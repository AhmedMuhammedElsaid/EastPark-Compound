import type { Href } from "expo-router";
import type { SlipPhoto } from "@/components/finance/use-payment-submission";
import type { FinanceFlatListItem, FinancePaymentInput, FinancePaymentMethod, PayFor } from "@/services/api/finance";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { Camera, Image as ImageIcon, MagnifyingGlass, WarningCircle, X } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GoldButton } from "@/components/auth/gold-button";
import { FinanceFlatRow, FinanceFlatRowSkeleton } from "@/components/finance/finance-ui";
import { PaymentReceipt } from "@/components/finance/payment-receipt";
import { useDebounced } from "@/components/finance/use-debounced";
import { SlipUploadError, usePaymentSubmission } from "@/components/finance/use-payment-submission";
import { ScreenHeader } from "@/components/ui/screen-header";
import { showConfirm } from "@/lib/confirm-dialog";
import { resolveImageMime } from "@/lib/feedback-attachments";
import {
  amountToString,
  balanceLabel,
  cairoToday,
  financeErrorKey,
  isDuplicateReferenceError,
  isIdempotencyConflictError,
  isUnconfirmedPaymentError,
  normalizeFlatQuery,
  shiftDate,
  toAmountString,
} from "@/lib/finance";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { FINANCE_PAYMENT_METHODS, useFinanceFlat, useFinanceFlats } from "@/services/api/finance";
import { BRAND, DARK, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

/** Server limit for slip photos (finance attachments: images <= 5 MB). */
const MAX_SLIP_BYTES = 5 * 1024 * 1024;
const PAY_FOR: readonly PayFor[] = ["AUTO", "DEPOSIT"];
type DateChoice = "today" | "yesterday";

type SelectedFlat = { id: string; label: string; ownerName: string | null; balance: number };

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({
    colors,
    styles: StyleSheet.create({
      container: { flex: 1, backgroundColor: colors.bg },
      scroll: { padding: SPACING.base, gap: SPACING.lg },
      section: { gap: SPACING.sm },
      label: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.text, textAlign: "left" },
      hint: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: "left" },
      input: {
        minHeight: 48,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        fontFamily: FONT.sans,
        fontSize: 16,
        lineHeight: 24,
        color: colors.text,
        textAlign: "left",
      },
      amountInput: { fontSize: 22, lineHeight: 32, fontWeight: "700" },
      inputFocused: { borderColor: BRAND.gold },
      inputError: { borderColor: SEMANTIC.error },
      fieldError: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.text, textAlign: "left" },
      search: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingStart: SPACING.md },
      searchInput: { flex: 1, borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 0 },
      chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
      chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: SPACING.base, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
      chipActive: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
      chipText: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, fontWeight: "600" },
      chipTextActive: { color: BRAND.ink, fontWeight: "700" },
      pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
      selected: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: BRAND.gold, backgroundColor: colors.card },
      selectedMain: { flex: 1, gap: 2 },
      selectedLabel: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 24, color: colors.text, textAlign: "left" },
      selectedSub: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: "left" },
      linkBtn: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: SPACING.sm },
      linkText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: "primaryText" in colors ? colors.primaryText : BRAND.gold },
      photoActions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
      photoBtn: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingHorizontal: SPACING.base, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
      photoBtnText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.text },
      thumb: { width: 120, height: 120, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: colors.elevated },
      thumbImg: { width: 120, height: 120 },
      removeBtn: { position: "absolute", top: 0, end: 0, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
      removeDot: { width: 24, height: 24, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center", backgroundColor: `${BRAND.ink}cc` },
      banner: { flexDirection: "row", gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: SEMANTIC.error },
      bannerBody: { flex: 1, gap: SPACING.xs },
      bannerText: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: DARK.text, textAlign: "left" },
      bannerAction: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
      bannerActionText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 22, color: DARK.text, textDecorationLine: "underline" },
    }),
  }), [colors]);
}

type Styles = ReturnType<typeof useStyles>["styles"];
type Colors = ReturnType<typeof useStyles>["colors"];

