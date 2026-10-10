import type { AxiosResponse } from "axios";
import type { CursorPage, Product, Review, Shop } from "@/services/api/shops";
import type { CartItem } from "@/store/slices/cart-slice";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { ArrowLeft, ChatCircleDots, Heart, HeartStraight, Minus, Phone, Plus, Star, Storefront, WhatsappLogo } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Animated, I18nManager, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCount, formatRating } from "@/components/directory/format";
import { DetailErrorScreen, ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAuthGuard } from "@/lib/hooks/use-auth-guard";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { cartAddBlock, cartAddBlockKey } from "@/lib/order-limits";
import { openWhatsAppChat, toWhatsAppDigits } from "@/lib/whatsapp";
import { DAY_KEYS, dayKeyFor, formatClockTime, hasSchedule, isShopOpenNow } from "@/lib/working-hours";
import { getAllSavedShopIds, shopsApi } from "@/services/api/shops";
import { useAppDispatch, useAppSelector } from "@/store";
import { addItem, updateQuantity } from "@/store/slices/cart-slice";
import { BRAND, DARK, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Tab = "menu" | "reviews";
type Row = { kind: "product"; product: Product } | { kind: "review"; review: Review };

const HERO_HEIGHT = 220;
const CART_BAR_HEIGHT = 56;
const NAV_BTN_SIZE = 44;
/** Status bar excluded: the band the floating back/save buttons occupy. */
const NAV_BAR_HEIGHT = SPACING.sm + NAV_BTN_SIZE + SPACING.sm;
/** The solid bar is fully in before the shop name can reach the buttons. */
const SOLID_HEADER_AT = HERO_HEIGHT - NAV_BAR_HEIGHT - SPACING.xl;

// ─── Styles ───────────────────────────────────────────────────────────────────

function buildHeaderStyles(colors: ReturnType<typeof useAppColors>) {
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    // Hero
    hero: { width: "100%", backgroundColor: colors.elevated },
    heroImage: { width: "100%", height: "100%" },
    heroPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
    scrim: { position: "absolute", top: 0, left: 0, right: 0 },
    // Info
    info: { paddingHorizontal: SPACING.base, paddingTop: SPACING.base, paddingBottom: SPACING.md, gap: SPACING.sm },
    nameRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
    name: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 22, lineHeight: 33, color: colors.text, flex: 1 },
    statusBadge: {
      minHeight: 28,
      marginTop: 3,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.full,
      justifyContent: "center",
    },
    badgeOpen: { backgroundColor: SEMANTIC.success },
    badgeClosed: { backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
    statusText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 12, lineHeight: 18, color: colors.text },
    statusTextOpen: { color: DARK.text },
    metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: SPACING.xs },
    meta: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 21, color: colors.textMuted },
    metaStrong: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 21, color: colors.text },
    description: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, lineHeight: 22 },
    ctaRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.xs },
    ctaBtn: {
      flex: 1,
      flexDirection: "row",
      minHeight: 48,
      borderRadius: RADIUS.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
      gap: SPACING.sm,
    },
    ctaBtnText: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 21, color: colors.text, fontWeight: "600" },

    // Tabs
    tabBar: {
      flexDirection: "row",
      marginHorizontal: SPACING.base,
      marginBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      minHeight: 48,
      justifyContent: "center",
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
      marginBottom: -1,
    },
    tabActive: { borderBottomColor: gold },
    tabText: { fontFamily: FONT.sans, fontSize: 15, lineHeight: 22, color: colors.textMuted, fontWeight: "500" },
    tabTextActive: { color: gold, fontWeight: "700" },

    // Working hours
    hoursBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.base,
      paddingVertical: SPACING.sm,
      marginTop: SPACING.xs,
    },
    hoursTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 23, color: colors.text, marginBottom: SPACING.xs },
    hoursRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 32, gap: SPACING.sm },
    hoursDay: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 21, color: colors.textMuted },
    hoursValue: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 21, color: colors.textMuted },
    hoursToday: { color: gold, fontWeight: "700" },
  });
}

