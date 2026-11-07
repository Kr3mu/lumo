-- Errors raised by Lumo are tables, so callers can branch on `err.code` (a MariaDB error number, or a Lumo
-- code string such as 'NO_SESSION') instead of matching message text.
local Errors = {}

local LumoError = {}
LumoError.__index = LumoError

function LumoError.__tostring(err)
    local where = err.sql and (' | ' .. err.sql) or ''
    return ('[lumo] %s (%s)%s'):format(err.message or 'query failed', tostring(err.code), where)
end

---@param err table { code, state, message, sql } as the driver returns it
---@return table
function Errors.wrap(err)
    err.resource = err.resource or GetCurrentResourceName()
    return setmetatable(err, LumoError)
end

---@param code string
---@param message string
function Errors.raise(code, message)
    error(Errors.wrap({ code = code, message = message }), 0)
end

function Errors.is(value)
    return getmetatable(value) == LumoError
end

return Errors
