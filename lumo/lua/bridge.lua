-- Calls into the lumo resource's bridge. Every call is one crossing into Node; nothing else in the module
-- crosses. The raw export function refs are fetched once (the way the exports proxy does it) and kept, which
-- skips the proxy's per-call closure, pcall and result re-packing.
---@param Errors table
---@param host string the resource running the bridge: 'lumo', or the monorepo resource that embeds it
return function(Errors, host)
    local Bridge = {}
    local prefix = '__cfx_export_' .. host .. '_'

    local refs = {}
    local TriggerEvent = TriggerEvent

    local function ref(name)
        local fn = refs[name]
        if fn then return fn end

        TriggerEvent(prefix .. name, function(exportData) fn = exportData end)
        if not fn then Errors.raise(Errors.codes.NOT_STARTED, ('the %s resource is not started, or its Lumo bridge is not loaded'):format(host)) end

        refs[name] = fn
        return fn
    end

    AddEventHandler('onServerResourceStop', function(resource)
        if resource == host then refs = {} end
    end)

    -- The bridge answers [value] or [nil, err]; a slow answer is a promise the funcref call already awaited.
    ---@param name 'exec' | 'each' | 'batch' | 'checkout' | 'release' | 'ready'
    ---@return any
    function Bridge.call(name, ...)
        local reply = ref(name)(...)
        if reply[2] ~= nil then error(Errors.wrap(reply[2]), 0) end
        return reply[1]
    end

    return Bridge
end
