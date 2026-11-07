-- Strict mode: a table's columns are read from information_schema once, on its first call, and every call is
-- checked against them before anything reaches MariaDB, so a typo or a wrong type fails with the column's name
-- instead of a generic 1054 or a silent conversion. Off with `set lumo_strict false` or { strict = false }.
return function(Errors, Bridge, Sql)
    local Strict = {}
    Strict.enabled = GetConvar('lumo_strict', 'true') ~= 'false'

    local type, pairs, tostring = type, pairs, tostring
    local mathType, min = math.type, math.min
    local NULL = Sql.NULL
    local UNKNOWN_COLUMN, BAD_TYPE = Errors.codes.UNKNOWN_COLUMN, Errors.codes.BAD_TYPE

    local KINDS = {
        tinyint = 'integer', smallint = 'integer', mediumint = 'integer', int = 'integer', bigint = 'integer',
        year = 'integer', bit = 'integer',
        decimal = 'decimal', float = 'number', double = 'number',
        char = 'string', varchar = 'string', tinytext = 'string', text = 'string', mediumtext = 'string',
        longtext = 'string', enum = 'string', set = 'string', json = 'string', uuid = 'string',
        inet4 = 'string', inet6 = 'string',
        binary = 'string', varbinary = 'string', tinyblob = 'string', blob = 'string', mediumblob = 'string',
        longblob = 'string',
        date = 'string', datetime = 'string', timestamp = 'string', time = 'string',
    }

    -- Floats with no fraction pass for integer columns: JSON and msgpack hand Lua 5.0 for 5.
    local accepts = {
        integer = function(v, column)
            local t = type(v)
            if t == 'number' then return mathType(v) == 'integer' or v % 1 == 0 end
            return t == 'boolean' and column.flag
        end,
        number = function(v) return type(v) == 'number' end,
        decimal = function(v) local t = type(v) return t == 'number' or t == 'string' end,
        string = function(v) return type(v) == 'string' end,
    }

    local SCHEMA = 'SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS'
        .. ' WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'

    -- Straight to the pool, never through the caller's batch or session: a batch can't read, and the schema
    -- read should not join the caller's transaction.
    local function columns(repo)
        local known = repo.columns
        if known then return known end

        local rows = Bridge.call('exec', 3, SCHEMA, { repo.name })
        if #rows == 0 then
            Errors.raise(Errors.codes.NO_SUCH_TABLE, ('table %s does not exist in the current database'):format(repo.name))
        end

        known = {}
        for i = 1, #rows do
            local row = rows[i]
            local columnType = row.COLUMN_TYPE
            known[row.COLUMN_NAME] = {
                name = row.COLUMN_NAME,
                kind = KINDS[row.DATA_TYPE],
                type = columnType,
                nullable = row.IS_NULLABLE == 'YES',
                flag = columnType == 'tinyint(1)' or columnType == 'bit(1)',
            }
        end
        repo.columns = known
        return known
    end

    local function distance(a, b)
        local previous = {}
        for j = 0, #b do previous[j] = j end
        for i = 1, #a do
            local current = { [0] = i }
            local byte = a:byte(i)
            for j = 1, #b do
                current[j] = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (byte == b:byte(j) and 0 or 1))
            end
            previous = current
        end
        return previous[#b]
    end

    local function closest(known, name)
        local best, bestDistance = nil, 3
        for candidate in pairs(known) do
            local d = distance(name, candidate)
            if d < bestDistance then best, bestDistance = candidate, d end
        end
        return best
    end

    local function column(repo, known, name)
        local found = known[name]
        if found then return found end

        Sql.ident(name)
        local hint = closest(known, name)
        Errors.raise(UNKNOWN_COLUMN, ('%s.%s does not exist%s'):format(repo.name, name, hint and (' (did you mean %s?)'):format(hint) or ''))
    end

    local function describe(v)
        local t = type(v)
        if t == 'number' then return 'number ' .. tostring(v) end
        return t
    end

    local function value(repo, col, v, nullOk)
        if v == NULL then
            if nullOk or col.nullable then return end
            Errors.raise(BAD_TYPE, ('%s.%s is NOT NULL'):format(repo.name, col.name))
        end

        local kind = col.kind
        if not kind or accepts[kind](v, col) then return end
        Errors.raise(BAD_TYPE, ('%s.%s is %s, got %s'):format(repo.name, col.name, col.type, describe(v)))
    end

    ---@param where table | nil equality table; arrays are checked element by element, Database.null always passes
    function Strict.where(repo, where)
        if type(where) ~= 'table' or where == Sql.ALL_ROWS then return end
        local known = columns(repo)
        for name, v in pairs(where) do
            local col = column(repo, known, name)
            if type(v) == 'table' and v ~= NULL then
                for i = 1, #v do value(repo, col, v[i], true) end
            else
                value(repo, col, v, true)
            end
        end
    end

    ---@param row table values for insert, update or upsert
    function Strict.row(repo, row)
        local known = columns(repo)
        for name, v in pairs(row) do value(repo, column(repo, known, name), v, false) end
    end

    ---@param deltas table column = amount for increment
    function Strict.deltas(repo, deltas)
        local known = columns(repo)
        for name, v in pairs(deltas) do
            local col = column(repo, known, name)
            local kind = col.kind
            if kind ~= 'integer' and kind ~= 'number' and kind ~= 'decimal' then
                Errors.raise(BAD_TYPE, ('%s.%s is %s; increment needs a numeric column'):format(repo.name, col.name, col.type))
            end
            if type(v) ~= 'number' then
                Errors.raise(BAD_TYPE, ('increment of %s.%s needs a number, got %s'):format(repo.name, col.name, describe(v)))
            end
            value(repo, col, v, false)
        end
    end

    function Strict.key(repo, v)
        local known = columns(repo)
        value(repo, column(repo, known, repo.keyName), v, false)
    end

    ---@param list string[] | nil column names: the columns option, upsert's update list
    function Strict.names(repo, list)
        if not list then return end
        local known = columns(repo)
        for i = 1, #list do column(repo, known, list[i]) end
    end

    function Strict.orderBy(repo, orderBy)
        if not orderBy then return end
        local known = columns(repo)
        for part in orderBy:gmatch('[^,]+') do
            local name = part:match('^%s*([%w_]+)')
            if name then column(repo, known, name) end
        end
    end

    return Strict
end
