import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Home,
  MessageCircle,
  Package,
  NotebookText,
  CookingPot,
  Settings,
  Timer,
  ChevronRight,
  ChevronDown,
  Check,
} from "lucide-react-native";
import {
  completeCooking,
  remainingSeconds,
  type CookingState,
} from "../domain/cooking.ts";
import { createGuestInventory } from "../domain/seed.ts";
import { resetGuestDemoInventory } from "../domain/guest-demo.ts";
import {
  getHomeActionTitleFontSize,
  getUrgentCardMinHeight,
  getUrgentInventoryLimit,
} from "../domain/home-layout.ts";
import { formatCookingStepTitle } from "../domain/recipe-presentation.ts";
import {
  recipeContextMessage,
  recipeUsage,
  type ChatMessage,
  type MenuRecipe,
} from "../domain/menu-chat.ts";
import {
  sortInventory,
  type InventorySortMode,
} from "../domain/inventory-presentation.ts";
import {
  getAndroidWebFrame,
  getPhoneShellStyle,
} from "../domain/web-frame.ts";
import { breakSentences } from "../domain/readable-text.ts";
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
  pickPurchaseImages,
  selectionFromSample,
} from "../services/purchase-images.ts";
import { registerRemoteInventory } from "../services/register-inventory.ts";
import { purchaseDemoAssets } from "./purchase-demo-assets.ts";
import { color, s } from "./theme";

