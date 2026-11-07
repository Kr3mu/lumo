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
    { title: "Guide", pages: ["tables", "reading", "writing", "raw-sql", "errors", "transactions", "batches", "sessions", "threads"] },
    { title: "API reference", pages: ["api-db", "api-table", "types"] },
    { title: "More", pages: ["performance", "architecture", "migrating", "faq"] },
];

export const pages = {
    introduction: {
        title: "Introduction",
        lede: "Lumo is a MariaDB driver for FiveM servers. You work with tables as Lua objects, write no SQL for everyday reads and writes, and every query costs exactly one call into the driver.",
        blocks: [
            { t: "note", kind: "info", s: "Lumo 0.1. Every behaviour on these pages is covered by an end-to-end suite that runs in FXServer against MariaDB, in both the standalone and the monorepo layout. Speed figures come from the benchmarks that led to Lumo." },
            { t: "code", lang: "lua", title: "server/players.lua", s: "local Database = require '@lumo'\nlocal Players = Database.table('players')\n\nAddEventHandler('playerJoining', function()\n    local player = Players:find({ license = GetPlayerIdentifierByType(source, 'license') })\n    print(player and player.money)\nend)" },
            { t: "h2", id: "why", s: "Why another driver" },
            { t: "p", s: "Most of the time in a FiveM database call is not spent in the database. A small SELECT takes MariaDB 50–80 µs; getting the request from Lua into the driver and the answer back is what costs. Lumo is built around that measurement." },
            { t: "list", items: [
                "**Tables as objects.** `Database.table('players')` gives you `find`, `get`, `list`, `insert`, `update`, `increment` and `delete`. The SQL is generated once per call shape and cached.",
                "**One call per query.** Building the SQL, binding values and reading rows all happen in Lua, where they cost microseconds. Only the query itself crosses into the driver.",
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
        lede: "Lumo is one folder in the monorepo: a server resource with its driver, and a Lua module that other resources load with `require`.",
        blocks: [
            { t: "h2", id: "requirements", s: "Requirements" },
            { t: "table", head: ["Component", "Version", "Why"], rows: [
                ["FXServer", "Legacy, Node 22 runtime", "the driver runs on Node with a worker thread"],
                ["MariaDB", "11.4 or newer", "multi-statement batches and the text protocol Lumo uses"],
                ["Resources using Lumo", "`lua54 'yes'`", "`<close>` and `<const>` are Lua 5.4 features"],
            ] },
            { t: "h2", id: "setup", s: "Set up" },
            { t: "steps", items: [
                { title: "Add Lumo to the monorepo", s: "Lumo lives in the monorepo as `lumo/`: `init.lua` is the Lua module, the driver sits beside it. The server starts it like any other resource." },
                { title: "Set the connection string and permissions", s: "Lumo reads `lumo_connection_string`. The worker thread needs `add_unsafe_worker_permission`.", lang: "cfg", code: "set lumo_connection_string \"mysql://lumo:secret@127.0.0.1/fivem\"\nadd_unsafe_worker_permission lumo\n\nensure lumo" },
                { title: "Require it where you need it", s: "Resources load Lumo with ox_lib's `require`, which accepts other resources: `require '@lumo'` runs `lumo/init.lua` inside your resource and returns the `Database` module. Lumo defines no globals.", lang: "lua", code: "-- fxmanifest.lua\nfx_version 'cerulean'\ngame 'gta5'\nlua54 'yes'\n\nshared_script '@ox_lib/init.lua'\nserver_script 'server/init.lua'\n\ndependencies { 'ox_lib', 'lumo' }" },
                { title: "Declare a table and use it", s: "Tables are usually declared at the top of a module and used from event handlers.", lang: "lua", code: "-- server/players.lua\nlocal Database = require '@lumo'\nlocal Players = Database.table('players')\n\nCreateThread(function()\n    Database.ready()\n    print(('%d players in the database'):format(Players:count()))\nend)" },
            ] },
            { t: "note", kind: "tip", s: "Keep `ensure lumo` above the resources that use it. Calls made before Lumo has connected wait for the connection instead of failing; see [Database.ready](#api-db)." },
            { t: "h2", id: "monorepo", s: "Inside a monorepo resource" },
            { t: "p", s: "If your server is one big resource with everything inside (a `core` resource with modules under it), copy the `lumo` folder into it, for example to `core/lib/lumo/`, and load the driver from your own manifest. The Lua module finds its own files and talks to the driver in the same resource; nothing else changes." },
            { t: "code", lang: "lua", title: "core/fxmanifest.lua", s: "fx_version 'cerulean'\ngame 'gta5'\nlua54 'yes'\nnode_version '22'\n\nshared_script '@ox_lib/init.lua'\nserver_scripts {\n    'lib/lumo/dist/server.js',   -- the Lumo driver, running inside core\n    'server/init.lua',\n}" },
            { t: "code", lang: "cfg", title: "server.cfg", s: "set lumo_connection_string \"mysql://lumo:secret@127.0.0.1/fivem\"\nadd_unsafe_worker_permission core\nensure core" },
            { t: "code", lang: "lua", title: "core/server/players.lua", s: "local Database = require 'lib.lumo'   -- a path inside core, not '@lumo'\nlocal Players = Database.table('players')" },
            { t: "note", kind: "info", s: "`require '@lumo'` means \"the lumo resource\"; a plain path like `'lib.lumo'` means \"this resource\". In both cases every query is still one call into the driver." },
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
            { t: "note", kind: "info", s: "The examples in these docs leave out the `require` line: every file that uses Lumo starts with `local Database = require '@lumo'`." },
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
            { t: "p", s: "Each of these is one call into the driver. [Reading](#reading) and [Writing](#writing) cover the options; [Table](#api-table) lists every method." },
            { t: "h2", id: "cache", s: "Generated SQL is cached" },
            { t: "p", s: "The SQL for a call depends only on its shape: the table, the method and the column names you pass, never the values. Lumo builds it the first time a shape is used and caches it, so later calls do a few table lookups and no string building. In the syntax benchmark this costs about 10 µs over hand-written SQL on the C# prototype and is lost in the noise on Node." },
            { t: "h2", id: "safety", s: "Column names and values" },
            { t: "p", s: "Values are always bound as parameters, never pasted into SQL. Column names come from table keys, so Lumo checks every name against `[A-Za-z0-9_]` and quotes it. `orderBy` accepts only `column` or `column ASC|DESC` lists. Building a `where` table from player input is safe; building a column name from player input raises an error." },
        ],
    },

    reading: {
        title: "Reading",
        lede: "`get`, `find`, `list`, `count` and `exists` read rows. Each is one call into the driver.",
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
        ],
    },

    errors: {
        title: "Errors",
        lede: "A failed query raises a Lua error. The error value is a table, so you can branch on the MariaDB code instead of matching message text.",
        blocks: [
            { t: "code", lang: "lua", s: "local ok, err = pcall(Crews.insert, Crews, { tag = tag, name = name })\nif not ok then\n    if err.code == 1062 then\n        return notify(src, 'That crew tag is taken.')\n    end\n    error(err) -- anything else is a bug: let it surface\nend" },
            { t: "h2", id: "fields", s: "Error fields" },
            { t: "table", mono: [0], head: ["Field", "Example", "Meaning"], rows: [
                ["code", "1062", "MariaDB error number"],
                ["state", "23000", "SQLSTATE class"],
                ["message", "Duplicate entry 'NOVA' for key 'tag'", "server message"],
                ["sql", "INSERT INTO `crews` (`name`, `tag`) VALUES (?, ?)", "the generated or raw SQL, without values"],
                ["resource", "crews", "the resource that made the call"],
            ] },
            { t: "h2", id: "common", s: "Codes you will meet" },
            { t: "table", mono: [0], head: ["Code", "Name", "Usual cause"], rows: [
                ["1062", "ER_DUP_ENTRY", "a UNIQUE or PRIMARY KEY already has this value"],
                ["1452", "ER_NO_REFERENCED_ROW", "a foreign key points at a row that does not exist"],
                ["1213", "ER_LOCK_DEADLOCK", "two transactions locked rows in opposite order; retry the transaction"],
                ["1205", "ER_LOCK_WAIT_TIMEOUT", "a row stayed locked longer than innodb_lock_wait_timeout"],
                ["1054", "ER_BAD_FIELD_ERROR", "a column name in a where or row table does not exist"],
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
                ["Calls into the driver", "one per query, plus begin and commit", "1"],
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
            { t: "code", lang: "lua", title: "Save everyone on shutdown", s: "AddEventHandler('onResourceStop', function(name)\n    if name ~= GetCurrentResourceName() then return end\n\n    Database.batch(function()\n        for _, p in pairs(Players.online) do\n            Players:update(p.id, { money = p.money, kills = p.kills, deaths = p.deaths })\n        end\n    end) -- one call into the driver, one transaction\nend)" },
            { t: "h2", id: "transfer", s: "A money transfer" },
            { t: "code", lang: "lua", s: "Database.batch(function()\n    Players:increment(buyerId, { money = -2500 })\n    Players:increment(sellerId, { money = 2500 })\n    Trades:insert({ buyer = buyerId, seller = sellerId, amount = 2500 })\nend)" },
            { t: "h2", id: "semantics", s: "How it runs" },
            { t: "p", s: "MariaDB executes a multi-statement query in order and stops at the first failing statement. Lumo sends `COMMIT` only as the last statement of the last chunk, so a failure never commits; the driver then sends `ROLLBACK` and raises the error." },
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
        lede: "The module `require '@lumo'` returns. Every Lumo call starts here.",
        blocks: [
            { t: "api", name: "Database.table", sig: "Database.table(name, options?)", calls: 0, returns: "Table", s: "Returns the repository for a table, creating it on first use. One object per table name per resource.", params: [{ name: "name", type: "string", s: "table name, `[A-Za-z0-9_]` only" }, { name: "options.key", type: "string", s: "primary key column, default `'id'`" }] },
            { t: "api", name: "Database.one", sig: "Database.one(sql, ...)", calls: 1, returns: "row | nil", s: "Runs raw SQL and returns the first row." },
            { t: "api", name: "Database.all", sig: "Database.all(sql, ...)", calls: 1, returns: "{ row }", s: "Runs raw SQL and returns every row." },
            { t: "api", name: "Database.value", sig: "Database.value(sql, ...)", calls: 1, returns: "any | nil", s: "Runs raw SQL and returns the first column of the first row." },
            { t: "api", name: "Database.exec", sig: "Database.exec(sql, ...)", calls: 1, returns: "integer, integer | nil", s: "Runs raw SQL for its effect. Returns affected rows and, for an INSERT, the insert id." },
            { t: "api", name: "Database.transaction", sig: "Database.transaction(fn, ...)", calls: "n + 2", returns: "fn's return values", s: "Checks out a connection, begins a transaction and calls `fn(...)`. Every Lumo call in that thread joins the transaction. Commits when fn returns; rolls back and re-raises when it raises." },
            { t: "api", name: "Database.batch", sig: "Database.batch(fn)", calls: 1, returns: "true", s: "Calls `fn()`, collecting the writes it makes, then sends them all in one transaction as one round trip. Reads raise inside a batch." },
            { t: "api", name: "Database.session", sig: "Database.session()", calls: 1, returns: "Session", s: "Pins a connection to the current thread until the session is closed. Use with `<close>`." },
            { t: "api", name: "Database.async", sig: "Database.async(fn, ...)", calls: 0, returns: "promise", s: "Runs `fn(...)` in a new thread and returns a promise for its result, for overlapping independent queries." },
            { t: "api", name: "Database.ready", sig: "Database.ready()", calls: 1, returns: "true", s: "Waits until the driver has its first connection. Table calls already wait on their own; use this for startup checks." },
            { t: "api", name: "Database.null / Database.all_rows", sig: "Database.null, Database.all_rows", calls: 0, returns: "sentinel", s: "`Database.null` matches or writes NULL inside a where or row table. `Database.all_rows` is the explicit where for `updateWhere` and `deleteWhere` on every row." },
        ],
    },

    "api-table": {
        title: "Table",
        lede: "Returned by `Database.table`. Every method is one call into the driver; the SQL is generated once per call shape and cached.",
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
            { t: "note", kind: "info", s: "Values are written into the SQL text by the driver (client-side binding). In the sqlbench measurements this was faster than server-side prepared statements, which need an extra round trip to prepare." },
        ],
    },

    performance: {
        title: "Performance",
        lede: "Measured on a Legacy FXServer against MariaDB 12.3.3 on the same machine.",
        blocks: [
            { t: "diagram", name: "bench" },
            { t: "h2", id: "syntax", s: "Repositories against raw SQL" },
            { t: "p", s: "The same tasks on 10,000 indexed players, through the Lumo table API, on each driver prototype and on oxmysql (all three running the same Lua syntax layer). Median of 3 rounds of 1,500 reads or 300 writes." },
            { t: "table", mono: [1, 2, 3], head: ["Task", "Node driver", "C# driver", "oxmysql 2.14.3"], rows: [
                ["`Players:find({ license = l })`", "115 µs", "306 µs", "1.20 ms"],
                ["`Players:list({ orderBy = 'kills DESC', limit = 10 })`", "126 µs", "337 µs", "1.18 ms"],
                ["`Players:increment(id, { money = 1 })`", "1.04 ms", "1.35 ms", "1.97 ms"],
                ["2-write `Database.batch`", "1.17 ms", "1.45 ms", "4.44 ms"],
            ] },
            { t: "p", s: "Against hand-written SQL on the same driver, the table API cost +10 to +13 µs on the C# prototype and was inside the ±20 µs run-to-run noise on Node. Lumo uses the Node driver." },
            { t: "h2", id: "steps", s: "The oxmysql documentation benchmark" },
            { t: "table", mono: [1, 2], head: ["Step", "Lumo driver (Node)", "oxmysql 2.14.3"], rows: [
                ["initialise test_table (4 statements)", "32.74 ms", "35.45 ms"],
                ["small transactions (2 statements)", "1.23–1.57 ms", "5.70–6.03 ms"],
                ["insert 10,000 users (one transaction)", "258.07 ms", "14.10 s"],
                ["select every 4th user id (2,500 lookups)", "219.31 ms", "3.65 s"],
                ["scalar / single / prepare / query", "108–203 µs", "1.36–1.72 ms"],
                ["**total**", "**517.25 ms**", "**17.82 s**"],
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
            { t: "h2", id: "why-node", s: "Why the driver is Node, not C#" },
            { t: "p", s: "Both prototypes reach the database floor on bulk work (Node 517 ms, C# 523 ms on the full benchmark). The difference is the call itself: an empty Lua → Node export costs about 40 µs, an empty Lua → C# export on mono about 150 µs. That is why every read above is about 2.6× faster on Node." },
        ],
    },

    architecture: {
        title: "Architecture",
        lede: "Three layers, and one rule: exactly one call from Lua into the driver per query.",
        blocks: [
            { t: "diagram", name: "layers" },
            { t: "h2", id: "lua", s: "Lua table layer" },
            { t: "p", s: "`require '@lumo'` runs Lumo's Lua module inside each resource that loads it. Table objects turn method calls into cached SQL plus a value array; nothing crosses into the driver until the query runs. The layer caches the driver's raw export function references once, skipping the exports proxy (worth 23–31 µs per call)." },
            { t: "h2", id: "bridge", s: "Bridge" },
            { t: "p", s: "Three exports with flat arguments: `exec(shape, sql, params, session)`, `batch(sqls, index, params)` and `checkout` / `release`. A fast answer is the export's return value. A slow one returns a job id, and the answer arrives through one resumer function each resource registers at startup, so no Lua function crosses the bridge per call." },
            { t: "code", lang: "ts", title: "bridge contract", s: "exec(shape: 0 | 1 | 2 | 3, sql: string, params?: unknown[], session?: number): unknown\n// returns the value, or [false, error], or [false, jobId] when it continues async\n\nbatch(sqls: string[], index: number[], params: unknown[][]): true | [false, Error]\ncheckout(): number\nrelease(session: number): void" },
            { t: "h2", id: "driver", s: "Driver" },
            { t: "list", items: [
                "The Node main thread writes each request into a SharedArrayBuffer when the worker is spinning, and waits up to the inline budget for the reply.",
                "The worker thread owns the connection pool, the handle table for sessions and transactions, and a dedicated connection for fast single statements.",
                "Replies use a compact binary format with a key table. Values that format cannot carry (Buffer, Date, BigInt) fall back to v8 serialization, so types never change between the inline and async paths.",
            ] },
            { t: "h2", id: "chatty", s: "What it avoids" },
            { t: "diagram", name: "chatty" },
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
            { t: "p", s: "The Lua library and the Node driver ran unchanged on Enhanced build 170 with Node 26 in testing, but Lumo has only been benchmarked on Legacy." },
            { t: "h3", s: "Why not a C# driver?" },
            { t: "p", s: "A C# prototype was just as fast on bulk work, but every call from Lua into mono costs about 150 µs against about 40 µs for Node." },
            { t: "h3", s: "Is it safe with player input?" },
            { t: "p", s: "Values are always bound, never pasted into SQL, and column names are checked against `[A-Za-z0-9_]`. Player input belongs in values and where tables, never in column names, `orderBy` or raw SQL text." },
        ],
    },
};
