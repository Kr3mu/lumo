-- Lumo: the Database module. One file, two ways to load it:
--   with ox_lib's require:   local Database = require '@lumo'      (or require 'lib.lumo' inside a monorepo)
--   with no dependencies:    server_script '@lumo/init.lua'        (or 'lib/lumo/init.lua'), then use Database
-- FiveM has no built-in require, so the second way is the manifest include FiveM supports natively.
-- Either way this file runs inside the resource that loads it. It finds its own resource and folder from its
-- chunk name ('@@lumo/init.lua', '@@core/lib/lumo/init.lua'), which is the same in both modes, and loads its
-- other parts with LoadResourceFile, so nothing past this file needs require.
-- require passes the module name; FiveM runs a manifest script with a number as its argument.
local requiredAs = ...
if type(requiredAs) ~= 'string' then requiredAs = nil end
local resource, folder = debug.getinfo(1, 'S').source:match('^@@([^/]+)/(.-)init%.lua$')
if not resource then
    local name = requiredAs or '@lumo'
    local path
    resource, path = name:match('^@([^%.]+)%.?(.*)$')
    if not resource then resource, path = GetCurrentResourceName(), name end
    folder = path ~= '' and (path:gsub('%.', '/') .. '/') or ''
end

local function part(file)
    local file_path = folder .. 'lua/' .. file .. '.lua'
    local source = LoadResourceFile(resource, file_path)
    if not source then error(('lumo: cannot read %s from resource %s'):format(file_path, resource), 2) end
    return assert(load(source, ('@@%s/%s'):format(resource, file_path), 't', _ENV))()
end

local Errors = part('errors')
local Context = part('context')
local Sql = part('sql')(Errors)
local Bridge = part('bridge')(Errors, resource)
local Query = part('query')(Bridge, Context, Errors)
local Strict = part('strict')(Errors, Bridge, Sql)
local Table = part('table')(Errors, Query, Sql, Strict)

local Database = {}

local RUN, ONE, VALUE, ALL = Query.RUN, Query.ONE, Query.VALUE, Query.ALL
local pack, unpack = table.pack, table.unpack
local pcall, error = pcall, error

Database.null = Sql.NULL
Database.all_rows = Sql.ALL_ROWS
Database.Error = Errors.codes

---@param name string table name
---@param options { key?: string, strict?: boolean } | nil primary key column (default 'id'); strict overrides lumo_strict
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

-- Pins a checked-out connection to this thread until close. The bridge also reclaims it after
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

---@return true once the bridge has its first connection
function Database.ready()
    return Bridge.call('ready')
end

-- Included from a manifest there is no require to hand the module to, so it becomes this resource's
-- `Database`. Each resource has its own Lua state, so this never reaches another resource.
if not requiredAs then _ENV.Database = Database end

return Database
