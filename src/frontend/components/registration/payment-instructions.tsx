/**
 * The how-to-pay steps, shared by the receipt upload modal and the standalone
 * info modal on the events list. There is no payment gateway — the fee is paid
 * on the university portal and proved with a PDF receipt, so these steps are
 * the whole payment UX and must read identically wherever they appear.
 *
 * Only the final step differs: inside the upload modal the dropzone is right
 * there, elsewhere the student has to go find their held seat first.
 */
export function PaymentInstructions({
  uploadStep = "Upload the receipt PDF below, then register once it is verified",
  amountInr = 250,
}: {
  uploadStep?: React.ReactNode;
  amountInr?: number;
}) {
  return (
    <div>
      <h3 className="mb-[var(--mc-unit)] font-pixel text-[12px] uppercase text-mc-success">
        Instructions
      </h3>
      <ol className="list-inside list-decimal space-y-[calc(var(--mc-unit)*0.5)] text-[16px]">
        <li>
          Visit the payment portal at{" "}
          <a
            href="https://christuniversity.in/online-payment-portal"
            target="_blank"
            rel="noopener noreferrer"
            className="text-mc-eyebrow underline"
          >
            https://christuniversity.in/online-payment-portal
          </a>
        </li>
        <li>Select &quot;Gateways&quot; from the event list</li>
        <li>Complete the single fest-wide participant pass payment of ₹{amountInr.toLocaleString("en-IN")}</li>
        <li>Download/print the payment receipt as PDF</li>
        <li>{uploadStep}</li>
      </ol>
    </div>
  );
}
