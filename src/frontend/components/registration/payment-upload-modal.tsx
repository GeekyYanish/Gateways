"use client";

import { useState, useRef } from "react";
import { BlockModal, BlockButton, BlockInput, BlockSelect, showToast } from "@/frontend/components/mc";
import { PaymentInstructions } from "@/frontend/components/registration/payment-instructions";
import { useSession } from "@/frontend/components/auth/session-provider";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";
import { DataError } from "@/backend/data/types";
import { cn } from "@/frontend/lib/utils";

export interface PaymentUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  registrationId: string;
  onSuccess: () => void;
}

/** The one-time pass is not tied to any individual event registration. */
export const GATEWAYS_ENTRY_PAYMENT_ID = "gateways-entry";

export function PaymentUploadModal({
  open,
  onOpenChange,
  eventId,
  registrationId,
  onSuccess,
}: PaymentUploadModalProps) {
  const { session } = useSession();
  const userId = session?.userId;
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "neft" | "gateway">("upi");
  const [transactionReference, setTransactionReference] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: paymentConfig } = useAsync(() => repo.paymentReceipts.getConfig(), []);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        showToast({
          title: "Invalid file type",
          body: "Please upload a PDF file.",
          severity: "critical",
        });
        return;
      }
      if (selectedFile.size > MAX_FILE_SIZE) {
        showToast({
          title: "File too large",
          body: "The payment receipt must be under 5MB.",
          severity: "critical",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (droppedFile.type !== "application/pdf") {
        showToast({
          title: "Invalid file type",
          body: "Please upload a PDF file.",
          severity: "critical",
        });
        return;
      }
      if (droppedFile.size > MAX_FILE_SIZE) {
        showToast({
          title: "File too large",
          body: "The payment receipt must be under 5MB.",
          severity: "critical",
        });
        return;
      }
      setFile(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSubmit = async () => {
    if (!file || !userId || transactionReference.trim().length < 4) return;

    setIsSubmitting(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });

      await repo.paymentReceipts.submit({
        registrationId,
        eventId,
        userId,
        fileData: base64Data,
        fileName: file.name,
        fileSizeBytes: file.size,
        paymentMethod,
        transactionReference: transactionReference.trim(),
      });

      showToast({
        title: "Receipt Uploaded",
        body: "Your payment receipt has been submitted for verification.",
        severity: "success",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      showToast({
        title: "Upload Failed",
        body: error instanceof DataError ? error.message : "There was an error submitting your receipt. Please try again.",
        severity: "critical",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BlockModal
      open={open}
      onOpenChange={onOpenChange}
      variant="portal"
      title="Make Payment"
      description="Pay the one-time Gateways pass and upload the receipt. Registration unlocks after verification."
      footer={
        <>
          <BlockButton variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </BlockButton>
          <BlockButton
            variant="emerald"
            onClick={handleSubmit}
            disabled={!file || transactionReference.trim().length < 4 || isSubmitting}
            loading={isSubmitting}
          >
            Submit Receipt
          </BlockButton>
        </>
      }
    >
      <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)] text-mc-text">
        <PaymentInstructions
          amountInr={paymentConfig?.amountInr}
          uploadStep="Upload the receipt PDF below, then wait for verification before registering"
        />

        <div className="grid gap-[var(--mc-unit)] sm:grid-cols-2">
          <BlockSelect
            label="Payment method"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value as "upi" | "neft" | "gateway")}
          >
            <option value="upi">UPI</option>
            <option value="neft">NEFT / bank transfer</option>
            <option value="gateway">Payment gateway</option>
          </BlockSelect>
          <BlockInput
            label="UTR / transaction reference"
            value={transactionReference}
            onChange={(event) => setTransactionReference(event.target.value)}
            placeholder="e.g. 123456789012"
            autoComplete="off"
            hint="Required and must match the receipt."
          />
        </div>

        <div>
          <h3 className="font-pixel text-[12px] uppercase text-mc-success mb-[var(--mc-unit)]">
            Upload Receipt
          </h3>
          <div
            className={cn(
              "flex flex-col items-center justify-center p-[calc(var(--mc-unit)*2)]",
              "bg-mc-slot bevel-inset border-2 border-dashed border-mc-border",
              "cursor-pointer hover:brightness-110 transition-all",
            )}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            {file ? (
              <div className="text-center">
                <p className="text-mc-success text-[16px] break-all">
                  📄 {file.name}
                </p>
                <p className="text-mc-text-dim text-[14px] mt-1">
                  Click or drag to change file
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[16px]">Click or drag & drop a PDF file here</p>
                <p className="text-mc-text-dim text-[14px] mt-1">Max file size: 5MB</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </BlockModal>
  );
}
