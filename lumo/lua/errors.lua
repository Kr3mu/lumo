-- Errors raised by Lumo are tables, so callers can branch on `err.code` instead of matching message text:
-- `if err.code == Database.Error.DUPLICATE_ENTRY then`. MariaDB errors carry the server's error number;
-- Lumo's own errors carry a string code. `err.name` is the enum name for either, when there is one.
local Errors = {}

---@enum LumoErrorCode
Errors.codes = {
    -- MariaDB error numbers
    BAD_FIELD = 1054,             -- a column name in a where or row table does not exist
    PARSE_ERROR = 1064,           -- invalid SQL in a raw query
    NO_SUCH_TABLE = 1146,         -- the table does not exist (a missing migration)
    BAD_NULL = 1048,              -- NULL written to a NOT NULL column
    DATA_TOO_LONG = 1406,         -- a string longer than its column
    DUPLICATE_ENTRY = 1062,       -- a UNIQUE or PRIMARY KEY already has this value
    ROW_IS_REFERENCED = 1451,     -- deleting or changing a row another table's foreign key points at
    NO_REFERENCED_ROW = 1452,     -- a foreign key points at a row that does not exist
    LOCK_WAIT_TIMEOUT = 1205,     -- a row stayed locked longer than innodb_lock_wait_timeout
    DEADLOCK = 1213,              -- two transactions locked rows in opposite order; retry the transaction

    -- Lumo's own codes
    NOT_STARTED = 'NOT_STARTED',          -- the resource running the bridge is not started
    BAD_ARGUMENT = 'BAD_ARGUMENT',        -- the bridge received an argument of the wrong type
    BAD_IDENTIFIER = 'BAD_IDENTIFIER',    -- a table or column name with characters other than [A-Za-z0-9_]
    BAD_ORDER_BY = 'BAD_ORDER_BY',        -- orderBy is not "column [ASC|DESC], ..."
    BAD_UPSERT = 'BAD_UPSERT',            -- upsert without { update = { ...columns } }
    EMPTY_WHERE = 'EMPTY_WHERE',          -- a where table with no columns, or updateWhere/deleteWhere without one
    READ_IN_BATCH = 'READ_IN_BATCH',      -- a read inside Database.batch
    NO_SESSION = 'NO_SESSION',            -- a session id the bridge does not know
    SESSION_EXPIRED = 'SESSION_EXPIRED',  -- a session or transaction held past lumo_checkout_timeout_ms
}

local names = {}
for name, code in pairs(Errors.codes) do names[code] = name end

local LumoError = {}
LumoError.__index = LumoError

function LumoError.__tostring(err)
    local where = err.sql and (' | ' .. err.sql) or ''
    local code = err.name and ('%s %s'):format(err.name, tostring(err.code)) or tostring(err.code)
    return ('[lumo] %s (%s)%s'):format(err.message or 'query failed', code, where)
end

---@param err table { code, state, message, sql } as the bridge returns it
---@return table
function Errors.wrap(err)
    err.resource = err.resource or GetCurrentResourceName()
    err.name = names[err.code]
    return setmetatable(err, LumoError)
end

---@param code LumoErrorCode
---@param message string
function Errors.raise(code, message)
    error(Errors.wrap({ code = code, message = message }), 0)
end

function Errors.is(value)
    return getmetatable(value) == LumoError
end

return Errors
