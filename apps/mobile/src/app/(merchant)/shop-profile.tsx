import type { Control, FieldErrors } from "react-hook-form";
import type { ShopUpdatePayload, WorkingHoursDay } from "@/services/api/merchant";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Check } from "phosphor-react-native";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { DetailErrorScreen } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { toNullable } from "@/lib/utils";
import { merchantApi } from "@/services/api/merchant";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = typeof DAYS[number];

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const workingHoursDaySchema = z.object({
  closed: z.boolean(),
  open: z.string().regex(timeRegex, "validation.invalid_time").optional().or(z.literal("")),
  close: z.string().regex(timeRegex, "validation.invalid_time").optional().or(z.literal("")),
});

const shopProfileSchema = z.object({
  name: z.string().min(2, "validation.min_2"),
  nameAr: z.string().min(2, "validation.min_2"),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  phone: z.string().refine(isValidPhone, "validation.invalid_phone").optional(),
  whatsapp: z.string().refine(isValidPhone, "validation.invalid_phone").optional(),
  workingHours: z.record(z.string(), workingHoursDaySchema).optional(),
});

type ShopProfileForm = z.infer<typeof shopProfileSchema>;

// ─── Styles ───────────────────────────────────────────────────────────────────

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    saveBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    saveBtnDisabled: { opacity: 0.5 },
    scroll: { padding: SPACING.base, gap: SPACING.md },
    section: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      gap: SPACING.sm,
    },
    sectionTitle: {
      fontFamily: FONT.sans,
      fontWeight: "700",
      fontSize: 14,
      lineHeight: 22,
      color: "primaryText" in colors ? colors.primaryText : BRAND.gold,
      marginBottom: SPACING.xs,
    },
    label: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, marginBottom: 2 },
    input: {
      height: 48,
      backgroundColor: colors.bg,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      fontFamily: FONT.sans,
      fontSize: 14,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputError: { borderColor: SEMANTIC.error },
    inputMulti: {
      height: 80,
      textAlignVertical: "top" as const,
      paddingTop: SPACING.sm,
    },
    errorText: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: SEMANTIC.error, marginTop: 2 },
    dayRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.sm,
      minHeight: 52,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dayLabel: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.text, width: 64 },
    timeInput: {
      flex: 1,
      height: 44,
      backgroundColor: colors.bg,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      fontFamily: FONT.sans,
      fontSize: 13,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      textAlign: "center" as const,
    },
    timeSeparator: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted },
    closedLabel: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted, flex: 1 },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  }), [colors]);
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type ProfileSectionsProps = {
  control: Control<ShopProfileForm>;
  errors: FieldErrors<ShopProfileForm>;
  styles: ReturnType<typeof useStyles>;
  colors: ReturnType<typeof useAppColors>;
};

function ProfileSections({ control, errors, styles, colors }: ProfileSectionsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Basic Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("merchant.section_basic_info")}</Text>

        <FormField
          label={t("merchant.field_name_en")}
          control={control}
          name="name"
          error={errors.name?.message}
          styles={styles}
          colors={colors}
        />
        <FormField
          label={t("merchant.field_name_ar")}
          control={control}
          name="nameAr"
          error={errors.nameAr?.message}
          styles={styles}
          colors={colors}
          rtl
        />
        <FormField
          label={t("merchant.field_description_en")}
          control={control}
          name="description"
          error={errors.description?.message}
          styles={styles}
          colors={colors}
          multiline
        />
        <FormField
          label={t("merchant.field_description_ar")}
          control={control}
          name="descriptionAr"
          error={errors.descriptionAr?.message}
          styles={styles}
          colors={colors}
          multiline
          rtl
        />
      </View>

      {/* Contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("merchant.section_contact")}</Text>

        <FormField
          label={t("merchant.field_phone")}
          control={control}
          name="phone"
          error={errors.phone?.message}
          styles={styles}
          colors={colors}
          keyboardType="phone-pad"
        />
        <FormField
          label={t("merchant.field_whatsapp")}
          control={control}
          name="whatsapp"
          error={errors.whatsapp?.message}
          styles={styles}
          colors={colors}
          keyboardType="phone-pad"
        />
      </View>

      {/* Working Hours */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("merchant.section_working_hours")}</Text>
        {DAYS.map(day => (
          <WorkingHoursRow
            key={day}
            day={day}
            control={control}
            styles={styles}
            colors={colors}
          />
        ))}
      </View>
    </>
  );
}

