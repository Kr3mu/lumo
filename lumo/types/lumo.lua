---@meta
-- Editor types for Lumo (LuaLS). The per-table types come from Database.define: each resource that defines
-- tables gets a lumo.d.lua with overloads that type Database.define and Database.table by table name.

---@class Lumo.Null
---@class Lumo.AllRows

---@alias Lumo.Columns table<string, string> column = shorthand: { id = 'id', owner = 'string(60) unique', note = 'string(100)?' }

---@class Lumo.DefineOptions : Lumo.TableOptions
---@field primary? string[] a primary key over several columns
---@field indexes? (string | string[])[] indexes, each one column or a list of columns
---@field unique? (string | string[])[] unique keys, each one column or a list of columns

---@class Lumo.TableOptions
---@field key? string primary key column, default 'id'
---@field strict? boolean check calls at runtime too; defaults to the lumo_strict convar (false)

---@class Lumo.Error
---@field code integer | string MariaDB error number, or Lumo's own string code
---@field name? string the Database.Error name for the code
---@field message string
---@field state? string SQLSTATE
---@field sql? string
---@field resource string

---@class Lumo.ErrorCodes
---@field BAD_FIELD 1054
---@field PARSE_ERROR 1064
---@field NO_SUCH_TABLE 1146
---@field BAD_NULL 1048
---@field DATA_TOO_LONG 1406
---@field DUPLICATE_ENTRY 1062
---@field ROW_IS_REFERENCED 1451
---@field NO_REFERENCED_ROW 1452
---@field LOCK_WAIT_TIMEOUT 1205
---@field DEADLOCK 1213
---@field NOT_STARTED 'NOT_STARTED'
---@field BAD_ARGUMENT 'BAD_ARGUMENT'
---@field BAD_IDENTIFIER 'BAD_IDENTIFIER'
---@field BAD_ORDER_BY 'BAD_ORDER_BY'
---@field BAD_UPSERT 'BAD_UPSERT'
---@field EMPTY_WHERE 'EMPTY_WHERE'
---@field READ_IN_BATCH 'READ_IN_BATCH'
---@field NO_SESSION 'NO_SESSION'
---@field SESSION_EXPIRED 'SESSION_EXPIRED'
---@field UNKNOWN_COLUMN 'UNKNOWN_COLUMN'
---@field BAD_TYPE 'BAD_TYPE'

---@class Lumo.Session
local Session = {}
function Session:close() end

---@class Lumo.Database
---@field null Lumo.Null
---@field all_rows Lumo.AllRows
---@field Error Lumo.ErrorCodes
---@field one fun(sql: string, ...: any): table? first row
---@field all fun(sql: string, ...: any): table[] rows
---@field value fun(sql: string, ...: any): any first column of the first row
---@field exec fun(sql: string, ...: any): integer?, integer? affected rows, insert id
---@field transaction fun(fn: fun(...): ..., ...: any): ... fn's return values; commits on return, rolls back on error
---@field batch fun(fn: fun()): true writes inside fn are sent as one transaction in one round trip
---@field session fun(): Lumo.Session a connection pinned to this thread; use with <close>
---@field async fun(fn: function, ...: any): promise runs fn in a new thread
---@field ready fun(): true waits for the first connection
---@field each fun(sql: string, sets: any[][], shape?: 'all' | 'one' | 'value' | 'exec'): any[] one statement run per parameter set, in one call
local Database = {}

---@param name string
---@param columns Lumo.Columns
---@param options? Lumo.DefineOptions
---@return table
function Database.define(name, columns, options) end

---@param name string
---@param options? Lumo.TableOptions
---@return table
function Database.table(name, options) end

return Database
