import type { AdminListing } from "@/services/api/listings";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { showMessage } from "react-native-flash-message";

import { showConfirm } from "@/lib/confirm-dialog";
import { listingErrorKey } from "@/lib/listings";
import { adminListingsApi, listingKeys } from "@/services/api/listings";
import { SEMANTIC } from "@/theme/tokens";

export type AdminListingAction = "approve" | "reject" | "takeDown";
type ReasonTarget = { listing: AdminListing; action: "reject" | "takeDown" };

/**
 * Approve (confirm dialog) and reject / take down (reason dialog) for the admin
 * list and detail screens. Every outcome refetches all listing views.
 */
export function useAdminListingActions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pending, setPending] = React.useState<Record<string, AdminListingAction>>({});
  const [reasonTarget, setReasonTarget] = React.useState<ReasonTarget | null>(null);

  const run = React.useCallback(async (listing: AdminListing, action: AdminListingAction, reason?: string) => {
    setPending(current => ({ ...current, [listing.id]: action }));
    try {
      if (action === "approve")
        await adminListingsApi.approve(listing.id);
      else
        await adminListingsApi.reject(listing.id, reason ?? "");
      const toast = action === "approve" ? "listings.toast_approved" : action === "reject" ? "listings.toast_rejected" : "listings.toast_taken_down";
      showMessage({ message: t(toast), type: "success", backgroundColor: SEMANTIC.success });
      return true;
    }
    catch (error) {
      showMessage({ message: t(listingErrorKey(error) as any), type: "danger", backgroundColor: SEMANTIC.error });
      return false;
    }
    finally {
      setPending(({ [listing.id]: _done, ...rest }) => rest);
      void queryClient.invalidateQueries({ queryKey: listingKeys.all });
    }
  }, [queryClient, t]);

  const onAction = React.useCallback((listing: AdminListing, action: AdminListingAction) => {
    if (pending[listing.id])
      return;
    if (action !== "approve") {
      setReasonTarget({ listing, action });
      return;
    }
    void showConfirm({
      title: t("listings.confirm_approve_title"),
      message: t("listings.confirm_approve_body", { unit: listing.unitLabel }),
      confirmLabel: t("listings.confirm_approve_button"),
      destructive: false,
    }).then((confirmed) => {
      if (confirmed)
        void run(listing, "approve");
    });
  }, [pending, run, t]);

  const submitReason = React.useCallback(async (reason: string) => {
    if (!reasonTarget)
      return;
    const ok = await run(reasonTarget.listing, reasonTarget.action, reason);
    if (ok)
      setReasonTarget(null);
  }, [reasonTarget, run]);

  const reasonDialog = {
    visible: reasonTarget !== null,
    title: t(reasonTarget?.action === "takeDown" ? "listings.take_down_title" : "listings.reject_title"),
    confirmLabel: t(reasonTarget?.action === "takeDown" ? "listings.take_down" : "listings.reject"),
    busy: reasonTarget ? !!pending[reasonTarget.listing.id] : false,
    onCancel: () => setReasonTarget(null),
    onSubmit: submitReason,
  };

  return { pending, onAction, reasonDialog };
}