const tabs = ["홈", "채팅", "재고", "레시피", "조리도구", "설정"];
const titles = [
  "냉톡",
  "메뉴 상담",
  "내 재고",
  "내 레시피",
  "조리도구",
  "설정",
];
const icons = [
  Home,
  MessageCircle,
  Package,
  NotebookText,
  CookingPot,
  Settings,
];
const sampleSteps = [
  {
    text: "김치 150g과 두부 100g을 먹기 좋은 크기로 잘라주세요. 사용 전 포장 표시와 보관 상태를 확인해주세요.",
    minutes: 0,
  },
  {
    text: "냄비에 김치와 물 350ml를 넣고 끓입니다. 끓기 시작하면 중약불에서 김치가 부드러워질 때까지 10분간 끓여주세요.",
    minutes: 10,
  },
  {
    text: "두부를 넣고 5분 더 끓여주세요. 간장 5ml를 넣고 맛을 확인합니다. 김치의 짠 정도에 따라 물을 조금 더 넣어주세요.",
    minutes: 5,
  },
  {
    text: "불을 끄고 그릇에 담아주세요. 실제로 사용한 양을 확인한 뒤 아래 요리 완료 버튼을 눌러 재고에 반영합니다.",
    minutes: 0,
  },
];
const sampleRecipe: MenuRecipe = {
  title: "김치 두부찌개",
  reason: "두부를 먼저 사용하면서 추가 구매 없이 만들 수 있어요.",
  servings: 1,
  minutes: 20,
  difficulty: "쉬움",
  ingredients: [
    { ingredientKey: "kimchi", name: "김치", quantity: 150, unit: "g", inInventory: true, requiredPurchase: false },
    { ingredientKey: "tofu", name: "두부", quantity: 100, unit: "g", inInventory: true, requiredPurchase: false },
    { ingredientKey: "soy", name: "간장", quantity: 5, unit: "ml", inInventory: true, requiredPurchase: false },
    { ingredientKey: null, name: "물", quantity: 350, unit: "ml", inInventory: false, requiredPurchase: false },
  ],
  steps: sampleSteps,
  sources: [],
};
type LocalState = CookingState & {
  providedAt: string;
  saved: boolean;
  tools: string[];
  allergens: string[];
  timer: { label: string; endsAt: number } | null;
  chat: ChatMessage[];
  recipe: MenuRecipe | null;
};
function fresh(): LocalState {
  const date = new Date().toISOString().slice(0, 10);
  return {
    inventory: createGuestInventory(date),
    completedSessionIds: [],
    providedAt: date,
    saved: false,
    tools: [
      "2.5L 냄비",
      "계란후라이용 프라이팬",
      "전자레인지",
      "1인용 에어프라이기",
    ],
    allergens: ["새우"],
    timer: null,
    chat: [],
    recipe: backendConfig.mode === "local" ? sampleRecipe : null,
  };
}
function Button({
  children,
  onPress,
  secondary = false,
  loading = false,
  disabled = false,
}: {
  children: string;
  onPress: () => void;
  secondary?: boolean;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={[s.button, secondary && s.secondary, inactive && s.buttonDisabled]}
    >
      <View style={s.buttonContent}>
        <Text style={[s.buttonText, secondary && { color: color.green }]}>
          {children}
        </Text>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={secondary ? color.green : "white"}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
export default function NaengTalk() {
  const viewport = useWindowDimensions();
  const [state, setState] = useState<LocalState>(fresh);
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [tab, setTab] = useState(0);
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
  const [input, setInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [inventorySort, setInventorySort] =
    useState<InventorySortMode>("expiry");
  const [sortMenu, setSortMenu] = useState(false);
  const lock = useRef(false);
  const recipeScroll = useRef<ScrollView>(null);
  const frame = getAndroidWebFrame(viewport.width, viewport.height);
  const homeActionTitleFontSize = getHomeActionTitleFontSize(
    Platform.OS === "web" ? frame.width : viewport.width,
  );
  const urgentInventoryLimit = getUrgentInventoryLimit(
    Platform.OS === "web" ? frame.height : viewport.height,
  );
  const appFrameStyle =
    Platform.OS === "web"
      ? [
          s.app,
          getPhoneShellStyle(Platform.OS),
          {
            flexGrow: 0,
            flexShrink: 0,
            flexBasis: "auto" as const,
            width: frame.width,
            height: frame.height,
          },
        ]
      : s.app;
  const visibleInventory = useMemo(
    () =>
      sortInventory(
        state.inventory.filter((item) => item.quantity > 0),
        inventorySort,
      ),
    [state.inventory, inventorySort],
  );
  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const raw = await AsyncStorage.getItem("naengtalk-local-validation-v1");
        const stored = raw ? JSON.parse(raw) : null;
        if (active && stored?.state) setState({ ...fresh(), ...stored.state });

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
      setState(fresh());
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
      setState({ ...fresh(), inventory });
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
          providedAt: response.recipe
            ? new Date().toISOString().slice(0, 10)
            : current.providedAt,
        }));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };
  const finish = async () => {
    if (lock.current) return;
    lock.current = true;
    setError("");
    try {
      if (!state.recipe) throw new Error("완료할 레시피가 없습니다.");
      const usage = usageFromDraft(usageDraft);
      if (!usage.length) throw new Error("재고에서 차감할 재료가 없습니다.");
      if (backendConfig.mode === "supabase") {
        await completeRemoteCooking({
          title: state.recipe.title,
          content: state.recipe,
          usage,
          requestKey: session,
        });
        const inventory = await loadRemoteInventory();
        setState((current) => ({
          ...current,
          inventory,
          saved: true,
          completedSessionIds: current.completedSessionIds.includes(session)
            ? current.completedSessionIds
            : [...current.completedSessionIds, session],
        }));
      } else {
        const result = completeCooking(state, session, usage);
        setState({ ...state, ...result, saved: true });
      }
      setDetail(false);
      setReview(false);
      setUsageDraft([]);
      setTab(3);
    } catch (e) {
      const message = (e as Error).message;
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
  const recipeCard = state.recipe && (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${state.recipe.title} 상세 열기`}
      onPress={openRecipe}
      style={s.card}
    >
      <View style={s.row}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[s.title, { fontSize: 17 }]}>{state.recipe.title}</Text>
          <Text style={s.muted}>
            제공일 {state.providedAt.replaceAll("-", ". ")}
          </Text>
        </View>
        <ChevronRight color={color.ink} size={22} />
      </View>
      <View style={s.row}>
        <Text style={s.badge}>{state.recipe.minutes}분</Text>
        <Text style={s.badge}>{state.recipe.servings}인분</Text>
      </View>
    </Pressable>
  );
  if (!ready)
    return (
      <View style={s.stage}>
        <Text style={s.text}>냉톡을 준비하고 있어요.</Text>
      </View>
    );
  return (
    <View style={s.stage}>
      <SafeAreaView style={appFrameStyle}>
        {!loggedIn ? (
          <View
            style={{ flex: 1, padding: 32, justifyContent: "center", gap: 20 }}
          >
            <Text style={[s.title, { fontSize: 38 }]}>냉톡</Text>
            <Text style={s.text}>대화로 관리하는 냉장고와 레시피</Text>
            <View style={{ height: 28 }} />
            <Button loading={authBusy} onPress={() => void handleGuestLogin()}>
              게스트 로그인(심사)
            </Button>
            <Button
              secondary
              onPress={() =>
                setError("Google 로그인은 Supabase 연결 후 사용할 수 있습니다.")
              }
            >
              구글 로그인
            </Button>
              <Text style={s.muted}>
                {backendConfig.mode === "local"
                  ? "개발 검증 모드입니다. 현재 게스트 버튼은 기기 내 샘플을 열며 실제 익명 인증·AI는 아직 연결되지 않았습니다."
                  : "게스트마다 독립된 원격 재고를 생성하고 로그인 상태를 안전하게 복원합니다."}
              </Text>
            <Text style={{ color: "#a94232" }}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={s.header}>
              {tab === 0 ? (
                <View accessibilityElementsHidden style={s.home}>
                  <Image
                    source={require("../../assets/images/icon.png")}
                    resizeMode="contain"
                    style={{ width: 38, height: 38 }}
                  />
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="홈으로 이동"
                  style={s.home}
                  onPress={() => setTab(0)}
                >
                  <Home size={23} color={color.ink} />
                </Pressable>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{titles[tab]}</Text>
                <Text style={s.muted}>
                  {tab === 0
                    ? "오늘도 남김없이, 나만의 한 끼"
                    : tab === 3
                      ? "완료한 레시피만 모아봐요"
                      : "내 냉장고에 맞춘 생활"}
                </Text>
              </View>
            </View>
            {timer}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.content}
            >
              {tab === 0 && (
                <View style={s.homeLayout}>
                  <View
                    style={[
                      s.card,
                      {
                        flex: 2,
                        minHeight: getUrgentCardMinHeight(urgentInventoryLimit),
                        backgroundColor: color.soft,
                      },
                    ]}
                  >
                    <Text style={s.title}>먼저 먹으면 좋겠어요</Text>
                    <Text style={s.muted}>
                      권장 소진일이 가까운 재료 · 샘플 추정일
                    </Text>
                    {[...state.inventory]
                      .filter((x) => x.quantity > 0)
                      .sort((a, b) => a.useBy.localeCompare(b.useBy))
                      .slice(0, urgentInventoryLimit)
                      .map((item) => (
                        <View
                          style={[s.row, { paddingVertical: 10 }]}
                          key={item.id}
                        >
                          <Text style={[s.text, { flex: 1 }]}>{item.name}</Text>
                          <View style={s.row}>
                            <Text style={s.muted}>
                              {item.quantity}
                              {item.unit}
                            </Text>
                            <Text
                              style={[
                                s.muted,
                                { fontWeight: "700", color: color.ink },
                              ]}
                            >
                              {item.useBy.slice(5).replace("-", ".")}
                            </Text>
                          </View>
                        </View>
                      ))}
                  </View>
                  <View style={[s.row, s.homeActions]}>
                    <Pressable
                      style={[
                        s.card,
                        {
                          flex: 1,
                          justifyContent: "center",
                          backgroundColor: color.warm,
                        },
                      ]}
                      onPress={() => setRegistration(true)}
                    >
                      <Package color={color.green} />
                      <Text
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        numberOfLines={1}
                        style={[s.title, { fontSize: homeActionTitleFontSize }]}
                      >
                        구매내역 등록
                      </Text>
                      <Text style={s.muted}>냉장고 채우기</Text>
                    </Pressable>
                    <Pressable
                      style={[s.card, { flex: 1, justifyContent: "center" }]}
                      onPress={() => setTab(1)}
                    >
                      <MessageCircle color={color.green} />
                      <Text
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        numberOfLines={1}
                        style={[s.title, { fontSize: homeActionTitleFontSize }]}
                      >
                        오늘 뭐 먹지?
                      </Text>
                      <Text style={s.muted}>메뉴 상담하기</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              {tab === 1 && (
                <>
                  <View style={[s.card, { marginTop: 12 }]}>
                    <Text style={s.text}>
                      오늘은 어떤 메뉴가 당기세요? 시간, 맛, 원하는 메뉴를 말하면
                      현재 재고와 조리도구에 맞춰 한 가지를 추천해드려요.
                    </Text>
                  </View>
                  {state.chat.map((item, index) => (
                    <View
                      key={`${item.role}-${index}`}
                      style={[
                        s.card,
                        item.role === "user"
                          ? { backgroundColor: color.green, marginLeft: 42 }
                          : { marginRight: 24 },
                      ]}
                    >
                      <Text style={[s.text, item.role === "user" && { color: "white" }]}>
                        {breakSentences(item.content)}
                      </Text>
                    </View>
                  ))}
                  {aiBusy ? (
                    <View style={[s.card, { marginRight: 24 }]}>
                      <View style={s.loadingRow}>
                        <Text accessibilityLiveRegion="polite" style={[s.muted, { flex: 1 }]}>
                          냉장고와 레시피를 확인하고 있어요…
                        </Text>
                        <ActivityIndicator size="small" color={color.green} />
                      </View>
                    </View>
                  ) : null}
                  {state.recipe ? (
                    <View style={[s.card, { backgroundColor: color.soft }]}>
                      <Text style={s.title}>{state.recipe.title}</Text>
                      <Text style={s.text}>{breakSentences(state.recipe.reason)}</Text>
                      <Button secondary onPress={openRecipe}>
                        레시피 전체 보기
                      </Button>
                    </View>
                  ) : null}
                  {error ? (
                    <Text accessibilityRole="alert" style={{ color: "#a94232" }}>
                      {error}
                    </Text>
                  ) : null}
                </>
              )}
              {tab === 2 && (
                <>
                  <Button onPress={() => setRegistration(true)}>
                    재고 등록
                  </Button>
                  <View style={[s.row, { justifyContent: "space-between" }]}>
                    <Text style={s.muted}>{visibleInventory.length}종 보관 중</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="재고 정렬 방식 선택"
                      style={s.sortButton}
                      onPress={() => setSortMenu(true)}
                    >
                      <Text style={s.muted}>
                        {inventorySort === "expiry"
                          ? "남은 소비기한 순"
                          : "이름순"}
                      </Text>
                      <ChevronDown size={16} color={color.muted} />
                    </Pressable>
                  </View>
                  {visibleInventory.map((item) => (
                    <View key={item.id} style={s.card}>
                      <View style={s.row}>
                        <Text style={[s.title, { fontSize: 17, flex: 1 }]}>
                          {item.name}
                        </Text>
                        <Text style={s.text}>
                          {item.quantity}
                          {item.unit}
                        </Text>
                      </View>
                      <Text style={s.muted}>
                        권장 소진일(샘플 추정) {item.useBy}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {tab === 3 &&
                (state.saved ? (
                  recipeCard
                ) : (
                  <View style={s.card}>
                    <Text style={s.text}>아직 완료한 요리가 없어요.</Text>
                    <Text style={s.muted}>
                      채팅에서 레시피를 열고 요리 완료하면 여기에 저장돼요.
                    </Text>
                    <Button secondary onPress={() => setTab(1)}>
                      채팅으로 이동
                    </Button>
                  </View>
                ))}
              {tab === 4 && (
                <>
                  <TextInput
                    style={s.input}
                    accessibilityLabel="조리도구"
                    placeholder="예: 2.5L 냄비"
                    value={input}
                    onChangeText={setInput}
                  />
                  <Button
                    onPress={() => {
                      if (input.trim()) {
                        setState({
                          ...state,
                          tools: [...state.tools, input.trim()],
                        });
                        setInput("");
                      }
                    }}
                  >
                    조리도구 입력
                  </Button>
                  <View style={s.grid}>
                    {state.tools.map((tool, i) => (
                      <View style={[s.card, s.third]} key={`${tool}-${i}`}>
                        <CookingPot color={color.green} size={19} />
                        <Text
                          style={[
                            s.text,
                            {
                              textAlign: "center",
                              flexShrink: 1,
                              fontSize: 12,
                              lineHeight: 16,
                            },
                          ]}
                        >
                          {tool}
                        </Text>
                        <Pressable
                          onPress={() =>
                            setState({
                              ...state,
                              tools: state.tools.filter((_, j) => i !== j),
                            })
                          }
                        >
                          <Text style={[s.muted, { fontSize: 11, lineHeight: 14 }]}>삭제</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </>
              )}
              {tab === 5 && (
                <>
                  <View style={s.card}>
                    <Text style={s.title}>알레르기 항목</Text>
                    <Text style={s.muted}>
                      등록된 항목은 레시피를 만들기 전에 AI와 안전 검사에서 확인합니다.
                    </Text>
                    <TextInput
                      style={s.input}
                      accessibilityLabel="알레르기 항목"
                      placeholder="예: 새우"
                      value={input}
                      onChangeText={setInput}
                    />
                    <Button
                      onPress={() => {
                        const allergen = input.trim();
                        if (allergen && !state.allergens.includes(allergen)) {
                          setState({ ...state, allergens: [...state.allergens, allergen] });
                          setInput("");
                        }
                      }}
                    >
                      알레르기 등록
                    </Button>
                    {state.allergens.length ? state.allergens.map((allergen) => (
                      <View key={allergen} style={s.row}>
                        <Text style={[s.text, { flex: 1 }]}>{allergen}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${allergen} 알레르기 삭제`}
                          onPress={() => setState({
                            ...state,
                            allergens: state.allergens.filter((item) => item !== allergen),
                          })}
                        >
                          <Text style={s.muted}>삭제</Text>
                        </Pressable>
                      </View>
                    )) : (
                      <Text style={s.text}>등록된 알레르기 없음</Text>
                    )}
                  </View>
                  <Button
                    secondary
                    onPress={() => void handleResetDemo()}
                  >
                    {authBusy ? "초기화 중…" : "샘플 데이터 초기화"}
                  </Button>
                  <Button
                    secondary
                    onPress={() => void handleLogout()}
                  >
                    {authBusy ? "로그아웃 중…" : "로그아웃"}
                  </Button>
                </>
              )}
            </ScrollView>
            {tab === 1 && (
              <View style={[s.footer, s.row]}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder="먹고 싶은 메뉴를 말해보세요"
                  value={input}
                  onChangeText={setInput}
                  editable={!aiBusy}
                  onSubmitEditing={() => void handleSendChat()}
                />
                <Button loading={aiBusy} onPress={() => void handleSendChat()}>
                  전송
                </Button>
              </View>
            )}
            <View style={s.nav}>
              {tabs.map((name, i) => {
                const Icon = icons[i];
                return (
                  <Pressable
                    key={name}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === i }}
                    style={s.tab}
                    onPress={() => {
                      setTab(i);
                      setInput("");
                    }}
                  >
                    <Icon
                      size={22}
                      color={tab === i ? color.green : color.muted}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        color: tab === i ? color.green : color.muted,
                      }}
                    >
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        <Modal
          visible={detail}
          animationType="slide"
          onRequestClose={() => setDetail(false)}
        >
          <View style={s.stage}>
            <SafeAreaView style={appFrameStyle}>
              <View style={s.header}>
                <Text style={s.title}>{activeRecipe.title}</Text>
              </View>
              {timer}
              <ScrollView
                ref={recipeScroll}
                onContentSizeChange={() => { if (review) recipeScroll.current?.scrollToEnd({ animated: true }); }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.content}
              >
                <Text style={s.muted}>
                  제공일 {state.providedAt.replaceAll("-", ". ")} · {activeRecipe.servings}인분 · {activeRecipe.minutes}분
                </Text>
                <Text style={s.badge}>{breakSentences(activeRecipe.reason)}</Text>
                <View style={s.card}>
                  <Text style={s.title}>준비 재료</Text>
                  {activeRecipe.ingredients.map((ingredient, index) => (
                    <Text key={`${ingredient.name}-${index}`} style={s.text}>
                      {ingredient.name}
                      {ingredient.quantity !== null && ingredient.unit
                        ? ` ${ingredient.quantity}${ingredient.unit}`
                        : ""}
                      {ingredient.requiredPurchase ? " · 구매 필요" : ""}
                    </Text>
                  ))}
                </View>
                {activeRecipe.steps.map((step, i) => (
                  <View style={s.card} key={i}>
                    <Text style={[s.title, { fontSize: 16 }]}>
                      {formatCookingStepTitle(i)}
                    </Text>
                    <Text style={s.text}>{breakSentences(step.text)}</Text>
                    {step.minutes > 0 && (
                      <Button
                        secondary
                        onPress={() => {
                          const startedAt = Date.now();
                          setNow(startedAt);
                          setState({
                            ...state,
                            timer: {
                              label: `${i + 1}단계`,
                              endsAt: startedAt + step.minutes * 60000,
                            },
                          });
                        }}
                      >{`${step.minutes}분 타이머 시작`}</Button>
                    )}
                  </View>
                ))}
                {review && (
                  <View style={[s.card, { backgroundColor: color.soft }]}>
                    <Text style={s.title}>사용량을 확인해주세요</Text>
                    {usageDraft.map((line) => (
                      <View key={line.ingredientId} style={s.usageRow}>
                        <Text style={[s.text, { flex: 1 }]}>
                          {state.inventory.find((x) => x.id === line.ingredientId)?.name}
                        </Text>
                        <TextInput
                          accessibilityLabel={`${state.inventory.find((x) => x.id === line.ingredientId)?.name ?? "재료"} 사용량`}
                          inputMode="decimal"
                          value={line.quantityText}
                          onChangeText={(quantityText) => setUsageDraft((current) => (
                            updateUsageDraftQuantity(current, line.ingredientId, quantityText)
                          ))}
                          style={s.usageInput}
                        />
                        <Text style={s.text}>{line.unit}</Text>
                      </View>
                    ))}
                    <Text style={s.muted}>
                      확정하면 현재 재고에서 차감합니다.
                    </Text>
                    <Button onPress={() => void finish()}>사용량 확정</Button>
                  </View>
                )}
                {error ? (
                  <Text accessibilityRole="alert" style={{ color: "#a94232" }}>
                    {error}
                  </Text>
                ) : null}
              </ScrollView>
              <View style={[s.footer, s.row]}>
                <View style={{ flex: 1 }}>
                  <Button
                    secondary
                    onPress={() => {
                      setDetail(false);
                      setReview(false);
                      setUsageDraft([]);
                    }}
                  >
                    {tab === 3
                      ? "레시피 목록으로 돌아가기"
                      : "채팅으로 돌아가기"}
                  </Button>
                </View>
                <Button onPress={startUsageReview}>요리 완료</Button>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
        <Modal
          visible={sortMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setSortMenu(false)}
        >
          <Pressable
            style={{
              flex: 1,
              justifyContent: "center",
              padding: 24,
              backgroundColor: "#0007",
            }}
            onPress={() => setSortMenu(false)}
          >
            <View
              style={[
                s.card,
                { alignSelf: "center", width: "100%", maxWidth: 360 },
              ]}
            >
              <Text style={s.title}>재고 정렬</Text>
              {(
                [
                  ["expiry", "남은 소비기한 순"],
                  ["name", "이름순"],
                ] as const
              ).map(([mode, label]) => (
                <Pressable
                  accessibilityRole="button"
                  key={mode}
                  style={[s.row, { minHeight: 48 }]}
                  onPress={() => {
                    setInventorySort(mode);
                    setSortMenu(false);
                  }}
                >
                  <Text style={[s.text, { flex: 1 }]}>{label}</Text>
                  {inventorySort === mode ? (
                    <Check size={20} color={color.green} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
        <Modal
          visible={registration}
          transparent
          animationType="fade"
          onRequestClose={() => {
            closeRegistration();
          }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              padding: 24,
              backgroundColor: "#0007",
            }}
          >
            <View
              style={[
                s.card,
                { alignSelf: "center", width: "100%", maxWidth: 440, maxHeight: "90%" },
              ]}
            >
              <Text style={s.title}>
                {direct
                  ? "식품 직접 입력"
                  : purchaseRows.length || purchaseFailures.length
                    ? "구매내역 확인"
                    : purchasePicker
                      ? "구매내역 이미지 선택"
                      : "재고 등록"}
              </Text>
              {direct ? (
                <>
                  <TextInput
                    multiline
                    style={[s.input, { minHeight: 110 }]}
                    placeholder="식품의 이름과 용량, 유통기한을 적어주세요."
                    value={directInput}
                    onChangeText={setDirectInput}
                    editable={!purchaseBusy}
                  />
                  <Text style={s.muted}>
                    {breakSentences("AI가 입력 내용을 분석한 뒤 재고명, 수량, 권장 소진일을 보여드립니다. 확인 후 최종 등록할 수 있습니다.")}
                  </Text>
                  {purchaseBusy ? (
                    <View style={s.loadingRow}>
                      <Text accessibilityLiveRegion="polite" style={[s.muted, { flex: 1 }]}>
                        {purchaseProgress || "입력 내용을 분석하고 있어요"}…
                      </Text>
                      <ActivityIndicator size="small" color={color.green} />
                    </View>
                  ) : null}
                  <Button
                    loading={purchaseBusy}
                    disabled={!directInput.trim()}
                    onPress={() => void handleAnalyzeDirectInventory()}
                  >
                    식품 등록
                  </Button>
                  <Text style={s.muted}>{error}</Text>
                </>
              ) : purchaseRows.length || purchaseFailures.length ? (
                <>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {purchaseRows.some((row) => row.needsReview) || purchaseFailures.length ? (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={{ color: "#a94232", fontWeight: "700", marginBottom: 12 }}
                    >
                      직접 입력해야 하는 항목들이 있습니다.
                    </Text>
                  ) : null}
                  <Text style={[s.muted, { marginBottom: 12 }]}>
                    {breakSentences("재고명, 수량, 권장 소진일을 확인해주세요. 원본 이미지는 저장하지 않습니다.")}
                  </Text>
                  {purchaseRows.map((row) => (
                    <View
                      key={row.id}
                      style={[
                        s.card,
                        {
                          padding: 12,
                          marginBottom: 12,
                          borderRadius: 16,
                          borderColor: row.needsReview ? "#c64b3c" : color.line,
                          borderWidth: row.needsReview ? 2 : 1,
                        },
                      ]}
                    >
                      <Text style={[s.muted, { fontWeight: "700" }]}>재고명</Text>
                      <TextInput
                        accessibilityLabel={`${row.name || "미확인 식품"} 재고명`}
                        value={row.name}
                        onChangeText={(name) => setPurchaseRows((current) => current.map((item) => (
                          item.id === row.id
                            ? updatePurchaseReviewRow(item, { name }, new Date().toISOString().slice(0, 10))
                            : item
                        )))}
                        style={s.input}
                      />
                      <Text style={[s.muted, { fontWeight: "700" }]}>수량</Text>
                      <TextInput
                        accessibilityLabel={`${row.name || "미확인 식품"} 수량`}
                        placeholder="예: 300g, 2개"
                        value={row.quantityText}
                        onChangeText={(quantityText) => setPurchaseRows((current) => current.map((item) => (
                          item.id === row.id
                            ? updatePurchaseReviewRow(item, { quantityText }, new Date().toISOString().slice(0, 10))
                            : item
                        )))}
                        style={s.input}
                      />
                      <Text style={[s.muted, { fontWeight: "700" }]}>권장 소진일</Text>
                      <TextInput
                        accessibilityLabel={`${row.name || "미확인 식품"} 권장 소진일`}
                        inputMode="numeric"
                        placeholder="YYYY-MM-DD"
                        value={row.useByDate}
                        onChangeText={(useByDate) => setPurchaseRows((current) => current.map((item) => (
                          item.id === row.id
                            ? updatePurchaseReviewRow(item, { useByDate }, new Date().toISOString().slice(0, 10))
                            : item
                        )))}
                        style={s.input}
                      />
                    </View>
                  ))}
                  {purchaseFailures.map((failure) => (
                    <View
                      key={failure.id}
                      style={[s.card, { padding: 12, marginBottom: 12, borderColor: "#c64b3c" }]}
                    >
                      <Text style={[s.text, { fontWeight: "700" }]}>{failure.label}</Text>
                      <Text style={{ color: "#a94232" }}>{failure.error}</Text>
                    </View>
                  ))}
                  {error ? <Text style={{ color: "#a94232", marginTop: 10 }}>{error}</Text> : null}
                </ScrollView>
                {purchaseRows.length ? (
                  <Button
                    loading={purchaseBusy}
                    disabled={purchaseRows.some((row) => row.needsReview) || purchaseFailures.length > 0}
                    onPress={() => void handleRegisterPurchase()}
                  >
                    등록
                  </Button>
                ) : null}
                <Button
                  secondary
                  onPress={() => {
                    setPurchaseRows([]);
                    setPurchaseFailures([]);
                    setPurchasePicker(true);
                    setError("");
                  }}
                >
                  다른 이미지 선택
                </Button>
                </>
              ) : purchasePicker ? (
                <>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={[s.muted, { marginBottom: 12 }]}>
                    {breakSentences("심사용 샘플을 고르거나 직접 이미지를 등록하세요. 한 번에 최대 10장까지 분석합니다.")}
                  </Text>
                  <View style={s.grid}>
                    {purchaseDemoAssets.map((sample) => {
                      const selected = purchaseSelections.some((item) => item.id === sample.id);
                      return (
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected, disabled: purchaseBusy }}
                          accessibilityLabel={`${sample.id} 구매내역 선택`}
                          disabled={purchaseBusy}
                          key={sample.id}
                          onPress={() => togglePurchaseSample(sample)}
                          style={[
                            s.card,
                            {
                              width: "47%",
                              padding: 8,
                              borderRadius: 16,
                              borderColor: selected ? color.green : color.line,
                              borderWidth: selected ? 2 : 1,
                            },
                          ]}
                        >
                          <Image
                            source={sample.source}
                            resizeMode="cover"
                            style={{ width: "100%", height: 116, borderRadius: 10 }}
                          />
                          <View style={s.row}>
                            <Text style={[s.text, { flex: 1, fontWeight: "700" }]}>{sample.id}</Text>
                            {selected ? <Check size={18} color={color.green} /> : null}
                          </View>
                          <Text style={s.muted}>{sample.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {purchaseSelections.filter((item) => item.kind === "library").map((item) => (
                    <View key={item.id} style={[s.row, { paddingVertical: 7 }]}>
                      <Text numberOfLines={1} style={[s.text, { flex: 1 }]}>{item.label}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${item.label} 선택 해제`}
                        onPress={() => setPurchaseSelections((current) => current.filter((entry) => entry.id !== item.id))}
                      >
                        <Text style={{ color: "#a94232", fontWeight: "700" }}>삭제</Text>
                      </Pressable>
                    </View>
                  ))}
                  {purchaseBusy ? (
                    <View style={[s.loadingRow, { marginTop: 12 }]}>
                      <Text accessibilityLiveRegion="polite" style={[s.text, { flex: 1 }]}>
                        {purchaseProgress} 분석 중…
                      </Text>
                      <ActivityIndicator size="small" color={color.green} />
                    </View>
                  ) : null}
                  {error ? <Text style={{ color: "#a94232", marginTop: 10 }}>{error}</Text> : null}
                </ScrollView>
                {purchaseSelections.length ? (
                  <Button loading={purchaseBusy} onPress={() => void handleAnalyzePurchases()}>
                    {`선택한 이미지 분석 (${purchaseSelections.length})`}
                  </Button>
                ) : null}
                <Button secondary onPress={() => void handlePickPurchaseImages()}>
                  이미지 등록
                </Button>
                </>
              ) : (
                <>
                  <Text style={s.muted}>
                    {breakSentences("구매내역 캡처를 AI로 분석하거나 식품을 직접 입력할 수 있습니다.")}
                  </Text>
                  <Button
                    onPress={() => {
                      setPurchasePicker(true);
                      setError("");
                    }}
                  >
                    구매내역 캡처 등록
                  </Button>
                  <Button secondary onPress={() => setDirect(true)}>
                    직접 입력
                  </Button>
                </>
              )}
              <Button
                secondary
                onPress={closeRegistration}
              >
                닫기
              </Button>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