function buildListStyles(colors: ReturnType<typeof useAppColors>) {
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return StyleSheet.create({
    rowWrap: { paddingHorizontal: SPACING.base, paddingBottom: SPACING.sm },
    skeletons: { paddingHorizontal: SPACING.base, gap: SPACING.sm },
    productRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      gap: SPACING.md,
    },
    productImage: { width: 72, height: 72, borderRadius: RADIUS.md, backgroundColor: colors.elevated },
    productImageDim: { opacity: 0.5 },
    productInfo: { flex: 1, gap: 2 },
    productName: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, lineHeight: 23, color: colors.text },
    productDesc: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted, lineHeight: 20 },
    productFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm, marginTop: SPACING.xs },
    productPrice: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 23, color: gold },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.full,
      backgroundColor: BRAND.gold,
      justifyContent: "center",
      alignItems: "center",
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: RADIUS.full,
      backgroundColor: `${BRAND.gold}1f`,
    },
    stepBtn: { width: 44, height: 44, borderRadius: RADIUS.full, justifyContent: "center", alignItems: "center" },
    stepCount: { minWidth: 24, textAlign: "center", fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 22, color: colors.text },
    unavailablePill: {
      minHeight: 28,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.full,
      justifyContent: "center",
      backgroundColor: colors.elevated,
    },
    unavailableText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 12, lineHeight: 18, color: colors.textMuted },
    pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },

    reviewCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: SPACING.base,
      gap: SPACING.xs,
    },
    reviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: SPACING.sm },
    reviewerName: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 21, color: colors.text, flexShrink: 1 },
    reviewStars: { flexDirection: "row", gap: 2 },
    reviewDate: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    reviewComment: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, lineHeight: 22 },

    empty: { alignItems: "center", paddingVertical: SPACING["3xl"], paddingHorizontal: SPACING.xl, gap: SPACING.sm },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: RADIUS.full,
      backgroundColor: `${BRAND.gold}1f`,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: SPACING.xs,
    },
    emptyTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 24, color: colors.text, textAlign: "center" },
    emptyText: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 21, color: colors.textMuted, textAlign: "center" },

    // Floating cart pill — the route is inside (tabs), so the tab bar already clears the system nav.
    cartBar: {
      position: "absolute",
      start: SPACING.base,
      end: SPACING.base,
      bottom: SPACING.base,
      height: CART_BAR_HEIGHT,
      borderRadius: RADIUS.full,
      backgroundColor: BRAND.gold,
      flexDirection: "row",
      alignItems: "center",
      paddingStart: SPACING.sm,
      paddingEnd: SPACING.lg,
      gap: SPACING.md,
      shadowColor: BRAND.ink,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    cartBarBadge: {
      minWidth: 40,
      height: 40,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.full,
      backgroundColor: `${BRAND.ink}26`,
      justifyContent: "center",
      alignItems: "center",
    },
    cartBarBadgeText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 20, color: BRAND.ink },
    cartBarLabel: { flex: 1, fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 22, color: BRAND.ink },
    cartBarTotal: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 22, color: BRAND.ink },
  });
}

/** Floating back/save buttons and the solid bar that appears behind them. */
function buildNavStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    heroNav: {
      position: "absolute",
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: SPACING.base,
    },
    navBtn: {
      width: NAV_BTN_SIZE,
      height: NAV_BTN_SIZE,
      borderRadius: RADIUS.full,
      backgroundColor: `${BRAND.ink}99`,
      justifyContent: "center",
      alignItems: "center",
    },
    navSpacer: { width: NAV_BTN_SIZE, height: NAV_BTN_SIZE },
    // Solid bar that replaces the photo under the status bar and the buttons
    // once the hero has scrolled away, so text never slides under them.
    solidHeader: {
      position: "absolute",
      top: 0,
      start: 0,
      end: 0,
      backgroundColor: colors.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      justifyContent: "flex-end",
    },
    solidHeaderRow: {
      height: NAV_BAR_HEIGHT,
      justifyContent: "center",
      paddingHorizontal: SPACING.base + NAV_BTN_SIZE + SPACING.sm,
    },
    solidHeaderTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 24, color: colors.text, textAlign: "center" },
  });
}

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  return { ...buildHeaderStyles(colors), ...buildNavStyles(colors), ...buildListStyles(colors) };
}

