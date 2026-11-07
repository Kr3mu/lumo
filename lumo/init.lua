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
local Define = part('define')(Errors, Bridge, Sql, Table, part('typegen'), part('columns')(Errors, Sql))

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

-- Declares a table in code: created if missing, typed for the editor in this resource's lumo.d.lua.
---@param name string table name
---@param columns table<string, string> column = shorthand: { id = 'id', owner = 'string(60) unique', note = 'string(100)?' }
---@param options { key?: string, strict?: boolean, primary?: string[], indexes?: (string | string[])[], unique?: (string | string[])[] } | nil
function Database.define(name, columns, options)
    return Define.define(name, columns, options)
end

---@param sql string raw SQL with ? placeholders
---@return table | nil first row
function Database.one(sql, ...)
    Define.wait()
    return Query.send(ONE, sql, Sql.pack(...))
end

---@return table[] rows
function Database.all(sql, ...)
    Define.wait()
    return Query.send(ALL, sql, Sql.pack(...))
end

---@return any first column of the first row
function Database.value(sql, ...)
    Define.wait()
    return Query.send(VALUE, sql, Sql.pack(...))
end

---@return integer | nil affected, integer | nil insertId
function Database.exec(sql, ...)
    Define.wait()
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

local eachShapes = { all = ALL, one = ONE, value = VALUE, exec = RUN }

-- One statement run once per parameter set, in a single call: the bridge pipelines the sets over a few connections.
---@param sql string raw SQL with ? placeholders
---@param sets any[][] one params array per run, e.g. { { 'license:a' }, { 'license:b' } }
---@param shape 'all' | 'one' | 'value' | 'exec' | nil what each run returns, like the matching Database call (default 'all')
---@return any[] one result per set, in order; for 'exec' each is { affected, insertId }
function Database.each(sql, sets, shape)
    Define.wait()
    local id = eachShapes[shape or 'all']
    if not id then
        Errors.raise(Errors.codes.BAD_ARGUMENT, ("Database.each: shape must be 'all', 'one', 'value' or 'exec', got %s"):format(tostring(shape)))
    end
    if type(sets) ~= 'table' then
        Errors.raise(Errors.codes.BAD_ARGUMENT, 'Database.each needs a list of parameter sets')
    end
    if #sets == 0 then return {} end
    return Query.each(id, sql, Sql.sets(sets))
end

---@return true once the bridge has its first connection
function Database.ready()
    Define.wait()
    return Bridge.call('ready')
end

-- Included from a manifest there is no require to hand the module to, so it becomes this resource's
-- `Database`. Each resource has its own Lua state, so this never reaches another resource.
-- The casts point the editor at types/lumo.lua and types/schema.lua instead of this file's untyped table.
if not requiredAs then _ENV.Database = Database --[[@as Lumo.Database]] end

return Database --[[@as Lumo.Database]]
