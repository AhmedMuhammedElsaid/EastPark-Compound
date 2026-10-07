import type { LeadCardColors, LeadCardStyles } from "./lead-card-styles";
import type { LeadAction } from "@/lib/resident-leads";
import type { ResidentLead } from "@/services/api/admin";
import { ArrowCounterClockwise, EnvelopeSimple, HouseLine, PaperPlaneTilt, UserMinus } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, Text, View } from "react-native";

import { leadActions, leadUnitLabel } from "@/lib/resident-leads";
import { BRAND } from "@/theme/tokens";
import { LEAD_STATUS_COLOR } from "./lead-card-styles";

const INVITE_ICON = { send: EnvelopeSimple, resend: PaperPlaneTilt, reinvite: ArrowCounterClockwise, attach: HouseLine } as const;

type LeadCardProps = {
  lead: ResidentLead;
  /** The action in flight for this lead, if any. */
  pending?: LeadAction;
  ui: { styles: LeadCardStyles; colors: LeadCardColors; onAction: (lead: ResidentLead, action: LeadAction) => void };
};

export function LeadCard({ lead, pending, ui }: LeadCardProps) {
  const { t, i18n } = useTranslation();
  const { styles, colors, onAction } = ui;
  const available = leadActions(lead.status, lead.hasAccount);
  const statusColor = LEAD_STATUS_COLOR[lead.status];
  const date = new Date(lead.createdAt).toLocaleDateString(i18n.language === "ar" ? "ar-EG" : "en-GB", { month: "short", day: "numeric", year: "numeric" });
  const InviteIcon = available.invite ? INVITE_ICON[available.invite] : null;
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.main}>
          <Text style={styles.name} numberOfLines={1}>{lead.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>{lead.email}</Text>
          <Text style={styles.meta}>{lead.phone}</Text>
        </View>
        <View style={styles.side}>
          <Text style={styles.unit}>{leadUnitLabel(lead)}</Text>
          <View style={[styles.pill, { backgroundColor: `${statusColor}33` }]}>
            <Text style={styles.pillText}>{t(`admin_leads.status_${lead.status.toLowerCase() as "pending"}`)}</Text>
          </View>
          <Text style={styles.date}>{date}</Text>
        </View>
      </View>

      {(available.invite || available.reject) && (
        <View style={styles.actions}>
          {available.invite && InviteIcon && (
            <Pressable
              style={({ pressed }) => [styles.primary, pending && styles.busy, pressed && styles.pressed]}
              onPress={() => onAction(lead, "invite")}
              disabled={Boolean(pending)}
              accessibilityRole="button"
              accessibilityState={{ busy: pending === "invite", disabled: Boolean(pending) }}
            >
              <InviteIcon size={18} color={gold} mirrored={I18nManager.isRTL} />
              <Text style={styles.primaryText}>
                {pending === "invite"
                  ? t(available.invite === "attach" ? "admin_leads.pending_attach" : "admin_leads.pending_invite")
                  : t(`admin_leads.action_${available.invite}`)}
              </Text>
            </Pressable>
          )}
          {available.reject && (
            <Pressable
              style={({ pressed }) => [styles.reject, pending && styles.busy, pressed && styles.pressed]}
              onPress={() => onAction(lead, "reject")}
              disabled={Boolean(pending)}
              accessibilityRole="button"
              accessibilityLabel={t("admin_leads.reject_for", { name: lead.name })}
              accessibilityState={{ busy: pending === "reject", disabled: Boolean(pending) }}
            >
              <UserMinus size={18} color={colors.text} />
              <Text style={styles.rejectText}>{pending === "reject" ? t("admin_leads.pending_reject") : t("admin_leads.action_reject")}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