const PHONE_FIELD_ERROR = /phone|whatsapp/i;

/** A 400 whose validation errors name the phone or WhatsApp field. */
function isPhoneValidationError(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: unknown } } | undefined)?.response;
  if (response?.status !== 400)
    return false;
  try {
    return PHONE_FIELD_ERROR.test(JSON.stringify(response.data ?? ""));
  }
  catch {
    return false;
  }
}

function useSaveShopProfile() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { mutate: saveProfile, isPending } = useMutation({
    mutationFn: (payload: ShopUpdatePayload) => merchantApi.updateShop(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-shop"] });
      showMessage({ message: t("merchant.shop_saved"), type: "success", backgroundColor: SEMANTIC.success });
      router.back();
    },
    onError: (error) => {
      const message = isPhoneValidationError(error) ? t("validation.invalid_phone") : t("common.error");
      showMessage({ message, type: "danger", backgroundColor: SEMANTIC.error });
    },
  });

  const onSubmit = (values: ShopProfileForm) => {
    const payload: ShopUpdatePayload = {
      name: values.name,
      nameAr: values.nameAr,
      description: toNullable(values.description),
      descriptionAr: toNullable(values.descriptionAr),
      phone: toNullable(normalizePhone(values.phone)),
      whatsapp: toNullable(normalizePhone(values.whatsapp)),
      workingHours: values.workingHours as Record<string, WorkingHoursDay> | undefined,
    };
    saveProfile(payload);
  };

  // Invalid working hours have no inline slot, so surface them as a toast.
  const onInvalid = (formErrors: FieldErrors<ShopProfileForm>) => {
    if (formErrors.workingHours)
      showMessage({ message: t("validation.invalid_time"), type: "danger", backgroundColor: SEMANTIC.error });
  };

  return { onSubmit, onInvalid, isPending };
}

export default function MerchantShopProfileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const colors = useAppColors();

  const { data: shopData, isError, isLoading, refetch } = useQuery({
    queryKey: ["merchant-shop"],
    queryFn: () => merchantApi.getMyShop(),
  });

  const shop = shopData?.data.data;

  const defaultWorkingHours = React.useMemo<Record<DayKey, WorkingHoursDay>>(() => {
    const base = shop?.workingHours as Record<string, WorkingHoursDay> | null | undefined;
    const result = {} as Record<DayKey, WorkingHoursDay>;
    for (const day of DAYS) {
      result[day] = base?.[day] ?? { closed: false, open: "09:00", close: "22:00" };
    }
    return result;
  }, [shop?.workingHours]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ShopProfileForm>({
    resolver: zodResolver(shopProfileSchema),
    defaultValues: {
      name: "",
      nameAr: "",
      description: "",
      descriptionAr: "",
      phone: "",
      whatsapp: "",
      workingHours: defaultWorkingHours,
    },
  });

  // Populate form once shop data arrives
  React.useEffect(() => {
    if (shop) {
      reset({
        name: shop.name ?? "",
        nameAr: shop.nameAr ?? "",
        description: shop.description ?? "",
        descriptionAr: shop.descriptionAr ?? "",
        phone: shop.phone ?? "",
        whatsapp: shop.whatsapp ?? "",
        workingHours: defaultWorkingHours,
      });
    }
  }, [shop, reset, defaultWorkingHours]);

  const { onSubmit, onInvalid, isPending } = useSaveShopProfile();

  if (isError && !shop)
    return <DetailErrorScreen onRetry={() => refetch()} />;
  if (isLoading || !shop) {
    return <ShopProfileSkeleton insets={insets} styles={styles} colors={colors} />;
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("merchant.shop_profile")}
        right={(
          <Pressable
            style={({ pressed }) => [styles.saveBtn, (!isDirty || isPending) && styles.saveBtnDisabled, pressed && styles.pressed]}
            onPress={handleSubmit(onSubmit, onInvalid)}
            disabled={!isDirty || isPending}
            accessibilityRole="button"
            accessibilityLabel={t("common.save")}
          >
            {isPending
              ? <ActivityIndicator size="small" color={BRAND.ink} />
              : <Check size={20} color={BRAND.ink} weight="bold" />}
          </Pressable>
        )}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        <ProfileSections control={control} errors={errors} styles={styles} colors={colors} />
      </ScrollView>
    </View>
  );
}

