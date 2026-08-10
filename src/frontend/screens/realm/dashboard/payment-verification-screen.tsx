"use client";

import { useState } from "react";
import { BlockPanel, BlockButton, BlockModal, showToast } from "@/frontend/components/mc";
import { useSession } from "@/frontend/components/auth/session-provider";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";
import { PaymentReceipt } from "@/backend/data/types";
import { cn } from "@/frontend/lib/utils";

export function PaymentVerificationScreen() {
  const { session } = useSession();
  const adminUserId = session?.userId;
  
  const { data: receipts, loading, reload } = useAsync(
    () => repo.paymentReceipts.listPending(),
    []
  );

  if (loading) {
    return <div className="p-[var(--mc-unit)] text-mc-text-dim">Loading pending receipts...</div>;
  }

  return (
    <div className="flex flex-col gap-[var(--mc-unit)] w-full">
      <h1 className="font-pixel text-[16px] uppercase text-mc-text mb-[calc(var(--mc-unit)*2)]">
        Verify Payments
      </h1>
      
      {!receipts || receipts.length === 0 ? (
        <BlockPanel variant="slot" className="text-center p-[calc(var(--mc-unit)*2)]">
          <p className="text-mc-text-dim">No pending payments to verify.</p>
        </BlockPanel>
      ) : (
        <div className="grid gap-[var(--mc-unit)]">
          {receipts.map(receipt => (
            <ReceiptCard 
              key={receipt.id} 
              receipt={receipt} 
              adminUserId={adminUserId} 
              onReviewed={reload} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReceiptCard({ 
  receipt, 
  adminUserId, 
  onReviewed 
}: { 
  receipt: PaymentReceipt, 
  adminUserId: string | undefined, 
  onReviewed: () => void 
}) {
  const { data: event } = useAsync(() => repo.events.getById(receipt.eventId), [receipt.eventId]);
  const { data: character } = useAsync(() => repo.characters.getByUser(receipt.userId), [receipt.userId]);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async () => {
    if (!adminUserId) return;
    setIsSubmitting(true);
    try {
      await repo.paymentReceipts.review(receipt.id, 'verified', adminUserId);
      showToast({ title: "Receipt Verified", severity: "success" });
      onReviewed();
    } catch (e) {
      showToast({ title: "Error verifying receipt", severity: "critical" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!adminUserId || !rejectNote.trim()) return;
    setIsSubmitting(true);
    try {
      await repo.paymentReceipts.review(receipt.id, 'rejected', adminUserId, rejectNote);
      showToast({ title: "Receipt Rejected", severity: "warning" });
      setRejectModalOpen(false);
      onReviewed();
    } catch (e) {
      showToast({ title: "Error rejecting receipt", severity: "critical" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPdf = () => {
    // Assuming fileData is a full base64 data URL
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`<iframe src="${receipt.fileData}" width="100%" height="100%" style="border:none;"></iframe>`);
    }
  };

  return (
    <BlockPanel variant="panel" padded="md" className="flex flex-col md:flex-row md:items-center justify-between gap-[var(--mc-unit)]">
      <div className="flex flex-col gap-[calc(var(--mc-unit)*0.5)]">
        <p className="font-pixel text-[12px] text-mc-success">
          {event ? event.title : "Loading event..."}
        </p>
        <p className="text-[16px] text-mc-text-dim">
          Player: <span className="text-mc-text">{character ? character.playerName : "Loading..."}</span>
        </p>
        <p className="text-[14px] text-mc-text-dim">
          Submitted: {new Date(receipt.submittedAt).toLocaleString()}
        </p>
        <p className="text-[14px] text-mc-text-dim">
          File: {receipt.fileName} ({(receipt.fileSizeBytes / 1024).toFixed(1)} KB)
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-[var(--mc-unit)] mt-[var(--mc-unit)] md:mt-0">
        <BlockButton variant="stone" size="sm" onClick={openPdf}>
          View PDF
        </BlockButton>
        <BlockButton variant="emerald" size="sm" onClick={handleApprove} disabled={isSubmitting}>
          Approve
        </BlockButton>
        <BlockButton variant="danger" size="sm" onClick={() => setRejectModalOpen(true)} disabled={isSubmitting}>
          Reject
        </BlockButton>
      </div>

      <BlockModal
        open={rejectModalOpen}
        onOpenChange={setRejectModalOpen}
        title="Reject Receipt"
        footer={
          <>
            <BlockButton variant="ghost" onClick={() => setRejectModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </BlockButton>
            <BlockButton 
              variant="danger" 
              onClick={handleReject} 
              disabled={!rejectNote.trim() || isSubmitting} 
              loading={isSubmitting}
            >
              Confirm Reject
            </BlockButton>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--mc-unit)]">
          <p className="text-[16px] text-mc-text">Please provide a reason for rejecting this payment receipt:</p>
          <textarea 
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            className="bg-mc-slot text-mc-text border-2 border-mc-border p-[var(--mc-unit)] w-full h-[100px] font-body text-[16px] focus:outline-none focus:border-mc-portal-light bevel-inset"
            placeholder="E.g., Receipt is blurry, transaction ID missing..."
          />
        </div>
      </BlockModal>
    </BlockPanel>
  );
}
