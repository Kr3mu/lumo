-- Brings an existing table up to its Database.define: columns are added, renamed, changed and dropped to match.
-- Every change runs in strict mode, so one that would cut text off fails and leaves the column as it was. Strict mode
-- still lets a number round, so that's refused here, along with a required column that would fill rows with fake zeroes.
return function(Bridge, Query)
    local Sync = {}

    local COLUMNS_SQL <const> = [[
        SELECT COLUMN_NAME AS name, COLUMN_TYPE AS columnType, IS_NULLABLE AS nullable
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ?
    ]]
    local ALTER_SQL <const> = "SET STATEMENT sql_mode = 'STRICT_ALL_TABLES' FOR ALTER TABLE `%s` %s"

    -- MariaDB reports its own spelling of a type: int(10) unsigned for INT UNSIGNED, longtext for JSON.
    local function normalize(columnType)
        local text = columnType:lower():gsub("%s*,%s*", ",")
        if text == "tinyint(1)" then return text end
        if text == "json" then return "longtext" end
        if text == "decimal" then return "decimal(10,0)" end
        return (text:gsub("^(%a*int)%(%d+%)", "%1"))
    end

    local function alter(tableName, change, description)
        local ok, err = pcall(Bridge.call, "exec", Query.RUN, ALTER_SQL:format(tableName, change))
        if ok then
            print(("^3[lumo] %s: %s^7"):format(tableName, description))
        else
            print(("^1[lumo] %s: FAILED, nothing changed (%s): %s^7"):format(tableName, description, tostring(err)))
        end
    end

    -- The key already exists, and repeating it here would fail or add a second index.
    local function withoutKeys(definition)
        return (definition:gsub(" UNIQUE", ""):gsub(" PRIMARY KEY", ""))
    end

    local function isNullable(definition)
        return not definition:upper():find("NOT NULL", 1, true)
    end

    -- sql: columns have no type to compare, so they never count as changed or renamed.
    local function differences(entry, column)
        local columnType = entry[3]
        if not columnType then return {} end

        local found = {}
        if normalize(columnType) ~= normalize(column.columnType) then
            found[#found + 1] = ("changed %s from %s to %s"):format(entry[1], column.columnType, columnType)
        end
        local wantsNull = isNullable(entry[2])
        if wantsNull ~= (column.nullable == "YES") then
            found[#found + 1] = ("made %s %s"):format(entry[1], wantsNull and "nullable" or "NOT NULL")
        end
        return found
    end

    -- A rename looks like one column gone and one new. That's only safe to assume when the type leaves one candidate.
    local function matchRenames(tableName, added, removed)
        local buckets = {}
        local function bucket(columnType)
            local key = normalize(columnType)
            buckets[key] = buckets[key] or { added = {}, removed = {} }
            return buckets[key]
        end
        for i = 1, #added do
            if added[i][3] then
                local list = bucket(added[i][3]).added
                list[#list + 1] = added[i]
            end
        end
        for i = 1, #removed do
            local list = bucket(removed[i].columnType).removed
            list[#list + 1] = removed[i]
        end

        local renames, renamed, kept = {}, {}, {}
        for key, group in pairs(buckets) do
            if #group.added == 1 and #group.removed == 1 then
                renames[#renames + 1] = { entry = group.added[1], from = group.removed[1].name }
                renamed[group.added[1][1]] = true
                kept[group.removed[1].name] = true
            elseif #group.added > 0 and #group.removed > 0 then
                local names = {}
                for i = 1, #group.removed do
                    names[i] = group.removed[i].name
                    kept[names[i]] = true
                end
                print(("^1[lumo] %s: could not tell which %s columns were renamed, so %s stays. Rename one at a time^7"):format(tableName, key, table.concat(names, ", ")))
            end
        end
        return renames, renamed, kept
    end

    local function needsValue(definition)
        return not isNullable(definition) and not definition:find(" DEFAULT ", 1, true) and not definition:find("AUTO_INCREMENT", 1, true)
    end

    -- Rounds or drops part of what's stored, without strict mode objecting.
    local function mayRound(from, to)
        if normalize(from) == normalize(to) then return false end
        local text = from:lower()
        return text:find("^float") or text:find("^double") or text:find("^decimal") or text:find("^datetime") or text:find("^timestamp")
    end

    local function addColumns(tableName, entries, added, renamed)
        local changes, names, isNew = {}, {}, {}
        local hasRows = Bridge.call("exec", Query.VALUE, ("SELECT 1 FROM `%s` LIMIT 1"):format(tableName)) ~= nil
        for i = 1, #added do
            local name = added[i][1]
            if not renamed[name] and hasRows and needsValue(added[i][2]) then
                print(("^1[lumo] %s: %s is NOT NULL with no default and the table has rows. Add it nullable, fill it in a migration, then make it NOT NULL^7"):format(tableName, name))
            elseif not renamed[name] then
                isNew[name] = true
                names[#names + 1] = name
                changes[#changes + 1] = ("ADD COLUMN `%s` %s"):format(name, added[i][2])
            end
        end
        if #changes == 0 then return end

        for i = 1, #entries do
            local constraint = entries[i]
            if type(constraint) == "string" then
                -- The first brackets hold this table's columns. A foreign key's second brackets name the parent's.
                for name in constraint:match("%b()"):gmatch("`([^`]+)`") do
                    if isNew[name] and not constraint:find("^PRIMARY KEY") then
                        changes[#changes + 1] = "ADD " .. constraint
                        break
                    end
                end
            end
        end
        alter(tableName, table.concat(changes, ", "), "added " .. table.concat(names, ", "))
    end

    ---@param tableName string
    ---@param entries (string[] | string)[] from Columns.compileTable
    function Sync.run(tableName, entries)
        local rows = Bridge.call("exec", Query.ALL, COLUMNS_SQL, { tableName })
        local live = {}
        for i = 1, #rows do live[rows[i].name] = rows[i] end

        local added = {}
        for i = 1, #entries do
            local entry = entries[i]
            if type(entry) == "table" then
                local column = live[entry[1]]
                if column then
                    live[entry[1]] = nil
                    local found = differences(entry, column)
                    if entry[3] and mayRound(column.columnType, entry[3]) then
                        print(("^1[lumo] %s: changing %s from %s to %s would round what's stored, so it stays. Do it in a migration^7"):format(tableName, entry[1], column.columnType, entry[3]))
                    elseif #found > 0 then
                        alter(tableName, ("MODIFY COLUMN `%s` %s"):format(entry[1], withoutKeys(entry[2])), table.concat(found, ", "))
                    end
                else
                    added[#added + 1] = entry
                end
            end
        end

        local removed = {}
        for _, column in pairs(live) do removed[#removed + 1] = column end

        local renames, renamed, kept = matchRenames(tableName, added, removed)
        for i = 1, #renames do
            local entry, from = renames[i].entry, renames[i].from
            alter(tableName, ("CHANGE COLUMN `%s` `%s` %s"):format(from, entry[1], withoutKeys(entry[2])), ("renamed %s to %s"):format(from, entry[1]))
        end
        addColumns(tableName, entries, added, renamed)
        for i = 1, #removed do
            local name = removed[i].name
            if not kept[name] then alter(tableName, ("DROP COLUMN `%s`"):format(name), "dropped " .. name) end
        end
    end

    return Sync
end