type Styles = ReturnType<typeof buildStyles>;
type Colors = ReturnType<typeof useAppColors>;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({ styles: buildStyles(colors), colors }), [colors]);
}

/**
 * Light status-bar icons over the hero scrim while focused; once the solid
 * header is in, the theme's own style (dark icons on the light theme).
 * Theme default again on blur.
 */
function useHeroStatusBar(isDarkTheme: boolean, solid: boolean) {
  useFocusEffect(React.useCallback(() => {
    setStatusBarStyle(solid && !isDarkTheme ? "dark" : "light");
    return () => setStatusBarStyle(isDarkTheme ? "light" : "dark");
  }, [isDarkTheme, solid]));
}

/** True once the hero photo has scrolled away from under the buttons. */
function useSolidHeader() {
  const [solid, setSolid] = React.useState(false);
  const onScroll = React.useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const next = e.nativeEvent.contentOffset.y > SOLID_HEADER_AT;
    setSolid(prev => (prev === next ? prev : next));
  }, []);
  return { solid, onScroll };
}

function goBack() {
  if (router.canGoBack())
    router.back();
  else router.replace("/(tabs)/directory");
}

// ─── Screen ───────────────────────────────────────────────────────────────────

/** Heart state for the shop: saving is RESIDENT-only on the backend. */
function useShopSave(shopId: string) {
  const { t } = useTranslation();
  const { requireAuth } = useAuthGuard();
  const queryClient = useQueryClient();
  const role = useAppSelector(s => s.auth.user?.role);
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  // Guests still see the heart (it opens the auth wall); merchants/admins would only get a 403.
  const isResident = isAuthenticated && role === "RESIDENT";
  const canSave = !isAuthenticated || isResident;

  // The shop response has no "saved" flag, so read the resident's saved ids.
  const { data: savedShopIds } = useQuery({
    queryKey: ["saved-shop-ids"],
    queryFn: getAllSavedShopIds,
    enabled: isResident,
  });
  const saved = !!savedShopIds?.includes(shopId);

  const setSavedLocally = React.useCallback((next: boolean) => {
    queryClient.setQueryData<string[]>(["saved-shop-ids"], (ids) => {
      const rest = (ids ?? []).filter(id => id !== shopId);
      return next ? [...rest, shopId] : rest;
    });
    // The Profile > Saved shops list shows full shop rows, so refetch it too.
    queryClient.invalidateQueries({ queryKey: ["saved-shops"] });
  }, [queryClient, shopId]);

  const { mutate: toggleSaved, isPending: savePending } = useMutation({
    mutationFn: (next: boolean) => (next ? shopsApi.saveShop(shopId) : shopsApi.unsaveShop(shopId)),
    onSuccess: (_res, next) => setSavedLocally(next),
    onError: (error, next) => {
      // Unsaving a shop that is no longer saved answers 404: already done.
      if (!next && (error as { response?: { status?: number } }).response?.status === 404) {
        setSavedLocally(false);
        return;
      }
      showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error });
    },
  });

  function handleSave() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    requireAuth(() => {
      if (!savePending)
        toggleSaved(!saved);
    });
  }

  return { saved, canSave, handleSave };
}

/**
 * Menu and reviews feed one FlashList (a list nested in a ScrollView loses
 * virtualization and never pages). Query keys are shared with merchant invalidation.
 */
