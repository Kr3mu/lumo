export function OnStop(handler: () => void) {
    on("onResourceStop", (resource: string) => {
        if (resource === GetCurrentResourceName()) handler();
    });
}
