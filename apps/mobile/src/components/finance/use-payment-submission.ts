import type { FinancePaymentInput, FinancePaymentResult } from "@/services/api/finance";
import { useMutation } from "@tanstack/react-query";
import * as React from "react";

import { getErrorCode } from "@/lib/api-error";
import { newIdempotencyKey } from "@/lib/finance";
import { financeApi } from "@/services/api/finance";

export type SlipPhoto = { uri: string; mime: string };

export type PaymentSubmission = {
  input: Omit<FinancePaymentInput, "attachmentPath">;
  slip: SlipPhoto | null;
};

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
 * The key is created on the first attempt and re-sent on every retry, also
 * after a timeout or a dropped response, so the server returns the original
 * receipt instead of posting twice. The uploaded slip path is reused too, so
 * a retry sends an identical body. Only `reset()` (a new payment) starts a
 * new key.
 */
export function usePaymentSubmission() {
  const keyRef = React.useRef<string | null>(null);
  const uploadedRef = React.useRef<{ uri: string; path: string } | null>(null);

  const mutation = useMutation<FinancePaymentResult, unknown, PaymentSubmission>({
    mutationFn: async ({ input, slip }) => {
      if (!keyRef.current)
        keyRef.current = newIdempotencyKey();
      const key = keyRef.current;

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

      try {
        const res = await financeApi.createPayment(attachmentPath ? { ...input, attachmentPath } : input, key);
        return res.data.data;
      }
      catch (error) {
        const code = getErrorCode(error);
        if (code && STALE_UPLOAD_CODES.has(code))
          uploadedRef.current = null;
        throw error;
      }
    },
  });

  const { reset: resetMutation } = mutation;
  const reset = React.useCallback(() => {
    keyRef.current = null;
    uploadedRef.current = null;
    resetMutation();
  }, [resetMutation]);

  return { ...mutation, reset, currentKey: () => keyRef.current };
}