function useShopTab(shopId: string, activeTab: Tab) {
  const products = useInfiniteQuery<
    AxiosResponse<{ data: CursorPage<Product> }>,
    Error,
    { pages: AxiosResponse<{ data: CursorPage<Product> }>[] },
    string[],
    string | undefined
  >({
    queryKey: ["shop-products", shopId],
    queryFn: ({ pageParam }) => shopsApi.getProducts(shopId, { cursor: pageParam, limit: 20 }),
    getNextPageParam: last => last.data.data.nextCursor ?? undefined,
    initialPageParam: undefined,
    enabled: !!shopId,
  });

  const reviews = useInfiniteQuery<
    AxiosResponse<{ data: CursorPage<Review> }>,
    Error,
    { pages: AxiosResponse<{ data: CursorPage<Review> }>[] },
    string[],
    string | undefined
  >({
    queryKey: ["shop-reviews", shopId],
    queryFn: ({ pageParam }) => shopsApi.getReviews(shopId, { cursor: pageParam, limit: 20 }),
    getNextPageParam: last => last.data.data.nextCursor ?? undefined,
    initialPageParam: undefined,
    enabled: !!shopId && activeTab === "reviews",
  });

  const rows: Row[] = React.useMemo(() => {
    if (activeTab === "menu")
      return (products.data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? []).map(product => ({ kind: "product", product }));
    return (reviews.data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? []).map(review => ({ kind: "review", review }));
  }, [activeTab, products.data, reviews.data]);

  const active = activeTab === "menu" ? products : reviews;
  return {
    rows,
    isError: active.isError && !active.data,
    isLoading: active.isLoading,
    isFetchingNextPage: active.isFetchingNextPage,
    refetch: () => {
      active.refetch();
    },
    loadMore: () => {
      if (active.hasNextPage && !active.isFetchingNextPage)
        active.fetchNextPage();
    },
  };
}

export default function ShopDetailScreen() {
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { styles, colors } = useStyles();
  const cartVisible = useAppSelector(s => s.cart.shopId === shopId && s.cart.items.length > 0);
  const [activeTab, setActiveTab] = React.useState<Tab>("menu");
  const isAr = i18n.language === "ar";

  const { solid, onScroll } = useSolidHeader();
  useHeroStatusBar(colors === DARK, solid);

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["shop", shopId],
    queryFn: () => shopsApi.getShop(shopId),
    enabled: !!shopId,
  });
  const shop = data?.data.data;
  const { saved, canSave, handleSave } = useShopSave(shopId);
  const tab = useShopTab(shopId, activeTab);

  if (isError && !shop)
    return <DetailErrorScreen onRetry={() => refetch()} />;
  if (isLoading || !shop)
    return <ShopDetailSkeleton styles={styles} topInset={insets.top} />;

  const header = (
    <>
      <ShopHero
        shop={shop}
        topInset={insets.top}
        styles={styles}
        colors={colors}
      />
      <ShopInfoSection shop={shop} isAr={isAr} styles={styles} colors={colors} />
      <ShopTabBar activeTab={activeTab} onTabChange={setActiveTab} styles={styles} />
    </>
  );

  return (
    <View style={styles.container}>
      <FlashList
        data={tab.rows}
        keyExtractor={row => (row.kind === "product" ? `p-${row.product.id}` : `r-${row.review.id}`)}
        getItemType={row => row.kind}
        renderItem={({ item: row }) => (
          <View style={styles.rowWrap}>
            {row.kind === "product"
              ? <ProductRow product={row.product} isAr={isAr} shopId={shopId} shopName={shop.name} shopNameAr={shop.nameAr} styles={styles} colors={colors} />
              : <ReviewRow review={row.review} isAr={isAr} styles={styles} colors={colors} />}
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={(
          <TabEmpty activeTab={activeTab} isError={tab.isError} isLoading={tab.isLoading} onRetry={tab.refetch} styles={styles} colors={colors} />
        )}
        ListFooterComponent={
          tab.isFetchingNextPage
            ? <View style={styles.rowWrap}><Skeleton width="100%" height={56} borderRadius={RADIUS.lg} /></View>
            : null
        }
        onEndReached={tab.loadMore}
        onEndReachedThreshold={0.5}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: cartVisible ? CART_BAR_HEIGHT + SPACING.base * 2 + SPACING.sm : SPACING["2xl"],
        }}
      />
      <StatusScrim topInset={insets.top} />
      <SolidHeader visible={solid} title={isAr ? shop.nameAr : shop.name} topInset={insets.top} styles={styles} />
      <HeroNav saved={saved} canSave={canSave} onSave={handleSave} topInset={insets.top} styles={styles} />
      <CartBar shopId={shopId} styles={styles} />
    </View>
  );
}

/**
 * Opens the shop's WhatsApp chat (app scheme, then wa.me), same normalisation
 * as the order hand-off; a failure shows the same toast as the confirmation screen.
 */
