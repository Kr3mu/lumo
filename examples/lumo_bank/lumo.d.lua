---@meta
-- Written by Lumo from the Database.define calls in lumo_bank when it starts. Do not edit: edit the
-- definitions instead.

---@class Lumo.Row.bank_accounts
---@field id integer
---@field balance integer
---@field created_at string
---@field frozen integer
---@field owner string

---@class (exact) Lumo.Where.bank_accounts
---@field id? integer | (integer)[] | Lumo.Null
---@field balance? integer | (integer)[] | Lumo.Null
---@field created_at? string | (string)[] | Lumo.Null
---@field frozen? integer | boolean | (integer | boolean)[] | Lumo.Null
---@field owner? string | (string)[] | Lumo.Null

---@class (exact) Lumo.Insert.bank_accounts
---@field id? integer
---@field balance? integer
---@field created_at? string
---@field frozen? integer | boolean
---@field owner string

---@class (exact) Lumo.Changes.bank_accounts
---@field id? integer
---@field balance? integer
---@field created_at? string
---@field frozen? integer | boolean
---@field owner? string

---@class (exact) Lumo.Deltas.bank_accounts
---@field id? number
---@field balance? number
---@field frozen? number

---@alias Lumo.Column.bank_accounts 'id' | 'balance' | 'created_at' | 'frozen' | 'owner'

---@class Lumo.Table.bank_accounts
local Lumo_bank_accounts = {}

---@param key integer
---@param options? { columns?: Lumo.Column.bank_accounts[], lock?: boolean }
---@return Lumo.Row.bank_accounts?
function Lumo_bank_accounts:get(key, options) end

---@param where Lumo.Where.bank_accounts
---@param options? { columns?: Lumo.Column.bank_accounts[], orderBy?: string, lock?: boolean }
---@return Lumo.Row.bank_accounts?
function Lumo_bank_accounts:find(where, options) end

---@param options? { where?: Lumo.Where.bank_accounts, columns?: Lumo.Column.bank_accounts[], orderBy?: string, limit?: integer, offset?: integer }
---@return Lumo.Row.bank_accounts[]
function Lumo_bank_accounts:list(options) end

---@param where? Lumo.Where.bank_accounts
---@return integer
function Lumo_bank_accounts:count(where) end

---@param where Lumo.Where.bank_accounts
---@return boolean
function Lumo_bank_accounts:exists(where) end

---@param row Lumo.Insert.bank_accounts
---@return integer? insertId
function Lumo_bank_accounts:insert(row) end

---@param rows Lumo.Insert.bank_accounts[]
---@return integer affected
function Lumo_bank_accounts:insertMany(rows) end

---@param key integer
---@param changes Lumo.Changes.bank_accounts
---@return integer affected
function Lumo_bank_accounts:update(key, changes) end

---@param key integer
---@param deltas Lumo.Deltas.bank_accounts
---@return integer affected
function Lumo_bank_accounts:increment(key, deltas) end

---@param where Lumo.Where.bank_accounts | Lumo.AllRows
---@param changes Lumo.Changes.bank_accounts
---@return integer affected
function Lumo_bank_accounts:updateWhere(where, changes) end

---@param row Lumo.Insert.bank_accounts
---@param options { update: Lumo.Column.bank_accounts[] }
---@return integer affected
function Lumo_bank_accounts:upsert(row, options) end

---@param key integer
---@return integer affected
function Lumo_bank_accounts:delete(key) end

---@param where Lumo.Where.bank_accounts | Lumo.AllRows
---@return integer affected
function Lumo_bank_accounts:deleteWhere(where) end

---@class Lumo.Row.bank_transactions
---@field id integer
---@field account_id integer
---@field amount integer
---@field created_at string
---@field kind 'deposit' | 'withdraw' | 'transfer_in' | 'transfer_out' | 'interest'
---@field note string?