// ─── FormField ────────────────────────────────────────────────────────────────

function FormField({
  label,
  control,
  name,
  error,
  styles,
  colors,
  multiline = false,
  rtl = false,
  keyboardType = "default",
}: {
  label: string;
  control: any;
  name: string;
  error?: string;
  styles: any;
  colors: any;
  multiline?: boolean;
  rtl?: boolean;
  keyboardType?: "default" | "phone-pad";
}) {
  const { t } = useTranslation();
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[
              styles.input,
              multiline && styles.inputMulti,
              error && styles.inputError,
              rtl && { textAlign: "right" as const },
            ]}
            value={value ?? ""}
            onChangeText={onChange}
            onBlur={onBlur}
            multiline={multiline}
            numberOfLines={multiline ? 3 : 1}
            keyboardType={keyboardType}
            accessibilityLabel={label}
            placeholderTextColor={colors.textMuted}
          />
        )}
      />
      {error ? <Text style={styles.errorText}>{t(error as any)}</Text> : null}
    </View>
  );
}

// ─── WorkingHoursRow ──────────────────────────────────────────────────────────

function WorkingHoursRow({
  day,
  control,
  styles,
  colors,
}: {
  day: DayKey;
  control: any;
  styles: any;
  colors: any;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.dayRow}>
      <Text style={styles.dayLabel}>{t(`merchant.days.${day}`)}</Text>

      <Controller
        control={control}
        name={`workingHours.${day}.closed`}
        render={({ field: { value, onChange } }) => (
          <>
            {value
              ? (
                  <Text style={styles.closedLabel}>{t("common.closed")}</Text>
                )
              : (
                  <>
                    <Controller
                      control={control}
                      name={`workingHours.${day}.open`}
                      render={({ field: f }) => (
                        <TextInput
                          style={styles.timeInput}
                          value={f.value ?? ""}
                          onChangeText={f.onChange}
                          placeholder="09:00"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                        />
                      )}
                    />
                    <Text style={styles.timeSeparator}>–</Text>
                    <Controller
                      control={control}
                      name={`workingHours.${day}.close`}
                      render={({ field: f }) => (
                        <TextInput
                          style={styles.timeInput}
                          value={f.value ?? ""}
                          onChangeText={f.onChange}
                          placeholder="22:00"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                        />
                      )}
                    />
                  </>
                )}
            <Switch
              value={value}
              onValueChange={v => onChange(v)}
              trackColor={{ true: SEMANTIC.error, false: SEMANTIC.success }}
              thumbColor={colors.text}
              accessibilityLabel={`${t(`merchant.days.${day}`)} - ${t("common.closed")}`}
            />
          </>
        )}
      />
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ShopProfileSkeleton({ insets, styles, colors }: { insets: { top: number }; styles: any; colors: any }) {
  return (
    <View style={styles.container}>
      <View style={{ height: insets.top + 60, backgroundColor: colors.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }} />
      <View style={{ padding: SPACING.base, gap: SPACING.md }}>
        <Skeleton width="100%" height={180} borderRadius={RADIUS.md} />
        <Skeleton width="100%" height={120} borderRadius={RADIUS.md} />
        <Skeleton width="100%" height={280} borderRadius={RADIUS.md} />
      </View>
    </View>
  );
}
