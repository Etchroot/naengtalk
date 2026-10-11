import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { AdsConsentPrivacyOptionsRequirementStatus } from "react-native-google-mobile-ads";
import { Text } from "../../../components/app-text.tsx";
import { AppButton } from "./app-button.tsx";
import { adPrivacyConsent } from "./ad-privacy-consent.android.ts";

export function AdPrivacyOptions() {
  const [required, setRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    void adPrivacyConsent.initialize().then((info) => {
      if (mounted) setRequired(info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
    }).catch(() => {
      // No entry is shown while the requirement status is unknown.
    });
    return () => { mounted = false; };
  }, []);

  if (!required) return null;

  const openOptions = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const info = await adPrivacyConsent.openPrivacyOptions();
      setRequired(info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <AppButton secondary loading={busy} onPress={() => void openOptions()}>광고 개인정보 선택</AppButton>
      {error ? <Text accessibilityRole="alert" style={{ color: "#b91c1c" }}>개인정보 선택 화면을 열 수 없습니다. 다시 시도해 주세요.</Text> : null}
    </View>
  );
}
