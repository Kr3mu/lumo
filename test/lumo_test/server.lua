-- Runs every documented Lumo behaviour against the database in lumo_connection_string, prints PASS/FAIL per
-- check and a summary, then stops the server when lumo_test_quit is true. Uses its own lt_* tables.
-- With ox_lib: '@lumo' tests the standalone resource, lumo_test_module 'lib.lumo' an embedded copy.
-- Without ox_lib the manifest includes '@lumo/init.lua', which already defined Database.
local Database = Database or require(GetConvar('lumo_test_module', '@lumo'))

local passed, failed = 0, 0

local function check(name, ok, detail)
    if ok then
        passed += 1
        print(('^2PASS^7 %s'):format(name))
    else
        failed += 1
        print(('^1FAIL^7 %s %s'):format(name, detail and ('-> ' .. tostring(detail)) or ''))
    end
end

local function raises(name, code, fn)
    local ok, err = pcall(fn)
    check(name, not ok and type(err) == 'table' and err.code == code, ok and 'no error' or tostring(err))
end

local function setup()
    Database.exec('DROP TABLE IF EXISTS lt_inventory, lt_settings, lt_players')
    Database.exec([[CREATE TABLE lt_players (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        license VARCHAR(60) NOT NULL UNIQUE,
        name VARCHAR(50) NOT NULL,
        money INT NOT NULL DEFAULT 0,
        kills INT NOT NULL DEFAULT 0,
        crew_id INT NULL
    )]])
    Database.exec('CREATE TABLE lt_inventory (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, player_id INT UNSIGNED NOT NULL, item VARCHAR(50) NOT NULL)')
    Database.exec('CREATE TABLE lt_settings (player_id INT UNSIGNED NOT NULL, `key` VARCHAR(40) NOT NULL, value VARCHAR(100) NULL, PRIMARY KEY (player_id, `key`))')
end

local Players = Database.table('lt_players')
local Inventory = Database.table('lt_inventory')
local Settings = Database.table('lt_settings', { key = 'player_id' })
local Loose = Database.table('lt_players', { strict = false })

local function writing()
    local id = Players:insert({ license = 'license:a', name = 'Alice', money = 100, kills = 5 })
    check('insert returns the new id', type(id) == 'number' and id > 0, id)

    local affected = Players:insertMany({
        { license = 'license:b', name = 'Bob', money = 200, kills = 9 },
        { license = 'license:c', name = 'Cleo', money = 300, kills = 2, crew_id = 7 },
        { license = 'license:d', name = 'Dan', money = 400, kills = 9 },
    })
    check('insertMany returns affected rows', affected == 3, affected)

    check('update returns affected rows', Players:update(id, { name = 'Alice B' }) == 1)
    Players:increment(id, { money = 50, kills = 1 })
    local alice = Players:get(id)
    check('increment adds to each column', alice.money == 150 and alice.kills == 6, alice and alice.money)
    Players:increment(id, { money = -30 })
    check('negative increment subtracts', Players:get(id).money == 120)

    raises('updateWhere refuses an empty where', 'EMPTY_WHERE', function() Players:updateWhere({}, { kills = 0 }) end)
    check('updateWhere filters by where', Players:updateWhere({ kills = 9 }, { crew_id = 3 }) == 2)

    Settings:upsert({ player_id = id, key = 'killsound', value = 'bell' }, { update = { 'value' } })
    Settings:upsert({ player_id = id, key = 'killsound', value = 'horn' }, { update = { 'value' } })
    check('upsert inserts then updates', Database.value('SELECT value FROM lt_settings WHERE player_id = ?', id) == 'horn')
    return id
end

