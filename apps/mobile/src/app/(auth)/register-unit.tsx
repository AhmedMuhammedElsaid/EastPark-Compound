import type { Control, FieldErrors, UseFormSetValue } from "react-hook-form";
import type { RegisterUnitValues } from "@/lib/register-unit";
import type { LeadError } from "@/services/api/residents";
import { zodResolver } from "@hookform/resolvers/zod";
import { Redirect, router } from "expo-router";
import { ArrowLeft, CheckCircle } from "phosphor-react-native";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";
import { AuthInput } from "@/components/auth/auth-input";
import { AuthScreenWrapper } from "@/components/auth/auth-screen-wrapper";
import { BrandMark } from "@/components/auth/brand-mark";
import { GoldButton } from "@/components/auth/gold-button";
import { ChipGroup } from "@/components/register/chip-group";
import { FLAT_OPTIONS, getBuildingsByPhase, getFloorOptions } from "@/lib/compound";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { MARITAL_STATUSES, registerUnitSchema, toLeadPayload } from "@/lib/register-unit";

import { residentsApi } from "@/services/api/residents";
import { useAppSelector } from "@/store";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const ERROR_KEYS: Record<LeadError, string> = {
  network: "register.submit_error.network",
  duplicate: "register.submit_error.duplicate",
  rate_limited: "register.submit_error.rate_limited",
  validation: "register.submit_error.server",
  server: "register.submit_error.server",
};

type TextField = "name" | "email" | "phone" | "jobTitle" | "nationalId" | "passportNumber" | "parking";
const FIELD_KEY: Record<TextField, string> = {
  name: "name",
  email: "email",
  phone: "phone",
  jobTitle: "job",
  nationalId: "national_id",
  passportNumber: "passport_number",
  parking: "parking",
};

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    header: { alignItems: "center", marginTop: SPACING.md, marginBottom: SPACING.lg },
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 24, lineHeight: 36, color: colors.text, textAlign: "center", marginBottom: SPACING.xs },
    subtitle: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, textAlign: "center", marginBottom: SPACING.xl },
    section: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 13, lineHeight: 20, color: colors.textMuted, marginTop: SPACING.sm, marginBottom: SPACING.sm },
    errorBox: { borderWidth: 1, borderColor: SEMANTIC.error, backgroundColor: `${SEMANTIC.error}1a`, borderRadius: RADIUS.md, padding: SPACING.base, marginBottom: SPACING.md, gap: 2 },
    errorTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 22, color: colors.text },
    errorBody: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    note: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: "center", marginTop: SPACING.md },
    linkRow: { alignItems: "center", justifyContent: "center", minHeight: 48, marginTop: SPACING.sm },
    link: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted },
    backRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs, minHeight: 44, alignSelf: "flex-start" },
    success: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.md, paddingHorizontal: SPACING.lg },
    successIcon: { width: 80, height: 80, borderRadius: RADIUS.full, backgroundColor: `${BRAND.gold}1f`, alignItems: "center", justifyContent: "center" },
  }), [colors]);
}

const EMPTY_FORM: RegisterUnitValues = {
  name: "",
  email: "",
  phone: "",
  building: "",
  floor: "",
  flatNumber: "",
  parking: "",
  jobTitle: "",
  maritalStatus: "",
  nationalId: "",
  passportNumber: "",
};

type TextFieldProps = {
  control: Control<RegisterUnitValues>;
  name: TextField;
  errors: FieldErrors<RegisterUnitValues>;
  extra?: object;
};

/** One labelled text input bound to the form; the ref lets a failed submit focus it. */
function TextInput({ control, name, errors, extra = {} }: TextFieldProps) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value, ref } }) => (
        <AuthInput
          ref={ref}
          label={t(`register.fields.${FIELD_KEY[name]}`)}
          placeholder={t(`register.fields.${FIELD_KEY[name]}_placeholder`)}
          value={value ?? ""}
          onChangeText={onChange}
          onBlur={onBlur}
          error={errors[name]?.message ? t(errors[name]?.message as string) : undefined}
          {...extra}
        />
      )}
    />
  );
}

type UnitChipsProps = {
  control: Control<RegisterUnitValues>;
  setValue: UseFormSetValue<RegisterUnitValues>;
  building: string;
  errors: FieldErrors<RegisterUnitValues>;
  ar: boolean;
};

/** Building, floor and flat chips; the floor list follows the chosen building. */
function UnitChips({ control, setValue, building, errors, ar }: UnitChipsProps) {
  const { t } = useTranslation();
  const err = (key?: string) => (key ? t(key) : undefined);
  return (
    <>
      <Controller
        control={control}
        name="building"
        render={({ field: { onChange, value } }) => (
          <ChipGroup
            label={t("register.fields.building")}
            value={value}
            onChange={(v) => {
              onChange(v);
              // The floors depend on the building (ground floor only in phases 2 and 3).
              setValue("floor", "", { shouldValidate: false });
            }}
            options={getBuildingsByPhase().flatMap(g => g.buildings).map(b => ({ value: b.value, label: b.value }))}
            error={err(errors.building?.message)}
          />
        )}
      />
      <Controller
        control={control}
        name="floor"
        render={({ field: { onChange, value } }) => (
          <ChipGroup
            label={t("register.fields.floor")}
            value={value}
            onChange={onChange}
            options={getFloorOptions(building).map(o => ({ value: o.value, label: ar ? o.labelAr : o.labelEn }))}
            emptyHint={t("register.fields.building_placeholder")}
            error={err(errors.floor?.message)}
          />
        )}
      />
      <Controller
        control={control}
        name="flatNumber"
        render={({ field: { onChange, value } }) => (
          <ChipGroup
            label={t("register.fields.flat")}
            value={value}
            onChange={onChange}
            options={FLAT_OPTIONS.map(o => ({ value: o.value, label: o.labelEn }))}
            error={err(errors.flatNumber?.message)}
          />
        )}
      />
    </>
  );
}

