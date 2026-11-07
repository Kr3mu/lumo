-- Lumo: the Database module, loaded with ox_lib's require. Two layouts work:
--   its own resource:   local Database = require '@lumo'        -- driver runs in the lumo resource
--   inside a monorepo:  local Database = require 'lib.lumo'     -- driver runs in this same resource
-- require passes the module name as `...`; it locates the sibling files and the resource hosting the driver.
local base = ... or '@lumo'
local host = base:match('^@([^%.]+)') or GetCurrentResourceName()

local function load(name)
    return require(base .. '.lua.' .. name)
end

local Errors = load('errors')
local Context = load('context')
local Sql = load('sql')(Errors)
local Bridge = load('bridge')(Errors, host)
local Query = load('query')(Bridge, Context, Errors)
local Table = load('table')(Errors, Query, Sql)

local Database = {}

local RUN, ONE, VALUE, ALL = Query.RUN, Query.ONE, Query.VALUE, Query.ALL
local pack, unpack = table.pack, table.unpack
local pcall, error = pcall, error

Database.null = Sql.NULL
Database.all_rows = Sql.ALL_ROWS

---@param name string table name
---@param options { key?: string } | nil primary key column, default 'id'
function Database.table(name, options)
    return Table.get_table(name, options)
end

---@param sql string raw SQL with ? placeholders
---@return table | nil first row
function Database.one(sql, ...)
    return Query.send(ONE, sql, Sql.pack(...))
end

---@return table[] rows
function Database.all(sql, ...)
    return Query.send(ALL, sql, Sql.pack(...))
end

---@return any first column of the first row
function Database.value(sql, ...)
    return Query.send(VALUE, sql, Sql.pack(...))
end

---@return integer | nil affected, integer | nil insertId
function Database.exec(sql, ...)
    return Query.send(RUN, sql, Sql.pack(...))
end

-- Pins a checked-out connection to this thread until close. The driver also reclaims it after
-- lumo_checkout_timeout_ms, or when this resource stops, so a thread that never resumes can't leak it.
local Session = {}
Session.__index = Session

local function open()
    local scope = { session = Bridge.call('checkout') }
    Context.push(scope)
    return scope
end

local function close(scope, mode)
    Context.pop(scope)
    return Bridge.call('release', scope.session, mode)
end

function Session:close()
    if self.closed then return end
    self.closed = true
    close(self.scope, 0)
end

Session.__close = Session.close

---@return table session use with `local session <close> = Database.session()`
function Database.session()
    return setmetatable({ scope = open() }, Session)
end

---@param fn function runs on one connection inside START TRANSACTION
---@return any fn's return values
function Database.transaction(fn, ...)
    local current = Context.current()
    if current and current.session and current.transaction then
        return fn(...)
    end

    local scope = open()
    scope.transaction = true
    local ok, err = pcall(Bridge.call, 'exec', RUN, 'START TRANSACTION', nil, scope.session)
    if not ok then
        pcall(close, scope, 2)
        error(err, 0)
    end

    local results = pack(pcall(fn, ...))
    if not results[1] then
        pcall(close, scope, 2)
        error(results[2], 0)
    end

    close(scope, 1)
    return unpack(results, 2, results.n)
end

---@param fn function its writes are collected, then sent as one transaction in one call
---@return true
function Database.batch(fn)
    local scope = { batch = {} }
    Context.push(scope)
    local ok, err = pcall(fn)
    Context.pop(scope)
    if not ok then error(err, 0) end

    if #scope.batch == 0 then return true end
    return Bridge.call('batch', scope.batch)
end

---@param fn function runs in a new thread
---@return table promise resolved with fn's first return value
function Database.async(fn, ...)
    local p = promise.new()
    local args = pack(...)
    CreateThread(function()
        local ok, result = pcall(fn, unpack(args, 1, args.n))
        if ok then p:resolve(result) else p:reject(result) end
    end)
    return p
end

---@return true once the driver has its first connection
function Database.ready()
    return Bridge.call('ready')
end

return Database
