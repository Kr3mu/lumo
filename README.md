# Lumo

A MariaDB driver for FiveM. Lua scripts work with tables as objects, write no SQL for everyday reads and writes,
and every query costs exactly one call into the driver.

```lua
local Database = require '@lumo'
local Players = Database.table('players')

local player = Players:find({ license = license })
Players:increment(player.id, { money = 500 })
```

## Repository

| Folder | What it is |
|---|---|
| `lumo/` | The FiveM resource: a Node driver with a worker thread (`src/` → `dist/`) and the Lua `Database` module (`init.lua`, `lua/`) |
| `test/` | End-to-end checks that run in FXServer against a real MariaDB |
| `docs/` | The documentation site (Svelte 5 + Vite) |
| `brand/` | The logo kit and the scripts that build it |
