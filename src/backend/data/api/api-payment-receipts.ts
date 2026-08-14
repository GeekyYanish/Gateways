/**
 * PaymentReceiptRepository backed by the real Gateways backend.
 *
 * The backend exposes exactly two participant endpoints:
 *
 *   POST /api/v1/payment-receipts/      submit (JSON, base64 PDF, 8MB cap)
 *   GET  /api/v1/payment-receipts/me    the caller's own receipt, or null
 *
 * Everything else on this interface is an ADMIN operation. Those live under
 * `/api/v1/admin/payments/*` behind `assertAdmin`, belong to the ops console
 * rather than the participant site, and are refused here rather than quietly
 * falling back to local data — a staff view silently reading a different store
 * than the one it writes to is the worst of the available failures.
 */

import { apiFetch, ApiError } from "@/frontend/lib/api-client";
import type { PaymentReceiptRepository } from "../repository";
import { DataError, type PaymentReceipt } from "../types";

/** The backend's serialised receipt — `PaymentReceiptResponseSchema`. */
interface ApiReceipt {
  id: string;
  userId?: string;
  registrationId?: string | null;
  eventId?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  status: PaymentReceipt["status"];
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  rejectionReason?: string | null;
  submittedAt: string;
  amountInr?: number;
  paymentMethod?: "upi" | "neft" | "gateway" | null;
  transactionReference?: string | null;
  fileUrl?: string | null;
}

/**
 * `fileData` is deliberately empty on the way back.
 *
 * Receipts are stored in Cloudinary and served as short-lived signed URLs; the
 * backend never returns the PDF bytes. The local implementation kept base64 in
 * localStorage because it had nowhere else to put it. Any UI that re-renders a
 * submitted receipt needs the signed URL from the admin endpoint, not this.
 */
function toReceipt(api: ApiReceipt, fallbackUserId = ""): PaymentReceipt {
  return {
    id: api.id,
    registrationId: api.registrationId ?? "",
    eventId: api.eventId ?? "",
    userId: api.userId ?? fallbackUserId,
    fileData: "",
    fileName: api.fileName ?? "",
    fileSizeBytes: api.fileSizeBytes ?? 0,
    status: api.status,
    reviewedBy: api.reviewedBy ?? null,
    reviewedAt: api.reviewedAt ?? null,
    reviewNote: api.reviewNote ?? api.rejectionReason ?? null,
    submittedAt: api.submittedAt,
    amountInr: api.amountInr,
    paymentMethod: api.paymentMethod ?? null,
    transactionReference: api.transactionReference ?? null,
    fileUrl: api.fileUrl ?? null,
  };
}

function adminOnly(operation: string): never {
  throw new DataError(
    "NOT_AUTHENTICATED",
    `${operation} is an admin operation served by /api/v1/admin/payments, not the participant site.`,
  );
}

export class ApiPaymentReceipts implements PaymentReceiptRepository {
  async getConfig(): Promise<{ amountInr: number }> {
    try {
      return await apiFetch<{ amountInr: number }>('/payment-receipts/config');
    } catch (error) {
      throw error instanceof ApiError ? error.toDataError() : error;
    }
  }

  async submit(input: {
    registrationId: string;
    eventId: string;
    userId: string;
    fileData: string;
    fileName: string;
    fileSizeBytes: number;
    paymentMethod?: "upi" | "neft" | "gateway";
    transactionReference?: string;
  }): Promise<PaymentReceipt> {
    try {
      const data = await apiFetch<{ receipt: ApiReceipt } | ApiReceipt>(
        "/payment-receipts/",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fileName: input.fileName,
            fileSizeBytes: input.fileSizeBytes,
            fileData: input.fileData,
            paymentMethod: input.paymentMethod,
            transactionReference: input.transactionReference,
          }),
        },
      );
      const receipt = "receipt" in data ? data.receipt : data;
      return toReceipt(receipt, input.userId);
    } catch (error) {
      throw error instanceof ApiError ? error.toDataError() : error;
    }
  }

  async getByUser(userId: string): Promise<PaymentReceipt | null> {
    try {
      const data = await apiFetch<{ receipt: ApiReceipt | null } | null>(
        "/payment-receipts/me",
      );
      const receipt = data && "receipt" in data ? data.receipt : (data as ApiReceipt | null);
      return receipt ? toReceipt(receipt, userId) : null;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) return null;
      throw error instanceof ApiError ? error.toDataError() : error;
    }
  }

  /**
   * The backend has no per-registration lookup — `/me` returns the caller's one
   * receipt. Filtering that single record is the honest equivalent, and returns
   * null rather than someone else's receipt when the ids do not match.
   */
  async getByRegistration(registrationId: string): Promise<PaymentReceipt | null> {
    const mine = await this.getByUser("");
    return mine && mine.registrationId === registrationId ? mine : null;
  }

  async listForEvent(): Promise<PaymentReceipt[]> {
    return adminOnly("Listing receipts for an event");
  }

  async listPending(): Promise<PaymentReceipt[]> {
    return adminOnly("Listing pending receipts");
  }

  async review(): Promise<PaymentReceipt> {
    return adminOnly("Reviewing a receipt");
  }
}
