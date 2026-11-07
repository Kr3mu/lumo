<p align="center">
  <img src="brand/kit/lumo-horizontal.svg" alt="Lumo" width="360">
</p>

<p align="center">
  <a href="https://lumo.kr3mu.dev"><b>Documentation: lumo.kr3mu.dev</b></a>
</p>

<p align="center">
  A MariaDB driver for FiveM. Tables are Lua objects, everyday reads and writes need no SQL,<br>
  and every query costs exactly one call into the driver.
</p>

```lua
local Database = require '@lumo'
local Players = Database.table('players')

local player = Players:find({ license = license })
Players:increment(player.id, { money = 500 })
```

## Why Lumo

Most of the time in a FiveM database call is not spent in the database. A small indexed `SELECT` takes MariaDB
50–80 µs; getting the request from Lua into the driver and the answer back is what costs. Lumo is built around that:

- **Tables as objects.** `find`, `get`, `list`, `count`, `exists`, `insert`, `insertMany`, `update`, `updateWhere`,
  `increment`, `upsert`, `delete`, `deleteWhere`. SQL is generated once per call shape and cached.
- **One call per query.** Building SQL, binding values and reading rows happen in Lua. Only the query crosses into
  the driver.
- **Answers inside the call.** A query that finishes within 2 ms is the call's return value; the Lua coroutine
  never yields. Slower ones continue on a worker thread and resume it.
- **Transactions done right.** `Database.transaction(fn)` pins one connection to your function, commits on return and
  rolls back on error. `Database.batch(fn)` sends many writes as one multi-statement round trip.
- **SQL when you need it.** Joins, aggregates and reports use `Database.one`, `all`, `value` and `exec`.
- **Safe by construction.** Values are always bound; column names are checked; `orderBy` only accepts
  `column [ASC|DESC]`; a write with an empty filter refuses to touch every row.

## Install

