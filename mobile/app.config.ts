import type { ConfigContext, ExpoConfig } from "expo/config";

const TEST_ANDROID_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const TEST_PUBLISHER_ID = "3940256099942544";

export default function configureApp({ config }: ConfigContext): ExpoConfig {
  const production = process.env.EAS_BUILD_PROFILE === "production";
  const androidAppId = production
    ? process.env.ADMOB_ANDROID_APP_ID
    : TEST_ANDROID_APP_ID;
  const bannerUnitId = process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID;

  if (production && (
    !androidAppId ||
    !/^ca-app-pub-\d{16}~\d{10}$/.test(androidAppId) ||
    androidAppId.includes(TEST_PUBLISHER_ID) ||
    !bannerUnitId ||
    !/^ca-app-pub-\d{16}\/\d{10}$/.test(bannerUnitId) ||
    bannerUnitId.includes(TEST_PUBLISHER_ID)
  )) {
    throw new Error("Production Android builds require real ADMOB_ANDROID_APP_ID and EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID values.");
  }

  return {
    ...config,
    name: config.name ?? "냉톡",
    slug: config.slug ?? "naengtalk",
    plugins: [
      ...(config.plugins ?? []),
      "expo-localization",
      ["react-native-google-mobile-ads", {
        androidAppId,
        delayAppMeasurementInit: true,
      }],
    ],
    extra: {
      ...config.extra,
      admobTestMode: !production,
    },
  };
}
