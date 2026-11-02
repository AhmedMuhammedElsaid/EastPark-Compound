import type { FinancePaymentInput, FinancePaymentResult } from "@/services/api/finance";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { getErrorCode } from "@/lib/api-error";
import { isUnconfirmedPaymentError, newIdempotencyKey } from "@/lib/finance";
import { financeApi, financeKeys } from "@/services/api/finance";

export type SlipPhoto = { uri: string; mime: string };

export type PaymentSubmission = {
  input: Omit<FinancePaymentInput, "attachmentPath">;
  slip: SlipPhoto | null;
};

/** The request that was sent: re-sent verbatim, with its key, while the outcome is unconfirmed. */
export type SentPayment = { key: string; body: FinancePaymentInput };

/** The slip upload failed before the payment was sent (copy comes from the upload error). */
export class SlipUploadError extends Error {
  readonly original: unknown;
  constructor(original: unknown) {
    super("slip_upload_failed");
    this.original = original;
  }
}

/** The uploaded slip can no longer be attached: the next attempt uploads it again. */
const STALE_UPLOAD_CODES = new Set([
  "finance.error.attachmentExpired",
  "finance.error.attachmentMissing",
  "finance.error.attachmentInvalid",
]);

/**
 * Records one payment with ONE `Idempotency-Key` per submission (plan 3.3).
 * The key is created on the first attempt and kept until `reset()` or
 * `discard()`.
 *
 * When a create call ends without a definite answer (no response, 408, 429,
 * 5xx) the payment may already be recorded: the submission turns
 * `unconfirmed` and every further attempt re-sends the FIRST body (its
 * `receivedAt`, `force` and uploaded `attachmentPath`) verbatim with the same
 * key, whatever the form holds now, so the server returns the original
 * receipt instead of posting twice. The pending attempt lives in memory only.
 */
export function usePaymentSubmission() {
  const queryClient = useQueryClient();
  const keyRef = React.useRef<string | null>(null);
  const uploadedRef = React.useRef<{ uri: string; path: string } | null>(null);
  const sentRef = React.useRef<SentPayment | null>(null);
  const unconfirmedRef = React.useRef(false);
  const lastSubmissionRef = React.useRef<PaymentSubmission | null>(null);
  const [unconfirmed, setUnconfirmed] = React.useState(false);

  const markUnconfirmed = React.useCallback((value: boolean) => {
    unconfirmedRef.current = value;
    setUnconfirmed(value);
  }, []);

  const mutation = useMutation<FinancePaymentResult, unknown, PaymentSubmission>({
    mutationFn: async ({ input, slip }) => {
      let sent: SentPayment;
      if (unconfirmedRef.current && sentRef.current) {
        sent = sentRef.current;
      }
      else {
        if (!keyRef.current)
          keyRef.current = newIdempotencyKey();

        let attachmentPath: string | undefined;
        if (slip) {
          if (uploadedRef.current?.uri !== slip.uri) {
            try {
              uploadedRef.current = { uri: slip.uri, path: await financeApi.uploadSlip(slip.uri, slip.mime) };
            }
            catch (error) {
              throw new SlipUploadError(error);
            }
          }
          attachmentPath = uploadedRef.current.path;
        }
        sent = { key: keyRef.current, body: attachmentPath ? { ...input, attachmentPath } : input };
        sentRef.current = sent;
      }

      try {
        const res = await financeApi.createPayment(sent.body, sent.key);
        markUnconfirmed(false);
        return res.data.data;
      }
      catch (error) {
        markUnconfirmed(isUnconfirmedPaymentError(error));
        const code = getErrorCode(error);
        if (code && STALE_UPLOAD_CODES.has(code))
          uploadedRef.current = null;
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKeys.all }),
  });

  const { reset: resetMutation, mutate } = mutation;

  const submit = React.useCallback((submission: PaymentSubmission, options?: Parameters<typeof mutate>[1]) => {
    lastSubmissionRef.current = submission;
    mutate(submission, options);
  }, [mutate]);

  /** Re-sends the unconfirmed request verbatim (same body, same key). */
  const retry = React.useCallback((options?: Parameters<typeof mutate>[1]) => {
    if (lastSubmissionRef.current)
      mutate(lastSubmissionRef.current, options);
  }, [mutate]);

  /**
   * Drops the unconfirmed attempt so the form can be edited: the next submit
   * uses a NEW key. Only after the accountant checked the flat's recent payments.
   */
  const discard = React.useCallback(() => {
    keyRef.current = null;
    sentRef.current = null;
    markUnconfirmed(false);
    resetMutation();
  }, [resetMutation, markUnconfirmed]);

  const reset = React.useCallback(() => {
    keyRef.current = null;
    uploadedRef.current = null;
    sentRef.current = null;
    lastSubmissionRef.current = null;
    markUnconfirmed(false);
    resetMutation();
  }, [resetMutation, markUnconfirmed]);

  return {
    ...mutation,
    submit,
    retry,
    discard,
    reset,
    unconfirmed,
    /** The request awaiting confirmation (its flat id points the accountant to the ledger). */
    pending: () => (unconfirmedRef.current ? sentRef.current : null),
    currentKey: () => keyRef.current,
  };
}
