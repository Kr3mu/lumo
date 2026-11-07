import type { PoolConfig } from "mariadb";
import type { Dictionary } from "types/database";

import { Log } from "lib/shared";

type ParsedOptions = PoolConfig & Dictionary<string | number | boolean | object | undefined>;

export function GetConfig(): PoolConfig {
    const connectionString = GetConvar("mysql_connection_string", "mysql://root@localhost").replace(
        "mysql://",
        "mariadb://",
    );

    const options = connectionString.includes("mariadb://")
        ? parseUri(connectionString)
        : parseKeyValue(connectionString);

    if (typeof options.ssl === "string") {
        try {
            options.ssl = JSON.parse(options.ssl);
        } catch (error) {
            Log.Warn(`[database] Failed to parse ssl in configuration (${error})`);
        }
    }

    return {
        connectTimeout: 60000,
        connectionLimit: 10,
        acquireTimeout: 30000,
        keepAliveDelay: 60000,
        ...options,
        namedPlaceholders: false,
        logParam: false,
        dateStrings: true,
        insertIdAsNumber: true,
        bigIntAsNumber: true,
        decimalAsNumber: true,
        autoJsonMap: true,
    };
}

export function MaskConfig(configuration: PoolConfig): PoolConfig {
    if (!configuration.password) return configuration;
    return { ...configuration, password: "******" };
}

function parseUri(connectionString: string): ParsedOptions {
    const match = connectionString.match(
        /^(?:([^:/?#.]+):)?(?:\/\/(?:([^/?#]*)@)?([\w\d\-Ā-￿.%]*)(?::([0-9]+))?)?([^?#]+)?(?:\?([^#]*))?$/,
    );

    if (!match) {
        throw new Error(`mysql_connection_string structure was invalid (${connectionString})`);
    }

    const [, , auth = "", host, port, databaseName = "", query = ""] = match;
    const [user, password] = auth.split(":");
    const params = Object.fromEntries(
        query
            .split("&")
            .filter(Boolean)
            .map((parameter) => {
                const [key, value = ""] = parameter.split("=");
                return [key, value];
            }),
    );

    return {
        user: user ? decodeURIComponent(user) : undefined,
        password: password ? decodeURIComponent(password) : undefined,
        host: host ? decodeURIComponent(host) : undefined,
        port: port ? Number.parseInt(port, 10) : undefined,
        database: decodeURIComponent(databaseName.replace(/^\/+/, "")),
        ...params,
    };
}

function parseKeyValue(connectionString: string): ParsedOptions {
    return connectionString
        .replace(/(?:host(?:name)|ip|server|data\s?source|addr(?:ess)?)=/gi, "host=")
        .replace(/(?:user\s?(?:id|name)?|uid)=/gi, "user=")
        .replace(/(?:pwd|pass)=/gi, "password=")
        .replace(/(?:db)=/gi, "database=")
        .split(";")
        .reduce<ParsedOptions>((options, parameter) => {
            const [key, value] = parameter.split("=");
            if (key) options[key] = value;
            return options;
        }, {});
}
