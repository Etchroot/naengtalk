import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Constants from "expo-constants";
import mobileAds, {
  AdsConsent,
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";

type AdBannerProps = { visible: boolean };

export function AdBanner({ visible }: AdBannerProps) {
  const [ready, setReady] = useState(false);
  const testMode = Constants.expoConfig?.extra?.admobTestMode !== false;
  const unitId = testMode
    ? TestIds.BANNER
    : process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID;

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      try {
        await AdsConsent.gatherConsent();
      } catch {
        // A previous session's consent may still permit ads.
      }
      try {
        const { canRequestAds } = await AdsConsent.getConsentInfo();
        if (!canRequestAds) return;
        await mobileAds().initialize();
        if (mounted) setReady(true);
      } catch {
        // Keep ads disabled when the consent state or SDK is unavailable.
      }
    };
    void initialize();
    return () => { mounted = false; };
  }, []);

  if (!visible || !ready || !unitId) return null;
  return (
    <View style={{ minHeight: 50, alignItems: "center", justifyContent: "center", backgroundColor: "white" }}>
      <BannerAd unitId={unitId} size={BannerAdSize.BANNER} />
    </View>
  );
}
