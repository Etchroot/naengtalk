import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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
import {
  getHomeActionTitleFontSize,
  getUrgentCardMinHeight,
  getUrgentInventoryLimit,
} from "../domain/home-layout.ts";
import { formatCookingStepTitle } from "../domain/recipe-presentation.ts";
import {
  sortInventory,
  type InventorySortMode,
} from "../domain/inventory-presentation.ts";
import { getAndroidWebFrame } from "../domain/web-frame.ts";
import { backendConfig } from "../services/backend-config.ts";
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
const usage = [
  { ingredientId: "kimchi", quantity: 150, unit: "g" },
  { ingredientId: "tofu", quantity: 100, unit: "g" },
  { ingredientId: "soy", quantity: 5, unit: "ml" },
];
const steps = [
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
type LocalState = CookingState & {
  providedAt: string;
  saved: boolean;
  tools: string[];
  timer: { label: string; endsAt: number } | null;
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
    timer: null,
  };
}
function Button({
  children,
  onPress,
  secondary = false,
}: {
  children: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[s.button, secondary && s.secondary]}
    >
      <Text style={[s.buttonText, secondary && { color: color.green }]}>
        {children}
      </Text>
    </Pressable>
  );
}
export default function NaengTalk() {
  const viewport = useWindowDimensions();
  const [state, setState] = useState<LocalState>(fresh);
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState(0);
  const [detail, setDetail] = useState(false);
  const [review, setReview] = useState(false);
  const [session, setSession] = useState("");
  const [registration, setRegistration] = useState(false);
  const [direct, setDirect] = useState(false);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
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
    AsyncStorage.getItem("naengtalk-local-validation-v1")
      .then((raw) => {
        if (raw) {
          const data = JSON.parse(raw);
          setState(data.state);
          setLoggedIn(data.loggedIn);
        }
      })
      .catch(() => setError("로컬 저장 데이터를 읽지 못했습니다."))
      .finally(() => setReady(true));
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
  const openRecipe = () => {
    setSession(`local-${Date.now()}-${Math.random()}`);
    setError("");
    setReview(false);
    setDetail(true);
  };
  const finish = () => {
    if (lock.current) return;
    lock.current = true;
    try {
      const result = completeCooking(state, session, usage);
      setState({ ...state, ...result, saved: true });
      setDetail(false);
      setReview(false);
      setTab(3);
    } catch (e) {
      setError((e as Error).message);
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
  const recipeCard = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="김치 두부찌개 상세 열기"
      onPress={openRecipe}
      style={s.card}
    >
      <View style={s.row}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[s.title, { fontSize: 17 }]}>김치 두부찌개</Text>
          <Text style={s.muted}>
            제공일 {state.providedAt.replaceAll("-", ". ")}
          </Text>
        </View>
        <ChevronRight color={color.ink} size={22} />
      </View>
      <View style={s.row}>
        <Text style={s.badge}>20분</Text>
        <Text style={s.badge}>쉬움</Text>
        <Text style={s.badge}>1인분</Text>
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
            <Button onPress={() => setLoggedIn(true)}>
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
                  : "Supabase 연결 설정이 감지되었습니다. 다음 단계에서 실제 익명 로그인과 원격 재고를 활성화합니다."}
              </Text>
            <Text style={{ color: "#a94232" }}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={s.header}>
              {tab === 0 ? (
                <View accessibilityElementsHidden style={s.home} />
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
            <View style={s.notice}>
          <Text style={s.muted}>
            {backendConfig.mode === "local"
              ? "로컬 개발 검증 · AI / 클라우드 미연결"
              : "Supabase 연결 준비됨 · 원격 데이터 전환 대기"}
          </Text>
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
                      오늘은 어떤 메뉴가 당기세요? 아래 샘플 레시피로 타이머와
                      재고 차감을 검증할 수 있어요.
                    </Text>
                    <Button secondary onPress={openRecipe}>
                      레시피 전체 보기
                    </Button>
                  </View>
                  {message ? (
                    <View style={s.card}>
                      <Text style={s.text}>{message}</Text>
                      <Text style={s.muted}>
                        AI 연결 전이므로 이 메시지에 대한 생성이나 재고 변경은
                        실행하지 않았습니다.
                      </Text>
                    </View>
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
                    <Text style={s.text}>새우</Text>
                    <Text style={s.muted}>
                      게스트 샘플 기본값입니다. 알레르기 편집·레시피 검증은 다음
                      서버 연동 단계에서 활성화합니다.
                    </Text>
                  </View>
                  <Button
                    secondary
                    onPress={() => {
                      setState(fresh());
                      setError("");
                    }}
                  >
                    샘플 데이터 초기화
                  </Button>
                  <Button
                    secondary
                    onPress={() => {
                      setLoggedIn(false);
                      setTab(0);
                    }}
                  >
                    로그아웃
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
                />
                <Button
                  onPress={() => {
                    if (input.trim()) {
                      setMessage(input);
                      setInput("");
                    }
                  }}
                >
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
                <Text style={s.title}>김치 두부찌개</Text>
              </View>
              {timer}
              <ScrollView
                ref={recipeScroll}
                onContentSizeChange={() => { if (review) recipeScroll.current?.scrollToEnd({ animated: true }); }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.content}
              >
                <Text style={s.muted}>
                  제공일 {state.providedAt.replaceAll("-", ". ")} · 1인분 · 20분
                </Text>
                <Text style={s.badge}>
                  동작 검증용 샘플 레시피 · AI 생성 아님
                </Text>
                <View style={s.card}>
                  <Text style={s.title}>준비 재료</Text>
                  <Text style={s.text}>
                    김치 150g · 두부 100g · 간장 5ml · 물 350ml
                  </Text>
                </View>
                {steps.map((step, i) => (
                  <View style={s.card} key={i}>
                    <Text style={[s.title, { fontSize: 16 }]}>
                      {formatCookingStepTitle(i)}
                    </Text>
                    <Text style={s.text}>{step.text}</Text>
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
                    {usage.map((line) => (
                      <Text key={line.ingredientId} style={s.text}>
                        {
                          state.inventory.find(
                            (x) => x.id === line.ingredientId,
                          )?.name
                        }{" "}
                        − {line.quantity}
                        {line.unit}
                      </Text>
                    ))}
                    <Text style={s.muted}>
                      확정하면 현재 재고에서 차감합니다.
                    </Text>
                    <Button onPress={finish}>사용량 확정</Button>
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
                    }}
                  >
                    {tab === 3
                      ? "레시피 목록으로 돌아가기"
                      : "채팅으로 돌아가기"}
                  </Button>
                </View>
                <Button onPress={() => setReview(true)}>요리 완료</Button>
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
            setRegistration(false);
            setDirect(false);
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
            <View style={s.card}>
              <Text style={s.title}>
                {direct ? "식품 직접 입력" : "재고 등록"}
              </Text>
              {direct ? (
                <>
                  <TextInput
                    multiline
                    style={[s.input, { minHeight: 110 }]}
                    placeholder="식품의 이름과 용량, 유통기한을 적어주세요."
                  />
                  <Text style={s.muted}>
                    AI 연동 후 분석·검수·등록을 활성화합니다. 현재는 재고를
                    변경하지 않습니다.
                  </Text>
                  <Button onPress={() => setError("AI 연결이 필요합니다.")}>
                    식품 등록
                  </Button>
                  <Text style={s.muted}>{error}</Text>
                </>
              ) : (
                <>
                  <Text style={s.muted}>
                    구매내역·영수증 인식은 서버 연결 후 활성화합니다.
                  </Text>
                  <Button secondary onPress={() => setDirect(true)}>
                    직접 입력
                  </Button>
                </>
              )}
              <Button
                secondary
                onPress={() => {
                  setRegistration(false);
                  setDirect(false);
                  setError("");
                }}
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
