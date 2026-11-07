-- Which connection the current thread's queries use. A transaction or session pins a checked-out connection
-- to the coroutine that opened it; a batch collects writes instead of sending them. Other threads keep using
-- the pool, so two event handlers never share a transaction by accident.
local Context = {}

-- Weak keys: a coroutine that dies without closing its scope does not keep its entry alive.
local stacks = setmetatable({}, { __mode = 'k' })
local running = coroutine.running

---@return table | nil  { session = number } or { batch = table }
function Context.current()
    local stack = stacks[running()]
    return stack and stack[#stack]
end

---@param scope table
function Context.push(scope)
    local co = running()
    local stack = stacks[co]
    if not stack then
        stack = {}
        stacks[co] = stack
    end
    stack[#stack + 1] = scope
end

---@param scope table the scope being closed; popping anything else means scopes were closed out of order
function Context.pop(scope)
    local stack = stacks[running()]
    assert(stack and stack[#stack] == scope, 'lumo: sessions and transactions must close in the order they opened')
    stack[#stack] = nil
end

return Context
