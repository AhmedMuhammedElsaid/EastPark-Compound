import type { Resolver } from "react-hook-form";
import type { Product } from "@/services/api/merchant";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
import * as React from "react";
import { useController, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { merchantApi } from "@/services/api/merchant";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const schema = z.object({
  name: z.string().min(1).max(100),
  nameAr: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  descriptionAr: z.string().max(500).optional(),
  price: z.coerce.number().positive(),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    nav: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: SPACING.base,
      paddingBottom: SPACING.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: SPACING.sm,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.elevated,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    navTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: colors.text },
    scroll: { padding: SPACING.base, gap: SPACING.md },
    section: { gap: SPACING.xs },
    label: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, color: colors.text },
    input: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontFamily: FONT.sans,
      fontSize: 14,
      color: colors.text,
      height: 48,
    },
    inputMultiline: { height: 80, textAlignVertical: "top" as const, paddingTop: SPACING.sm },
    inputFocused: { borderColor: BRAND.gold },
    inputError: { borderColor: SEMANTIC.error },
    errorText: { fontFamily: FONT.sans, fontSize: 12, color: SEMANTIC.error },
    saveBtn: {
      height: 52,
      borderRadius: RADIUS.md,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginTop: SPACING.md,
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.bg },
  }), [colors]);
}

export default function ProductFormScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isNew = productId === "new";
  const styles = useStyles();
  const colors = useAppColors();

  const { data } = useQuery({
    queryKey: ["merchant-product", productId],
    queryFn: () => merchantApi.getAllMyProducts(),
    enabled: !isNew,
    select: products => products.find(p => p.id === productId),
    initialData: () => queryClient.getQueryData<Product[]>(["merchant-products"]),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(["merchant-products"])?.dataUpdatedAt,
  });

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      name: "",
      nameAr: "",
      description: "",
      descriptionAr: "",
      price: 0,
      imageUrl: "",
    },
  });

  React.useEffect(() => {
    if (data) {
      reset({
        name: data.name,
        nameAr: data.nameAr,
        description: data.description ?? "",
        descriptionAr: data.descriptionAr ?? "",
        price: data.price,
        imageUrl: data.imageUrl ?? "",
      });
    }
  }, [data, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (values: FormData) => {
      const payload = {
        name: values.name,
        nameAr: values.nameAr,
        description: values.description || undefined,
        descriptionAr: values.descriptionAr || undefined,
        price: values.price,
        imageUrl: values.imageUrl || undefined,
      };
      return isNew
        ? merchantApi.createProduct(payload)
        : merchantApi.updateProduct(productId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-products"] });
      router.back();
    },
    onError: () => showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error }),
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.nav, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>{isNew ? t("merchant.new_product") : t("merchant.edit_product")}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <ProductFields control={control} errors={errors} styles={styles} colors={colors} />

        <Pressable
          style={[styles.saveBtn, isPending && styles.saveBtnDisabled]}
          onPress={handleSubmit((d: FormData) => mutate(d))}
          disabled={isPending}
        >
          <Text style={styles.saveBtnText}>{isPending ? t("common.loading") : t("common.save")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Form fields sub-component ────────────────────────────────────────────────

function ProductFields({ control, errors, styles, colors }: { control: any; errors: any; styles: any; colors: any }) {
  const { t } = useTranslation();
  return (
    <>
      <PField control={control} name="name" label={t("merchant.field_name_en")} error={errors.name?.message} styles={styles} colors={colors} />
      <PField control={control} name="nameAr" label={t("merchant.field_name_ar")} error={errors.nameAr?.message} rtl styles={styles} colors={colors} />
      <PField control={control} name="price" label={t("merchant.field_price")} error={errors.price?.message} keyboardType="decimal-pad" styles={styles} colors={colors} />
      <PField control={control} name="description" label={t("merchant.field_description_en")} error={errors.description?.message} multiline styles={styles} colors={colors} />
      <PField control={control} name="descriptionAr" label={t("merchant.field_description_ar")} error={errors.descriptionAr?.message} multiline rtl styles={styles} colors={colors} />
      <PField control={control} name="imageUrl" label={t("merchant.field_image_url")} error={errors.imageUrl?.message} keyboardType="url" styles={styles} colors={colors} />
    </>
  );
}

function PField({
  control,
  name,
  label,
  error,
  multiline,
  rtl,
  keyboardType,
  styles,
  colors,
}: {
  control: any;
  name: string;
  label: string;
  error?: string;
  multiline?: boolean;
  rtl?: boolean;
  keyboardType?: any;
  styles: any;
  colors: any;
}) {
  const { field } = useController({ control, name });
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={String(field.value ?? "")}
        onChangeText={field.onChange}
        onBlur={() => {
          field.onBlur();
          setIsFocused(false);
        }}
        onFocus={() => setIsFocused(true)}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlign={rtl ? "right" : "left"}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}
