import type { LeadAction } from "@/lib/resident-leads";
import type { ResidentLead } from "@/services/api/admin";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { showMessage } from "react-native-flash-message";
import { showConfirm } from "@/lib/confirm-dialog";

import { inviteResultStatus, leadActions, leadErrorKey, leadUnitLabel } from "@/lib/resident-leads";
import { adminApi } from "@/services/api/admin";
import { SEMANTIC } from "@/theme/tokens";

export const LEADS_QUERY_ROOT = "admin-leads";
export const LEAD_STATS_QUERY_KEY = ["admin-lead-stats"];

/** Confirm-dialog copy key: `send` reuses the `invite` wording. */
function confirmKey(lead: ResidentLead, action: LeadAction): string {
  if (action === "reject")
    return "reject";
  const kind = leadActions(lead.status, lead.hasAccount).invite ?? "send";
  return kind === "send" ? "invite" : kind;
}

async function runLeadAction(lead: ResidentLead, action: LeadAction): Promise<string> {
  if (action === "reject") {
    await adminApi.rejectLead(lead.id);
    return "admin_leads.toast_rejected";
  }
  const res = await adminApi.inviteLead(lead.id);
  const message = res.data?.data?.message ?? res.data?.message;
  if (inviteResultStatus(message) === "CONVERTED")
    return "admin_leads.toast_added";
  return lead.status === "INVITED" ? "admin_leads.toast_resent" : "admin_leads.toast_invited";
}

/**
 * Confirm → call → toast → refetch for one lead action. Returns the action in
 * flight per lead id and the handler the cards call.
 */
export function useLeadActions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pending, setPending] = React.useState<Record<string, LeadAction>>({});

  const execute = React.useCallback(async (lead: ResidentLead, action: LeadAction) => {
    setPending(current => ({ ...current, [lead.id]: action }));
    const vars = { name: lead.name, unit: leadUnitLabel(lead) };
    try {
      const toastKey = await runLeadAction(lead, action);
      showMessage({ message: t(toastKey, vars), type: "success", backgroundColor: SEMANTIC.success });
    }
    catch (error) {
      showMessage({ message: t(leadErrorKey(action, error)), type: "danger", backgroundColor: SEMANTIC.error });
    }
    finally {
      setPending(({ [lead.id]: _done, ...rest }) => rest);
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_ROOT] });
      queryClient.invalidateQueries({ queryKey: LEAD_STATS_QUERY_KEY });
    }
  }, [queryClient, t]);

  const onAction = React.useCallback((lead: ResidentLead, action: LeadAction) => {
    if (pending[lead.id])
      return;
    const key = confirmKey(lead, action);
    const vars = { name: lead.name, email: lead.email, unit: leadUnitLabel(lead) };
    void showConfirm({
      title: t(`admin_leads.confirm_${key}_title`),
      message: t(`admin_leads.confirm_${key}_body`, vars),
      confirmLabel: t(`admin_leads.confirm_${key}_button`),
      destructive: action === "reject",
    }).then((confirmed) => {
      if (confirmed)
        void execute(lead, action);
    });
  }, [execute, pending, t]);

  return { pending, onAction };
}
