import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Constants from "expo-constants";
import mobileAds, {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { adPrivacyConsent } from "./ad-privacy-consent.android.ts";

type AdBannerProps = { visible: boolean };

export function AdBanner({ visible }: AdBannerProps) {
  const [ready, setReady] = useState(false);
  const testMode = Constants.expoConfig?.extra?.admobTestMode !== false;
  const unitId = testMode
    ? TestIds.BANNER
    : process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID;

  useEffect(() => {
    let mounted = true;
    let revision = 0;
    const applyConsent = async ({ canRequestAds }: { canRequestAds: boolean }) => {
      const currentRevision = ++revision;
      if (!canRequestAds) {
        if (mounted) setReady(false);
        return;
      }
      try {
        await mobileAds().initialize();
        if (mounted && currentRevision === revision) setReady(true);
      } catch {
        if (mounted && currentRevision === revision) setReady(false);
      }
    };
    const unsubscribe = adPrivacyConsent.subscribe((info) => { void applyConsent(info); });
    void adPrivacyConsent.initialize().catch(() => {
      if (mounted) setReady(false);
    });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  if (!visible || !ready || !unitId) return null;
  return (
    <View style={{ minHeight: 50, alignItems: "center", justifyContent: "center", backgroundColor: "white" }}>
      <BannerAd unitId={unitId} size={BannerAdSize.BANNER} />
    </View>
  );
}
