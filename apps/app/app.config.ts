import type { ExpoConfig } from "expo/config";
const variant = process.env.APP_VARIANT ?? "development";
const production = variant === "production";
const bundle = process.env.APP_BUNDLE_IDENTIFIER;
if (
  production ||
  process.env.EXPO_PUBLIC_APP_ENV === "production" ||
  process.env.VERCEL_ENV === "production"
) {
  throw new Error(
    "Produktionsfreigabe gesperrt: Dieser Entwicklungsstand benötigt noch Produktions-Auth, Store-Abos und native Abnahme. Bitte development/preview verwenden.",
  );
}
if (production && !bundle)
  throw new Error(
    "APP_BUNDLE_IDENTIFIER muss vor einem Produktionsbuild explizit gesetzt sein.",
  );
const config: ExpoConfig = {
  name: production ? "ChoreoFlow" : "ChoreoFlow Dev",
  owner: "choreoflow",
  slug: "bastianexpo",
  version: "0.1.0",
  scheme: production ? "choreoflow" : "choreoflow-dev",
  orientation: "default",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    ...(bundle
      ? { bundleIdentifier: production ? bundle : `${bundle}.dev` }
      : {}),
  },
  web: { bundler: "metro", output: "single", name: "ChoreoFlow" },
  plugins: [
    "expo-router",
    "expo-sqlite",
    "expo-secure-store",
    "expo-asset",
    "expo-sharing",
    [
      "expo-audio",
      {
        microphonePermission: false,
        recordAudioAndroid: false,
        enableBackgroundPlayback: false,
      },
    ],
  ],
  extra: {
    variant,
    eas: {
      // Public project identity, verified in the owner's Expo dashboard.
      projectId:
        process.env.EAS_PROJECT_ID ?? "733a2847-f234-4b34-bbf5-d7036b6d922f",
    },
  },
};
export default config;
