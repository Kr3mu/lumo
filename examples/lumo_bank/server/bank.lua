-- Bank accounts: one row per player license in bank_accounts, every movement of money logged in bank_transactions.
-- Game rules (not enough money, frozen account) raise { code, message } tables, the same shape as Lumo's own errors.
---@type Lumo.Database
local Database = require '@lumo'

local Accounts = Database.define('bank_accounts', {
    id         = 'id',
    owner      = 'string(60) unique',
    balance    = 'int = 0',
    frozen     = 'bool = false',
    created_at = 'datetime = now',
})

local Transactions = Database.define('bank_transactions', {
    id         = 'id',
    account_id = 'uint -> bank_accounts.id cascade',
    amount     = 'int',
    kind       = 'enum(deposit, withdraw, transfer_in, transfer_out, interest)',
    note       = 'string(100)?',
    created_at = 'datetime = now',
})

local Bank = {}

Bank.MAX_AMOUNT = 10000000

---@param value any
---@return boolean
function Bank.isAmount(value)
    return math.type(value) == 'integer' and value > 0 and value <= Bank.MAX_AMOUNT
end

-- Always raises; typed `any` so `return refuse(...)` fits any function and narrows what follows.
---@return any
local function refuse(code, message)
    error({ code = code, message = message }, 0)
end

---@param owner string player license
---@return Lumo.Row.bank_accounts
function Bank.open(owner)
    local account = Accounts:find({ owner = owner })
    if account then return account end

    -- Two joins at once can both miss the find; the loser's insert hits the UNIQUE key, which is fine.
    local ok, err = pcall(Accounts.insert, Accounts, { owner = owner })
    if not ok and err.code ~= Database.Error.DUPLICATE_ENTRY then error(err, 0) end

    return Accounts:find({ owner = owner }) --[[@as Lumo.Row.bank_accounts]]
end

---@param accountId integer
---@return integer
function Bank.balance(accountId)
    local account = Accounts:get(accountId, { columns = { 'balance' } })
    if not account then return refuse('NO_ACCOUNT', 'no such account') end
    return account.balance
end

-- Every write is known up front, so one batch: both statements in one round trip, one transaction.
---@param accountId integer
---@param amount integer
---@param note? string
function Bank.deposit(accountId, amount, note)
    Database.batch(function()
        Accounts:increment(accountId, { balance = amount })
        Transactions:insert({ account_id = accountId, amount = amount, kind = 'deposit', note = note })
    end)
end

-- The balance decides whether the write happens, so this needs a transaction holding the row lock.
---@param accountId integer
---@param amount integer
---@param note? string
---@return integer balance after the withdrawal
function Bank.withdraw(accountId, amount, note)
    return Database.transaction(function()
        local account = Accounts:get(accountId, { lock = true })
        if not account then return refuse('NO_ACCOUNT', 'no such account') end
        if account.frozen == 1 then return refuse('FROZEN', 'the account is frozen') end
        if account.balance < amount then return refuse('NO_MONEY', 'not enough money') end

        Accounts:increment(accountId, { balance = -amount })
        Transactions:insert({ account_id = accountId, amount = -amount, kind = 'withdraw', note = note })
        return account.balance - amount
    end)
end

---@param fromId integer
---@param toId integer
---@param amount integer
---@param note? string
---@return integer balance of the sender afterwards
function Bank.transfer(fromId, toId, amount, note)
    if fromId == toId then return refuse('SAME_ACCOUNT', 'cannot transfer to the same account') end

    return Database.transaction(function()
        -- Lock in id order: two opposite transfers that each locked their own sender first would deadlock.
        local low = Accounts:get(math.min(fromId, toId), { lock = true })
        local high = Accounts:get(math.max(fromId, toId), { lock = true })
        local from, to = low, high
        if fromId > toId then from, to = high, low end

        if not from or not to then return refuse('NO_ACCOUNT', 'no such account') end
        if from.frozen == 1 or to.frozen == 1 then return refuse('FROZEN', 'one of the accounts is frozen') end
        if from.balance < amount then return refuse('NO_MONEY', 'not enough money') end

        Accounts:increment(fromId, { balance = -amount })
        Accounts:increment(toId, { balance = amount })
        Transactions:insertMany({
            { account_id = fromId, amount = -amount, kind = 'transfer_out', note = note },
            { account_id = toId, amount = amount, kind = 'transfer_in', note = note },
        })
        return from.balance - amount
    end)
end

---@param accountId integer
---@param count? integer
---@return Lumo.Row.bank_transactions[]
function Bank.statement(accountId, count)
    return Transactions:list({ where = { account_id = accountId }, orderBy = 'id DESC', limit = count or 10 })
end

-- Set-based work is plain SQL: one statement for every account instead of a read and a write per row.
---@param rate number e.g. 0.01 for 1%
---@return integer accounts paid
function Bank.payInterest(rate)
    local paid = Accounts:count({ frozen = 0 })
    Database.batch(function()
        Database.exec([[
            INSERT INTO bank_transactions (account_id, amount, kind)
            SELECT id, FLOOR(balance * ?), 'interest' FROM bank_accounts WHERE frozen = 0 AND balance >= 100
        ]], rate)
        Database.exec('UPDATE bank_accounts SET balance = balance + FLOOR(balance * ?) WHERE frozen = 0 AND balance >= 100', rate)
    end)
    return paid
end

---@param accountId integer
---@param frozen boolean
function Bank.setFrozen(accountId, frozen)
    Accounts:update(accountId, { frozen = frozen })
end

return Bank