function openWhatsApp(raw: string | null, onFailed: () => void) {
  const digits = toWhatsAppDigits(raw);
  if (digits)
    openWhatsAppChat(digits, undefined, url => Linking.openURL(url)).catch(onFailed);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Height of the soft fade under the status bar, over the hero photo. */
const SCRIM_FADE_HEIGHT = 96;
const SCRIM_STEP = 2;
const SCRIM_TOP_ALPHA = 0.72;

/**
 * Fine ink bands (expo-linear-gradient is not installed): 2px steps with an
 * eased alpha are smooth enough that no stripes show, even over light photos.
 * Starts below the status bar, where the fixed StatusScrim ends, so the two
 * join without a seam.
 */
function HeroScrim({ topInset, styles }: { topInset: number; styles: Styles }) {
  const steps = SCRIM_FADE_HEIGHT / SCRIM_STEP;
  return (
    <View style={[styles.scrim, { top: topInset }]} pointerEvents="none">
      {Array.from({ length: steps }, (_, i) => {
        const alpha = SCRIM_TOP_ALPHA * (1 - i / steps) ** 2;
        const hex = Math.round(alpha * 255).toString(16).padStart(2, "0");
        return <View key={`scrim-${i}`} style={{ height: SCRIM_STEP, backgroundColor: `${BRAND.ink}${hex}` }} />;
      })}
    </View>
  );
}

/** Fixed band behind the status bar so its icons stay readable at any scroll position. */
function StatusScrim({ topInset }: { topInset: number }) {
  const hex = Math.round(SCRIM_TOP_ALPHA * 255).toString(16).padStart(2, "0");
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, start: 0, end: 0, height: topInset, backgroundColor: `${BRAND.ink}${hex}` }}
    />
  );
}

/** Opaque bar behind the status bar and the buttons, faded in once the hero is gone. */
function SolidHeader({ visible, title, topInset, styles }: { visible: boolean; title: string; topInset: number; styles: Styles }) {
  const reduceMotion = useReducedMotion();
  const opacity = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: reduceMotion ? 0 : 160, useNativeDriver: true }).start();
  }, [opacity, visible, reduceMotion]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.solidHeader, { height: topInset + NAV_BAR_HEIGHT, opacity }]}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      <View style={styles.solidHeaderRow}>
        <Text style={styles.solidHeaderTitle} numberOfLines={1}>{title}</Text>
      </View>
    </Animated.View>
  );
}

/** Back and save buttons, fixed on the screen (not inside the scrolling list) so Back is always reachable. */
function HeroNav({ saved, canSave, onSave, topInset, styles }: { saved: boolean; canSave: boolean; onSave: () => void; topInset: number; styles: Styles }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.heroNav, { top: topInset + SPACING.sm }]} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <ArrowLeft mirrored={I18nManager.isRTL} size={22} color={DARK.text} />
      </Pressable>
      {canSave && (
        <Pressable
          style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
          onPress={onSave}
          accessibilityRole="button"
          accessibilityLabel={saved ? t("directory.saved") : t("directory.save")}
          accessibilityState={{ selected: saved }}
        >
          {saved
            ? <Heart size={22} color={BRAND.gold} weight="fill" />
            : <HeartStraight size={22} color={DARK.text} />}
        </Pressable>
      )}
    </View>
  );
}

type ShopHeroProps = {
  shop: Shop;
  topInset: number;
  styles: Styles;
  colors: Colors;
};

function ShopHero({ shop, topInset, styles, colors }: ShopHeroProps) {
  const coverPhoto = shop.photos?.find(p => p.isPrimary) ?? shop.photos?.[0];
  return (
    <View style={[styles.hero, { height: HERO_HEIGHT + topInset }]}>
      {coverPhoto
        ? <Image source={{ uri: coverPhoto.url }} style={styles.heroImage} contentFit="cover" transition={150} />
        : (
            <View style={styles.heroPlaceholder}>
              <Storefront size={48} color={colors.textMuted} />
            </View>
          )}
      <HeroScrim topInset={topInset} styles={styles} />
    </View>
  );
}

