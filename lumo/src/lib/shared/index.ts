export const Log = {
    Info: (message: string) => console.log(`^5${message}^7`),
    Success: (message: string) => console.log(`^2${message}^7`),
    Warn: (message: string) => console.log(`^3${message}^7`),
    Error: (message: string) => console.log(`^1${message}^7`),
    Debug: (message: string) => console.log(message),
};
