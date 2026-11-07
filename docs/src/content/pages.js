// Every docs page as data. Block types (rendered by components/Block.svelte):
//   p { s }                      paragraph, inline syntax from lib/inline.js
//   h2 { id, s }                 section heading; listed in "On this page"
//   h3 { s }                     sub-heading
//   list { items: [s] }          bullet list
//   steps { items: [{ title, s, code?, lang? }] }   a real ordered procedure
//   code { lang, title?, s }     code block with a copy button
//   tabs { tabs: [{ label, lang, s }] }             code in switchable tabs
//   table { head: [s], rows: [[s]], mono?: [col] }  mono columns render as code-like figures
//   note { kind: info|tip|warn, s }
//   api { name, sig, calls, returns, s, params?: [{ name, type, s }] }
//   diagram { name: callpath|layers|bench|chatty|lifecycle }
//   cards { items: [{ page, title, s }] }           links to other pages

export const groups = [
    { title: "Getting started", pages: ["introduction", "installation", "configuration"] },
    { title: "Guide", pages: ["tables", "define", "strict", "reading", "writing", "raw-sql", "errors", "transactions", "batches", "sessions", "threads"] },
    { title: "API reference", pages: ["api-db", "api-table", "types"] },
    { title: "More", pages: ["performance", "why-fast", "vs-oxmysql", "architecture", "migrating", "faq"] },
];

