import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "../components/app-text.tsx";
import {
  Timer,
} from "lucide-react-native";
import { completeCooking, remainingSeconds } from "../domain/cooking.ts";
import { resetGuestDemoInventory } from "../domain/guest-demo.ts";
import {
  getCompactHeaderMetrics,
  getHomeActionTitleFontSize,
  getToolCardLayout,
  getUrgentInventoryLimit,
} from "../domain/home-layout.ts";
import {
  recipeContextMessage,
  recipeUsage,
  type ChatMessage,
} from "../domain/menu-chat.ts";
import {
  sortInventory,
  type InventorySortMode,
} from "../domain/inventory-presentation.ts";
import { getLocalTodayPresentation } from "../domain/date-presentation.ts";
import {
  getChatComposerLayout,
  getKeyboardAwareWebFrame,
  getPhoneShellStyle,
  getResponsiveAppCanvas,
} from "../domain/web-frame.ts";
import {
  createUsageDraft,
  updateUsageDraftQuantity,
  usageFromDraft,
  type UsageDraft,
} from "../domain/usage-review.ts";
import { backendConfig } from "../services/backend-config.ts";
import {
  restoreRemoteSession,
  resetRemoteGuestDemo,
  signInGuest,
  signOutSession,
} from "../services/auth.ts";
import { loadRemoteInventory } from "../services/remote-inventory.ts";
import { completeRemoteCooking } from "../services/remote-cooking.ts";
import { shareCompletedAiRecipe } from "../services/remote-cooking.ts";
import { canShareRecipe, newProposalSharingState, shareAfterCompletion } from "../domain/recipe-sharing.ts";
import { sendMenuChat } from "../services/menu-chat.ts";
import {
  analysisFromResponse,
  appendPurchaseReviewRows,
  mergePurchaseSelections,
  toInventoryImportPayload,
  updatePurchaseReviewRow,
  validatePurchaseReviewRows,
  type PurchaseReviewRow,
  type PurchaseSelection,
} from "../domain/purchase-review.ts";
import { analyzePurchaseImage } from "../services/purchase-ocr.ts";
import { analyzeInventoryText } from "../services/inventory-parse.ts";
import {
  capChatInventoryRow,
  createChatInventoryDraft,
  toChatInventoryPayload,
  type ChatInventoryRow,
} from "../domain/chat-inventory.ts";
import { applyRemoteChatInventory } from "../services/chat-inventory.ts";
import { normalizedIngredientKey } from "../domain/purchase-ocr.ts";
import {
  pickPurchaseImages,
  selectionFromSample,
} from "../services/purchase-images.ts";
import { registerRemoteInventory } from "../services/register-inventory.ts";
import { purchaseDemoAssets } from "./purchase-demo-assets.ts";
import { color, s } from "./theme";
import { createInitialState, type AppTab, type LocalState } from "./naengtalk/model.ts";
import { AppHeader } from "./naengtalk/components/app-header.tsx";
import { BottomNavigation } from "./naengtalk/components/bottom-navigation.tsx";
import { sampleRecipe } from "./naengtalk/sample-recipe.ts";
import { LoginScreen } from "./naengtalk/screens/login-screen.tsx";
import { HomeScreen } from "./naengtalk/screens/home-screen.tsx";
import { ChatScreen } from "./naengtalk/screens/chat-screen.tsx";
import { InventoryScreen } from "./naengtalk/screens/inventory-screen.tsx";
import { RecipesScreen } from "./naengtalk/screens/recipes-screen.tsx";
import { ToolsScreen } from "./naengtalk/screens/tools-screen.tsx";
import { SettingsScreen } from "./naengtalk/screens/settings-screen.tsx";
import { ChatInventoryReviewModal } from "./naengtalk/modals/chat-inventory-review-modal.tsx";
import { RecipeDetailModal } from "./naengtalk/modals/recipe-detail-modal.tsx";
import { OverdrawConfirmModal } from "./naengtalk/modals/overdraw-confirm-modal.tsx";
import { ShareConsentModal } from "./naengtalk/modals/share-consent-modal.tsx";
import { InventorySortModal } from "./naengtalk/modals/inventory-sort-modal.tsx";
import { PurchaseRegistrationModal } from "./naengtalk/modals/purchase-registration-modal.tsx";

