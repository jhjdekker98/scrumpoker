let configModule: typeof import("./env.dev");
if (import.meta.env.MODE === "production") {
    configModule = await import("./env.prod");
} else {
    configModule = await import("./env.dev");
}
export const config = configModule.config;
