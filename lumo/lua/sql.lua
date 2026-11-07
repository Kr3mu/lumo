-- SQL building for table calls. Values are always bound as `?` parameters; only identifiers and the
-- shape of the statement end up in the SQL text, so the text depends on the call's shape alone and is cached.
---@param Errors table
return function(Errors)
    local Sql = {}

    local concat = table.concat
    local sort = table.sort
    local type = type
    local next = next

    -- Database.null is what callers write; NULL_PARAM is what crosses the bridge, since a Lua array cannot hold nil.
    Sql.NULL = setmetatable({}, { __tostring = function() return 'Database.null' end })
    Sql.ALL_ROWS = setmetatable({}, { __tostring = function() return 'Database.all_rows' end })
    local NULL_PARAM = { __lumo = 'null' }

    local quoted = {}

    ---@param name string
    ---@return string the identifier in backticks
    function Sql.ident(name)
        local q = quoted[name]
        if q then return q end

        if type(name) ~= 'string' or not name:match('^[%w_]+$') then
            Errors.raise('BAD_IDENTIFIER', ('column or table name %q may only contain letters, digits and _'):format(tostring(name)))
        end

        q = '`' .. name .. '`'
        quoted[name] = q
        return q
    end

    ---@param value any
    ---@return any the value as it crosses the bridge
    function Sql.param(value)
        if value == nil or value == Sql.NULL then return NULL_PARAM end
        return value
    end

    -- Values passed as varargs to raw SQL calls; select('#') keeps trailing and middle nils as NULL.
    function Sql.pack(...)
        local n = select('#', ...)
        if n == 0 then return nil end

        local params = {}
        for i = 1, n do params[i] = Sql.param((select(i, ...))) end
        return params
    end

    -- Column names of a table argument, sorted so { a = 1, b = 2 } and { b = 2, a = 1 } share one cached statement.
    ---@return string[] columns, string key
    function Sql.columns(map)
        local first = next(map)
        if first ~= nil and next(map, first) == nil then return { first }, first end

        local columns = {}
        for column in pairs(map) do columns[#columns + 1] = column end
        sort(columns)
        return columns, concat(columns, ',')
    end

    -- WHERE clause for an equality table. The cache key records each column's kind (value, NULL or list
    -- length), because those change the SQL text; the values themselves only change params.
    ---@param where table
    ---@param params any[] appended to
    ---@return string clause, string key
    function Sql.where(where, params)
        local columns = Sql.columns(where)
        if #columns == 0 then Errors.raise('EMPTY_WHERE', 'a where table needs at least one column') end

        local parts, keys = {}, {}
        for i = 1, #columns do
            local column = columns[i]
            local value = where[column]
            local name = Sql.ident(column)

            if value == Sql.NULL then
                parts[i] = name .. ' IS NULL'
                keys[i] = column .. ':n'
            elseif type(value) == 'table' then
                local count = #value
                if count == 0 then
                    parts[i] = '1 = 0'
                else
                    local marks = {}
                    for j = 1, count do
                        marks[j] = '?'
                        params[#params + 1] = Sql.param(value[j])
                    end
                    parts[i] = name .. ' IN (' .. concat(marks, ', ') .. ')'
                end
                keys[i] = column .. ':' .. count
            else
                parts[i] = name .. ' = ?'
                params[#params + 1] = value
                keys[i] = column
            end
        end

        return concat(parts, ' AND '), concat(keys, ',')
    end

    local directions = { [''] = '', asc = ' ASC', desc = ' DESC' }

    -- orderBy accepts only "column [ASC|DESC]" lists: it is code, never player input, and it can't carry SQL.
    ---@param orderBy string
    ---@return string
    function Sql.orderBy(orderBy)
        local parts = {}
        for part in orderBy:gmatch('[^,]+') do
            local column, direction = part:match('^%s*([%w_]+)%s*(%a*)%s*$')
            local suffix = direction and directions[direction:lower()]
            if not column or not suffix then
                Errors.raise('BAD_ORDER_BY', ('orderBy %q must be "column [ASC|DESC]" separated by commas'):format(orderBy))
            end
            parts[#parts + 1] = Sql.ident(column) .. suffix
        end
        return ' ORDER BY ' .. concat(parts, ', ')
    end

    ---@param columns string[] | nil
    ---@return string
    function Sql.select(columns)
        if not columns then return '*' end

        local names = {}
        for i = 1, #columns do names[i] = Sql.ident(columns[i]) end
        return concat(names, ', ')
    end

    return Sql
end