/** Shown after the lead is accepted: nothing more to do until the office approves it. */
function RegistrationDone({ styles, onDone }: { styles: ReturnType<typeof useStyles>; onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <AuthScreenWrapper scrollable={false}>
      <View style={styles.header}><BrandMark size="sm" /></View>
      <View style={styles.success}>
        <View style={styles.successIcon}><CheckCircle size={40} color={BRAND.gold} weight="duotone" /></View>
        <Text style={styles.title}>{t("register.success_title")}</Text>
        <Text style={styles.subtitle}>{t("register.success_body")}</Text>
      </View>
      <GoldButton label={t("register.success_done")} onPress={onDone} />
    </AuthScreenWrapper>
  );
}

/** Unit registration for guests: the in-app version of the web `/register-unit` form. */
export default function RegisterUnitScreen() {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles();
  const ar = i18n.language.startsWith("ar");
  const [submitError, setSubmitError] = React.useState<LeadError | null>(null);
  const [done, setDone] = React.useState(false);

  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const { control, handleSubmit, setFocus, setValue, formState: { errors, isSubmitting } } = useForm<RegisterUnitValues>({
    resolver: zodResolver(registerUnitSchema),
    defaultValues: EMPTY_FORM,
  });
  const building = useWatch({ control, name: "building" });

  async function onSubmit(values: RegisterUnitValues) {
    setSubmitError(null);
    const result = await residentsApi.submitLead(toLeadPayload(values));
    if (result.ok) {
      setDone(true);
      return;
    }
    // Values stay as typed so nothing is lost on a retry.
    setSubmitError(result.error);
  }

  function goHome() {
    router.dismissTo("/(tabs)");
  }

  // Signed-in users already have an account (the web page redirects them the same way).
  if (isAuthenticated)
    return <Redirect href="/(tabs)" />;
  if (done)
    return <RegistrationDone styles={styles} onDone={goHome} />;

  return (
    <AuthScreenWrapper>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow} accessibilityRole="button" accessibilityLabel={t("common.back")}>
        <ArrowLeft mirrored={I18nManager.isRTL} size={16} color={colors.textMuted} />
        <Text style={styles.link}>{t("common.back")}</Text>
      </Pressable>
      <View style={styles.header}><BrandMark size="sm" /></View>
      <Text style={styles.title}>{t("register.title")}</Text>
      <Text style={styles.subtitle}>{t("register.subtitle")}</Text>

      <Text style={styles.section}>{t("register.section_you")}</Text>
      <TextInput control={control} name="name" errors={errors} extra={{ autoCapitalize: "words", autoComplete: "name" }} />
      <TextInput control={control} name="email" errors={errors} extra={{ keyboardType: "email-address", autoComplete: "email" }} />
      <TextInput control={control} name="phone" errors={errors} extra={{ keyboardType: "phone-pad", autoComplete: "tel" }} />
      <TextInput control={control} name="jobTitle" errors={errors} />
      <Controller
        control={control}
        name="maritalStatus"
        render={({ field: { onChange, value } }) => (
          <ChipGroup
            label={t("register.fields.marital_status")}
            value={value ?? ""}
            // Tapping the chosen status again clears it: the field is optional.
            onChange={v => onChange(v === value ? "" : v)}
            options={MARITAL_STATUSES.map(s => ({ value: s, label: t(`register.fields.marital_statuses.${s.toLowerCase()}`) }))}
          />
        )}
      />
      <TextInput control={control} name="nationalId" errors={errors} extra={{ keyboardType: "number-pad", maxLength: 14 }} />
      <TextInput control={control} name="passportNumber" errors={errors} extra={{ autoCapitalize: "characters", maxLength: 30 }} />

      <Text style={styles.section}>{t("register.section_unit")}</Text>
      <UnitChips control={control} setValue={setValue} building={building} errors={errors} ar={ar} />
      <TextInput control={control} name="parking" errors={errors} />

      {submitError
        ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorTitle}>{t("register.submit_error.title")}</Text>
              <Text style={styles.errorBody}>{t(ERROR_KEYS[submitError])}</Text>
            </View>
          )
        : null}

      <GoldButton
        label={t("register.submit")}
        onPress={handleSubmit(onSubmit, (formErrors) => {
        // Bring the first invalid text field into view; chip fields show their error in place.
          const first = Object.keys(formErrors)[0] as keyof RegisterUnitValues | undefined;
          if (first)
            setFocus(first);
        })}
        loading={isSubmitting}
      />
      <Text style={styles.note}>{t("register.privacy_note")}</Text>

      <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.linkRow} accessibilityRole="link">
        <Text style={styles.link}>{t("register.have_account")}</Text>
      </Pressable>
    </AuthScreenWrapper>
  );
}
