import z from "zod";

import packageJSON from "./package.json";

const envSchema = z.object({
  EXPO_PUBLIC_APP_ENV: z.enum(["development", "preview", "production"]),
  EXPO_PUBLIC_NAME: z.string(),
  EXPO_PUBLIC_SCHEME: z.string(),
  EXPO_PUBLIC_BUNDLE_ID: z.string(),
  EXPO_PUBLIC_PACKAGE: z.string(),
  EXPO_PUBLIC_VERSION: z.string(),
  EXPO_PUBLIC_API_URL: z.string(),
  EXPO_PUBLIC_SOCKET_URL: z.string(),
  EXPO_PUBLIC_POSTHOG_KEY: z.string().optional(),
  APP_BUILD_ONLY_VAR: z.string().optional(),
});

const EXPO_PUBLIC_APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV
  ?? "development") as z.infer<typeof envSchema>["EXPO_PUBLIC_APP_ENV"];

const BUNDLE_IDS = {
  development: "com.eastpark.app.development",
  preview: "com.eastpark.app.preview",
  production: "com.eastpark.app",
} as const;

const PACKAGES = {
  development: "com.eastpark.app.development",
  preview: "com.eastpark.app.preview",
  production: "com.eastpark.app",
} as const;

const SCHEMES = {
  development: "eastpark",
  preview: "eastpark.preview",
  production: "eastpark",
} as const;

const NAME = "EastPark";

const STRICT_ENV_VALIDATION = process.env.STRICT_ENV_VALIDATION === "1";

const _env: z.infer<typeof envSchema> = {
  EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_NAME: NAME,
  EXPO_PUBLIC_SCHEME: SCHEMES[EXPO_PUBLIC_APP_ENV],
  EXPO_PUBLIC_BUNDLE_ID: BUNDLE_IDS[EXPO_PUBLIC_APP_ENV],
  EXPO_PUBLIC_PACKAGE: PACKAGES[EXPO_PUBLIC_APP_ENV],
  EXPO_PUBLIC_VERSION: packageJSON.version,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
  EXPO_PUBLIC_SOCKET_URL: process.env.EXPO_PUBLIC_SOCKET_URL ?? "http://localhost:3000",
  EXPO_PUBLIC_POSTHOG_KEY: process.env.EXPO_PUBLIC_POSTHOG_KEY,
  APP_BUILD_ONLY_VAR: process.env.APP_BUILD_ONLY_VAR,
};

function getValidatedEnv(env: z.infer<typeof envSchema>) {
  const parsed = envSchema.safeParse(env);

  if (parsed.success === false) {
    const errorMessage
      = `❌ Invalid environment variables:${
        JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
      }\n❌ Missing variables in .env file for APP_ENV=${EXPO_PUBLIC_APP_ENV}`
      + `\n💡 Tip: If you recently updated the .env file, try restarting with -c flag to clear the cache.`;

    if (STRICT_ENV_VALIDATION) {
      console.error(errorMessage);
      throw new Error("Invalid environment variables");
    }
  }
  else {
    console.log("✅ EastPark environment variables validated");
  }

  return parsed.success ? parsed.data : env;
}

const Env = STRICT_ENV_VALIDATION ? getValidatedEnv(_env) : _env;

export default Env;
