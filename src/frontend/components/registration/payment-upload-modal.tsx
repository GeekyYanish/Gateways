"use client";

import { useState, useRef } from "react";
import { BlockModal, BlockButton, showToast } from "@/frontend/components/mc";
import { useSession } from "@/frontend/components/auth/session-provider";
import { repo } from "@/backend/data";
import { cn } from "@/frontend/lib/utils";

export interface PaymentUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  registrationId: string;
  onSuccess: () => void;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!file || !userId) return;

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
      });

      showToast({
        title: "Receipt Uploaded",
        body: "Your payment receipt has been submitted for verification.",
        severity: "success",
      });

      onSuccess();
      onOpenChange(false);
    } catch {
      showToast({
        title: "Upload Failed",
        body: "There was an error submitting your receipt. Please try again.",
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
      title="Upload Payment Receipt"
      description="Upload your payment receipt to complete registration"
      footer={
        <>
          <BlockButton variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </BlockButton>
          <BlockButton
            variant="emerald"
            onClick={handleSubmit}
            disabled={!file || isSubmitting}
            loading={isSubmitting}
          >
            Submit Receipt
          </BlockButton>
        </>
      }
    >
      <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)] text-mc-text">
        <div>
          <h3 className="font-pixel text-[12px] uppercase text-mc-success mb-[var(--mc-unit)]">
            Instructions
          </h3>
          <ol className="list-decimal list-inside space-y-[calc(var(--mc-unit)*0.5)] text-[16px]">
            <li>Visit the payment portal at <a href="https://christuniversity.in/online-payment-portal" target="_blank" rel="noopener noreferrer" className="text-mc-eyebrow underline">https://christuniversity.in/online-payment-portal</a></li>
            <li>Select &ldquo;Gateways&rdquo; from the event list</li>
            <li>Complete the payment for the event</li>
            <li>Download/print the payment receipt as PDF</li>
            <li>Upload the receipt PDF below</li>
          </ol>
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