const titles = [
  "냉톡",
  "메뉴 상담",
  "내 재고",
  "내 레시피",
  "조리도구",
  "설정",
];
export default function NaengTalk() {
  const viewport = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const [state, setState] = useState<LocalState>(createInitialState);
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [tab, setTab] = useState<AppTab>(0);
  const [detail, setDetail] = useState(false);
  const [review, setReview] = useState(false);
  const [session, setSession] = useState("");
  const [registration, setRegistration] = useState(false);
  const [direct, setDirect] = useState(false);
  const [purchasePicker, setPurchasePicker] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseSelections, setPurchaseSelections] = useState<PurchaseSelection[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<PurchaseReviewRow[]>([]);
  const [purchaseFailures, setPurchaseFailures] = useState<Array<{ id: string; label: string; error: string }>>([]);
  const [purchaseProgress, setPurchaseProgress] = useState("");
  const [directInput, setDirectInput] = useState("");
  const [usageDraft, setUsageDraft] = useState<UsageDraft[]>([]);
  const [chatInventoryRows, setChatInventoryRows] = useState<ChatInventoryRow[]>([]);
  const [chatInventoryKey, setChatInventoryKey] = useState("");
  const [chatInventoryBusy, setChatInventoryBusy] = useState(false);
  const [overdraw, setOverdraw] = useState<{
    kind: "chat" | "recipe"; rowId: string; name: string; available: number; unit: string;
  } | null>(null);
  const [input, setInput] = useState("");
  const [chatInputFocused, setChatInputFocused] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [shareConsentVisible, setShareConsentVisible] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [inventorySort, setInventorySort] =
    useState<InventorySortMode>("expiry");
  const [sortMenu, setSortMenu] = useState(false);
  const lock = useRef(false);
  const stableWebViewport = useRef({ width: viewport.width, height: viewport.height });
  const chatBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (Platform.OS === "web" && !chatInputFocused) {
    stableWebViewport.current = { width: viewport.width, height: viewport.height };
  }
  const webFrameState = getKeyboardAwareWebFrame(
    { width: viewport.width, height: viewport.height },
    stableWebViewport.current,
    Platform.OS === "web" && chatInputFocused,
  );
  const frame = Platform.OS === "web"
    ? webFrameState.frame
    : {
        width: Math.max(0, viewport.width - safeAreaInsets.left - safeAreaInsets.right),
        height: Math.max(0, viewport.height - safeAreaInsets.top - safeAreaInsets.bottom),
      };
  const appCanvas = getResponsiveAppCanvas(frame.width, frame.height);
  const chatComposerLayout = getChatComposerLayout(appCanvas.designWidth);
  const compactHeader = getCompactHeaderMetrics();
  const today = getLocalTodayPresentation();
  const homeActionTitleFontSize = getHomeActionTitleFontSize(
    appCanvas.designWidth,
  );
  const urgentInventoryLimit = getUrgentInventoryLimit(
    appCanvas.designHeight,
  );
  const toolCardLayout = getToolCardLayout(
    appCanvas.designWidth,
    Platform.OS === "web" ? 8 : 0,
  );
  const safeAreaStyle = Platform.OS === "web" ? s.webSafeArea : s.nativeSafeArea;
  const appViewportStyle = [
    s.appViewport,
    {
      width: appCanvas.renderedWidth,
      height: appCanvas.renderedHeight,
    },
  ];
  const appFrameStyle = [
    s.app,
    getPhoneShellStyle(Platform.OS),
    {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: "auto" as const,
      position: "absolute" as const,
      top: 0,
      left: 0,
      width: appCanvas.designWidth,
      height: appCanvas.designHeight,
      transformOrigin: "top left" as const,
      transform: [{ scale: appCanvas.scale }],
    },
  ];
  const stageStyle =
    Platform.OS === "web" && webFrameState.keyboardOpen
      ? [s.stage, { justifyContent: "flex-end" as const, overflow: "hidden" as const }]
      : s.stage;
  const visibleInventory = useMemo(
    () =>
      sortInventory(
        state.inventory.filter((item) => item.quantity > 0),
        inventorySort,
      ),
    [state.inventory, inventorySort],
  );
  useEffect(() => {
    return () => {
      if (chatBlurTimer.current) clearTimeout(chatBlurTimer.current);
    };
  }, []);
  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const raw = await AsyncStorage.getItem("naengtalk-local-validation-v1");
        const stored = raw ? JSON.parse(raw) : null;
        if (active && stored?.state) setState({ ...createInitialState(), ...stored.state });

        if (backendConfig.mode === "supabase") {
          const hasSession = await restoreRemoteSession();
          if (!active) return;
          if (hasSession) {
            const inventory = await loadRemoteInventory();
            if (!active) return;
            setState((current) => ({ ...current, inventory }));
            setLoggedIn(true);
          } else {
            setLoggedIn(false);
          }
        } else if (active && stored) {
          setLoggedIn(Boolean(stored.loggedIn));
        }
      } catch {
        if (active) {
          setLoggedIn(false);
          setError("로그인 상태를 확인하지 못했습니다. 다시 시도해주세요.");
        }
      } finally {
        if (active) setReady(true);
      }
    };
    void initialize();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (ready)
      AsyncStorage.setItem(
        "naengtalk-local-validation-v1",
        JSON.stringify({ state, loggedIn }),
      ).catch(() => setError("저장 공간을 확인해주세요."));
  }, [state, loggedIn, ready]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const handleGuestLogin = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    setError("");
    try {
      if (backendConfig.mode === "supabase") {
        await signInGuest();
        const inventory = await loadRemoteInventory();
        setState((current) => ({ ...current, inventory }));
      }
      setLoggedIn(true);
    } catch {
      setLoggedIn(false);
      setError("게스트 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setAuthBusy(false);
    }
  };
  const handleLogout = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    setError("");
    try {
      await signOutSession();
      setState(createInitialState());
      setShareConsentVisible(false);
      setLoggedIn(false);
      setTab(0);
    } catch {
      setError("로그아웃하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setAuthBusy(false);
    }
  };
  const handleResetDemo = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    setError("");
    try {
      const inventory = await resetGuestDemoInventory({
        mode: backendConfig.mode,
        date: new Date().toISOString().slice(0, 10),
        resetRemote: resetRemoteGuestDemo,
        loadRemote: loadRemoteInventory,
      });
      setState({ ...createInitialState(), inventory });
      setShareConsentVisible(false);
      setTab(0);
    } catch {
      setError("샘플 데이터를 초기화하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setAuthBusy(false);
    }
  };
  const closeRegistration = () => {
    setRegistration(false);
    setDirect(false);
    setPurchasePicker(false);
    setPurchaseBusy(false);
    setPurchaseSelections([]);
    setPurchaseRows([]);
    setPurchaseFailures([]);
    setPurchaseProgress("");
    setDirectInput("");
    setError("");
  };
  const togglePurchaseSample = (sample: (typeof purchaseDemoAssets)[number]) => {
    if (purchaseBusy) return;
    try {
      const selection = selectionFromSample(sample);
      setPurchaseSelections((current) => current.some((item) => item.id === selection.id)
        ? current.filter((item) => item.id !== selection.id)
        : mergePurchaseSelections(current, [selection]));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const handlePickPurchaseImages = async () => {
    if (purchaseBusy) return;
    setError("");
    try {
      const picked = await pickPurchaseImages();
      setPurchaseSelections((current) => mergePurchaseSelections(current, picked));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const handleAnalyzePurchases = async () => {
    if (purchaseBusy || !purchaseSelections.length) return;
    setPurchaseBusy(true);
    setPurchaseRows([]);
    setPurchaseFailures([]);
    setError("");
    for (let index = 0; index < purchaseSelections.length; index += 1) {
      const selection = purchaseSelections[index];
      setPurchaseProgress(`${index + 1}/${purchaseSelections.length} · ${selection.label}`);
      try {
        const result = await analyzePurchaseImage(selection);
        setPurchaseRows((current) => appendPurchaseReviewRows(
          current,
          [analysisFromResponse(selection.id, result)],
        ));
      } catch (e) {
        setPurchaseFailures((current) => [...current, {
          id: selection.id,
          label: selection.label,
          error: (e as Error).message,
        }]);
      }
    }
    setPurchaseProgress("");
    setPurchaseBusy(false);
    setPurchasePicker(false);
  };
  const handleAnalyzeDirectInventory = async () => {
    if (purchaseBusy || !directInput.trim()) return;
    setPurchaseBusy(true);
    setPurchaseProgress("입력 내용을 분석하고 있어요");
    setError("");
    try {
      const result = await analyzeInventoryText(directInput);
      const rows = appendPurchaseReviewRows([], [
        analysisFromResponse(`DIRECT-${Date.now()}`, result),
      ]);
      if (!rows.length) throw new Error("등록할 식품을 찾지 못했습니다.");
      setPurchaseRows(rows);
      setPurchaseFailures([]);
      setDirect(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPurchaseProgress("");
      setPurchaseBusy(false);
    }
  };
  const handleRegisterPurchase = async () => {
    if (purchaseBusy || !purchaseRows.length) return;
    const registrationDate = new Date().toISOString().slice(0, 10);
    const invalidIds = validatePurchaseReviewRows(purchaseRows, registrationDate);
    if (invalidIds.length) {
      const invalid = new Set(invalidIds);
      setPurchaseRows((current) => current.map((row) => invalid.has(row.id)
        ? { ...row, needsReview: true }
        : row));
      setError("수정이 필요한 항목을 먼저 확인해주세요.");
      return;
    }
    const candidates = toInventoryImportPayload(purchaseRows, registrationDate);
    setPurchaseBusy(true);
    setError("");
    try {
      if (backendConfig.mode === "supabase") {
        await registerRemoteInventory(
          candidates,
          `inventory-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
        const inventory = await loadRemoteInventory();
        setState((current) => ({ ...current, inventory }));
      } else {
        setState((current) => ({
          ...current,
          inventory: [
            ...current.inventory,
            ...candidates.map((item, index) => ({
              id: `${item.ingredient_key}-${Date.now()}-${index}`,
              name: item.display_name,
              quantity: item.quantity,
              unit: item.unit,
              useBy: item.use_by_at,
              estimated: true,
            })),
          ],
        }));
      }
      closeRegistration();
      setTab(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPurchaseBusy(false);
    }
  };
  const openRecipe = () => {
    if (!state.recipe) return;
    setSession(`local-${Date.now()}-${Math.random()}`);
    setError("");
    setReview(false);
    setUsageDraft([]);
    setDetail(true);
  };
  const handleSendChat = async () => {
    if (aiBusy || !input.trim()) return;
    const outgoing = input.trim();
    const previousHistory = state.chat;
    const userMessage: ChatMessage = { role: "user", content: outgoing };
    setInput("");
    setError("");
    setAiBusy(true);
    setState((current) => ({ ...current, chat: [...current.chat, userMessage] }));
    try {
      if (backendConfig.mode === "local") {
        const assistant: ChatMessage = {
          role: "assistant",
          content: "로컬 검증 모드에서는 김치 두부찌개 샘플을 보여드려요.",
        };
        setState((current) => ({
          ...current,
          chat: [...current.chat, assistant],
          recipe: sampleRecipe,
          saved: false,
          ...newProposalSharingState(),
          providedAt: new Date().toISOString().slice(0, 10),
        }));
      } else {
        const response = await sendMenuChat({
          message: outgoing,
          history: state.recipe
            ? [...previousHistory, recipeContextMessage(state.recipe)]
            : previousHistory,
          cookingTools: state.tools,
          allergens: state.allergens,
        });
        setState((current) => ({
          ...current,
          chat: [...current.chat, { role: "assistant", content: response.reply }],
          recipe: response.recipe ?? current.recipe,
          ...(response.recipe ? { saved: false, ...newProposalSharingState() } : {}),
          providedAt: response.recipe
            ? new Date().toISOString().slice(0, 10)
            : current.providedAt,
        }));
        if (response.inventoryChanges.length) {
          const latestInventory = await loadRemoteInventory();
          let additionRows: PurchaseReviewRow[] = [];
          const additions = response.inventoryChanges.filter((change) => change.action === "add");
          if (additions.length) {
            try {
              const parsed = await analyzeInventoryText(additions.map((change) =>
                `${change.name} ${change.quantity ?? ""}${change.unit ?? ""}`).join("\n"));
              additionRows = appendPurchaseReviewRows([], [analysisFromResponse(`CHAT-${Date.now()}`, parsed)]);
            } catch {
              // The reviewer can fill an unrecognized shelf-life date instead of losing the proposal.
            }
          }
          const rows = createChatInventoryDraft(response.inventoryChanges, latestInventory, additionRows);
          setState((current) => ({ ...current, inventory: latestInventory }));
          if (rows.length) {
            setChatInventoryRows(rows);
            setChatInventoryKey(`chat-${Date.now()}-${Math.random().toString(36).slice(2)}`);
          }
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };
  const confirmChatInventory = async (rows: ChatInventoryRow[] = chatInventoryRows) => {
    if (chatInventoryBusy) return;
    setError("");
    setChatInventoryBusy(true);
    try {
      const payload = toChatInventoryPayload(rows, new Date().toISOString().slice(0, 10));
      const result = await applyRemoteChatInventory(chatInventoryKey, payload);
      if (result.status === "needs_confirmation") {
        const row = rows.find((item) => item.action === "consume"
          && item.ingredientKey === result.ingredient_key && item.unit === result.unit);
        if (!row) throw new Error("초과 사용 항목을 다시 확인해주세요.");
        setOverdraw({ kind: "chat", rowId: row.id, name: result.display_name,
          available: Number(result.available), unit: result.unit });
        return;
      }
      const inventory = await loadRemoteInventory();
      setState((current) => ({ ...current, inventory,
        chat: [...current.chat, { role: "assistant", content: result.status === "already_applied"
          ? "이미 반영된 재고 변경입니다." : "확인한 재고 변경을 반영했어요." }] }));
      setChatInventoryRows([]);
      setChatInventoryKey("");
    } catch (e) {
      setError((e as Error).message || "재고를 반영하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setChatInventoryBusy(false);
    }
  };
  const confirmShare = async () => {
    if (!canShareRecipe(state.recipe) || shareBusy) return;
    setShareConsentVisible(false);
    if (!state.saved) {
      setState((current) => ({ ...current, sharePending: true }));
      return;
    }
    if (!state.savedRecipeId) {
      setError("이 레시피의 저장 정보를 확인하지 못했습니다. 새로 요리 완료한 레시피에서 공유해주세요.");
      return;
    }
    setShareBusy(true);
    try {
      await shareCompletedAiRecipe(state.savedRecipeId);
      setState((current) => ({ ...current, shared: true, sharePending: false }));
    } catch {
      setError("레시피를 공유하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setShareBusy(false);
    }
  };
  const finish = async (draftOverride?: UsageDraft[]) => {
    if (lock.current) return;
    lock.current = true;
    setError("");
    try {
      if (!state.recipe) throw new Error("완료할 레시피가 없습니다.");
      const usage = usageFromDraft(draftOverride ?? usageDraft);
      if (!usage.length) throw new Error("재고에서 차감할 재료가 없습니다.");
      const latestInventory = backendConfig.mode === "supabase"
        ? await loadRemoteInventory() : state.inventory;
      for (const line of usage) {
        const available = latestInventory.filter((item) => item.id === line.ingredientId && item.unit === line.unit)
          .reduce((sum, item) => sum + item.quantity, 0);
        if (line.quantity > available) {
          setState((current) => ({ ...current, inventory: latestInventory }));
          setOverdraw({ kind: "recipe", rowId: line.ingredientId,
            name: latestInventory.find((item) => item.id === line.ingredientId)?.name ?? line.ingredientId,
            available, unit: line.unit });
          return;
        }
      }
      if (backendConfig.mode === "supabase") {
        const completed = await completeRemoteCooking({
          title: state.recipe.title,
          content: state.recipe,
          usage,
          requestKey: session,
          shareAfterCompletion: shareAfterCompletion(state.recipe, state.sharePending, state.shared),
        });
        const inventory = await loadRemoteInventory();
        setState((current) => ({
          ...current,
          inventory,
          saved: true,
          savedRecipeId: completed.recipe_id ?? current.savedRecipeId,
          shared: Boolean(completed.shared_recipe_id) || current.shared,
          sharePending: completed.shared_recipe_id ? false : current.sharePending,
          completedSessionIds: current.completedSessionIds.includes(session)
            ? current.completedSessionIds
            : [...current.completedSessionIds, session],
        }));
      } else {
        const result = completeCooking(state, session, usage);
        setState({ ...state, ...result, saved: true, sharePending: false });
      }
      setDetail(false);
      setReview(false);
      setUsageDraft([]);
      setTab(3);
    } catch (e) {
      const message = (e as Error).message;
      if (message.includes("insufficient inventory") && backendConfig.mode === "supabase") {
        try {
          const latest = await loadRemoteInventory();
          const offending = usageFromDraft(draftOverride ?? usageDraft).find((line) => line.quantity > latest
            .filter((item) => item.id === line.ingredientId && item.unit === line.unit)
            .reduce((sum, item) => sum + item.quantity, 0));
          if (offending) {
            const available = latest.filter((item) => item.id === offending.ingredientId && item.unit === offending.unit)
              .reduce((sum, item) => sum + item.quantity, 0);
            setState((current) => ({ ...current, inventory: latest }));
            setOverdraw({ kind: "recipe", rowId: offending.ingredientId,
              name: latest.find((item) => item.id === offending.ingredientId)?.name ?? offending.ingredientId,
              available, unit: offending.unit });
            return;
          }
        } catch { /* Preserve the original server error below. */ }
      }
      setError(
        message.includes("사용량") || message.includes("0보다")
          ? message
          : message.includes("insufficient inventory")
          ? "재고가 부족합니다. 구매하거나 사용량을 수정해주세요."
          : backendConfig.mode === "supabase"
            ? "요리 완료를 반영하지 못했습니다. 잠시 후 다시 시도해주세요."
            : message,
      );
    } finally {
      lock.current = false;
    }
  };
  const left = state.timer ? remainingSeconds(state.timer.endsAt, now) : null;
  const timer = state.timer && (
    <View style={s.notice}>
      <View style={s.row}>
        <Timer size={18} color={color.green} />
        <Text accessibilityLiveRegion="polite" style={[s.text, { flex: 1 }]}>
          {state.timer.label} ·{" "}
          {left === 0
            ? "시간이 되었어요"
            : `${Math.floor(left! / 60)}:${String(left! % 60).padStart(2, "0")}`}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setState({ ...state, timer: null })}
        >
          <Text style={s.muted}>종료</Text>
        </Pressable>
      </View>
    </View>
  );
  const activeRecipe = state.recipe ?? sampleRecipe;
  const activeUsage = recipeUsage(activeRecipe);
  const startUsageReview = () => {
    setError("");
    setUsageDraft(createUsageDraft(activeUsage));
    setReview(true);
  };
  if (!ready)
    return (
      <View style={s.stage}>
        <Text style={s.text}>냉톡을 준비하고 있어요.</Text>
      </View>
    );
  return (
    <View style={stageStyle}>
      <SafeAreaView style={safeAreaStyle}>
        <View style={appViewportStyle}>
          <View style={appFrameStyle}>
        {!loggedIn ? (
          <LoginScreen
            busy={authBusy}
            error={error}
            statusText={backendConfig.mode === "local"
              ? "개발 검증 모드입니다. 현재 게스트 버튼은 기기 내 샘플을 열며 실제 익명 인증·AI는 아직 연결되지 않았습니다."
              : "게스트마다 독립된 원격 재고를 생성하고 로그인 상태를 안전하게 복원합니다."}
            onGuestLogin={() => void handleGuestLogin()}
            onGoogleLogin={() => setError("Google 로그인은 Supabase 연결 후 사용할 수 있습니다.")}
          />
        ) : (
          <>
            <AppHeader
              tab={tab}
              title={titles[tab]}
              onHome={() => setTab(0)}
              scale={appCanvas.scale}
            />
            {timer}
            {tab === 1 ? (
              <ChatScreen
                chat={state.chat}
                recipe={state.recipe}
                input={input}
                error={error}
                aiBusy={aiBusy}
                composerLayout={chatComposerLayout}
                onChangeInput={setInput}
                onSend={() => void handleSendChat()}
                onOpenRecipe={openRecipe}
                onInputFocus={() => {
                  if (chatBlurTimer.current) clearTimeout(chatBlurTimer.current);
                  setChatInputFocused(true);
                }}
                onInputBlur={() => {
                  if (chatBlurTimer.current) clearTimeout(chatBlurTimer.current);
                  chatBlurTimer.current = setTimeout(() => setChatInputFocused(false), 250);
                }}
              />
            ) : (
              <ScrollView
                scrollEnabled={tab !== 0}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.content}
              >
              {tab === 0 && (
                <HomeScreen
                  inventory={state.inventory}
                  today={today}
                  urgentInventoryLimit={urgentInventoryLimit}
                  homeActionTitleFontSize={homeActionTitleFontSize}
                  onOpenRegistration={() => setRegistration(true)}
                  onOpenChat={() => setTab(1)}
                />
              )}
              {tab === 2 && (
                <InventoryScreen
                  inventory={visibleInventory}
                  sortMode={inventorySort}
                  todayKey={today.key}
                  onOpenSort={() => setSortMenu(true)}
                  onOpenRegistration={() => setRegistration(true)}
                />
              )}
              {tab === 3 && (
                <RecipesScreen
                  savedRecipe={state.saved ? state.recipe : null}
                  providedAt={state.providedAt}
                  onOpenRecipe={openRecipe}
                  onOpenChat={() => setTab(1)}
                />
              )}
              {tab === 4 && (
                <ToolsScreen
                  tools={state.tools}
                  input={input}
                  cardWidth={toolCardLayout.cardWidth}
                  cardAspectRatio={toolCardLayout.aspectRatio}
                  onChangeInput={setInput}
                  onAddTool={() => {
                    if (!input.trim()) return;
                    setState({ ...state, tools: [...state.tools, input.trim()] });
                    setInput("");
                  }}
                  onRemoveTool={(index) => setState({
                    ...state,
                    tools: state.tools.filter((_, itemIndex) => index !== itemIndex),
                  })}
                />
              )}
              {tab === 5 && (
                <SettingsScreen
                  allergens={state.allergens}
                  allergenInput={input}
                  busy={authBusy}
                  onChangeAllergenInput={setInput}
                  onAddAllergen={() => {
                    const allergen = input.trim();
                    if (!allergen || state.allergens.includes(allergen)) return;
                    setState({ ...state, allergens: [...state.allergens, allergen] });
                    setInput("");
                  }}
                  onRemoveAllergen={(allergen) => setState({
                    ...state,
                    allergens: state.allergens.filter((item) => item !== allergen),
                  })}
                  onResetDemo={() => void handleResetDemo()}
                  onLogout={() => void handleLogout()}
                />
              )}
              </ScrollView>
            )}
            <BottomNavigation
              tab={tab}
              scale={appCanvas.scale}
              onSelect={(nextTab) => {
                setTab(nextTab);
                setInput("");
              }}
            />
          </>
        )}
        <ChatInventoryReviewModal
          rows={chatInventoryRows}
          busy={chatInventoryBusy}
          error={error}
          onClose={() => { setChatInventoryRows([]); setError(""); }}
          onConfirm={() => void confirmChatInventory()}
          onChangeRow={(id, patch) => setChatInventoryRows((current) => current.map((item) => {
            if (item.id !== id) return item;
            if (patch.name !== undefined) {
              const match = state.inventory.find((stock) => stock.name.trim() === patch.name?.trim());
              return {
                ...item,
                ...patch,
                ingredientKey: item.action === "add" ? normalizedIngredientKey(patch.name) : match?.id ?? "",
              };
            }
            if (patch.quantityText !== undefined) {
              const unit = patch.quantityText.trim().match(/(?:g|ml|개|대)$/i)?.[0].toLowerCase() ?? item.unit;
              return { ...item, ...patch, unit };
            }
            return { ...item, ...patch };
          }))}
        />
        <RecipeDetailModal
          visible={detail}
          recipe={activeRecipe}
          providedAt={state.providedAt}
          timer={timer}
          review={review}
          usageDraft={usageDraft}
          inventory={state.inventory}
          error={error}
          returnLabel={tab === 3 ? "레시피 목록으로 돌아가기" : "채팅으로 돌아가기"}
          canShare={canShareRecipe(state.recipe)}
          sharePending={state.sharePending}
          shared={state.shared}
          shareBusy={shareBusy}
          safeAreaStyle={safeAreaStyle}
          appViewportStyle={appViewportStyle}
          appFrameStyle={appFrameStyle}
          headerMetrics={compactHeader}
          onRequestClose={() => setDetail(false)}
          onBack={() => {
            setDetail(false);
            setReview(false);
            setUsageDraft([]);
          }}
          onStartTimer={(stepIndex, minutes) => {
            const startedAt = Date.now();
            setNow(startedAt);
            setState({ ...state, timer: { label: `${stepIndex + 1}단계`, endsAt: startedAt + minutes * 60000 } });
          }}
          onChangeUsage={(ingredientId, quantityText) => setUsageDraft((current) => (
            updateUsageDraftQuantity(current, ingredientId, quantityText)
          ))}
          onFinishCooking={() => void finish()}
          onStartUsageReview={startUsageReview}
          onConfirmShare={() => setShareConsentVisible(true)}
        />
        <OverdrawConfirmModal
          visible={overdraw !== null}
          ingredientName={overdraw?.name ?? "재료"}
          onCancel={() => setOverdraw(null)}
          onConfirm={() => {
            if (!overdraw) return;
            const current = overdraw;
            setOverdraw(null);
            if (current.kind === "chat") {
              const capped = capChatInventoryRow(chatInventoryRows, current.rowId, current.available);
              setChatInventoryRows(capped);
              if (capped.length) void confirmChatInventory(capped);
              return;
            }
            const capped = current.available <= 0
              ? usageDraft.filter((line) => line.ingredientId !== current.rowId)
              : updateUsageDraftQuantity(usageDraft, current.rowId, String(current.available));
            setUsageDraft(capped);
            if (capped.length) void finish(capped);
            else setError("차감할 등록 재고가 없습니다. 사용량을 다시 확인해주세요.");
          }}
        />
        <ShareConsentModal
          visible={shareConsentVisible}
          onCancel={() => setShareConsentVisible(false)}
          onConfirmShare={() => void confirmShare()}
        />
        <InventorySortModal
          visible={sortMenu}
          sortMode={inventorySort}
          onClose={() => setSortMenu(false)}
          onSelect={(mode) => {
            setInventorySort(mode);
            setSortMenu(false);
          }}
        />
        <PurchaseRegistrationModal
          visible={registration}
          direct={direct}
          picker={purchasePicker}
          busy={purchaseBusy}
          directInput={directInput}
          rows={purchaseRows}
          failures={purchaseFailures}
          selections={purchaseSelections}
          progress={purchaseProgress}
          error={error}
          samples={purchaseDemoAssets}
          onClose={closeRegistration}
          onChangeDirectInput={setDirectInput}
          onAnalyzeDirect={() => void handleAnalyzeDirectInventory()}
          onChangeRow={(id, patch) => setPurchaseRows((current) => current.map((item) => (
            item.id === id
              ? updatePurchaseReviewRow(item, patch, new Date().toISOString().slice(0, 10))
              : item
          )))}
          onRegister={() => void handleRegisterPurchase()}
          onChooseOther={() => {
            setPurchaseRows([]);
            setPurchaseFailures([]);
            setPurchasePicker(true);
            setError("");
          }}
          onToggleSample={togglePurchaseSample}
          onRemoveSelection={(id) => setPurchaseSelections((current) => current.filter((entry) => entry.id !== id))}
          onAnalyze={() => void handleAnalyzePurchases()}
          onPickImages={() => void handlePickPurchaseImages()}
          onOpenPicker={() => { setPurchasePicker(true); setError(""); }}
          onOpenDirect={() => setDirect(true)}
        />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
