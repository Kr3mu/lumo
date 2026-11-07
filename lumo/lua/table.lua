-- Table repositories: Players:find({ license = l }), Players:increment(id, { money = 500 }), ...
-- Each method builds its SQL once per call shape (method, columns, options) and caches it on the table object.
return function(Errors, Query, Sql, Strict)
    local Table = {}
    Table.__index = Table

    local concat = table.concat
    local type = type

    local RUN, ONE, VALUE, ALL = Query.RUN, Query.ONE, Query.VALUE, Query.ALL

    local tables = {}

    ---@param name string
    ---@param options { key?: string, strict?: boolean } | nil
    ---@return table
    function Table.get_table(name, options)
        local key = options and options.key or 'id'
        local strict = Strict.enabled
        if options and options.strict ~= nil then strict = options.strict end

        local id = name .. '|' .. key .. (strict and '|strict' or '')
        local repo = tables[id]
        if repo then return repo end

        repo = setmetatable({
            name = name,
            quoted = Sql.ident(name),
            keyName = key,
            key = Sql.ident(key),
            strict = strict,
            cache = {},
        }, Table)
        tables[id] = repo
        return repo
    end

    local function cached(self, key, build)
        local sql = self.cache[key]
        if not sql then
            sql = build()
            self.cache[key] = sql
        end
        return sql
    end

    local function selectPart(options)
        local columns = options and options.columns
        return Sql.select(columns), columns and concat(columns, ',') or '*'
    end

    local function checkRead(self, where, options)
        if where then Strict.where(self, where) end
        if options then
            Strict.names(self, options.columns)
            Strict.orderBy(self, options.orderBy)
        end
    end

    local function suffix(options)
        local orderBy = options and options.orderBy
        local lock = options and options.lock
        return (orderBy and Sql.orderBy(orderBy) or ''), (orderBy or '') .. (lock and '|lock' or '')
    end

    ---@param key any primary key value
    ---@param options { columns?: string[], lock?: boolean } | nil
    function Table:get(key, options)
        if self.strict then
            Strict.key(self, key)
            checkRead(self, nil, options)
        end
        local cols, colsKey = selectPart(options)
        local lock = options and options.lock
        local sql = cached(self, 'get|' .. colsKey .. (lock and '|lock' or ''), function()
            return 'SELECT ' .. cols .. ' FROM ' .. self.quoted .. ' WHERE ' .. self.key .. ' = ? LIMIT 1' .. (lock and ' FOR UPDATE' or '')
        end)
        return Query.send(ONE, sql, { key })
    end

    ---@param where table
    ---@param options { columns?: string[], orderBy?: string, lock?: boolean } | nil
    function Table:find(where, options)
        if self.strict then checkRead(self, where, options) end
        local params = {}
        local clause, whereKey = Sql.where(where, params)
        local cols, colsKey = selectPart(options)
        local order, orderKey = suffix(options)
        local lock = options and options.lock
        local sql = cached(self, 'find|' .. whereKey .. '|' .. colsKey .. '|' .. orderKey, function()
            return 'SELECT ' .. cols .. ' FROM ' .. self.quoted .. ' WHERE ' .. clause .. order .. ' LIMIT 1' .. (lock and ' FOR UPDATE' or '')
        end)
        return Query.send(ONE, sql, params)
    end

    ---@param options { where?: table, columns?: string[], orderBy?: string, limit?: integer, offset?: integer } | nil
    function Table:list(options)
        if self.strict then checkRead(self, options and options.where, options) end
        local params = {}
        local clause, whereKey = '', ''
        if options and options.where then
            clause, whereKey = Sql.where(options.where, params)
            clause = ' WHERE ' .. clause
        end

        local cols, colsKey = selectPart(options)
        local order, orderKey = suffix(options)
        local limit = options and options.limit
        local offset = options and options.offset
        if limit then params[#params + 1] = limit end
        if offset then params[#params + 1] = offset end

        local sql = cached(self, 'list|' .. whereKey .. '|' .. colsKey .. '|' .. orderKey .. (limit and '|l' or '') .. (offset and '|o' or ''), function()
            return 'SELECT ' .. cols .. ' FROM ' .. self.quoted .. clause .. order
                .. (limit and ' LIMIT ?' or (offset and ' LIMIT 18446744073709551615' or '')) .. (offset and ' OFFSET ?' or '')
        end)
        return Query.send(ALL, sql, params)
    end

    ---@param where table | nil
    ---@return integer
    function Table:count(where)
        if self.strict then checkRead(self, where) end
        local params = {}
        local clause, whereKey = '', ''
        if where then
            clause, whereKey = Sql.where(where, params)
            clause = ' WHERE ' .. clause
        end
        local sql = cached(self, 'count|' .. whereKey, function()
            return 'SELECT COUNT(*) FROM ' .. self.quoted .. clause
        end)
        return Query.send(VALUE, sql, params)
    end

    ---@param where table
    ---@return boolean
    function Table:exists(where)
        if self.strict then checkRead(self, where) end
        local params = {}
        local clause, whereKey = Sql.where(where, params)
        local sql = cached(self, 'exists|' .. whereKey, function()
            return 'SELECT 1 FROM ' .. self.quoted .. ' WHERE ' .. clause .. ' LIMIT 1'
        end)
        return Query.send(VALUE, sql, params) ~= nil
    end

    local function rowValues(row, columns, params)
        for i = 1, #columns do params[#params + 1] = Sql.param(row[columns[i]]) end
    end

    local function quotedList(columns)
        local names = {}
        for i = 1, #columns do names[i] = Sql.ident(columns[i]) end
        return concat(names, ', ')
    end

    local function marks(count)
        return '(' .. ('?, '):rep(count - 1) .. '?)'
    end

    ---@param row table
    ---@return integer | nil insert id
    function Table:insert(row)
        if self.strict then Strict.row(self, row) end
        local columns, key = Sql.columns(row)
        local params = {}
        rowValues(row, columns, params)
        local sql = cached(self, 'insert|' .. key, function()
            return 'INSERT INTO ' .. self.quoted .. ' (' .. quotedList(columns) .. ') VALUES ' .. marks(#columns)
        end)
        local _, insertId = Query.send(RUN, sql, params)
        return insertId
    end

    -- One multi-row INSERT. Every row uses the first row's columns; a row missing one inserts NULL there.
    ---@param rows table[]
    ---@return integer | nil affected rows
    function Table:insertMany(rows)
        local count = #rows
        if count == 0 then return 0 end
        if self.strict then
            for i = 1, count do Strict.row(self, rows[i]) end
        end

        local columns, key = Sql.columns(rows[1])
        local params = {}
        for i = 1, count do rowValues(rows[i], columns, params) end

        local head = cached(self, 'insertMany|' .. key, function()
            return 'INSERT INTO ' .. self.quoted .. ' (' .. quotedList(columns) .. ') VALUES '
        end)
        local one = marks(#columns)
        local sql = head .. (one .. ', '):rep(count - 1) .. one
        return (Query.send(RUN, sql, params))
    end

    local function setClause(changes, params, template)
        local columns, key = Sql.columns(changes)
        local parts = {}
        for i = 1, #columns do
            local name = Sql.ident(columns[i])
            parts[i] = template:gsub('{c}', name)
            params[#params + 1] = Sql.param(changes[columns[i]])
        end
        return concat(parts, ', '), key
    end

    ---@param key any primary key value
    ---@param changes table
    ---@return integer | nil affected rows
    function Table:update(key, changes)
        if self.strict then
            Strict.key(self, key)
            Strict.row(self, changes)
        end
        local params = {}
        local set, setKey = setClause(changes, params, '{c} = ?')
        params[#params + 1] = key
        local sql = cached(self, 'update|' .. setKey, function()
            return 'UPDATE ' .. self.quoted .. ' SET ' .. set .. ' WHERE ' .. self.key .. ' = ?'
        end)
        return (Query.send(RUN, sql, params))
    end

    ---@param key any primary key value
    ---@param deltas table column = amount to add (negative to subtract)
    ---@return integer | nil affected rows
    function Table:increment(key, deltas)
        if self.strict then
            Strict.key(self, key)
            Strict.deltas(self, deltas)
        end
        local params = {}
        local set, setKey = setClause(deltas, params, '{c} = {c} + ?')
        params[#params + 1] = key
        local sql = cached(self, 'increment|' .. setKey, function()
            return 'UPDATE ' .. self.quoted .. ' SET ' .. set .. ' WHERE ' .. self.key .. ' = ?'
        end)
        return (Query.send(RUN, sql, params))
    end

    -- A filter that can reach every row must be said out loud: an empty where table raises, Database.all_rows passes.
    local function writeFilter(where, params)
        if where == Sql.ALL_ROWS then return '', 'all' end
        if type(where) ~= 'table' or next(where) == nil then
            Errors.raise(Errors.codes.EMPTY_WHERE, 'updateWhere/deleteWhere need a where table; pass Database.all_rows to touch every row')
        end
        local clause, key = Sql.where(where, params)
        return ' WHERE ' .. clause, key
    end

    ---@param where table
    ---@param changes table
    ---@return integer | nil affected rows
    function Table:updateWhere(where, changes)
        if self.strict then
            Strict.row(self, changes)
            Strict.where(self, where)
        end
        local params = {}
        local set, setKey = setClause(changes, params, '{c} = ?')
        local clause, whereKey = writeFilter(where, params)
        local sql = cached(self, 'updateWhere|' .. setKey .. '|' .. whereKey, function()
            return 'UPDATE ' .. self.quoted .. ' SET ' .. set .. clause
        end)
        return (Query.send(RUN, sql, params))
    end

    ---@param row table
    ---@param options { update: string[] }
    ---@return integer | nil affected rows
    function Table:upsert(row, options)
        local update = options and options.update
        if not update or #update == 0 then
            Errors.raise(Errors.codes.BAD_UPSERT, 'upsert needs { update = { ...columns } }: the columns to change when the row exists')
        end

        if self.strict then
            Strict.row(self, row)
            Strict.names(self, update)
        end

        local columns, key = Sql.columns(row)
        local params = {}
        rowValues(row, columns, params)
        local sql = cached(self, 'upsert|' .. key .. '|' .. concat(update, ','), function()
            local sets = {}
            for i = 1, #update do
                local name = Sql.ident(update[i])
                sets[i] = name .. ' = VALUES(' .. name .. ')'
            end
            return 'INSERT INTO ' .. self.quoted .. ' (' .. quotedList(columns) .. ') VALUES ' .. marks(#columns)
                .. ' ON DUPLICATE KEY UPDATE ' .. concat(sets, ', ')
        end)
        return (Query.send(RUN, sql, params))
    end

    ---@param key any primary key value
    ---@return integer | nil affected rows
    function Table:delete(key)
        if self.strict then Strict.key(self, key) end
        local sql = cached(self, 'delete', function()
            return 'DELETE FROM ' .. self.quoted .. ' WHERE ' .. self.key .. ' = ?'
        end)
        return (Query.send(RUN, sql, { key }))
    end

    ---@param where table
    ---@return integer | nil affected rows
    function Table:deleteWhere(where)
        if self.strict then Strict.where(self, where) end
        local params = {}
        local clause, whereKey = writeFilter(where, params)
        local sql = cached(self, 'deleteWhere|' .. whereKey, function()
            return 'DELETE FROM ' .. self.quoted .. clause
        end)
        return (Query.send(RUN, sql, params))
    end

    return Table
end