Requirements: FXServer (Legacy, Node 22 runtime), MariaDB 11.4+, and [ox_lib](https://github.com/overextended/ox_lib)
in resources that use Lumo. FiveM has no built-in `require`: listing `@ox_lib/init.lua` first in a manifest gives the
resource ox_lib's `require`, which loads `@lumo` into it. Lumo then loads the rest of its own files itself.

### As its own resource

```cfg
set lumo_connection_string "mysql://user:password@127.0.0.1/database"
add_unsafe_worker_permission lumo

ensure ox_lib
ensure lumo
```

```lua
-- fxmanifest.lua of a resource that uses Lumo
shared_script '@ox_lib/init.lua'
server_script 'server/init.lua'
dependencies { 'ox_lib', 'lumo' }

-- server/players.lua
local Database = require '@lumo'
```

### Inside a monorepo resource

Copy the `lumo/` folder into your resource (for example `core/lib/lumo/`) and load the driver from your own manifest:

```lua
-- core/fxmanifest.lua
node_version '22'
shared_script '@ox_lib/init.lua'
server_scripts {
    'lib/lumo/dist/server.js',
    'server/init.lua',
}

-- core/server/players.lua
local Database = require 'lib.lumo'   -- a path inside core, not '@lumo'
```

```cfg
add_unsafe_worker_permission core
```

The module finds its own files and talks to the driver in the same resource.

## Examples

```lua
local Database = require '@lumo'
local Players   = Database.table('players')
local Inventory = Database.table('inventory')

-- Reading
local player = Players:get(7)
local top    = Players:list({ orderBy = 'kills DESC', limit = 10 })
local police = Players:count({ job = 'police' })

-- Writing
local id = Players:insert({ license = license, name = name })
Players:update(id, { job = 'police', grade = 2 })
Players:increment(id, { money = -250 })

-- A purchase: read, decide, write, all on one locked connection
local left = Database.transaction(function()
    local p = Players:get(id, { lock = true })
    if p.money < price then error({ code = 'NO_MONEY', message = 'not enough money' }) end
    Players:increment(id, { money = -price })
    Inventory:insert({ player_id = id, item = item })
    return p.money - price
end)

-- Many writes, one round trip
Database.batch(function()
    for _, p in pairs(online) do
        Players:update(p.id, { money = p.money, kills = p.kills })
    end
end)

-- Raw SQL for joins and reports
local crew = Database.one([[
    SELECT c.tag, COUNT(p.id) AS members
    FROM crews c LEFT JOIN players p ON p.crew_id = c.id
    WHERE c.id = ? GROUP BY c.id
]], crewId)

-- Errors are tables
local ok, err = pcall(Crews.insert, Crews, { tag = tag })
if not ok and err.code == 1062 then print('tag taken') end
```

## API

| Call | Returns |
|---|---|
| `Database.table(name, { key = 'id' })` | a table repository |
| `T:get(key, { columns, lock })` / `T:find(where, { columns, orderBy, lock })` | row or `nil` |
| `T:list({ where, columns, orderBy, limit, offset })` | array of rows |
| `T:count(where)` / `T:exists(where)` | integer / boolean |
| `T:insert(row)` / `T:insertMany(rows)` | insert id / affected rows |
| `T:update(key, changes)` / `T:increment(key, deltas)` / `T:upsert(row, { update })` / `T:delete(key)` | affected rows |
| `T:updateWhere(where, changes)` / `T:deleteWhere(where)` | affected rows; empty `where` raises, pass `Database.all_rows` |
| `Database.one / all / value / exec(sql, ...)` | row / rows / value / affected, insert id |
| `Database.transaction(fn, ...)` | `fn`'s return values |
| `Database.batch(fn)` | `true` |
| `local s <close> = Database.session()` | a connection pinned to this thread |
| `Database.async(fn, ...)` | a promise |
| `Database.ready()`, `Database.null`, `Database.all_rows` | |

`where` tables match by equality (joined with AND); an array value becomes `IN (…)` and `Database.null` matches
`NULL`. The full documentation is at [lumo.kr3mu.dev](https://lumo.kr3mu.dev); its source is in `docs/` (`cd docs && bun install && bun run dev`, deploy with `bun run deploy`).

## Configuration

| Convar | Default | |
|---|---|---|
| `lumo_connection_string` | `mysql://root@localhost` | falls back to `mysql_connection_string` |
| `lumo_pool_size` | `10` | connections kept warm by the worker |
| `lumo_inline_budget_ms` | `2` | how long the server thread waits for a fast answer; `0` = always async |
| `lumo_slow_query_ms` | `150` | slower queries are logged with resource and SQL |
| `lumo_checkout_timeout_ms` | `10000` | a held session or transaction older than this is rolled back |
| `lumo_debug` | `false` | log every call |

## Performance

From the benchmarks that led to Lumo (Legacy FXServer, MariaDB 12.3.3, same machine, median of 5 rounds):

| | Lumo's driver | oxmysql 2.14.3 |
|---|---|---|
| oxmysql documentation benchmark, total | **517 ms** | 17.82 s |
| 10,000 inserts in one transaction | **258 ms** | 14.10 s |
| small reads (scalar, single, query) | **108–203 µs** | 1.36–1.72 ms |

The table API costs about the same as hand-written SQL: the SQL is cached per call shape.

## Tests

`test/lumo_test` runs every documented behaviour against a real database in FXServer, in both layouts:

```bash
mariadb -uroot < test/setup.sql
# server.cfg: see test/server.cfg.example (ox_lib, lumo, lumo_test)
```

It prints one `PASS`/`FAIL` line per check and `LUMO TEST OK: <n> passed, 0 failed`. Set
`lumo_test_module lib.lumo` to test an embedded copy instead of the `lumo` resource.

## Building

```bash
cd lumo && bun install && bun run build      # driver → lumo/dist (committed)
cd docs && bun install && bun run build      # documentation site → docs/dist
cd brand && python build_kit.py              # logo SVGs → brand/kit
```

## Repository

| Folder | |
|---|---|
| `lumo/` | the resource: Node driver (`src/` → `dist/`) and Lua module (`init.lua`, `lua/`) |
| `test/` | end-to-end suite, setup SQL, example server config |
| `docs/` | documentation site (Svelte 5 + Vite) |
| `brand/` | logo kit and the scripts that build it; Outfit font under the SIL OFL |
