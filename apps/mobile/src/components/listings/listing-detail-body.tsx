import type { Listing } from "@/services/api/listings";
import { Phone, WhatsappLogo } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";

import { ListingSpecs, StatusPill, TypeTag, usePriceLabel } from "@/components/listings/listing-bits";
import { PhotoCarousel } from "@/components/listings/photo-carousel";
import { formatExpiry } from "@/lib/expiry-date";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { openWhatsAppChat, toWhatsAppDigits } from "@/lib/whatsapp";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Props = {
  listing: Listing;
  /** Call / WhatsApp buttons (hidden on the owner's and the admin's views). */
  showContact?: boolean;
  /** Status pill under the title (owner and admin views). */
  showStatus?: boolean;
  /** Rendered between the facts and the description (notes, reasons, owner info). */
  children?: React.ReactNode;
};

/** Carousel → price → flat → specs → (children) → description → contact. */
export function ListingDetailBody({ listing, showContact, showStatus, children }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles(colors);
  const priceLabel = usePriceLabel();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  const expires = listing.status === "APPROVED" && listing.expiresAt ? new Date(listing.expiresAt) : null;

  return (
    <View>
      <PhotoCarousel
        photos={listing.photos}
        overlay={<View style={styles.tag} pointerEvents="none"><TypeTag type={listing.type} /></View>}
      />
      <View style={styles.content}>
        <View style={styles.headBlock}>
          <Text style={[styles.price, { color: gold }]}>{priceLabel(listing.type, listing.price)}</Text>
          <Text style={styles.unit} accessibilityRole="header">{t("listings.unit", { unit: listing.unitLabel })}</Text>
          {showStatus ? <StatusPill status={listing.status} /> : null}
        </View>

        <View style={styles.card}>
          <ListingSpecs
            areaSqm={listing.areaSqm}
            bedrooms={listing.bedrooms}
            bathrooms={listing.bathrooms}
            furnished={listing.furnished}
            showFurnished
          />
        </View>

        {children}

        {listing.description
          ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t("listings.description")}</Text>
                <Text style={styles.body}>{listing.description}</Text>
              </View>
            )
          : null}

        <View style={styles.metaBlock}>
          <Text style={styles.meta}>{t("listings.listed_by", { name: listing.owner.name })}</Text>
          {expires ? <Text style={styles.meta}>{t("listings.visible_until", { date: formatExpiry(expires, i18n.language) })}</Text> : null}
        </View>

        {showContact ? <ContactActions phone={listing.contactPhone} styles={styles} gold={gold} /> : null}
      </View>
    </View>
  );
}

function ContactActions({ phone, styles, gold }: { phone: string; styles: ReturnType<typeof buildStyles>; gold: string }) {
  const { t } = useTranslation();
  const digits = toWhatsAppDigits(phone);
  const failed = () => showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("listings.contact")}</Text>
      <View style={styles.contactRow}>
        <Pressable
          style={({ pressed }) => [styles.contactBtn, styles.contactPrimary, pressed && styles.pressed]}
          onPress={() => Linking.openURL(`tel:${phone}`).catch(failed)}
          accessibilityRole="button"
          accessibilityLabel={`${t("directory.call")} ${phone}`}
        >
          <Phone size={20} color={BRAND.ink} weight="bold" />
          <Text style={[styles.contactText, { color: BRAND.ink }]}>{t("directory.call")}</Text>
        </Pressable>
        {digits && (
          <Pressable
            style={({ pressed }) => [styles.contactBtn, pressed && styles.pressed]}
            onPress={() => openWhatsAppChat(digits, undefined, url => Linking.openURL(url)).catch(failed)}
            accessibilityRole="button"
            accessibilityLabel={t("directory.whatsapp")}
          >
            <WhatsappLogo size={20} color={gold} weight="bold" />
            <Text style={[styles.contactText, { color: gold }]}>{t("directory.whatsapp")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    tag: { position: "absolute", top: SPACING.md, start: SPACING.md },
    content: { padding: SPACING.base, gap: SPACING.lg },
    headBlock: { gap: SPACING.xs },
    price: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 24, lineHeight: 36 },
    unit: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 16, lineHeight: 24, color: colors.text },
    card: { backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: SPACING.md },
    section: { gap: SPACING.sm },
    sectionTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 24, color: colors.text },
    body: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 24, color: colors.text },
    metaBlock: { gap: 2 },
    meta: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 20, color: colors.textMuted },
    contactRow: { flexDirection: "row", gap: SPACING.sm },
    contactBtn: {
      flex: 1,
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.sm,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: BRAND.gold,
    },
    contactPrimary: { backgroundColor: BRAND.gold },
    contactText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 22 },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  });
}

function useStyles(colors: ReturnType<typeof useAppColors>) {
  return React.useMemo(() => buildStyles(colors), [colors]);
}