/**
 * Leaving while a payment is unconfirmed drops its in-memory key: warn first
 * that it may already be recorded and the flat's recent payments must be checked.
 */
function useLeaveUnconfirmedGuard(active: boolean) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  React.useEffect(() => {
    if (!active)
      return;
    return navigation.addListener("beforeRemove", (event) => {
      event.preventDefault();
      void showConfirm({
        title: t("finance.leave_unconfirmed_title"),
        message: t("finance.leave_unconfirmed_body"),
        confirmLabel: t("finance.leave_anyway"),
        cancelLabel: t("finance.stay"),
        destructive: true,
      }).then((confirmed) => {
        if (confirmed)
          navigation.dispatch(event.data.action);
      });
    });
  }, [navigation, active, t]);
}

/** Record a payment (`/finance/payment/new?flatId=`): one idempotency key per submission, kept across retries. */
// eslint-disable-next-line max-lines-per-function
export default function NewPaymentScreen() {
  const { t } = useTranslation();
  const { styles, colors } = useStyles();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ flatId?: string }>();
  const preset = useFinanceFlat(params.flatId);

  const [picked, setPicked] = React.useState<SelectedFlat | null>(null);
  // The `?flatId=` preset counts as picked until the accountant clears it.
  const [presetDismissed, setPresetDismissed] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<FinancePaymentMethod>("CASH");
  const [reference, setReference] = React.useState("");
  const [payFor, setPayFor] = React.useState<PayFor>("AUTO");
  const [dateChoice, setDateChoice] = React.useState<DateChoice>("today");
  const [payerName, setPayerName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [slip, setSlip] = React.useState<SlipPhoto | null>(null);
  const [showErrors, setShowErrors] = React.useState(false);
  const [failure, setFailure] = React.useState<{ key: string; conflict: boolean } | null>(null);

  const submission = usePaymentSubmission();
  const busy = submission.isPending;
  const conflict = !!failure?.conflict;
  // While the outcome is unconfirmed the sent body is re-sent verbatim, so the form is locked.
  const locked = busy || submission.unconfirmed || conflict;
  useLeaveUnconfirmedGuard(submission.unconfirmed || conflict);

  const presetFlat: SelectedFlat | null = preset.data && !presetDismissed
    ? { id: preset.data.id, label: preset.data.label, ownerName: preset.data.owner?.name ?? null, balance: preset.data.balance }
    : null;
  const flat = picked ?? presetFlat;
  const setFlat = (next: SelectedFlat | null) => {
    setPicked(next);
    setPresetDismissed(true);
  };

  const amountValue = toAmountString(amount);
  const amountError = showErrors && !amountValue ? t("finance.amount_invalid") : undefined;
  const flatError = showErrors && !flat ? t("finance.flat_required") : undefined;

  function resetAll() {
    submission.reset();
    setFlat(null);
    setAmount("");
    setMethod("CASH");
    setReference("");
    setPayFor("AUTO");
    setDateChoice("today");
    setPayerName("");
    setNote("");
    setSlip(null);
    setShowErrors(false);
    setFailure(null);
  }

  function buildInput(force: boolean): FinancePaymentInput | null {
    if (!flat || !amountValue)
      return null;
    const today = cairoToday();
    return {
      flatId: flat.id,
      amount: amountValue,
      method,
      receivedAt: dateChoice === "today" ? today : shiftDate(today, -1),
      payFor,
      ...(reference.trim() ? { reference: reference.trim() } : {}),
      ...(payerName.trim() ? { payerName: payerName.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(force ? { force: true } : {}),
    };
  }

  const handlers = {
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: async (error: unknown) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (isDuplicateReferenceError(error)) {
        const ok = await showConfirm({
          title: t("finance.duplicate_title"),
          message: t("finance.errors.duplicateReference"),
          confirmLabel: t("finance.record_anyway"),
        });
        if (ok)
          submit(true);
        return;
      }
      if (!(error instanceof SlipUploadError) && isUnconfirmedPaymentError(error)) {
        // The payment may or may not be recorded. Retrying is safe: same body, same key.
        setFailure({ key: "finance.retry_safe", conflict: false });
        return;
      }
      const source = error instanceof SlipUploadError ? error.original : error;
      const key = error instanceof SlipUploadError && financeErrorKey(source) === "finance.errors.check_form"
        ? "finance.errors.attachmentType"
        : financeErrorKey(source);
      setFailure({ key, conflict: isIdempotencyConflictError(error) });
    },
  };

  function submit(force = false) {
    if (submission.pending()) {
      retry();
      return;
    }
    setShowErrors(true);
    const input = buildInput(force);
    if (!input || busy)
      return;
    setFailure(null);
    submission.submit({ input, slip }, handlers);
  }

  function retry() {
    if (busy)
      return;
    setFailure(null);
    submission.retry(handlers);
  }

  function pendingFlatId(): string | undefined {
    return submission.pending()?.body.flatId ?? flat?.id;
  }

  function openRecentPayments() {
    const id = pendingFlatId();
    if (id)
      router.push(`/finance/flats/${encodeURIComponent(id)}` as Href);
  }

  async function discardAndEdit() {
    const ok = await showConfirm({
      title: t("finance.discard_unconfirmed_title"),
      message: t("finance.discard_unconfirmed_body"),
      confirmLabel: t("finance.discard_and_edit"),
      cancelLabel: t("finance.keep_waiting"),
      destructive: true,
    });
    if (!ok)
      return;
    submission.discard();
    setFailure(null);
  }

  async function startNewAfterConflict() {
    const ok = await showConfirm({
      title: t("finance.start_new_title"),
      message: t("finance.start_new_body"),
      confirmLabel: t("finance.start_new_payment"),
      destructive: true,
    });
    if (ok)
      resetAll();
  }

  if (submission.data) {
    const result = submission.data;
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("finance.record_payment")} />
        <PaymentReceipt
          result={result}
          onAnother={resetAll}
          onOpenFlat={() => router.replace(`/finance/flats/${encodeURIComponent(result.flatId)}` as Href)}
          onDone={() => (router.canGoBack() ? router.back() : router.replace("/finance/today" as Href))}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title={t("finance.record_payment")} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FlatField
          flat={flat}
          loadingPreset={!!params.flatId && !presetDismissed && preset.isLoading}
          onSelect={setFlat}
          onClear={() => setFlat(null)}
          disabled={locked}
          error={flatError}
          styles={styles}
          colors={colors}
        />

        <View style={styles.section}>
          <Text style={styles.label}>{t("finance.amount")}</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            editable={!locked}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            maxLength={13}
            style={[styles.input, styles.amountInput, !!amountError && styles.inputError]}
            accessibilityLabel={t("finance.amount")}
            accessibilityHint={amountError}
          />
          {amountError ? <Text style={styles.fieldError}>{amountError}</Text> : null}
          {flat && flat.balance > 0 && (
            <View style={styles.chips}>
              <Chip label={t("finance.pay_full_balance", { amount: formatCurrency(flat.balance) })} active={amount === amountToString(flat.balance)} onPress={() => setAmount(amountToString(flat.balance))} disabled={locked} styles={styles} />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t("finance.method")}</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {FINANCE_PAYMENT_METHODS.map(m => (
              <Chip key={m} label={t(`finance.method_${m}`)} active={method === m} onPress={() => setMethod(m)} disabled={locked} styles={styles} radio />
            ))}
          </View>
        </View>

        <TextField
          label={method === "CHEQUE" ? t("finance.cheque_number") : t("finance.reference")}
          hint={method === "CASH" ? t("common.optional") : t("finance.reference_hint")}
          value={reference}
          onChangeText={setReference}
          maxLength={100}
          disabled={locked}
          styles={styles}
          colors={colors}
        />

        <View style={styles.section}>
          <Text style={styles.label}>{t("finance.received_on")}</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            <Chip label={t("finance.today")} active={dateChoice === "today"} onPress={() => setDateChoice("today")} disabled={locked} styles={styles} radio />
            <Chip label={t("finance.yesterday")} active={dateChoice === "yesterday"} onPress={() => setDateChoice("yesterday")} disabled={locked} styles={styles} radio />
          </View>
          <Text style={styles.hint}>{t("finance.older_dates_hint")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t("finance.pay_for")}</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {PAY_FOR.map(p => (
              <Chip key={p} label={t(`finance.pay_for_${p}`)} active={payFor === p} onPress={() => setPayFor(p)} disabled={locked} styles={styles} radio />
            ))}
          </View>
          <Text style={styles.hint}>{t(`finance.pay_for_${payFor}_hint`)}</Text>
        </View>

        <TextField label={t("finance.payer_name")} hint={t("common.optional")} value={payerName} onChangeText={setPayerName} maxLength={120} disabled={locked} styles={styles} colors={colors} />
        <TextField label={t("finance.note")} hint={t("common.optional")} value={note} onChangeText={setNote} maxLength={500} multiline disabled={locked} styles={styles} colors={colors} />

        <SlipField slip={slip} onChange={setSlip} disabled={locked} styles={styles} colors={colors} />

        {failure && (
          <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <WarningCircle size={20} color={DARK.text} />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerText}>{t(failure.key as any)}</Text>
              {submission.unconfirmed && <Text style={styles.bannerText}>{t("finance.unconfirmed_locked")}</Text>}
              {(submission.unconfirmed || conflict) && (
                <Pressable style={styles.bannerAction} onPress={openRecentPayments} accessibilityRole="button" accessibilityLabel={t("finance.check_recent_payments")}>
                  <Text style={styles.bannerActionText}>{t("finance.check_recent_payments")}</Text>
                </Pressable>
              )}
              {submission.unconfirmed && !busy && (
                <Pressable style={styles.bannerAction} onPress={discardAndEdit} accessibilityRole="button" accessibilityLabel={t("finance.discard_and_edit")}>
                  <Text style={styles.bannerActionText}>{t("finance.discard_and_edit")}</Text>
                </Pressable>
              )}
              {conflict && (
                <Pressable style={styles.bannerAction} onPress={startNewAfterConflict} accessibilityRole="button" accessibilityLabel={t("finance.start_new_payment")}>
                  <Text style={styles.bannerActionText}>{t("finance.start_new_payment")}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {!conflict && (
          <GoldButton
            label={failure ? t("finance.try_again") : t("finance.record_payment")}
            onPress={() => submit()}
            loading={busy}
            disabled={busy}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, active, onPress, disabled, styles, radio }: { label: string; active: boolean; onPress: () => void; disabled?: boolean; styles: Styles; radio?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole={radio ? "radio" : "button"}
      accessibilityState={radio ? { checked: active, disabled } : { selected: active, disabled }}
      accessibilityLabel={label}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TextField({ label, hint, value, onChangeText, maxLength, multiline, disabled, styles, colors }: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  maxLength: number;
  multiline?: boolean;
  disabled?: boolean;
  styles: Styles;
  colors: Colors;
}) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={maxLength}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && { minHeight: 96, textAlignVertical: "top" }, focused && styles.inputFocused]}
        accessibilityLabel={label}
      />
    </View>
  );
}

function FlatField({ flat, loadingPreset, onSelect, onClear, disabled, error, styles, colors }: {
  flat: SelectedFlat | null;
  loadingPreset: boolean;
  onSelect: (flat: SelectedFlat) => void;
  onClear: () => void;
  disabled: boolean;
  error?: string;
  styles: Styles;
  colors: Colors;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState("");
  const q = useDebounced(normalizeFlatQuery(query), 300);
  const results = useFinanceFlats({ q }, { enabled: !flat && q.length > 0, limit: 5 });
  const items: FinanceFlatListItem[] = results.data?.pages[0]?.data.data.items ?? [];

  if (loadingPreset)
    return <FinanceFlatRowSkeleton />;

  if (flat) {
    return (
      <View style={styles.section}>
        <Text style={styles.label}>{t("finance.flat")}</Text>
        <View style={styles.selected}>
          <View style={styles.selectedMain}>
            <Text style={styles.selectedLabel}>{flat.label}</Text>
            <Text style={styles.selectedSub}>{`${flat.ownerName ?? t("finance.no_owner")} · ${balanceLabel(t, flat.balance)}`}</Text>
          </View>
          <Pressable style={styles.linkBtn} onPress={onClear} disabled={disabled} accessibilityRole="button" accessibilityLabel={t("finance.change_flat")}>
            <Text style={styles.linkText}>{t("finance.change_flat")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t("finance.flat")}</Text>
      <View style={[styles.input, styles.search, !!error && styles.inputError]}>
        <MagnifyingGlass size={20} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          editable={!disabled}
          placeholder={t("finance.search_placeholder")}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
          style={[styles.input, styles.searchInput]}
          accessibilityLabel={t("finance.search_label")}
        />
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {q.length > 0 && results.isLoading ? <FinanceFlatRowSkeleton /> : null}
      {q.length > 0 && !results.isLoading && items.length === 0
        ? <Text style={styles.hint}>{results.isError ? t(financeErrorKey(results.error) as any) : t("finance.no_flats")}</Text>
        : null}
      {items.map(item => (
        <FinanceFlatRow
          key={item.id}
          flat={item}
          selected={false}
          onPress={() => onSelect({ id: item.id, label: item.label, ownerName: item.ownerName, balance: item.balance })}
        />
      ))}
    </View>
  );
}

function SlipField({ slip, onChange, disabled, styles, colors }: {
  slip: SlipPhoto | null;
  onChange: (slip: SlipPhoto | null) => void;
  disabled: boolean;
  styles: Styles;
  colors: Colors;
}) {
  const { t } = useTranslation();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;

  async function pick(source: "camera" | "library") {
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          showMessage({ message: t("finance.camera_denied"), type: "warning", backgroundColor: SEMANTIC.warning });
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6 };
      const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0])
        return;
      const asset = result.assets[0];
      const mime = resolveImageMime({ uri: asset.uri, mimeType: asset.mimeType });
      if (!mime) {
        showMessage({ message: t("finance.errors.attachmentType"), type: "danger", backgroundColor: SEMANTIC.error });
        return;
      }
      if (asset.fileSize != null && asset.fileSize > MAX_SLIP_BYTES) {
        showMessage({ message: t("finance.errors.attachmentTooLarge"), type: "danger", backgroundColor: SEMANTIC.error });
        return;
      }
      onChange({ uri: asset.uri, mime });
    }
    catch {
      showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error });
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t("finance.slip")}</Text>
      <Text style={styles.hint}>{t("finance.slip_hint")}</Text>
      {slip
        ? (
            <View style={styles.thumb}>
              <Image source={{ uri: slip.uri }} style={styles.thumbImg} contentFit="cover" accessibilityLabel={t("finance.slip")} />
              <Pressable style={styles.removeBtn} onPress={() => onChange(null)} disabled={disabled} accessibilityRole="button" accessibilityLabel={t("finance.remove_slip")}>
                <View style={styles.removeDot}><X size={14} color={BRAND.gold} weight="bold" /></View>
              </Pressable>
            </View>
          )
        : (
            <View style={styles.photoActions}>
              <Pressable style={({ pressed }) => [styles.photoBtn, pressed && styles.pressed]} onPress={() => pick("camera")} disabled={disabled} accessibilityRole="button" accessibilityLabel={t("finance.take_slip_photo")}>
                <Camera size={20} color={gold} />
                <Text style={styles.photoBtnText}>{t("finance.take_slip_photo")}</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.photoBtn, pressed && styles.pressed]} onPress={() => pick("library")} disabled={disabled} accessibilityRole="button" accessibilityLabel={t("finance.choose_slip_photo")}>
                <ImageIcon size={20} color={gold} />
                <Text style={styles.photoBtnText}>{t("finance.choose_slip_photo")}</Text>
              </Pressable>
            </View>
          )}
    </View>
  );
}
