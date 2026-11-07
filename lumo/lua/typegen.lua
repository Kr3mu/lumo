-- LuaLS types for tables declared with Database.define. LuaLS can't read a column type out of a string like
-- 'INT NOT NULL', so Lumo writes the types out: a row class, (exact) argument classes so a misspelled column is
-- flagged, and overloads that type Database.define / Database.table by table name.
local Typegen = {}

local concat, format = table.concat, string.format

local INTEGER = { tinyint = true, smallint = true, mediumint = true, int = true, integer = true, bigint = true, year = true, serial = true }
local DECIMAL = { decimal = true, dec = true, numeric = true }
local FLOAT = { float = true, double = true, real = true }
local STRING = {
    char = true, varchar = true, tinytext = true, text = true, mediumtext = true, longtext = true, enum = true,
    set = true, uuid = true, inet4 = true, inet6 = true, date = true, datetime = true, timestamp = true, time = true,
}
local BINARY = { binary = true, varbinary = true, tinyblob = true, blob = true, mediumblob = true, longblob = true }
local FLAG = { bool = true, boolean = true, ['tinyint(1)'] = true, ['bit(1)'] = true }

---@param name string
---@param definition string e.g. 'INT UNSIGNED NOT NULL DEFAULT 0'
local function parse(name, definition)
    local upper = definition:upper()
    local columnType = (definition:match('^%s*([%w_]+%b())') or definition:match('^%s*([%w_]+)') or ''):lower()
    local dataType = columnType:match('^[%w_]+') or ''
    local primary = upper:find('PRIMARY KEY', 1, true) ~= nil
    local generated = upper:find('GENERATED', 1, true) ~= nil or upper:find('%f[%w]AS%s*%(') ~= nil
    local nullable = not primary and not upper:find('NOT NULL', 1, true) and dataType ~= 'serial'
    local filled = upper:find('%f[%w]DEFAULT%f[%W]') or upper:find('AUTO_INCREMENT', 1, true) or dataType == 'serial'

    local values
    if dataType == 'enum' then
        values = {}
        for value in (definition:match('%b()') or ''):gmatch("'([^']*)'") do values[#values + 1] = "'" .. value .. "'" end
    end

    return {
        name = name,
        dataType = dataType,
        values = values,
        flag = FLAG[columnType] or FLAG[dataType] or false,
        primary = primary,
        generated = generated,
        nullable = nullable,
        required = not nullable and not filled and not generated,
    }
end

-- What a row field holds in Lua; matches the bridge's pool options (dates as strings, JSON parsed, numbers as numbers).
local function readType(c)
    if c.values and #c.values > 0 then return table.concat(c.values, ' | ') end
    if c.flag or INTEGER[c.dataType] then return 'integer' end
    if DECIMAL[c.dataType] or FLOAT[c.dataType] then return 'number' end
    if STRING[c.dataType] then return 'string' end
    if c.dataType == 'json' then return 'table' end
    return 'any'
end

-- What a call may pass; matches what strict mode accepts.
local function writeType(c)
    if c.values and #c.values > 0 then return table.concat(c.values, ' | ') end
    if c.flag then return 'integer | boolean' end
    if INTEGER[c.dataType] then return 'integer' end
    if DECIMAL[c.dataType] then return 'number | string' end
    if FLOAT[c.dataType] then return 'number' end
    if STRING[c.dataType] or BINARY[c.dataType] or c.dataType == 'json' then return 'string' end
    return 'any'
end

local function isNumeric(c)
    return INTEGER[c.dataType] or DECIMAL[c.dataType] or FLOAT[c.dataType]
end

local function columnsOf(columns)
    local list = {}
    for i = 1, #columns do
        local entry = columns[i]
        if type(entry) == 'table' then list[#list + 1] = parse(entry[1], entry[2]) end
    end
    return list
end

local METHODS = [[
---@class Lumo.Table.%s
local %s = {}

---@param key %s
---@param options? { columns?: %s, lock?: boolean }
---@return %s?
function %s:get(key, options) end

---@param where %s
---@param options? { columns?: %s, orderBy?: string, lock?: boolean }
---@return %s?
function %s:find(where, options) end

---@param options? { where?: %s, columns?: %s, orderBy?: string, limit?: integer, offset?: integer }
---@return %s[]
function %s:list(options) end

---@param where? %s
---@return integer
function %s:count(where) end

---@param where %s
---@return boolean
function %s:exists(where) end

---@param row %s
---@return integer? insertId
function %s:insert(row) end

---@param rows %s[]
---@return integer affected
function %s:insertMany(rows) end

---@param key %s
---@param changes %s
---@return integer affected
function %s:update(key, changes) end

---@param key %s
---@param deltas %s
---@return integer affected
function %s:increment(key, deltas) end

---@param where %s | Lumo.AllRows
---@param changes %s
---@return integer affected
function %s:updateWhere(where, changes) end

---@param row %s
---@param options { update: %s }
---@return integer affected
function %s:upsert(row, options) end

---@param key %s
---@return integer affected
function %s:delete(key) end

---@param where %s | Lumo.AllRows
---@return integer affected
function %s:deleteWhere(where) end
]]

local function tableTypes(name, columns)
    local list = columnsOf(columns)
    local lines = {}
    local function add(line) lines[#lines + 1] = line end
    local function class(kind) return ('Lumo.%s.%s'):format(kind, name) end

    add('---@class ' .. class('Row'))
    for _, c in ipairs(list) do add(format('---@field %s %s%s', c.name, readType(c), c.nullable and '?' or '')) end

    add('')
    add('---@class (exact) ' .. class('Where'))
    for _, c in ipairs(list) do
        local t = writeType(c)
        add(format('---@field %s? %s | (%s)[] | Lumo.Null', c.name, t, t))
    end

    add('')
    add('---@class (exact) ' .. class('Insert'))
    for _, c in ipairs(list) do
        if not c.generated then
            add(format('---@field %s%s %s%s', c.name, c.required and '' or '?', writeType(c), c.nullable and ' | Lumo.Null' or ''))
        end
    end

    add('')
    add('---@class (exact) ' .. class('Changes'))
    for _, c in ipairs(list) do
        if not c.generated then add(format('---@field %s? %s%s', c.name, writeType(c), c.nullable and ' | Lumo.Null' or '')) end
    end

    add('')
    add('---@class (exact) ' .. class('Deltas'))
    for _, c in ipairs(list) do
        if not c.generated and isNumeric(c) then add(format('---@field %s? number', c.name)) end
    end

    local names = {}
    for i, c in ipairs(list) do names[i] = "'" .. c.name .. "'" end
    add('')
    add(format('---@alias %s %s', class('Column'), #names > 0 and concat(names, ' | ') or 'string'))

    local keyType = 'any'
    for _, c in ipairs(list) do
        if c.primary then keyType = writeType(c) end
    end

    local var = 'Lumo_' .. name
    local row, where, cols = class('Row'), class('Where'), class('Column') .. '[]'
    add('')
    add(METHODS:format(
        name, var,
        keyType, cols, row, var,
        where, cols, row, var,
        where, cols, row, var,
        where, var,
        where, var,
        class('Insert'), var,
        class('Insert'), var,
        keyType, class('Changes'), var,
        keyType, class('Deltas'), var,
        where, class('Changes'), var,
        class('Insert'), cols, var,
        keyType, var,
        where, var
    ))
    return concat(lines, '\n')
end

---@param definitions { name: string, columns: table }[]
---@param resource string
---@return string
function Typegen.build(definitions, resource)
    local parts = {
        '---@meta',
        format('-- Written by Lumo from the Database.define calls in %s when it starts. Do not edit: edit the', resource),
        '-- definitions instead.',
        '',
    }
    local defines, tables = {}, {}
    for _, d in ipairs(definitions) do
        parts[#parts + 1] = tableTypes(d.name, d.columns)
        defines[#defines + 1] = format("---@overload fun(name: '%s', columns: Lumo.Columns, options?: Lumo.DefineOptions): Lumo.Table.%s", d.name, d.name)
        tables[#tables + 1] = format("---@overload fun(name: '%s', options?: Lumo.TableOptions): Lumo.Table.%s", d.name, d.name)
    end

    parts[#parts + 1] = '---@class Lumo.Database\nlocal Database = {}\n'
    parts[#parts + 1] = concat(defines, '\n') .. '\nfunction Database.define(name, columns, options) end\n'
    parts[#parts + 1] = concat(tables, '\n') .. '\nfunction Database.table(name, options) end\n'
    return concat(parts, '\n')
end

return Typegen
