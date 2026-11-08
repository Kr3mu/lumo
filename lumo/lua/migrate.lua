-- Runs migrations/0001.sql, 0002.sql and so on once each, before any Database.define. They hold what a define can't do
-- by itself, like moving data between columns.
return function(Bridge, Query)
    local Migrate = {}

    local PATH <const> = "migrations/%04d.sql"
    local COUNT_TABLES <const> = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()"
    local CREATE_LOG <const> = [[
        CREATE TABLE IF NOT EXISTS `lumo_migrations` (
            `id` INT UNSIGNED NOT NULL PRIMARY KEY,
            `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ]]
    local LOG <const> = "INSERT INTO `lumo_migrations` (`id`) VALUES (?)"

    -- Resources can't list a folder, so the numbers have to run without a gap.
    local function readFiles()
        local files, resource = {}, GetCurrentResourceName()
        local source = LoadResourceFile(resource, PATH:format(1))
        while source do
            files[#files + 1] = source
            source = LoadResourceFile(resource, PATH:format(#files + 1))
        end
        return files
    end

    local function statementsOf(source)
        local text = ("\n" .. source:gsub("\r", "")):gsub("\n%s*%-%-[^\n]*", "") .. "\n"
        local statements = {}
        for statement in text:gmatch("(.-);%s*\n") do
            if statement:find("%S") then statements[#statements + 1] = statement end
        end
        local last = text:match(".*;%s*\n(.*)$") or text
        if last:find("%S") then statements[#statements + 1] = last end
        return statements
    end

    local function apply(number, source)
        local statements = statementsOf(source)
        for i = 1, #statements do
            Bridge.call("exec", Query.RUN, statements[i])
        end
        Bridge.call("exec", Query.RUN, LOG, { number })
        print(("^5[lumo] applied migration %04d^7"):format(number))
    end

    function Migrate.run()
        local fresh = Bridge.call("exec", Query.VALUE, COUNT_TABLES) == 0
        Bridge.call("exec", Query.RUN, CREATE_LOG)

        local files = readFiles()
        -- The defines build the newest shape on an empty database, so a rename there has nothing to rename.
        if fresh then
            for number = 1, #files do Bridge.call("exec", Query.RUN, LOG, { number }) end
            return
        end

        local rows = Bridge.call("exec", Query.ALL, "SELECT `id` FROM `lumo_migrations`")
        local applied = {}
        for i = 1, #rows do applied[rows[i].id] = true end

        for number = 1, #files do
            if not applied[number] then apply(number, files[number]) end
        end
    end

    return Migrate
end