local function reading(id)
    local alice = Players:get(id)
    check('get by key', alice and alice.name == 'Alice B')
    check('get missing key is nil', Players:get(999999) == nil)
    local slim = Players:get(id, { columns = { 'name' } })
    check('get with columns selects only those', slim and slim.name and slim.money == nil)

    check('find by column', (Players:find({ license = 'license:c' }) or {}).name == 'Cleo')
    check('find with an array uses IN', (Players:find({ license = { 'license:x', 'license:d' } }) or {}).name == 'Dan')
    check('find with Database.null matches NULL', (Players:find({ crew_id = Database.null }, { orderBy = 'id' }) or {}).id == id)
    check('find with an empty array matches nothing', Players:find({ license = {} }) == nil)

    local top = Players:list({ orderBy = 'kills DESC, id ASC', limit = 2 })
    check('list orders and limits', #top == 2 and top[1].name == 'Bob' and top[2].name == 'Dan', top[1] and top[1].name)
    local page = Players:list({ orderBy = 'id', limit = 2, offset = 2 })
    check('list offsets', #page == 2 and page[1].name == 'Cleo', page[1] and page[1].name)
    check('list where', #Players:list({ where = { crew_id = 3 } }) == 2)
    check('count with and without where', Players:count() == 4 and Players:count({ kills = 9 }) == 2)
    check('exists', Players:exists({ license = 'license:b' }) == true and Players:exists({ license = 'nope' }) == false)

    raises('orderBy rejects SQL', 'BAD_ORDER_BY', function() Players:list({ orderBy = 'kills; DROP TABLE lt_players' }) end)
    raises('column names are checked', 'BAD_IDENTIFIER', function() Players:find({ ['license` = 1 OR 1=1 --'] = 'x' }) end)
    local evil = "x' OR '1'='1"
    check('values are bound, not pasted', Players:find({ license = evil }) == nil)
end

local function rawSql(id)
    local row = Database.one('SELECT name, money FROM lt_players WHERE id = ?', id)
    check('Database.one', row and row.name == 'Alice B')
    check('Database.all', #Database.all('SELECT id FROM lt_players WHERE money > ?', 150) == 3)
    check('Database.value', Database.value('SELECT COUNT(*) FROM lt_players') == 4)
    local affected, insertId = Database.exec('INSERT INTO lt_inventory (player_id, item) VALUES (?, ?)', id, 'bandage')
    check('Database.exec returns affected and insert id', affected == 1 and type(insertId) == 'number', insertId)
    Database.exec('UPDATE lt_players SET crew_id = ? WHERE id = ?', nil, id)
    check('nil params become NULL', Database.value('SELECT crew_id IS NULL FROM lt_players WHERE id = ?', id) == 1)

    local ok, err = pcall(Players.insert, Players, { license = 'license:a', name = 'Dup' })
    check('duplicate key raises code 1062', not ok and err.code == 1062, err)
    check('error enum names the code', not ok and err.code == Database.Error.DUPLICATE_ENTRY and err.name == 'DUPLICATE_ENTRY', err)
    check('errors print readably', not ok and tostring(err):find('1062', 1, true) ~= nil, tostring(err))
end

local function strict(id)
    local codes = Database.Error
    local ok, err = pcall(Players.find, Players, { licnese = 'license:a' })
    check('strict: unknown column raises with a hint', not ok and err.code == codes.UNKNOWN_COLUMN
        and err.message:find('did you mean license', 1, true) ~= nil, err)
    raises('strict: wrong type in where', codes.BAD_TYPE, function() Players:find({ license = 123 }) end)
    raises('strict: wrong type in an IN list', codes.BAD_TYPE, function() Players:find({ id = { 1, 'two' } }) end)
    raises('strict: wrong type in update', codes.BAD_TYPE, function() Players:update(id, { money = 'lots' }) end)
    raises('strict: fraction into an INT column', codes.BAD_TYPE, function() Players:update(id, { money = 1.5 }) end)
    raises('strict: NULL into NOT NULL', codes.BAD_TYPE, function() Players:insert({ license = 'license:z', name = Database.null }) end)
    raises('strict: increment needs a numeric column', codes.BAD_TYPE, function() Players:increment(id, { name = 1 }) end)
    raises('strict: wrong key type', codes.BAD_TYPE, function() Players:get('7') end)
    raises('strict: orderBy column is checked', codes.UNKNOWN_COLUMN, function() Players:list({ orderBy = 'monye DESC' }) end)
    raises('strict: columns option is checked', codes.UNKNOWN_COLUMN, function() Players:get(id, { columns = { 'nmae' } }) end)
    raises('strict: upsert update list is checked', codes.UNKNOWN_COLUMN, function()
        Settings:upsert({ player_id = id, key = 'k', value = 'v' }, { update = { 'vlaue' } })
    end)
    check('strict: whole floats pass for INT', Players:update(id, { money = 120.0 }) == 1)
    check('strict: Database.null passes for a nullable column', Players:update(id, { crew_id = Database.null }) == 1)

    raises('strict off: MariaDB reports the unknown column', codes.BAD_FIELD, function() Loose:find({ licnese = 'x' }) end)
    check('strict off: tables still work', (Loose:get(id) or {}).id == id)
end

local function transactions(id)
    local left = Database.transaction(function()
        local p = Players:get(id, { lock = true })
        Players:increment(id, { money = -20 })
        Inventory:insert({ player_id = id, item = 'pistol' })
        return p.money - 20
    end)
    check('transaction commits and returns fn values', left == 100 and Players:get(id).money == 100, left)

    local ok, err = pcall(Database.transaction, function()
        Players:increment(id, { money = -100 })
        error({ code = 'NO_MONEY', message = 'not enough money' })
    end)
    check('raising rolls the transaction back', not ok and err.code == 'NO_MONEY' and Players:get(id).money == 100, err)

    Database.transaction(function()
        Database.transaction(function() Players:increment(id, { money = 1 }) end)
        Players:increment(id, { money = 1 })
    end)
    check('nested transaction joins the outer one', Players:get(id).money == 102)
end

local function batches(id)
    local bob = Players:find({ license = 'license:b' })
    Database.batch(function()
        Players:increment(id, { money = -2 })
        Players:increment(bob.id, { money = 2 })
        Inventory:insert({ player_id = bob.id, item = 'armour' })
    end)
    check('batch commits every write', Players:get(id).money == 100 and Players:get(bob.id).money == 202)

    local ok = pcall(Database.batch, function()
        Players:increment(id, { money = -50 })
        Players:insert({ license = 'license:b', name = 'Dup' })
    end)
    check('a failing write rolls the whole batch back', not ok and Players:get(id).money == 100)

    raises('reads raise inside a batch', 'READ_IN_BATCH', function()
        Database.batch(function() Players:get(id) end)
    end)
end

local function sessions()
    do
        local session <close> = Database.session()
        Database.exec('CREATE TEMPORARY TABLE lt_tmp (n INT)')
        Database.exec('INSERT INTO lt_tmp VALUES (1), (2)')
        check('a session keeps connection state across calls', Database.value('SELECT COUNT(*) FROM lt_tmp') == 2)
    end

    local leaked = false
    for _ = 1, 12 do
        local ok = pcall(Database.value, 'SELECT COUNT(*) FROM lt_tmp')
        if ok then leaked = true end
    end
    check('session state does not leak into the pool', not leaked)
end

local function asyncCalls()
    local a = Database.async(Database.value, 'SELECT SLEEP(0.05) + 1')
    local b = Database.async(Database.value, 'SELECT SLEEP(0.05) + 2')
    local started = os.nanotime()
    local ra, rb = Citizen.Await(a), Citizen.Await(b)
    local ms = (os.nanotime() - started) / 1e6
    check('Database.async runs queries in parallel', ra == 1 and rb == 2 and ms < 95, ('%.1f ms'):format(ms))
end

-- Lua-side cost only: inside a batch, writes are collected and never sent, and the error throws the batch away.
local function luaCost(label, repo, fn)
    local n, elapsed = 100000, 0
    pcall(Database.batch, function()
        local started = os.nanotime()
        for i = 1, n do fn(repo, i) end
        elapsed = os.nanotime() - started
        error('discard')
    end)
    print(('timing: %-34s %6.2f us per call, Lua only (%d calls)'):format(label, elapsed / n / 1e3, n))
end

local function strictCost()
    for _ = 1, 2 do
        luaCost('update          strict', Players, function(r, i) r:update(1, { money = i, kills = 2 }) end)
        luaCost('update          loose', Loose, function(r, i) r:update(1, { money = i, kills = 2 }) end)
        luaCost('updateWhere IN  strict', Players, function(r, i) r:updateWhere({ license = 'license:b', crew_id = { 1, 2, 3 } }, { money = i }) end)
        luaCost('updateWhere IN  loose', Loose, function(r, i) r:updateWhere({ license = 'license:b', crew_id = { 1, 2, 3 } }, { money = i }) end)
        luaCost('insert 4 cols   strict', Players, function(r, i) r:insert({ license = 'x', name = 'y', money = i, kills = 1 }) end)
        luaCost('insert 4 cols   loose', Loose, function(r, i) r:insert({ license = 'x', name = 'y', money = i, kills = 1 }) end)
    end

    local fresh = Database.table('lt_settings', { key = 'key' })
    local started = os.nanotime()
    fresh:count()
    local first = os.nanotime() - started
    started = os.nanotime()
    fresh:count()
    local second = os.nanotime() - started
    print(('timing: %-34s %6.1f us once per table (first call %.1f us, next %.1f us)'):format('schema load', (first - second) / 1e3, first / 1e3, second / 1e3))
end

local function timing()
    local n = 2000
    local function measure(label, fn)
        local started = os.nanotime()
        for i = 1, n do fn(i) end
        print(('timing: %-34s avg %6.1f us over %d calls'):format(label, (os.nanotime() - started) / n / 1e3, n))
    end

    measure("Database.value('SELECT 1')", function() Database.value('SELECT 1') end)
    for round = 1, 3 do
        measure(('Players:get(id)        strict  r%d'):format(round), function() Players:get(1) end)
        measure(('Players:get(id)        loose   r%d'):format(round), function() Loose:get(1) end)
        measure(('Players:find(license)  strict  r%d'):format(round), function(i) Players:find({ license = (i % 2 == 0) and 'license:b' or 'license:c' }) end)
        measure(('Players:find(license)  loose   r%d'):format(round), function(i) Loose:find({ license = (i % 2 == 0) and 'license:b' or 'license:c' }) end)
    end
    measure('Database.one(raw find)', function(i)
        Database.one('SELECT * FROM lt_players WHERE license = ? LIMIT 1', (i % 2 == 0) and 'license:b' or 'license:c')
    end)
end

CreateThread(function()
    Database.ready()
    local ok, err = pcall(function()
        setup()
        local id = writing()
        reading(id)
        rawSql(id)
        strict(id)
        transactions(id)
        batches(id)
        sessions()
        asyncCalls()
        strictCost()
        timing()
    end)
    if not ok then check('suite ran to the end', false, err) end

    print(('LUMO TEST %s: %d passed, %d failed'):format(failed == 0 and 'OK' or 'FAILED', passed, failed))
    if GetConvarInt('lumo_test_quit', 0) == 1 then ExecuteCommand('quit') end
end)
