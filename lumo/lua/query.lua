-- The one path every query takes: into the current batch, onto the current session's connection, or to the pool.
return function(Bridge, Context, Errors)
    local Query = {}

    Query.RUN, Query.ONE, Query.VALUE, Query.ALL = 0, 1, 2, 3

    local unpack = table.unpack

    -- A batch only knows its results after it is sent, so reads inside one have nothing to return.
    ---@param shape integer Query.RUN | ONE | VALUE | ALL
    ---@param sql string
    ---@param params any[] | nil
    ---@return any
    function Query.send(shape, sql, params)
        local scope = Context.current()

        if scope and scope.batch then
            if shape ~= Query.RUN then
                Errors.raise(Errors.codes.READ_IN_BATCH, 'reads cannot run inside Database.batch; read before the batch or use a transaction')
            end
            local batch = scope.batch
            batch[#batch + 1] = { sql, params }
            return nil
        end

        local result = Bridge.call('exec', shape, sql, params, scope and scope.session)
        if shape == Query.RUN then return unpack(result, 1, 2) end
        return result
    end

    -- One statement, many parameter sets, one call into the bridge. In a batch, writes join it set by set.
    ---@param shape integer
    ---@param sql string
    ---@param sets any[][]
    ---@return any[] | nil one result per set, in order
    function Query.each(shape, sql, sets)
        local scope = Context.current()

        if scope and scope.batch then
            if shape ~= Query.RUN then
                Errors.raise(Errors.codes.READ_IN_BATCH, 'reads cannot run inside Database.batch; read before the batch or use a transaction')
            end
            local batch = scope.batch
            for i = 1, #sets do batch[#batch + 1] = { sql, sets[i] } end
            return nil
        end

        return Bridge.call('each', shape, sql, sets, scope and scope.session)
    end

    return Query
end