function ShopInfoSection({ shop, isAr, styles, colors }: { shop: Shop; isAr: boolean; styles: Styles; colors: Colors }) {
  const { t } = useTranslation();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  const displayName = isAr ? shop.nameAr : shop.name;
  const description = isAr ? shop.descriptionAr : shop.description;
  // Same normalisation as the order hand-off: no button for a number WhatsApp cannot open.
  const hasWhatsApp = toWhatsAppDigits(shop.whatsapp) !== null;
  const categoryLabel = t(`directory.${shop.category.toLowerCase().replace("_and_", "_")}`);
  // Manual override AND today's schedule (CLAUDE.md: the client computes "open now").
  const openNow = isShopOpenNow(shop, new Date());

  return (
    <View style={styles.info}>
      <View style={styles.nameRow}>
        <Text style={styles.name} accessibilityRole="header">{displayName}</Text>
        <View style={[styles.statusBadge, openNow ? styles.badgeOpen : styles.badgeClosed]}>
          <Text style={[styles.statusText, openNow && styles.statusTextOpen]}>
            {openNow ? t("common.open") : t("common.closed")}
          </Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{categoryLabel}</Text>
        {typeof shop.averageRating === "number" && (
          <>
            <Text style={styles.meta}>·</Text>
            <Star size={14} weight="fill" color={BRAND.gold} />
            <Text style={styles.metaStrong}>{formatRating(shop.averageRating)}</Text>
            <Text style={styles.meta}>
              {`(${t("directory.reviews_count", { count: shop.reviewCount, total: formatCount(shop.reviewCount) })})`}
            </Text>
          </>
        )}
      </View>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <WorkingHoursSection shop={shop} styles={styles} />
      {(shop.phone || hasWhatsApp)
        ? (
            <View style={styles.ctaRow}>
              {shop.phone
                ? (
                    <Pressable
                      style={({ pressed }) => [styles.ctaBtn, pressed && styles.pressed]}
                      onPress={() => {
                        if (shop.phone)
                          Linking.openURL(`tel:${shop.phone}`).catch(() => {});
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t("directory.call")}
                    >
                      <Phone size={18} color={gold} />
                      <Text style={styles.ctaBtnText}>{t("directory.call")}</Text>
                    </Pressable>
                  )
                : null}
              {hasWhatsApp
                ? (
                    <Pressable
                      style={({ pressed }) => [styles.ctaBtn, pressed && styles.pressed]}
                      onPress={() => openWhatsApp(shop.whatsapp, () => showMessage({ message: t("checkout.whatsapp_failed"), type: "warning" }))}
                      accessibilityRole="button"
                      accessibilityLabel={t("directory.whatsapp")}
                    >
                      <WhatsappLogo size={18} color={gold} />
                      <Text style={styles.ctaBtnText}>{t("directory.whatsapp")}</Text>
                    </Pressable>
                  )
                : null}
            </View>
          )
        : null}
    </View>
  );
}

/** Weekly schedule with today highlighted; times use locale digits. Hidden when the shop has none. */
function WorkingHoursSection({ shop, styles }: { shop: Shop; styles: Styles }) {
  const { t, i18n } = useTranslation();
  const hours = shop.workingHours;
  if (!hasSchedule(hours))
    return null;
  const today = dayKeyFor(new Date());
  return (
    <View style={styles.hoursBox}>
      <Text style={styles.hoursTitle} accessibilityRole="header">{t("directory.working_hours")}</Text>
      {DAY_KEYS.map((day) => {
        const entry = hours[day];
        const isToday = day === today;
        const value = !entry || entry.closed || !entry.open || !entry.close
          ? t("common.closed")
          : `${formatClockTime(entry.open, i18n.language)} - ${formatClockTime(entry.close, i18n.language)}`;
        const dayName = t(`directory.days.${day}`);
        return (
          <View key={day} style={styles.hoursRow} accessibilityLabel={`${dayName}: ${value}`}>
            <Text style={[styles.hoursDay, isToday && styles.hoursToday]}>
              {isToday ? `${dayName} (${t("directory.today")})` : dayName}
            </Text>
            <Text style={[styles.hoursValue, isToday && styles.hoursToday]}>{value}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ShopTabBar({ activeTab, onTabChange, styles }: { activeTab: Tab; onTabChange: (tab: Tab) => void; styles: Styles }) {
  const { t } = useTranslation();
  return (
    <View style={styles.tabBar} accessibilityRole="tablist">
      {(["menu", "reviews"] as const).map((tab) => {
        const selected = activeTab === tab;
        const label = tab === "menu" ? t("directory.menu") : t("directory.reviews_tab");
        return (
          <Pressable
            key={tab}
            style={[styles.tab, selected && styles.tabActive]}
            onPress={() => {
              if (!selected) {
                Haptics.selectionAsync();
                onTabChange(tab);
              }
            }}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
          >
            <Text style={[styles.tabText, selected && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type TabEmptyProps = {
  activeTab: Tab;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  styles: Styles;
  colors: Colors;
};

/** Error, skeleton or empty state for the active tab (shown while the list has no rows). */
function TabEmpty({ activeTab, isError, isLoading, onRetry, styles, colors }: TabEmptyProps) {
  const { t } = useTranslation();
  const isMenu = activeTab === "menu";
  if (isError)
    return <ErrorState onRetry={onRetry} />;
  if (isLoading) {
    return (
      <View style={styles.skeletons}>
        {(isMenu ? ["a", "b", "c", "d"] : ["a", "b", "c"]).map(k => (
          <Skeleton key={`row-skeleton-${k}`} width="100%" height={isMenu ? 98 : 84} borderRadius={RADIUS.lg} />
        ))}
      </View>
    );
  }
  return (
    <EmptyTab
      title={isMenu ? t("directory.no_products") : t("directory.no_reviews")}
      body={isMenu ? t("directory.no_products_subtitle") : t("directory.no_reviews_subtitle")}
      icon={isMenu ? "menu" : "reviews"}
      styles={styles}
      colors={colors}
    />
  );
}

function EmptyTab({ title, body, icon, styles, colors }: { title: string; body: string; icon: "menu" | "reviews"; styles: Styles; colors: Colors }) {
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        {icon === "menu" ? <Storefront size={28} color={gold} /> : <ChatCircleDots size={28} color={gold} />}
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{body}</Text>
    </View>
  );
}

type ProductRowProps = {
  product: Product;
  isAr: boolean;
  shopId: string;
  shopName: string;
  shopNameAr: string;
  styles: Styles;
  colors: Colors;
};

function ProductRow({ product, isAr, shopId, shopName, shopNameAr, styles, colors }: ProductRowProps) {
  const { t } = useTranslation();
  const { requireAuth } = useAuthGuard();
  const dispatch = useAppDispatch();
  const quantity = useAppSelector(s =>
    s.cart.shopId === shopId ? (s.cart.items.find((i: CartItem) => i.productId === product.id)?.quantity ?? 0) : 0,
  );
  // Backend caps: 50 lines per order, 99 per line (a different shop opens the conflict sheet instead).
  const addBlock = useAppSelector(s => (s.cart.shopId === shopId ? cartAddBlock(s.cart, product.id) : null));
  const name = isAr ? product.nameAr : product.name;
  const desc = isAr ? product.descriptionAr : product.description;
  // The public menu includes unavailable products; the backend rejects them at checkout.
  const available = product.isAvailable !== false;

  function handleAdd() {
    if (addBlock) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showMessage({ message: t(cartAddBlockKey(addBlock)), type: "warning" });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // addItem keeps the auth wall and the multi-shop conflict guard in the path.
    requireAuth(() => {
      dispatch(addItem({
        item: { productId: product.id, name: product.name, nameAr: product.nameAr, price: product.price, quantity: 1, imageUrl: product.imageUrl ?? null },
        shopId,
        shopName,
        shopNameAr,
      }));
    });
  }

  function handleDecrease() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch(updateQuantity({ productId: product.id, quantity: quantity - 1 }));
  }

  let action: React.ReactNode;
  if (!available) {
    action = (
      <View style={styles.unavailablePill}>
        <Text style={styles.unavailableText}>{t("directory.unavailable")}</Text>
      </View>
    );
  }
  else if (quantity > 0) {
    action = (
      <View style={styles.stepper}>
        <Pressable
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
          onPress={handleDecrease}
          accessibilityRole="button"
          accessibilityLabel={t("directory.decrease_quantity")}
        >
          <Minus size={18} color={colors.text} weight="bold" />
        </Pressable>
        <Text style={styles.stepCount} accessibilityLiveRegion="polite">{formatCount(quantity)}</Text>
        <Pressable
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
          onPress={handleAdd}
          accessibilityRole="button"
          accessibilityLabel={t("directory.increase_quantity")}
        >
          <Plus size={18} color={colors.text} weight="bold" />
        </Pressable>
      </View>
    );
  }
  else {
    action = (
      <Pressable
        style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
        onPress={handleAdd}
        accessibilityRole="button"
        accessibilityLabel={t("directory.add_to_cart")}
      >
        <Plus size={20} color={BRAND.ink} weight="bold" />
      </Pressable>
    );
  }

  return (
    <View style={styles.productRow}>
      {product.imageUrl
        ? (
            <Image
              source={{ uri: product.imageUrl }}
              recyclingKey={product.id}
              style={[styles.productImage, !available && styles.productImageDim]}
              contentFit="cover"
              transition={150}
            />
          )
        : null}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{name}</Text>
        {desc ? <Text style={styles.productDesc} numberOfLines={2}>{desc}</Text> : null}
        <View style={styles.productFooter}>
          <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
          {action}
        </View>
      </View>
    </View>
  );
}

function ReviewRow({ review, isAr, styles, colors }: { review: Review; isAr: boolean; styles: Styles; colors: Colors }) {
  const date = new Date(review.createdAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(isAr ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewerName} numberOfLines={1}>{review.user.name}</Text>
        <View style={styles.reviewStars} accessibilityLabel={formatRating(review.rating)}>
          {[0, 1, 2, 3, 4].map(i => (
            <Star
              key={`star-${i}`}
              size={13}
              weight={i < review.rating ? "fill" : "regular"}
              color={i < review.rating ? BRAND.gold : colors.textMuted}
            />
          ))}
        </View>
      </View>
      {dateLabel ? <Text style={styles.reviewDate}>{dateLabel}</Text> : null}
      {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
    </View>
  );
}

function CartBar({ shopId, styles }: { shopId: string; styles: Styles }) {
  const { t } = useTranslation();
  const { items, shopId: cartShopId } = useAppSelector(s => s.cart);

  if (cartShopId !== shopId || !items.length)
    return null;

  const count = items.reduce((sum: number, item: CartItem) => sum + item.quantity, 0);
  const total = items.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);

  return (
    <Pressable
      style={({ pressed }) => [styles.cartBar, pressed && { opacity: 0.92 }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push("/checkout/cart");
      }}
      accessibilityRole="button"
      accessibilityLabel={`${t("cart.checkout")} ${formatCurrency(total)}`}
    >
      <View style={styles.cartBarBadge}>
        <Text style={styles.cartBarBadgeText}>{formatCount(count)}</Text>
      </View>
      <Text style={styles.cartBarLabel} numberOfLines={1}>{t("cart.checkout")}</Text>
      <Text style={styles.cartBarTotal}>{formatCurrency(total)}</Text>
    </Pressable>
  );
}

function ShopDetailSkeleton({ styles, topInset }: { styles: Styles; topInset: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Skeleton width="100%" height={HERO_HEIGHT + topInset} borderRadius={0} />
      <View style={[styles.heroNav, { top: topInset + SPACING.sm }]}>
        <Pressable
          style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <ArrowLeft mirrored={I18nManager.isRTL} size={22} color={DARK.text} />
        </Pressable>
        <View style={styles.navSpacer} />
      </View>
      <View style={{ padding: SPACING.base, gap: SPACING.md }}>
        <Skeleton width="60%" height={26} />
        <Skeleton width="40%" height={16} />
        <Skeleton width="100%" height={14} />
        <Skeleton width="100%" height={14} />
        <View style={{ flexDirection: "row", gap: SPACING.sm }}>
          <Skeleton width="48%" height={48} borderRadius={RADIUS.md} />
          <Skeleton width="48%" height={48} borderRadius={RADIUS.md} />
        </View>
      </View>
    </View>
  );
}
