-- The column shorthand of Database.define, compiled to MariaDB column definitions:
--   'id'                               INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY
--   'string(100)?'                     VARCHAR(100) NULL
--   'int = 0'                          INT NOT NULL DEFAULT 0
--   'uint -> bank_accounts.id cascade' INT UNSIGNED NOT NULL, plus a foreign key that deletes with its parent
--   'datetime = now on update now'     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
--   'sql: POINT NOT NULL'              anything the shorthand doesn't cover, passed through as written
-- Columns are NOT NULL unless the type ends in `?`.
return function(Errors, Sql)
    local Columns = {}

    local BAD_ARGUMENT = Errors.codes.BAD_ARGUMENT
    local concat, sort = table.concat, table.sort

    local TYPES = {
        id = 'INT UNSIGNED', bigid = 'BIGINT UNSIGNED',
        int = 'INT', uint = 'INT UNSIGNED', bigint = 'BIGINT', ubigint = 'BIGINT UNSIGNED',
        tinyint = 'TINYINT', smallint = 'SMALLINT', bool = 'TINYINT(1)',
        float = 'FLOAT', double = 'DOUBLE', decimal = 'DECIMAL',
        string = 'VARCHAR', char = 'CHAR', text = 'TEXT', mediumtext = 'MEDIUMTEXT', longtext = 'LONGTEXT',
        json = 'JSON', blob = 'BLOB', uuid = 'UUID', enum = 'ENUM',
        date = 'DATE', datetime = 'DATETIME', timestamp = 'TIMESTAMP', time = 'TIME',
    }

    local function trim(s)
        return (s:gsub('^%s+', ''):gsub('%s+$', ''))
    end

    local function quote(value)
        return "'" .. value:gsub("'", "''") .. "'"
    end

    local function literal(value)
        if value == 'now' then return 'CURRENT_TIMESTAMP' end
        if value == 'null' then return 'NULL' end
        if value == 'true' then return '1' end
        if value == 'false' then return '0' end
        if tonumber(value) then return value end
        return quote(value:match("^'(.*)'$") or value)
    end

    local function enumValues(args)
        local values = {}
        for value in args:sub(2, -2):gmatch('[^,]+') do
            value = trim(value)
            values[#values + 1] = quote(value:match("^'(.*)'$") or value)
        end
        return '(' .. concat(values, ', ') .. ')'
    end

    ---@return { sql: string, primary: boolean, constraints: string[] }
    local function compile(tableName, name, spec)
        local function fail(why)
            Errors.raise(BAD_ARGUMENT, ('Database.define(%q): %s = %q: %s'):format(tableName, name, tostring(spec), why))
        end
        if type(spec) ~= 'string' then fail('a column is a string such as \'int\' or \'string(60)?\'') end

        local quoted = Sql.ident(name)
        if spec:sub(1, 4) == 'sql:' then
            local sql = trim(spec:sub(5))
            return { sql = sql, primary = sql:upper():find('PRIMARY KEY', 1, true) ~= nil, constraints = {} }
        end

        local typeName, args, nullable, rest = spec:match('^%s*(%a+)(%b())(%??)(.*)$')
        if not typeName then
            typeName, nullable, rest = spec:match('^%s*(%a+)(%??)(.*)$')
            args = ''
        end
        local sqlType = typeName and TYPES[typeName:lower()]
        if not sqlType then fail('unknown type; see the type list in the Defining tables docs') end
        typeName = typeName:lower()

        if typeName == 'enum' then
            if args == '' then fail('enum needs its values: enum(a, b, c)') end
            args = enumValues(args)
        elseif typeName == 'string' and args == '' then
            args = '(255)'
        end

        local parts = { sqlType .. args }
        local constraints = {}
        local primary = typeName == 'id' or typeName == 'bigid'
        if primary then
            parts[#parts + 1] = 'NOT NULL AUTO_INCREMENT PRIMARY KEY'
        else
            parts[#parts + 1] = nullable == '?' and 'NULL' or 'NOT NULL'
        end

        local reference
        rest = trim(rest)
        while rest ~= '' do
            local value, after = rest:match("^=%s*('[^']*')(.*)$")
            if not value then value, after = rest:match('^=%s*([^%s]+)(.*)$') end
            if value then
                parts[#parts + 1] = 'DEFAULT ' .. literal(value)
            else
                local parent, column
                parent, column, after = rest:match('^%->%s*([%w_]+)%.([%w_]+)(.*)$')
                if parent then
                    reference = ('FOREIGN KEY (%s) REFERENCES %s (%s)'):format(quoted, Sql.ident(parent), Sql.ident(column))
                    constraints[#constraints + 1] = reference
                else
                    after = rest:match('^on%s+update%s+now(.*)$')
                    if after then
                        parts[#parts + 1] = 'ON UPDATE CURRENT_TIMESTAMP'
                    else
                        local word
                        word, after = rest:match('^(%a+)(.*)$')
                        if word == 'unique' then
                            parts[#parts + 1] = 'UNIQUE'
                        elseif word == 'primary' then
                            parts[#parts + 1] = 'PRIMARY KEY'
                            primary = true
                        elseif word == 'index' then
                            constraints[#constraints + 1] = ('KEY (%s)'):format(quoted)
                        elseif (word == 'cascade' or word == 'nullify' or word == 'restrict') and reference then
                            local action = word == 'cascade' and 'CASCADE' or word == 'nullify' and 'SET NULL' or 'RESTRICT'
                            constraints[#constraints] = reference .. ' ON DELETE ' .. action
                        else
                            fail(('unknown option %q'):format(rest))
                        end
                    end
                end
            end
            rest = trim(after)
        end

        return { sql = concat(parts, ' '), columnType = parts[1], primary = primary, constraints = constraints }
    end

    local function keyList(names)
        if type(names) == 'string' then names = { names } end
        local quoted = {}
        for i = 1, #names do quoted[i] = Sql.ident(names[i]) end
        return '(' .. concat(quoted, ', ') .. ')'
    end

    -- Lua tables have no order, so the primary key comes first and the other columns follow by name.
    ---@param tableName string
    ---@param columns table<string, string>
    ---@param options { primary?: string[], indexes?: (string | string[])[], unique?: (string | string[])[] } | nil
    ---@return (string[] | string)[] { name, definition } entries followed by table constraints
    function Columns.compileTable(tableName, columns, options)
        if type(columns) ~= 'table' or next(columns) == nil then
            Errors.raise(BAD_ARGUMENT, ('Database.define(%q) needs its columns: { id = \'id\', name = \'string(50)\' }'):format(tostring(tableName)))
        end

        local compiled, names = {}, {}
        for name, spec in pairs(columns) do
            if type(name) ~= 'string' then
                Errors.raise(BAD_ARGUMENT, ('Database.define(%q): columns are name = \'type\' pairs'):format(tableName))
            end
            compiled[name] = compile(tableName, name, spec)
            names[#names + 1] = name
        end
        sort(names, function(a, b)
            if compiled[a].primary ~= compiled[b].primary then return compiled[a].primary end
            return a < b
        end)

        local entries, constraints = {}, {}
        for _, name in ipairs(names) do
            local column = compiled[name]
            entries[#entries + 1] = { name, column.sql, column.columnType }
            for _, constraint in ipairs(column.constraints) do constraints[#constraints + 1] = constraint end
        end

        if options then
            if options.primary then constraints[#constraints + 1] = 'PRIMARY KEY ' .. keyList(options.primary) end
            for _, index in ipairs(options.indexes or {}) do constraints[#constraints + 1] = 'KEY ' .. keyList(index) end
            for _, foreign in ipairs(options.foreign or {}) do
                constraints[#constraints + 1] = ('FOREIGN KEY %s REFERENCES `%s` %s%s'):format(
                    keyList(foreign.columns),
                    foreign.parent,
                    keyList(foreign.references),
                    foreign.action and (' ON DELETE ' .. foreign.action) or ''
                )
            end
            for _, index in ipairs(options.unique or {}) do constraints[#constraints + 1] = 'UNIQUE KEY ' .. keyList(index) end
        end

        for _, constraint in ipairs(constraints) do entries[#entries + 1] = constraint end
        return entries
    end

    return Columns
end