export const pages = {
    introduction: {
        title: "Introduction",
        lede: "Lumo is a MariaDB bridge for FiveM servers. You work with tables as Lua objects, write no SQL for everyday reads and writes, and every query costs exactly one call into the bridge.",
        blocks: [
            { t: "note", kind: "info", s: "Lumo 0.1. Every behaviour on these pages is covered by an end-to-end suite that runs in FXServer against MariaDB, in both the standalone and the monorepo layout. Speed figures come from the benchmarks that led to Lumo." },
            { t: "code", lang: "lua", title: "server/players.lua", s: "local Database = require '@lumo'\nlocal Players = Database.table('players')\n\nAddEventHandler('playerJoining', function()\n    local player = Players:find({ license = GetPlayerIdentifierByType(source, 'license') })\n    print(player and player.money)\nend)" },
            { t: "h2", id: "why", s: "Why another database bridge" },
            { t: "p", s: "Most of the time in a FiveM database call is not spent in the database. A small SELECT takes MariaDB 50–80 µs; getting the request from Lua into the bridge and the answer back is what costs. Lumo is built around that measurement." },
            { t: "list", items: [
                "**Tables as objects.** `Database.table('players')` gives you `find`, `get`, `list`, `insert`, `update`, `increment` and `delete`. The SQL is generated once per call shape and cached.",
                "**One call per query.** Building the SQL, binding values and reading rows all happen in Lua, where they cost microseconds. Only the query itself crosses into the bridge.",
                "**Answers inside the call.** A query that finishes within 2 ms comes back as the call's return value, so the Lua coroutine never yields.",
                "**SQL when you need it.** Joins, aggregates and reports use `Database.all`, `Database.one`, `Database.value` and `Database.exec` with plain SQL.",
            ] },
            { t: "diagram", name: "bench" },
            { t: "h2", id: "next", s: "Where to go next" },
            { t: "cards", items: [
                { page: "installation", title: "Installation", s: "Add the resource, set the connection string, load the library." },
                { page: "tables", title: "Tables", s: "Declare a table once and use it everywhere." },
                { page: "migrating", title: "Migrating from oxmysql", s: "Every MySQL.* call and its Lumo equivalent." },
                { page: "performance", title: "Performance", s: "Where the microseconds go, measured." },
            ] },
        ],
    },

    installation: {
        title: "Installation",
        lede: "Lumo is one folder in the monorepo: a server resource with its bridge, and a Lua module that other resources load from their manifest or with `require`.",
        blocks: [
            { t: "h2", id: "requirements", s: "Requirements" },
            { t: "table", head: ["Component", "Version", "Why"], rows: [
                ["FXServer", "Legacy, Node 22 runtime", "the bridge runs on Node with a worker thread"],
                ["MariaDB", "11.4 or newer", "multi-statement batches and the text protocol Lumo uses"],
                ["ox_lib", "optional", "only if you load Lumo with `require`; a manifest include needs nothing"],
            ] },
            { t: "h2", id: "setup", s: "Set up" },
            { t: "steps", items: [
                { title: "Add Lumo to the monorepo", s: "Lumo lives in the monorepo as `lumo/`: `init.lua` is the Lua module, the bridge sits beside it. The server starts it like any other resource." },
                { title: "Set the connection string and permissions", s: "Lumo reads `lumo_connection_string`. The worker thread needs `add_unsafe_worker_permission`.", lang: "cfg", code: "set lumo_connection_string \"mysql://lumo:secret@127.0.0.1/fivem\"\nadd_unsafe_worker_permission lumo\n\nensure lumo" },
                { title: "Load it in your resource", s: "List `@lumo/init.lua` before your own scripts. FiveM runs it inside your resource, and every script after it sees `Database`. No other resource is needed.", lang: "lua", code: "-- fxmanifest.lua\nfx_version 'cerulean'\ngame 'gta5'\n\nserver_scripts {\n    '@lumo/init.lua',\n    'server/init.lua',\n}\n\ndependencies { 'lumo' }" },
                { title: "Declare a table and use it", s: "Tables are usually declared at the top of a module and used from event handlers.", lang: "lua", code: "-- server/players.lua\nlocal Players = Database.table('players')\n\nCreateThread(function()\n    Database.ready()\n    print(('%d players in the database'):format(Players:count()))\nend)" },
            ] },
            { t: "note", kind: "tip", s: "Keep `ensure lumo` above the resources that use it. Calls made before Lumo has connected wait for the connection instead of failing; see [Database.ready](#api-db)." },
            { t: "h2", id: "require", s: "With ox_lib's require" },
            { t: "p", s: "FiveM has no built-in `require`, but ox_lib adds one when `@ox_lib/init.lua` is in your manifest. The same `init.lua` works with it: `require '@lumo'` runs it inside your resource and returns the module instead of setting `Database`. Use whichever your resources already use." },
            { t: "code", lang: "lua", title: "with ox_lib", s: "-- fxmanifest.lua\nshared_script '@ox_lib/init.lua'\nserver_script 'server/init.lua'\ndependencies { 'ox_lib', 'lumo' }\n\n-- server/players.lua\nlocal Database = require '@lumo'" },
            { t: "note", kind: "info", s: "Both ways load the same file. It finds its own resource and folder from its chunk name, loads the rest of Lumo with `LoadResourceFile`, and never depends on `require` after that. A manifest include sets `Database` only in your resource: every resource has its own Lua state." },
            { t: "h2", id: "monorepo", s: "Inside a monorepo resource" },
            { t: "p", s: "If your server is one big resource with everything inside (a `core` resource with modules under it), copy the `lumo` folder into it, for example to `core/lib/lumo/`, and load the bridge from your own manifest. The Lua module finds its own files and talks to the bridge in the same resource; nothing else changes." },
            { t: "code", lang: "lua", title: "core/fxmanifest.lua", s: "fx_version 'cerulean'\ngame 'gta5'\nnode_version '22'\n\nserver_scripts {\n    'lib/lumo/dist/server.js',   -- the Lumo bridge, running inside core\n    'lib/lumo/init.lua',         -- the Database module\n    'server/init.lua',\n}" },
            { t: "code", lang: "cfg", title: "server.cfg", s: "set lumo_connection_string \"mysql://lumo:secret@127.0.0.1/fivem\"\nadd_unsafe_worker_permission core\nensure core" },
            { t: "code", lang: "lua", title: "core/server/players.lua", s: "local Players = Database.table('players')\n\n-- or, with ox_lib's require instead of the manifest line:\nlocal Database = require 'lib.lumo'   -- a path inside core, not '@lumo'" },
            { t: "note", kind: "info", s: "`@lumo/init.lua` and `require '@lumo'` mean \"the lumo resource\"; `lib/lumo/init.lua` and `require 'lib.lumo'` mean \"this resource\". Either way every query is one call into the bridge." },
        ],
    },

    configuration: {
        title: "Configuration",
        lede: "All settings are convars. Set them in server.cfg before `ensure lumo`.",
        blocks: [
            { t: "h2", id: "convars", s: "Convars" },
            { t: "table", mono: [0, 1], head: ["Convar", "Default", "What it does"], rows: [
                ["lumo_connection_string", "mysql://root@localhost", "`mysql://user:pass@host:port/db?options` or `host=…;user=…;database=…`"],
                ["lumo_pool_size", "10", "Connections the worker opens at startup and keeps warm"],
                ["lumo_inline_budget_ms", "2", "How long the server thread may wait for a fast answer before the query continues async"],
                ["lumo_slow_query_ms", "150", "Queries slower than this are logged with the resource, table and generated SQL"],
                ["lumo_checkout_timeout_ms", "10000", "A held session or open transaction older than this is rolled back and returned"],
                ["lumo_debug", "false", "Logs every query with its duration and whether it was answered inline or async"],
                ["lumo_strict", "false", "Also checks table calls against the table's columns at runtime; see [Strict mode](#strict)"],
            ] },
            { t: "h2", id: "budget", s: "Choosing the inline budget" },
            { t: "p", s: "While a query is inline, the server thread waits for it. 2 ms covers almost every read and a single autocommit write (the redo-log flush takes 1.0–1.4 ms on a typical disk). Lower it if many slow queries run in the same frame; set it to `0` to make every query async." },
            { t: "code", lang: "cfg", title: "server.cfg", s: "set lumo_connection_string \"mysql://lumo:secret@127.0.0.1/fivem?charset=utf8mb4\"\nset lumo_pool_size 10\nset lumo_inline_budget_ms 2\nset lumo_slow_query_ms 150\nadd_unsafe_worker_permission lumo\nensure lumo" },
            { t: "note", kind: "warn", s: "`lumo_connection_string` can contain a password. Keep it in a cfg file that is not committed, and `exec` that file from server.cfg." },
        ],
    },

    tables: {
        title: "Tables",
        lede: "A table object is a repository for one database table. Declare it once; its methods build the SQL for you.",
        blocks: [
            { t: "code", lang: "lua", s: "local Players   = Database.table('players')                        -- primary key `id`\nlocal Inventory = Database.table('inventory')\nlocal Crews     = Database.table('crews', { key = 'tag' })         -- primary key `tag`" },
            { t: "note", kind: "info", s: "The examples in these docs leave out the `require` line: `Database` comes from `@lumo/init.lua` in the manifest, or from `local Database = require '@lumo'` at the top of each file." },
            { t: "h2", id: "methods", s: "What a table can do" },
            { t: "table", mono: [0], head: ["Call", "SQL it runs"], rows: [
                ["Players:get(7)", "`SELECT * FROM players WHERE id = ?`"],
                ["Players:find({ license = l })", "`… WHERE license = ? LIMIT 1`"],
                ["Players:list({ orderBy = 'kills DESC', limit = 10 })", "`… ORDER BY kills DESC LIMIT ?`"],
                ["Players:count({ job = 'police' })", "`SELECT COUNT(*) … WHERE job = ?`"],
                ["Players:insert({ license = l, name = n })", "`INSERT INTO players (license, name) VALUES (?, ?)`"],
                ["Players:update(7, { job = 'ems' })", "`UPDATE players SET job = ? WHERE id = ?`"],
                ["Players:increment(7, { money = 500 })", "`UPDATE players SET money = money + ? WHERE id = ?`"],
                ["Players:delete(7)", "`DELETE FROM players WHERE id = ?`"],
            ] },
            { t: "p", s: "Each of these is one call into the bridge. [Reading](#reading) and [Writing](#writing) cover the options; [Table](#api-table) lists every method." },
            { t: "h2", id: "cache", s: "Generated SQL is cached" },
            { t: "p", s: "The SQL for a call depends only on its shape: the table, the method and the column names you pass, never the values. Lumo builds it the first time a shape is used and caches it, so later calls do a few table lookups and no string building. In the syntax benchmark this costs about 10 µs over hand-written SQL on the C# prototype and is lost in the noise on Node." },
            { t: "h2", id: "safety", s: "Column names and values" },
            { t: "p", s: "Values are always bound as parameters, never pasted into SQL. Column names come from table keys, so Lumo checks every name against `[A-Za-z0-9_]` and quotes it. `orderBy` accepts only `column` or `column ASC|DESC` lists. Building a `where` table from player input is safe; building a column name from player input raises an error." },
        ],
    },

    define: {
        title: "Defining tables",
        lede: "Declare a table in your code with `Database.define`. Lumo creates it if it is missing and writes Lua types for it, so your editor knows every column and flags a misspelled column or a wrong value while you type.",
        blocks: [
            { t: "code", lang: "lua", title: "server/bank.lua", s: "local Accounts = Database.define('bank_accounts', {\n    id         = 'id',\n    owner      = 'string(60) unique',\n    balance    = 'int = 0',\n    frozen     = 'bool = false',\n    created_at = 'datetime = now',\n})\n\nlocal Transactions = Database.define('bank_transactions', {\n    id         = 'id',\n    account_id = 'uint -> bank_accounts.id cascade',\n    amount     = 'int',\n    kind       = 'enum(deposit, withdraw, transfer_in, transfer_out)',\n    note       = 'string(100)?',\n    created_at = 'datetime = now',\n})" },
            { t: "p", s: "Each column is `name = 'type options'`. Columns are NOT NULL unless the type ends in `?`. `Database.define` returns the same table object as `Database.table`, so everything in [Reading](#reading) and [Writing](#writing) works on it." },
            { t: "h2", id: "types", s: "Types" },
            { t: "table", mono: [0], head: ["Write", "Creates", "In Lua"], rows: [
                ["id", "INT UNSIGNED AUTO_INCREMENT PRIMARY KEY", "integer"],
                ["bigid", "BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY", "integer"],
                ["int, uint", "INT, INT UNSIGNED", "integer"],
                ["tinyint, smallint, bigint, ubigint", "TINYINT, SMALLINT, BIGINT, BIGINT UNSIGNED", "integer"],
                ["bool", "TINYINT(1)", "integer (0 or 1); writes accept true and false"],
                ["float, double", "FLOAT, DOUBLE", "number"],
                ["decimal(10, 2)", "DECIMAL(10, 2)", "number"],
                ["string(60)", "VARCHAR(60); plain `string` is VARCHAR(255)", "string"],
                ["char(8)", "CHAR(8)", "string"],
                ["text, mediumtext, longtext", "TEXT, MEDIUMTEXT, LONGTEXT", "string"],
                ["enum(a, b, c)", "ENUM('a', 'b', 'c')", "'a' | 'b' | 'c'"],
                ["json", "JSON", "table when read, string when written"],
                ["date, datetime, timestamp, time", "DATE, DATETIME, TIMESTAMP, TIME", "string"],
                ["uuid, blob", "UUID, BLOB", "string"],
            ] },
            { t: "h2", id: "options", s: "Options" },
            { t: "p", s: "Options follow the type, in any order." },
            { t: "table", mono: [0], head: ["Write", "Means"], rows: [
                ["?", "nullable: `string(100)?` is VARCHAR(100) NULL, and the field is optional in the types"],
                ["= value", "default: `= 0`, `= true`, `= citizen`, `= 'two words'`, `= null`, `= now` (CURRENT_TIMESTAMP)"],
                ["on update now", "set to CURRENT_TIMESTAMP whenever the row changes"],
                ["unique", "a UNIQUE key on this column"],
                ["index", "an index on this column"],
                ["primary", "this column is the primary key (for keys that aren't `id`)"],
                ["-> table.column", "a foreign key"],
                ["cascade, nullify, restrict", "after `->`: what happens when the parent row is deleted (delete this row, set this column to NULL, refuse the delete)"],
                ["sql: \u2026", "the whole definition in SQL, for anything the shorthand doesn't cover"],
            ] },
            { t: "p", s: "Indexes and keys over several columns go in the third argument:" },
            { t: "code", lang: "lua", title: "", s: "Database.define('inventory', { ... }, {\n    unique  = { { 'player_id', 'slot' } },        -- one row per slot\n    indexes = { 'item', { 'player_id', 'item' } }, -- single and multi-column indexes\n})\n\nDatabase.define('player_settings', { ... }, {\n    primary = { 'player_id', 'key' },             -- composite primary key\n    key = 'player_id',                            -- what get/update/delete look up by\n})" },
            { t: "h2", id: "examples", s: "Examples" },
            { t: "code", lang: "lua", title: "players", s: "local Players = Database.define('players', {\n    id         = 'id',\n    license    = 'string(60) unique',\n    name       = 'string(50)',\n    money      = 'int = 500',\n    bank       = 'int = 2500',\n    job        = 'string(30) = unemployed',\n    job_grade  = 'tinyint = 0',\n    is_admin   = 'bool = false',\n    position   = 'json?',\n    last_seen  = 'datetime = now on update now',\n    created_at = 'datetime = now',\n})" },
            { t: "code", lang: "lua", title: "vehicles: owned by a player, removed with them", s: "local Vehicles = Database.define('vehicles', {\n    id        = 'id',\n    owner_id  = 'uint -> players.id cascade',\n    plate     = 'char(8) unique',\n    model     = 'string(40)',\n    mods      = 'json?',\n    fuel      = 'decimal(5, 2) = 100',\n    garage    = 'string(40)?',\n    impounded = 'bool = false',\n})" },
            { t: "code", lang: "lua", title: "inventory: one item per slot", s: "local Inventory = Database.define('inventory', {\n    id        = 'id',\n    player_id = 'uint -> players.id cascade',\n    slot      = 'tinyint',\n    item      = 'string(50) index',\n    count     = 'int = 1',\n    metadata  = 'json?',\n}, { unique = { { 'player_id', 'slot' } } })" },
            { t: "code", lang: "lua", title: "player_settings: a composite primary key", s: "local Settings = Database.define('player_settings', {\n    player_id = 'uint -> players.id cascade',\n    key       = 'string(40)',\n    value     = 'text?',\n}, { primary = { 'player_id', 'key' }, key = 'player_id' })" },
            { t: "code", lang: "lua", title: "crews: members stay when a crew is deleted", s: "local Crews = Database.define('crews', {\n    id         = 'id',\n    tag        = 'string(5) unique',\n    name       = 'string(40)',\n    leader_id  = 'uint? -> players.id nullify',\n    created_at = 'datetime = now',\n})\n\nlocal Members = Database.define('crew_members', {\n    id        = 'id',\n    crew_id   = 'uint? -> crews.id nullify',\n    player_id = 'uint -> players.id cascade',\n    rank      = 'enum(recruit, member, officer, leader) = recruit',\n    joined_at = 'datetime = now',\n}, { unique = { 'player_id' } })" },
            { t: "code", lang: "lua", title: "bans: optional expiry", s: "local Bans = Database.define('bans', {\n    id         = 'id',\n    license    = 'string(60) index',\n    reason     = 'text',\n    banned_by  = 'string(60)?',\n    expires_at = 'datetime?',       -- NULL means permanent\n    created_at = 'datetime = now',\n})" },
            { t: "code", lang: "lua", title: "audit_log: a big table with an enum and JSON", s: "local AuditLog = Database.define('audit_log', {\n    id         = 'bigid',\n    player_id  = 'uint? index',\n    action     = 'enum(login, logout, purchase, transfer, admin)',\n    data       = 'json?',\n    created_at = 'datetime = now index',\n}, { indexes = { { 'player_id', 'action' } } })" },
            { t: "code", lang: "lua", title: "houses: SQL for the parts the shorthand doesn't cover", s: "local Houses = Database.define('houses', {\n    id       = 'id',\n    label    = 'string(60)',\n    price    = 'decimal(12, 2)',\n    owner_id = 'uint? -> players.id nullify',\n    entrance = 'sql: POINT NOT NULL',\n    interior = \"enum('shell_small', 'shell_medium', 'mlo') = shell_small\",\n})" },
            { t: "h2", id: "create", s: "Creating the table" },
            { t: "p", s: "`Database.define` returns the table object at once. In the background Lumo runs `CREATE TABLE IF NOT EXISTS`, one definition after another in the order they ran, so a foreign key can point at a table defined above it. A call on the table waits until it exists, so you can define tables at the top of a file and use them anywhere. Columns are created with the primary key first and the rest in name order." },
            { t: "note", kind: "info", s: "`CREATE TABLE IF NOT EXISTS` never changes a table that already exists. To add or change a column on a live server, run an `ALTER TABLE` yourself and update the definition to match." },
            { t: "h2", id: "types-file", s: "Editor types" },
            { t: "p", s: "When the tables exist, Lumo writes `lumo.d.lua` at the root of your resource with Lua types built from the definitions. This happens every time the resource starts, and the file is only rewritten when a definition changed. Open the resource in VS Code with a Lua language server and every table is typed:" },
            { t: "code", lang: "lua", title: "", s: "local a = Accounts:find({ owner = license })\na.balance                                     -- integer\na.balanse                                     -- Field `balanse` is not declared in `Lumo.Row.bank_accounts`\n\nAccounts:find({ ownr = license })             -- Field `ownr` is not declared in strict class `Lumo.Where.bank_accounts`\nAccounts:find({ owner = 42 })                 -- Cannot assign `integer` to field `owner`\nAccounts:update(id, { balance = 'lots' })     -- Cannot assign `string` to field `balance`\nAccounts:insert({ balance = 5 })              -- Missing required fields: `owner`\nAccounts:list({ columns = { 'ballance' } })   -- Cannot assign `\"ballance\"` to `Lumo.Column.bank_accounts`\nTransactions:insert({ kind = 'refund', ... }) -- Cannot assign `\"refund\"` to field `kind` of type `\"deposit\"|\"withdraw\"|\u2026`" },
            { t: "p", s: "These are the warnings the Lua language server reports for the bank tables above. `Database.table('bank_accounts')` anywhere else in the resource gets the same types. An insert must name a column only when MariaDB can't fill it: NOT NULL, no default, not `id`. Commit `lumo.d.lua` with your code." },
            { t: "note", kind: "tip", s: "A new or changed definition shows up in the editor after the next `restart` of the resource. With `require '@lumo'`, put `---@type Lumo.Database` above the require so the editor knows what it returns; loading Lumo from the manifest needs nothing." },
        ],
    },

    strict: {
        title: "Strict mode",
        lede: "Table calls are checked against the real table before they reach MariaDB: every column you name must exist, and every value must fit its column's type. Off by default: [editor types](#define) catch the same mistakes before the server runs. Turn it on for values the editor can't see, such as event arguments and JSON.",
        blocks: [
            { t: "code", lang: "lua", s: "local Players = Database.table('players')\n\nPlayers:find({ licnese = license })\n-- UNKNOWN_COLUMN: players.licnese does not exist (did you mean license?)\n\nPlayers:update(id, { money = 'lots' })\n-- BAD_TYPE: players.money is int(11), got string\n\nPlayers:insert({ license = license, name = Database.null })\n-- BAD_TYPE: players.name is NOT NULL" },
            { t: "h2", id: "how", s: "How it works" },
            { t: "p", s: "The first call on a table reads its columns from `information_schema` (one query, about 0.26 ms) and keeps them for the life of the resource. After that every call checks its column names and values in Lua, before any SQL is built or sent. Without strict mode the same typo still fails, but later and less helpfully: MariaDB answers with error 1054, and a wrong type is often converted silently." },
            { t: "table", mono: [0], head: ["Column type", "Accepts"], rows: [
                ["INT, BIGINT, SMALLINT, YEAR, …", "a number with no fraction (`5` and `5.0`)"],
                ["TINYINT(1), BIT(1)", "a whole number or a boolean"],
                ["DECIMAL", "a number or a string"],
                ["FLOAT, DOUBLE", "any number"],
                ["CHAR, VARCHAR, TEXT, ENUM, SET, JSON, BLOB", "a string"],
                ["DATE, DATETIME, TIMESTAMP, TIME", "a string such as `'2026-11-07 21:00:00'`"],
                ["any nullable column", "`Database.null` as well"],
            ] },
            { t: "p", s: "Everything a table call names is checked: `where` keys and values (each element of an `IN` list too), rows for `insert`, `insertMany` and `upsert`, changes for `update` and `updateWhere`, `increment` deltas (numeric columns only), the primary key value, the `columns` option, `orderBy` columns and `upsert`'s `update` list. Raw SQL through `Database.one`, `all`, `value` and `exec` is not checked." },
            { t: "h2", id: "on", s: "Turning it on" },
            { t: "code", lang: "cfg", title: "server.cfg", s: "set lumo_strict true      # every table, every resource" },
            { t: "code", lang: "lua", title: "one table", s: "local Bans = Database.table('bans', { strict = true })   -- overrides lumo_strict either way" },
            { t: "h2", id: "cost", s: "What it costs" },
            { t: "p", s: "Measured with the test suite on Legacy FXServer, MariaDB 12.3.3. The Lua-only figures run 100,000 calls inside a batch that is never sent, so they show the checks alone, without the bridge or the database." },
            { t: "table", mono: [1, 2, 3], head: ["Call", "Strict", "Off", "Difference"], rows: [
                ["`update(1, { money, kills })`", "2.86–3.32 µs", "2.44–2.67 µs", "+0.4–0.7 µs"],
                ["`updateWhere({ license, crew_id = { 1, 2, 3 } }, { money })`", "6.19–6.46 µs", "5.08–5.50 µs", "+0.7–1.4 µs"],
                ["`insert` with 4 columns", "3.33–3.62 µs", "2.57–2.67 µs", "+0.8–1.1 µs"],
                ["schema load, first call per table", "0.26 ms once", "none", ""],
            ] },
            { t: "p", s: "A whole query costs 125–220 µs, and with strict mode on or off, `get` and `find` stayed inside the same ±40 µs run-to-run noise over three alternating rounds of 2,000 calls. The checks are about 1% of a query." },
            { t: "note", kind: "info", s: "The columns are read once per resource start. After a migration that changes a table, restart the resources that use it, or the checks keep using the old columns." },
        ],
    },

    reading: {
        title: "Reading",
        lede: "`get`, `find`, `list`, `count` and `exists` read rows. Each is one call into the bridge.",
        blocks: [
            { t: "code", lang: "lua", s: "local player = Players:get(7)                                    -- by primary key\nlocal player = Players:find({ license = license })               -- first match or nil\nlocal police = Players:list({ where = { job = 'police' }, orderBy = 'name', limit = 50 })\nlocal online = Players:count({ online = true })\nlocal taken  = Crews:exists({ tag = 'NOVA' })" },
            { t: "h2", id: "where", s: "Filtering with where" },
            { t: "p", s: "A `where` table matches columns by equality, joined with AND. An array value becomes `IN (…)`, and `Database.null` matches NULL (a Lua table cannot hold `nil`)." },
            { t: "table", mono: [0, 1], head: ["where", "SQL", ""], rows: [
                ["{ job = 'police' }", "`job = ?`", ""],
                ["{ job = 'police', online = true }", "`job = ? AND online = ?`", "columns are sorted, so key order never changes the cached SQL"],
                ["{ id = { 3, 7, 12 } }", "`id IN (?, ?, ?)`", ""],
                ["{ crew_id = Database.null }", "`crew_id IS NULL`", ""],
            ] },
            { t: "note", kind: "info", s: "Ranges, LIKE, joins and aggregates belong in [raw SQL](#raw-sql). Repositories stay deliberately small so the generated SQL is always obvious." },
            { t: "h2", id: "options", s: "Options" },
            { t: "table", mono: [0], head: ["Option", "Used by", "Effect"], rows: [
                ["columns = { 'name', 'kills' }", "get, find, list", "select only these columns instead of `*`"],
                ["orderBy = 'kills DESC'", "find, list", "sort; also picks which row `find` returns"],
                ["limit = 10, offset = 20", "list", "paging"],
                ["lock = true", "get, find", "`FOR UPDATE`; only meaningful inside [a transaction](#transactions)"],
            ] },
            { t: "h2", id: "rows", s: "Rows" },
            { t: "p", s: "A row is a plain Lua table keyed by column name; `list` returns a plain array of them. Iterate with `ipairs`. Values are converted by column type; see [Types](#types)." },
            { t: "code", lang: "lua", title: "Leaderboard", s: "local top = Players:list({ columns = { 'name', 'kills' }, orderBy = 'kills DESC', limit = 10 })\n\nfor rank, row in ipairs(top) do\n    print(('#%d %s - %d kills'):format(rank, row.name, row.kills))\nend" },
        ],
    },

    writing: {
        title: "Writing",
        lede: "`insert`, `update`, `increment`, `upsert` and `delete` change rows and return what changed.",
        blocks: [
            { t: "code", lang: "lua", s: "local id = Players:insert({ license = license, name = name })   -- returns the new id\nPlayers:update(id, { job = 'police', grade = 2 })                -- returns affected rows\nPlayers:increment(id, { money = 500, kills = 1 })                -- money = money + 500, kills = kills + 1\nPlayers:increment(id, { money = -price })                        -- negative values subtract\nPlayers:delete(id)" },
            { t: "h2", id: "where-writes", s: "Writing by filter" },
            { t: "p", s: "The `…Where` variants take a `where` table instead of a key. They refuse an empty `where` so a typo cannot touch every row; pass `Database.all_rows` to mean it." },
            { t: "code", lang: "lua", s: "Players:updateWhere({ crew_id = crewId }, { crew_id = Database.null })\nVehicles:deleteWhere({ owner = id, stored = false })\nPlayers:updateWhere(Database.all_rows, { online = false })   -- explicit, on server start" },
            { t: "h2", id: "upsert", s: "Insert or update" },
            { t: "p", s: "`upsert` inserts a row, or updates the listed columns when a UNIQUE or PRIMARY key already exists (`INSERT … ON DUPLICATE KEY UPDATE`)." },
            { t: "code", lang: "lua", s: "Settings:upsert({ player_id = id, key = 'killsound', value = 'bell' }, { update = { 'value' } })" },
            { t: "h2", id: "many", s: "Many rows" },
            { t: "p", s: "`insertMany` writes a list of rows with the same columns as one multi-row INSERT. For mixed writes, use a [batch](#batches)." },
            { t: "code", lang: "lua", s: "Inventory:insertMany({\n    { player_id = id, item = 'bandage', amount = 5 },\n    { player_id = id, item = 'armour', amount = 1 },\n})" },
        ],
    },

    "raw-sql": {
        title: "Raw SQL",
        lede: "Repositories cover everyday reads and writes. Joins, aggregates, ranges and reports use plain SQL through four functions with the same return shapes.",
        blocks: [
            { t: "code", lang: "lua", s: "local crew = Database.one([[\n    SELECT c.tag, c.name, COUNT(p.id) AS members\n    FROM crews c LEFT JOIN players p ON p.crew_id = c.id\n    WHERE c.id = ? GROUP BY c.id\n]], crewId)\n\nlocal rich  = Database.all('SELECT name, money FROM players WHERE money > ? ORDER BY money DESC LIMIT ?', 1000000, 10)\nlocal total = Database.value('SELECT SUM(money) FROM players')\nlocal affected, insertId = Database.exec('UPDATE players SET online = 0 WHERE last_seen < NOW() - INTERVAL 1 DAY')" },
            { t: "h2", id: "functions", s: "The four functions" },
            { t: "table", mono: [0], head: ["Function", "Returns"], rows: [
                ["Database.one(sql, ...)", "first row, or nil"],
                ["Database.all(sql, ...)", "array of rows"],
                ["Database.value(sql, ...)", "first column of the first row, or nil"],
                ["Database.exec(sql, ...)", "affected rows, insert id"],
            ] },
            { t: "p", s: "Values bind to `?` in order and are passed as plain arguments, not a table. The SQL text is cached like a table call's, so a raw query in a hot path costs the same as one built by a repository." },
            { t: "note", kind: "warn", s: "Never build SQL by concatenating player input. Pass it as a value: `Database.all('… WHERE name = ?', name)`." },
            { t: "h2", id: "each", s: "One statement, many values" },
            { t: "p", s: "`Database.each` runs one statement once per set of values and returns one result per set, in order. It is one call into the bridge however many sets there are: the bridge spreads them over the pool's connections, and each connection sends its share without waiting for answers in between." },
            { t: "code", lang: "lua", s: "local names = Database.each('SELECT name FROM players WHERE license = ?', {\n    { 'license:a' }, { 'license:b' }, { 'license:c' },\n}, 'value')\n-- names = { 'Alice', nil, 'Cleo' }: a set with no match gives nil in its place\n\nlocal made = Database.each('INSERT INTO inventory (player_id, item) VALUES (?, ?)', {\n    { id, 'bread' }, { id, 'water' },\n}, 'exec')\n-- made[2][2] is the second insert's id" },
            { t: "table", mono: [0], head: ["Shape", "Each result is"], rows: [
                ["'all' (default)", "the rows, like `Database.all`"],
                ["'one'", "the first row or nil, like `Database.one`"],
                ["'value'", "the first column of the first row or nil, like `Database.value`"],
                ["'exec'", "`{ affected, insertId }`, like `Database.exec`"],
            ] },
            { t: "p", s: "On the oxmysql documentation benchmark, 2,500 lookups take 229 ms this way and 1.51 s as 2,500 separate `Database.value` calls. Inside a transaction or session every set runs on its connection, in order. Inside a [batch](#batches), `'exec'` adds its statements to the batch; the read shapes raise there like any read." },
        ],
    },

    errors: {
        title: "Errors",
        lede: "A failed query raises a Lua error. The error value is a table, so you can branch on its code with the `Database.Error` enum instead of matching message text.",
        blocks: [
            { t: "code", lang: "lua", s: "local ok, err = pcall(Crews.insert, Crews, { tag = tag, name = name })\nif not ok then\n    if err.code == Database.Error.DUPLICATE_ENTRY then\n        return notify(src, 'That crew tag is taken.')\n    end\n    error(err) -- anything else is a bug: let it surface\nend" },
            { t: "h2", id: "fields", s: "Error fields" },
            { t: "table", mono: [0], head: ["Field", "Example", "Meaning"], rows: [
                ["code", "1062", "MariaDB error number, or a string for Lumo's own errors"],
                ["name", "DUPLICATE_ENTRY", "the `Database.Error` name for the code, when it has one"],
                ["state", "23000", "SQLSTATE class"],
                ["message", "Duplicate entry 'NOVA' for key 'tag'", "server message"],
                ["sql", "INSERT INTO `crews` (`name`, `tag`) VALUES (?, ?)", "the generated or raw SQL, without values"],
                ["resource", "crews", "the resource that made the call"],
            ] },
            { t: "h2", id: "common", s: "Database.Error" },
            { t: "p", s: "MariaDB codes you will meet, by name. Any other MariaDB error still arrives with its number in `code` and no `name`." },
            { t: "table", mono: [0, 1], head: ["Database.Error", "Code", "Usual cause"], rows: [
                ["DUPLICATE_ENTRY", "1062", "a UNIQUE or PRIMARY KEY already has this value"],
                ["NO_REFERENCED_ROW", "1452", "a foreign key points at a row that does not exist"],
                ["ROW_IS_REFERENCED", "1451", "deleting or changing a row another table's foreign key points at"],
                ["DEADLOCK", "1213", "two transactions locked rows in opposite order; retry the transaction"],
                ["LOCK_WAIT_TIMEOUT", "1205", "a row stayed locked longer than innodb_lock_wait_timeout"],
                ["BAD_FIELD", "1054", "a column name in a where or row table does not exist"],
                ["NO_SUCH_TABLE", "1146", "the table does not exist (a missing migration)"],
                ["BAD_NULL", "1048", "NULL written to a NOT NULL column"],
                ["DATA_TOO_LONG", "1406", "a string longer than its column"],
                ["PARSE_ERROR", "1064", "invalid SQL in a raw query"],
            ] },
            { t: "h2", id: "lumo-codes", s: "Lumo's own codes" },
            { t: "p", s: "Raised before anything reaches MariaDB. Their `code` is the name itself." },
            { t: "table", mono: [0], head: ["Database.Error", "Raised when"], rows: [
                ["EMPTY_WHERE", "a where table has no columns, or `updateWhere`/`deleteWhere` gets none; pass `Database.all_rows` to mean every row"],
                ["BAD_IDENTIFIER", "a table or column name has characters other than `[A-Za-z0-9_]`"],
                ["BAD_ORDER_BY", "`orderBy` is not `column [ASC|DESC], ...`"],
                ["BAD_UPSERT", "`upsert` is called without `{ update = { ...columns } }`"],
                ["READ_IN_BATCH", "a read runs inside `Database.batch`"],
                ["SESSION_EXPIRED", "a session or transaction was held past `lumo_checkout_timeout_ms`"],
                ["NO_SESSION", "the bridge does not know the session, usually after it expired"],
                ["NOT_STARTED", "the resource running the bridge is not started"],
                ["BAD_ARGUMENT", "the bridge received an argument of the wrong type"],
                ["UNKNOWN_COLUMN", "[strict mode](#strict): a column the table does not have; the message suggests the closest name"],
                ["BAD_TYPE", "[strict mode](#strict): a value that does not fit its column, or `Database.null` for a NOT NULL column"],
            ] },
            { t: "note", kind: "tip", s: "`tostring(err)` gives a one-line summary, so an unhandled Lumo error still prints readably in the server console." },
        ],
    },

    transactions: {
        title: "Transactions",
        lede: "`Database.transaction` runs a function on one dedicated connection. Table calls inside it join the transaction automatically. It commits when the function returns and rolls back when it raises.",
        blocks: [
            { t: "code", lang: "lua", title: "server/shop.lua", s: "local Players   = Database.table('players')\nlocal Inventory = Database.table('inventory')\n\nlocal function BuyItem(playerId, item, price)\n    return Database.transaction(function()\n        local player = Players:get(playerId, { lock = true })   -- SELECT … FOR UPDATE\n        if player.money < price then\n            error({ code = 'NO_MONEY', message = 'not enough money' })\n        end\n\n        Players:increment(playerId, { money = -price })\n        Inventory:insert({ player_id = playerId, item = item })\n        return player.money - price\n    end)\nend" },
            { t: "diagram", name: "lifecycle" },
            { t: "h2", id: "when", s: "Transaction or batch" },
            { t: "p", s: "A transaction holds a connection while your Lua runs, which is what you need when a read decides the next write. When every write is known up front, use a [batch](#batches): it sends everything in one round trip and holds nothing." },
            { t: "table", head: ["", "Database.transaction(fn)", "Database.batch(fn)"], rows: [
                ["Calls into the bridge", "one per query, plus begin and commit", "1"],
                ["Holds a connection", "until fn returns", "no"],
                ["Can read before writing", "yes", "no; reads raise inside a batch"],
                ["Rollback", "fn raises, or the checkout timeout passes", "any write fails"],
            ] },
            { t: "h2", id: "rules", s: "Rules inside a transaction" },
            { t: "list", items: [
                "Every table call and raw SQL call in the function's thread uses the transaction's connection. There is nothing to pass around.",
                "Keep the function short. Rows read with `lock = true` stay locked until it returns.",
                "Do not `Wait()` inside. A transaction older than `lumo_checkout_timeout_ms` is rolled back and its connection returned.",
                "Errors you raise yourself roll back too; any value works, and it is re-raised after the rollback.",
            ] },
        ],
    },

    batches: {
        title: "Batches",
        lede: "Inside `Database.batch`, writes are collected instead of sent. When the function returns, they go to MariaDB as one multi-statement query inside a transaction.",
        blocks: [
            { t: "code", lang: "lua", title: "Save everyone on shutdown", s: "AddEventHandler('onResourceStop', function(name)\n    if name ~= GetCurrentResourceName() then return end\n\n    Database.batch(function()\n        for _, p in pairs(Players.online) do\n            Players:update(p.id, { money = p.money, kills = p.kills, deaths = p.deaths })\n        end\n    end) -- one call into the bridge, one transaction\nend)" },
            { t: "h2", id: "transfer", s: "A money transfer" },
            { t: "code", lang: "lua", s: "Database.batch(function()\n    Players:increment(buyerId, { money = -2500 })\n    Players:increment(sellerId, { money = 2500 })\n    Trades:insert({ buyer = buyerId, seller = sellerId, amount = 2500 })\nend)" },
            { t: "h2", id: "semantics", s: "How it runs" },
            { t: "p", s: "MariaDB executes a multi-statement query in order and stops at the first failing statement. Lumo sends `COMMIT` only as the last statement of the last chunk, so a failure never commits; the bridge then sends `ROLLBACK` and raises the error." },
            { t: "p", s: "Large batches are split into chunks of about 1 MB to stay under `max_allowed_packet`. 10,000 inserts take about 250 ms, the same as MariaDB running them from a console client." },
            { t: "note", kind: "warn", s: "Reads (`get`, `find`, `list`, `count`, `Database.one`, …) raise inside a batch, because their answer would not exist until the batch is sent. Read first, then batch the writes, or use a [transaction](#transactions)." },
        ],
    },

    sessions: {
        title: "Sessions",
        lede: "Most code never sees a connection. Open a session when connection state matters: temporary tables, `SET` variables, `LAST_INSERT_ID()`.",
        blocks: [
            { t: "code", lang: "lua", s: "local function RebuildWarStandings()\n    local session <close> = Database.session()\n\n    Database.exec([[CREATE TEMPORARY TABLE war_scores AS\n              SELECT crew_id, SUM(kills) AS kills FROM war_kills GROUP BY crew_id]])\n    Database.exec('UPDATE crews c JOIN war_scores s ON s.crew_id = c.id SET c.war_kills = s.kills')\n    return Database.value('SELECT COUNT(*) FROM war_scores')\nend -- session released here; the temp table goes with it" },
            { t: "h2", id: "scope", s: "How a session is scoped" },
            { t: "p", s: "While a session is open, every Lumo call made from the same thread, table or raw, runs on the session's connection. Calls from other threads keep using the pool." },
            { t: "h2", id: "close", s: "<close> releases it" },
            { t: "p", s: "`<close>` is a Lua 5.4 to-be-closed variable. Lua calls the session's `__close` when the scope ends: at the end of the block, on `return`, on `break`, and when an error passes through. The connection goes back to the pool in every case." },
            { t: "p", s: "Without `<close>`, call `session:close()` yourself. A session held longer than `lumo_checkout_timeout_ms` is reclaimed and logged with the resource name, and every session a resource holds is released when that resource stops." },
        ],
    },

    threads: {
        title: "Threads and async",
        lede: "Lumo calls look blocking. They must run inside a thread, the same rule as `MySQL.query.await`.",
        blocks: [
            { t: "p", s: "Event handlers, commands, `CreateThread` functions and callbacks from `lib.callback` already run as threads. Top-level file code does not, so wrap it:" },
            { t: "code", lang: "lua", s: "-- top of a file: not a thread yet\nCreateThread(function()\n    Database.ready()                                  -- waits for the first connection\n    print(('%d players in the database'):format(Players:count()))\nend)" },
            { t: "h2", id: "inline", s: "Inline and async answers" },
            { t: "p", s: "A call first waits up to `lumo_inline_budget_ms` for the answer on the server thread. If it arrives, the method simply returns it and the coroutine never yields. If it does not, the call yields and resumes when the worker answers. Your code looks the same either way." },
            { t: "diagram", name: "callpath" },
            { t: "h2", id: "parallel", s: "Running queries in parallel" },
            { t: "p", s: "Calls in one thread run one after another. To overlap independent slow queries, start them in separate threads with `Database.async`, which returns a promise:" },
            { t: "code", lang: "lua", s: "local stats = Database.async(Stats.get, Stats, playerId)\nlocal crew  = Database.async(Crews.find, Crews, { id = crewId })\n\nlocal s, c = Citizen.Await(stats), Citizen.Await(crew)" },
        ],
    },

    "api-db": {
        title: "Database",
        lede: "The module `@lumo/init.lua` defines (or `require '@lumo'` returns). Every Lumo call starts here.",
        blocks: [
            { t: "api", name: "Database.define", sig: "Database.define(name, columns, options?)", calls: 0, returns: "Table", s: "Declares a table in code: creates it with `CREATE TABLE IF NOT EXISTS` (calls on it wait until it exists) and writes its Lua types to `lumo.d.lua` in this resource. See [Defining tables](#define).", params: [{ name: "name", type: "string", s: "table name, `[A-Za-z0-9_]` only" }, { name: "columns", type: "table", s: "`column = 'type options'`, e.g. `{ id = 'id', owner = 'string(60) unique', note = 'string(100)?' }`" }, { name: "options", type: "table", s: "`key` and `strict` as for `Database.table`, plus `primary`, `indexes` and `unique` for keys over several columns" }] },
            { t: "api", name: "Database.table", sig: "Database.table(name, options?)", calls: 0, returns: "Table", s: "Returns the repository for a table, creating it on first use. One object per table name per resource.", params: [{ name: "name", type: "string", s: "table name, `[A-Za-z0-9_]` only" }, { name: "options.key", type: "string", s: "primary key column, default `'id'`" }, { name: "options.strict", type: "boolean", s: "check calls against the table's columns; defaults to `lumo_strict` (false). See [Strict mode](#strict)" }] },
            { t: "api", name: "Database.one", sig: "Database.one(sql, ...)", calls: 1, returns: "row | nil", s: "Runs raw SQL and returns the first row." },
            { t: "api", name: "Database.all", sig: "Database.all(sql, ...)", calls: 1, returns: "{ row }", s: "Runs raw SQL and returns every row." },
            { t: "api", name: "Database.value", sig: "Database.value(sql, ...)", calls: 1, returns: "any | nil", s: "Runs raw SQL and returns the first column of the first row." },
            { t: "api", name: "Database.exec", sig: "Database.exec(sql, ...)", calls: 1, returns: "integer, integer | nil", s: "Runs raw SQL for its effect. Returns affected rows and, for an INSERT, the insert id." },
            { t: "api", name: "Database.each", sig: "Database.each(sql, sets, shape?)", calls: 1, returns: "{ result }", s: "Runs one statement once per parameter set in a single call; the bridge spreads the sets over the pool's connections. Returns one result per set, in order. See [Raw SQL](#raw-sql).", params: [{ name: "sets", type: "{ { any } }", s: "one array of values per run" }, { name: "shape", type: "string", s: "`'all'` (default), `'one'`, `'value'` or `'exec'`" }] },
            { t: "api", name: "Database.transaction", sig: "Database.transaction(fn, ...)", calls: "n + 2", returns: "fn's return values", s: "Checks out a connection, begins a transaction and calls `fn(...)`. Every Lumo call in that thread joins the transaction. Commits when fn returns; rolls back and re-raises when it raises." },
            { t: "api", name: "Database.batch", sig: "Database.batch(fn)", calls: 1, returns: "true", s: "Calls `fn()`, collecting the writes it makes, then sends them all in one transaction as one round trip. Reads raise inside a batch." },
            { t: "api", name: "Database.session", sig: "Database.session()", calls: 1, returns: "Session", s: "Pins a connection to the current thread until the session is closed. Use with `<close>`." },
            { t: "api", name: "Database.async", sig: "Database.async(fn, ...)", calls: 0, returns: "promise", s: "Runs `fn(...)` in a new thread and returns a promise for its result, for overlapping independent queries." },
            { t: "api", name: "Database.ready", sig: "Database.ready()", calls: 1, returns: "true", s: "Waits until the bridge has its first connection. Table calls already wait on their own; use this for startup checks." },
            { t: "api", name: "Database.null / Database.all_rows", sig: "Database.null, Database.all_rows", calls: 0, returns: "sentinel", s: "`Database.null` matches or writes NULL inside a where or row table. `Database.all_rows` is the explicit where for `updateWhere` and `deleteWhere` on every row." },
            { t: "api", name: "Database.Error", sig: "Database.Error.DUPLICATE_ENTRY", calls: 0, returns: "enum", s: "Error codes by name, to compare with `err.code`. MariaDB codes are numbers (`DUPLICATE_ENTRY = 1062`), Lumo's own are strings. See [Errors](#errors)." },
        ],
    },

    "api-table": {
        title: "Table",
        lede: "Returned by `Database.table`. Every method is one call into the bridge; the SQL is generated once per call shape and cached.",
        blocks: [
            { t: "h2", id: "read", s: "Reading" },
            { t: "api", name: "get", sig: "Table:get(key, options?)", calls: 1, returns: "row | nil", s: "The row with this primary key. Options: `columns`, `lock`." },
            { t: "api", name: "find", sig: "Table:find(where, options?)", calls: 1, returns: "row | nil", s: "The first row matching `where`. Options: `columns`, `orderBy`, `lock`." },
            { t: "api", name: "list", sig: "Table:list(options?)", calls: 1, returns: "{ row }", s: "Every matching row. Options: `where`, `columns`, `orderBy`, `limit`, `offset`." },
            { t: "api", name: "count", sig: "Table:count(where?)", calls: 1, returns: "integer", s: "Number of matching rows." },
            { t: "api", name: "exists", sig: "Table:exists(where)", calls: 1, returns: "boolean", s: "Whether any row matches; stops at the first." },
            { t: "h2", id: "write", s: "Writing" },
            { t: "api", name: "insert", sig: "Table:insert(row)", calls: 1, returns: "integer", s: "Inserts one row and returns its AUTO_INCREMENT id." },
            { t: "api", name: "insertMany", sig: "Table:insertMany(rows)", calls: 1, returns: "integer", s: "Inserts rows with the same columns as one multi-row INSERT. Returns affected rows." },
            { t: "api", name: "update", sig: "Table:update(key, changes)", calls: 1, returns: "integer", s: "Sets columns on the row with this key. Returns affected rows." },
            { t: "api", name: "updateWhere", sig: "Table:updateWhere(where, changes)", calls: 1, returns: "integer", s: "Sets columns on every matching row. An empty `where` raises; pass `Database.all_rows`." },
            { t: "api", name: "increment", sig: "Table:increment(key, deltas)", calls: 1, returns: "integer", s: "Adds each delta to its column (`col = col + ?`). Negative deltas subtract." },
            { t: "api", name: "upsert", sig: "Table:upsert(row, { update = columns })", calls: 1, returns: "integer", s: "Inserts, or updates the listed columns when a unique key already exists." },
            { t: "api", name: "delete", sig: "Table:delete(key)", calls: 1, returns: "integer", s: "Deletes the row with this key. Returns affected rows." },
            { t: "api", name: "deleteWhere", sig: "Table:deleteWhere(where)", calls: 1, returns: "integer", s: "Deletes every matching row. An empty `where` raises; pass `Database.all_rows`." },
        ],
    },

    types: {
        title: "Types",
        lede: "How MariaDB column types arrive in Lua, and how Lua values are sent.",
        blocks: [
            { t: "h2", id: "reading", s: "Reading" },
            { t: "table", mono: [0], head: ["MariaDB type", "Lua value", "Notes"], rows: [
                ["TINYINT … BIGINT", "integer", "BIGINT UNSIGNED above 2^63 arrives as a string"],
                ["FLOAT, DOUBLE", "number", ""],
                ["DECIMAL", "number", "exact up to 15 significant digits; use a string column for money above that"],
                ["CHAR, VARCHAR, TEXT", "string", "UTF-8"],
                ["DATE, DATETIME, TIMESTAMP", "string", "`'2026-11-07 14:57:32'`, as stored, no timezone conversion"],
                ["JSON", "string", "decode with `json.decode` when you need the table"],
                ["BLOB, BINARY", "string", "raw bytes"],
                ["NULL", "nil", "a row table simply has no key for that column"],
            ] },
            { t: "h2", id: "writing", s: "Writing" },
            { t: "table", mono: [0], head: ["Lua value", "Sent as"], rows: [
                ["integer, number", "numeric literal; NaN and infinity become NULL"],
                ["string", "quoted and escaped, respecting NO_BACKSLASH_ESCAPES"],
                ["boolean", "1 or 0"],
                ["Database.null", "NULL (a plain nil cannot live in a Lua table)"],
                ["array table, in where", "`IN (…)`"],
            ] },
            { t: "note", kind: "info", s: "Values are written into the SQL text by the bridge (client-side binding). In the sqlbench measurements this was faster than server-side prepared statements, which need an extra round trip to prepare." },
        ],
    },

    performance: {
        title: "Performance",
        lede: "Measured on a Legacy FXServer against MariaDB 12.3.3 on the same machine.",
        blocks: [
            { t: "diagram", name: "bench" },
            { t: "h2", id: "syntax", s: "Repositories against raw SQL" },
            { t: "p", s: "The same tasks on 10,000 indexed players: through Lumo's table API, through Lumo's raw SQL functions, and through oxmysql's own API. Median of 5 rounds of 1,500 reads or 300 writes, the order rotating every round." },
            { t: "table", mono: [1, 2, 3], head: ["Task", "Lumo table API", "Lumo raw SQL", "oxmysql 2.14.3"], rows: [
                ["`Players:find({ license = l })`", "115 µs", "120 µs", "1.45 ms"],
                ["`Players:list({ orderBy = 'kills DESC', limit = 10 })`", "117 µs", "118 µs", "1.45 ms"],
                ["`Players:increment(id, { money = 1 })`", "1.07 ms", "1.08 ms", "1.71 ms"],
                ["2-write `Database.batch`", "1.19 ms", "1.18 ms", "5.63 ms"],
            ] },
            { t: "p", s: "The table API costs the same as hand-written SQL: the difference is inside the run-to-run noise. Writes are bounded by MariaDB committing to disk (about 1 ms); reads are 12 times faster than oxmysql, a 2-write batch almost 5 times." },
            { t: "h2", id: "steps", s: "The oxmysql documentation benchmark" },
            { t: "p", s: "Run unmodified through Lumo's public Lua API (`Database.batch`, `exec`, `each`, `value`, `one`, `all`) on Legacy FXServer with MariaDB 12.3.3, 7 rounds, median. Both returned identical results." },
            { t: "table", mono: [1, 2], head: ["Step", "Lumo", "oxmysql 2.14.3"], rows: [
                ["initialise test_table (4 statements)", "40.53 ms", "40.53 ms"],
                ["small transactions (2 statements)", "1.20–1.75 ms", "6.14–6.59 ms"],
                ["insert 10,000 users (one transaction)", "270.21 ms", "14.11 s"],
                ["select every 4th user id (2,500 lookups, `Database.each`)", "229.42 ms", "3.71 s"],
                ["insert", "1.36 ms", "2.37 ms"],
                ["update", "1.11 ms", "2.30 ms"],
                ["scalar", "231 µs", "1.55 ms"],
                ["single", "174 µs", "1.52 ms"],
                ["prepare", "130 µs", "1.48 ms"],
                ["query", "116 µs", "1.51 ms"],
                ["**total**", "**547.47 ms**", "**17.89 s**"],
            ] },
            { t: "h2", id: "budget", s: "Where one query's time goes" },
            { t: "diagram", name: "callpath" },
            { t: "table", mono: [1], head: ["Part", "Cost", "Can Lumo change it?"], rows: [
                ["Table layer: SQL lookup and binding", "a few µs", "already cached per call shape"],
                ["Lua → Node export call", "~40 µs", "no; it is the runtime's floor"],
                ["Handoff to the worker thread", "~10 µs", "already through shared memory"],
                ["MariaDB, small indexed SELECT", "~30–60 µs", "no"],
                ["MariaDB, autocommit write", "1.0–1.4 ms", "no; it is the redo-log flush"],
            ] },
            { t: "h2", id: "why-node", s: "Why the bridge runs on Node, not C#" },
            { t: "p", s: "Both prototypes reach the database floor on bulk work (Node 517 ms, C# 523 ms on the full benchmark). The difference is the call itself: an empty Lua → Node export costs about 40 µs, an empty Lua → C# export on mono about 150 µs. That is why every read above is about 2.6× faster on Node." },
        ],
    },

    architecture: {
        title: "Architecture",
        lede: "Three layers, and one rule: exactly one call from Lua into the bridge per query.",
        blocks: [
            { t: "diagram", name: "layers" },
            { t: "h2", id: "lua", s: "Lua table layer" },
            { t: "p", s: "`require '@lumo'` runs Lumo's Lua module inside each resource that loads it. Table objects turn method calls into cached SQL plus a value array; nothing crosses into the bridge until the query runs. The layer caches the bridge's raw export function references once, skipping the exports proxy (worth 23–31 µs per call)." },
            { t: "h2", id: "exports", s: "Exports" },
            { t: "p", s: "Three exports with flat arguments: `exec(shape, sql, params, session)`, `batch(sqls, index, params)` and `checkout` / `release`. A fast answer is the export's return value. A slow one returns a job id, and the answer arrives through one resumer function each resource registers at startup, so no Lua function crosses the bridge per call." },
            { t: "code", lang: "ts", title: "exports", s: "exec(shape: 0 | 1 | 2 | 3, sql: string, params?: unknown[], session?: number): unknown\n// returns the value, or [false, error], or [false, jobId] when it continues async\n\nbatch(sqls: string[], index: number[], params: unknown[][]): true | [false, Error]\ncheckout(): number\nrelease(session: number): void" },
            { t: "h2", id: "bridge", s: "Bridge" },
            { t: "list", items: [
                "The Node main thread writes each request into a SharedArrayBuffer when the worker is spinning, and waits up to the inline budget for the reply.",
                "The worker thread owns the connection pool, the handle table for sessions and transactions, and a dedicated connection for fast single statements.",
                "Replies use a compact binary format with a key table. Values that format cannot carry (Buffer, Date, BigInt) fall back to v8 serialization, so types never change between the inline and async paths.",
            ] },
            { t: "h2", id: "chatty", s: "What it avoids" },
            { t: "diagram", name: "chatty" },
        ],
    },

    "why-fast": {
        title: "Why Lumo is fast",
        lede: "No single trick. Each step of a query lost a little less time, and every step was measured before it was kept. These are the ones that mattered, with the numbers they moved.",
        blocks: [
            { t: "h2", id: "idea", s: "The idea" },
            { t: "p", s: "A small indexed query takes MariaDB 50–80 µs. Everything else in a FiveM database call is getting the request from Lua into the bridge and the answer back. Lumo treats that path as the thing to optimise: make the crossing cheap, make it happen once, and never wait for a tick you don't need." },
            { t: "diagram", name: "callpath" },

            { t: "h2", id: "inline", s: "1. The answer comes back inside the call" },
            { t: "p", s: "Most database resources hand Lua a callback and resume the coroutine on a later tick. Lumo's main thread passes the request to its worker through a `SharedArrayBuffer` and waits for the reply with `Atomics.wait`, up to `lumo_inline_budget_ms` (2 ms). A fast query's result becomes the export's return value: no callback, no promise, and the Lua coroutine never yields." },
            { t: "table", mono: [1], head: ["Step", "Effect"], rows: [
                ["Callback and resume on a later tick → answer inside the call", "small reads from ~1.0 ms to ~0.2 ms on the same bridge"],
                ["A slow query", "still continues async after the budget; the server thread is held at most 2 ms"],
            ] },

            { t: "h2", id: "crossing", s: "2. One cheap crossing per query" },
            { t: "list", items: [
                "**Raw function references.** The Lua module fetches each export's function once and calls it directly, skipping the exports proxy's closure, `pcall` and result repacking on every call: 23–31 µs per call.",
                "**No Lua function crosses the bridge.** A callback per call has to be serialised as a function reference and called back across runtimes. Lumo passes four flat values (shape, SQL, params, session) and gets one array back.",
                "**Objects stay in Lua.** Table calls build their SQL and value list in Lua, where it costs microseconds, then make exactly one call. A mysqli-style API with a call per bind or fetch would make ten or more.",
            ] },

            { t: "h2", id: "handoff", s: "3. Getting work to the worker without waking it" },
            { t: "p", s: "After each answer the worker spins for 0.25 ms. A request that arrives while it spins is written straight into shared memory and picked up immediately, skipping `postMessage` and the event-loop wake-up: 12–22 µs per call. The cost is a quarter-millisecond of busy-waiting on the worker's core, never on the server thread." },

            { t: "h2", id: "encoding", s: "4. A small reply format" },
            { t: "p", s: "Replies through shared memory use a compact binary format with a key table, so a column name is sent once per reply instead of once per row. Values the format can't carry (Buffer, Date, BigInt) fall back to v8 serialisation, so types never change between the fast and slow paths." },
            { t: "table", mono: [1, 2], head: ["Reply", "v8 serialisation", "Lumo format"], rows: [
                ["scalar", "3.58 µs", "0.5–0.9 µs"],
                ["one row", "4.65 µs", "0.7 µs"],
                ["10 rows", "9.84 µs", "3.0 µs"],
            ] },

            { t: "h2", id: "connection", s: "5. A connection that is always ready" },
            { t: "p", s: "Pools validate a connection that has been idle for a while with an extra ping before using it, and on a quiet server almost every query hits that. Single fast queries use a dedicated connection that skips the ping: spread-out queries went from 455–480 µs to 251–341 µs." },

            { t: "h2", id: "batches", s: "6. Transactions in one round trip" },
            { t: "p", s: "A transaction written as a list of statements goes to MariaDB as one multi-statement query per ~1 MB chunk, instead of one round trip per statement. MariaDB stops at the first error and Lumo rolls back, so it is still all-or-nothing." },
            { t: "table", mono: [1, 2], head: ["", "One round trip per statement", "Multi-statement"], rows: [
                ["10,000 inserts", "14.11 s (oxmysql)", "270 ms"],
                ["2-write transaction", "6.14–6.59 ms (oxmysql)", "1.20–1.75 ms"],
            ] },

            { t: "h2", id: "less-work", s: "7. Doing less work per query" },
            { t: "list", items: [
                "**SQL is cached per call shape.** `Players:find({ license = l })` builds its SQL once; later calls only bind values.",
                "**Client-side binding.** Values are escaped into the SQL text instead of using server-side prepared statements, which need an extra round trip. Measured end to end, prepared statements were not faster here.",
                "**Decode only what the shape needs.** `value` reads one cell; a write reads no rows at all.",
            ] },

            { t: "h2", id: "rejected", s: "What didn't make it" },
            { t: "p", s: "Every idea was measured before it was kept. These were built, tested and dropped because they made no measurable difference, or made things worse:" },
            { t: "list", items: [
                "Server-side prepared statements (`execute`): slower on `SELECT 1`, mixed elsewhere.",
                "Letting the worker park with `Atomics.waitAsync` after its spin: hung under sustained load.",
                "Larger socket buffers and non-blocking receives (in the C# prototype): no difference across repeated runs.",
                "Sending statements as numeric ids instead of SQL text: no difference for normal-length SQL.",
            ] },

            { t: "h2", id: "floor", s: "The floor" },
            { t: "p", s: "What's left per small query is the runtime's own Lua → Node crossing (about 40 µs) and MariaDB itself (50–80 µs for a read, 1.0–1.4 ms for a write while it flushes the commit to disk). Lumo's own bridge code is about 30 µs of a call. Bulk work runs at the speed of MariaDB executing the same SQL from a console client." },
        ],
    },

    "vs-oxmysql": {
        title: "Lumo vs oxmysql",
        lede: "How Lumo and oxmysql are built, side by side. Every oxmysql statement on this page comes from its v2.14.3 source, linked where it is made.",
        blocks: [
            { t: "h2", id: "summary", s: "At a glance" },
            { t: "table", head: ["", "oxmysql 2.14.3", "Lumo 0.1"], rows: [
                ["Connector", "`mysql2`", "`mariadb` (the MariaDB Node connector)"],
                ["Where queries run", "the resource's Node main thread", "a worker thread that owns the pool; the main thread only hands requests over"],
                ["Answer to Lua", "a Lua callback; `.await` wraps it in a promise and yields until the next tick", "the export's return value when the query finishes within 2 ms; a promise only when it doesn't"],
                ["Calls into the bridge", "through the exports proxy, with a callback function reference on every call", "cached raw function references, four flat arguments, no callback"],
                ["Everyday queries", "`connection.query`: text protocol, values escaped by mysql2", "text protocol, values escaped by the bridge"],
                ["Transaction list", "`START TRANSACTION`, then one awaited round trip per statement", "one multi-statement query per ~1 MB chunk, `COMMIT` only in the last"],
                ["Interactive transaction", "`MySQL.startTransaction(cb)`, fixed 30 s limit, `return false` rolls back", "`Database.transaction(fn)`: table calls join it; raising rolls back; configurable limit"],
                ["Errors", "logged to the console; the caller gets `nil` or `false`", "raised as a Lua error table with `code`, `state`, `message`, `sql`"],
                ["Dates", "milliseconds since 1970 (custom `typeCast`)", "strings, exactly as stored"],
                ["Placeholders", "`?`, `:name` and `@name`", "`?` only"],
            ] },

            { t: "h2", id: "threading", s: "Where the work happens" },
            { t: "p", s: "oxmysql runs mysql2's pool on the resource's Node main thread ([pool.ts](https://github.com/overextended/oxmysql/blob/v2.14.3/src/database/pool.ts)). Parsing results, building rows and logging all happen there, interleaved with every other script tick in the resource." },
            { t: "p", s: "Lumo's bridge starts a worker thread that owns the connections and does the protocol work. The main thread writes each request into shared memory and, for a fast query, waits up to `lumo_inline_budget_ms` for the reply. A query that takes longer continues on the worker while the main thread moves on, so a slow query can hold the server thread for at most that budget." },

            { t: "h2", id: "answer", s: "How the answer gets back to Lua" },
            { t: "p", s: "This is the biggest difference for small queries. In oxmysql, `MySQL.scalar.await` creates a promise, passes a Lua callback into the export and yields with `Citizen.Await`. The export schedules a resource tick before each query so the coroutine is resumed soon after the callback fires ([connection.ts](https://github.com/overextended/oxmysql/blob/v2.14.3/src/database/connection.ts), [scheduleTick.ts](https://github.com/overextended/oxmysql/blob/v2.14.3/src/utils/scheduleTick.ts)). Every query is a yield, a callback crossing back into Lua and a resume." },
            { t: "p", s: "Lumo calls a cached raw function reference with flat arguments. When the worker answers within the budget, the value is the call's return value: no callback, no promise, and the coroutine never yields. Measured on the same server, small reads took 1.48–1.55 ms with oxmysql and 116–231 µs with Lumo." },
            { t: "diagram", name: "callpath" },

            { t: "h2", id: "transactions", s: "Transactions" },
            { t: "p", s: "oxmysql's `MySQL.transaction` begins a transaction and then awaits `connection.query` once per statement, in order ([rawTransaction.ts](https://github.com/overextended/oxmysql/blob/v2.14.3/src/database/rawTransaction.ts)). Each statement is a full round trip to MariaDB, which is why 10,000 inserts took 14.11 s in the benchmark." },
            { t: "p", s: "Lumo sends the statements as one multi-statement query per chunk of about 1 MB, with `COMMIT` only at the end of the last chunk. MariaDB stops at the first failing statement and the bridge then rolls back, so the semantics stay all-or-nothing. The same 10,000 inserts took 270 ms, about the speed of MariaDB running them from a console client." },
            { t: "table", head: ["", "oxmysql", "Lumo"], rows: [
                ["10,000 inserts in one transaction", "14.11 s", "270 ms"],
                ["Round trips for N statements", "N + 2", "about one per MB of SQL"],
                ["On failure", "rolls back, logs, callback gets `false`", "rolls back, raises the MariaDB error"],
            ] },
            { t: "p", s: "For read-then-write logic, oxmysql's `MySQL.startTransaction` hands your function a query function and rolls back after a fixed 30 seconds ([startTransaction.ts](https://github.com/overextended/oxmysql/blob/v2.14.3/src/database/startTransaction.ts)). Lumo's `Database.transaction` pins a connection to your function's thread, so ordinary table calls inside it join the transaction. The limit is `lumo_checkout_timeout_ms`, connections held by a stopping resource are rolled back, and every connection is reset before it returns to the pool." },

            { t: "h2", id: "prepare", s: "Prepared statements" },
            { t: "p", s: "`MySQL.prepare` uses mysql2's `execute`: a server-side prepared statement, run once per parameter set, one after another ([rawExecute.ts](https://github.com/overextended/oxmysql/blob/v2.14.3/src/database/rawExecute.ts)). Lumo has no prepared statements. Values are bound client-side, which measured faster here because a prepared statement needs an extra round trip; repeated inserts go through `insertMany` (one multi-row INSERT) or `Database.batch`." },

            { t: "h2", id: "errors", s: "Errors" },
            { t: "p", s: "oxmysql logs a failed query to the console and hands the caller `nil` (or `false` for transactions), unless the resource opts into `return_callback_errors`. Lumo raises: the error is a table with the MariaDB error number in `code`, so `pcall` callers can handle a duplicate key (`1062`) and let everything else surface." },

            { t: "h2", id: "only-oxmysql", s: "What oxmysql has that Lumo doesn't" },
            { t: "list", items: [
                "**Named placeholders.** `:name` and `@name` parameters ([parseArguments.ts](https://github.com/overextended/oxmysql/blob/v2.14.3/src/utils/parseArguments.ts)). Lumo takes `?` only.",
                "**Compatibility layers.** oxmysql also provides `mysql-async` and `ghmattimysql`, so old resources run unchanged. Lumo has its own API and a [migration guide](#migrating).",
                "**MySQL support.** oxmysql works with MySQL and MariaDB. Lumo targets MariaDB 11.4+.",
                "**Debugging tools.** `mysql_debug` with optional per-query profiling through `INFORMATION_SCHEMA.PROFILING`, and an in-game query UI (`mysql_ui`). Lumo logs slow queries (`lumo_slow_query_ms`) and every call with `lumo_debug`, without a UI.",
                "**Callback style.** Every oxmysql function also accepts a callback. Lumo calls look blocking and run inside threads; `Database.async` covers running queries in parallel.",
                "**Isolation level setting.** `mysql_transaction_isolation_level` sets it for every pooled connection; Lumo uses the server's default.",
            ] },

            { t: "h2", id: "same", s: "What is the same" },
            { t: "list", items: [
                "Both talk to the database from Node and keep a pool of 10 connections by default.",
                "Both use the text protocol with client-side value escaping for everyday queries.",
                "Both read their connection string from a convar; Lumo falls back to `mysql_connection_string` if `lumo_connection_string` is empty.",
            ] },
        ],
    },

    migrating: {
        title: "Migrating from oxmysql",
        lede: "Most oxmysql calls become a table method. Queries with joins or aggregates move to raw SQL with the same return shape.",
        blocks: [
            { t: "tabs", tabs: [
                { label: "oxmysql", lang: "lua", s: "local player = MySQL.single.await('SELECT * FROM players WHERE license = ?', { license })\n\nlocal id = MySQL.insert.await('INSERT INTO crews (tag, name) VALUES (?, ?)', { tag, name })\n\nMySQL.update.await('UPDATE players SET money = money + ? WHERE id = ?', { 500, player.id })\n\nlocal ok = MySQL.transaction.await({\n    { 'UPDATE players SET money = money - ? WHERE id = ?', { price, buyer } },\n    { 'INSERT INTO inventory (player_id, item) VALUES (?, ?)', { buyer, item } },\n})" },
                { label: "Lumo", lang: "lua", s: "local Players   = Database.table('players')\nlocal Crews     = Database.table('crews')\nlocal Inventory = Database.table('inventory')\n\nlocal player = Players:find({ license = license })\n\nlocal id = Crews:insert({ tag = tag, name = name })\n\nPlayers:increment(player.id, { money = 500 })\n\nDatabase.batch(function()\n    Players:increment(buyer, { money = -price })\n    Inventory:insert({ player_id = buyer, item = item })\nend)" },
            ] },
            { t: "h2", id: "mapping", s: "Call by call" },
            { t: "table", mono: [0, 1], head: ["oxmysql", "Lumo", "Difference"], rows: [
                ["MySQL.single.await(sql, p)", "T:find(where) / T:get(key)", "or `Database.one(sql, ...)` for joins"],
                ["MySQL.query.await(sql, p)", "T:list(opts)", "or `Database.all(sql, ...)`"],
                ["MySQL.scalar.await(sql, p)", "T:count(where) / Database.value(sql, ...)", ""],
                ["MySQL.insert.await(sql, p)", "T:insert(row)", "returns the insert id"],
                ["MySQL.update.await(sql, p)", "T:update / T:increment / T:delete", "return affected rows"],
                ["MySQL.prepare.await(sql, {{…},{…}})", "T:insertMany(rows) / Database.batch(fn)", "one transaction"],
                ["MySQL.transaction.await(list)", "Database.batch(fn)", "raises instead of returning false"],
                ["MySQL.startTransaction(cb)", "Database.transaction(fn)", "commit on return, rollback on raise"],
                ["MySQL.ready(cb)", "Database.ready()", "blocking, inside a thread"],
            ] },
            { t: "h2", id: "behaviour", s: "Behaviour that changes" },
            { t: "list", items: [
                "Errors raise. oxmysql logs and returns nil or false; with Lumo, wrap calls in `pcall` where a failure is expected.",
                "Only `?` placeholders in raw SQL. Rewrite `@name` and `:name` parameters as positional values.",
                "Callbacks are gone. Code that used `MySQL.query(sql, p, function(rows) … end)` moves into a thread, or uses `Database.async`.",
                "Dates arrive as strings, not as millisecond timestamps.",
            ] },
        ],
    },

    faq: {
        title: "FAQ",
        lede: "Short answers to questions that come up when moving a server to Lumo.",
        blocks: [
            { t: "h3", s: "Is the table API slower than writing SQL?" },
            { t: "p", s: "Barely. In the syntax benchmark it cost about 10 µs on the C# prototype and was inside the noise on Node, because the SQL is generated once per call shape and cached. See [Performance](#performance)." },
            { t: "h3", s: "Can a slow query freeze the server?" },
            { t: "p", s: "Not for longer than `lumo_inline_budget_ms` (2 ms by default). After that the query continues on the worker and the server thread moves on." },
            { t: "h3", s: "Does Lumo work on FiveM Enhanced?" },
            { t: "p", s: "The Lua library and the Node bridge ran unchanged on Enhanced build 170 with Node 26 in testing, but Lumo has only been benchmarked on Legacy." },
            { t: "h3", s: "Why not a C# bridge?" },
            { t: "p", s: "A C# prototype was just as fast on bulk work, but every call from Lua into mono costs about 150 µs against about 40 µs for Node." },
            { t: "h3", s: "Is it safe with player input?" },
            { t: "p", s: "Values are always bound, never pasted into SQL, and column names are checked against `[A-Za-z0-9_]`. Player input belongs in values and where tables, never in column names, `orderBy` or raw SQL text." },
        ],
    },
};
