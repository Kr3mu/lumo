-- Database.define: a table declared in code. Lumo creates it if it is missing (CREATE TABLE IF NOT EXISTS, in the
-- order the definitions run, so foreign keys can point at earlier tables), adds any columns the live table lacks, and
-- writes lumo.d.lua at the root of this resource with LuaLS types for every definition. Calls on a table wait until
-- it's ready.
return function(Errors, Bridge, Sql, Table, Typegen, Columns, Sync, Migrate)
    local Define = {}

    -- At the resource root: SaveResourceFile can't create folders.
    local TYPES_PATH = 'lumo.d.lua'

    local definitions, byName = {}, {}
    local queue = {}
    local running = false
    local migrated = false
    local failure
    local busy

    local function createSql(name, entries)
        local lines = {}
        for i = 1, #entries do
            local entry = entries[i]
            lines[i] = type(entry) == 'string' and entry or Sql.ident(entry[1]) .. ' ' .. entry[2]
        end
        return ('CREATE TABLE IF NOT EXISTS %s (\n    %s\n)'):format(Sql.ident(name), table.concat(lines, ',\n    '))
    end

    local function writeTypes()
        local resource = GetCurrentResourceName()
        local text = Typegen.build(definitions, resource)
        if LoadResourceFile(resource, TYPES_PATH) == text then return end

        if SaveResourceFile(resource, TYPES_PATH, text, -1) then
            print(('^5[lumo] types for %d tables written to @%s/%s^7'):format(#definitions, resource, TYPES_PATH))
        else
            print(('^3[lumo] could not write @%s/%s^7'):format(resource, TYPES_PATH))
        end
    end

    local function createOrSync(job)
        Bridge.call('exec', 0, job.sql)
        Sync.run(job.name, job.entries)
    end

    -- One thread works through the queue; a define made while it runs joins the same pass.
    local function run()
        Bridge.call('ready')

        if not migrated then
            migrated = true
            local ok, err = pcall(Migrate.run)
            if not ok then
                failure = err
                print(('^1[lumo] a migration failed, so no tables were created or changed: %s^7'):format(tostring(err)))
            end
        end

        local i = 1
        while queue[i] do
            local job = queue[i]
            local ok, err = false, failure
            if not failure then ok, err = pcall(createOrSync, job) end
            if ok then
                job.repo.pending = nil
                job.promise:resolve(true)
            else
                print(('^1[lumo] could not create table %s: %s^7'):format(job.name, tostring(err)))
                job.promise:reject(err)
            end
            i += 1
        end

        queue = {}
        running = false
        local done = busy
        busy = nil
        done:resolve(true)
        writeTypes()
    end

    -- Raw SQL can name a defined table too, so it waits for every pending definition in this resource.
    function Define.wait()
        if busy then Citizen.Await(busy) end
        if failure then error(failure, 0) end
    end

    ---@param name string
    ---@param columns table<string, string> column = shorthand, e.g. { id = 'id', owner = 'string(60) unique' }
    ---@param options table | nil key, strict, and the table-level primary / indexes / unique
    function Define.define(name, columns, options)
        local entries = Columns.compileTable(name, columns, options)
        local sql = createSql(name, entries)
        local repo = Table.get_table(name, options)

        local definition = { name = name, columns = entries }
        local index = byName[name]
        if index then
            definitions[index] = definition
        else
            definitions[#definitions + 1] = definition
            byName[name] = #definitions
        end

        local done = promise.new()
        repo.pending = done
        queue[#queue + 1] = { name = name, sql = sql, entries = entries, repo = repo, promise = done }

        if not running then
            running = true
            busy = promise.new()
            CreateThread(run)
        end
        return repo
    end

    return Define
end
