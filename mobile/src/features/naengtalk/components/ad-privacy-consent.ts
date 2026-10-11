export type AdConsentInfo = {
  canRequestAds: boolean;
  privacyOptionsRequirementStatus: string;
};

export type AdConsentAdapter = {
  gatherConsent: () => Promise<AdConsentInfo>;
  getConsentInfo: () => Promise<AdConsentInfo>;
  showPrivacyOptionsForm: () => Promise<AdConsentInfo>;
};

export function createAdPrivacyConsent(adapter: AdConsentAdapter) {
  const listeners = new Set<(info: AdConsentInfo) => void>();
  let initialization: Promise<AdConsentInfo> | undefined;
  let currentInfo: AdConsentInfo | undefined;
  const publish = (info: AdConsentInfo) => {
    currentInfo = info;
    listeners.forEach((listener) => listener(info));
    return info;
  };

  const initialize = (): Promise<AdConsentInfo> => {
    if (!initialization) {
      initialization = (async () => {
        try {
          await adapter.gatherConsent();
        } catch {
          // The SDK may still allow ads based on the prior session.
        }
        return publish(await adapter.getConsentInfo());
      })().catch((error) => {
        initialization = undefined;
        throw error;
      });
    }
    return initialization;
  };

  return {
    initialize,
    openPrivacyOptions: async () => {
      await initialize();
      return publish(await adapter.showPrivacyOptionsForm());
    },
    subscribe: (listener: (info: AdConsentInfo) => void) => {
      listeners.add(listener);
      if (currentInfo) listener(currentInfo);
      return () => { listeners.delete(listener); };
    },
  };
}