---@class (exact) Lumo.Where.bank_transactions
---@field id? integer | (integer)[] | Lumo.Null
---@field account_id? integer | (integer)[] | Lumo.Null
---@field amount? integer | (integer)[] | Lumo.Null
---@field created_at? string | (string)[] | Lumo.Null
---@field kind? 'deposit' | 'withdraw' | 'transfer_in' | 'transfer_out' | 'interest' | ('deposit' | 'withdraw' | 'transfer_in' | 'transfer_out' | 'interest')[] | Lumo.Null
---@field note? string | (string)[] | Lumo.Null

---@class (exact) Lumo.Insert.bank_transactions
---@field id? integer
---@field account_id integer
---@field amount integer
---@field created_at? string
---@field kind 'deposit' | 'withdraw' | 'transfer_in' | 'transfer_out' | 'interest'
---@field note? string | Lumo.Null

---@class (exact) Lumo.Changes.bank_transactions
---@field id? integer
---@field account_id? integer
---@field amount? integer
---@field created_at? string
---@field kind? 'deposit' | 'withdraw' | 'transfer_in' | 'transfer_out' | 'interest'
---@field note? string | Lumo.Null

---@class (exact) Lumo.Deltas.bank_transactions
---@field id? number
---@field account_id? number
---@field amount? number

---@alias Lumo.Column.bank_transactions 'id' | 'account_id' | 'amount' | 'created_at' | 'kind' | 'note'

---@class Lumo.Table.bank_transactions
local Lumo_bank_transactions = {}

---@param key integer
---@param options? { columns?: Lumo.Column.bank_transactions[], lock?: boolean }
---@return Lumo.Row.bank_transactions?
function Lumo_bank_transactions:get(key, options) end

---@param where Lumo.Where.bank_transactions
---@param options? { columns?: Lumo.Column.bank_transactions[], orderBy?: string, lock?: boolean }
---@return Lumo.Row.bank_transactions?
function Lumo_bank_transactions:find(where, options) end

---@param options? { where?: Lumo.Where.bank_transactions, columns?: Lumo.Column.bank_transactions[], orderBy?: string, limit?: integer, offset?: integer }
---@return Lumo.Row.bank_transactions[]
function Lumo_bank_transactions:list(options) end

---@param where? Lumo.Where.bank_transactions
---@return integer
function Lumo_bank_transactions:count(where) end

---@param where Lumo.Where.bank_transactions
---@return boolean
function Lumo_bank_transactions:exists(where) end

---@param row Lumo.Insert.bank_transactions
---@return integer? insertId
function Lumo_bank_transactions:insert(row) end

---@param rows Lumo.Insert.bank_transactions[]
---@return integer affected
function Lumo_bank_transactions:insertMany(rows) end

---@param key integer
---@param changes Lumo.Changes.bank_transactions
---@return integer affected
function Lumo_bank_transactions:update(key, changes) end

---@param key integer
---@param deltas Lumo.Deltas.bank_transactions
---@return integer affected
function Lumo_bank_transactions:increment(key, deltas) end

---@param where Lumo.Where.bank_transactions | Lumo.AllRows
---@param changes Lumo.Changes.bank_transactions
---@return integer affected
function Lumo_bank_transactions:updateWhere(where, changes) end

---@param row Lumo.Insert.bank_transactions
---@param options { update: Lumo.Column.bank_transactions[] }
---@return integer affected
function Lumo_bank_transactions:upsert(row, options) end

---@param key integer
---@return integer affected
function Lumo_bank_transactions:delete(key) end

---@param where Lumo.Where.bank_transactions | Lumo.AllRows
---@return integer affected
function Lumo_bank_transactions:deleteWhere(where) end

---@class Lumo.Database
local Database = {}

---@overload fun(name: 'bank_accounts', columns: Lumo.Columns, options?: Lumo.DefineOptions): Lumo.Table.bank_accounts
---@overload fun(name: 'bank_transactions', columns: Lumo.Columns, options?: Lumo.DefineOptions): Lumo.Table.bank_transactions
function Database.define(name, columns, options) end

---@overload fun(name: 'bank_accounts', options?: Lumo.TableOptions): Lumo.Table.bank_accounts
---@overload fun(name: 'bank_transactions', options?: Lumo.TableOptions): Lumo.Table.bank_transactions
function Database.table(name, options) end
