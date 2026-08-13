"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0710", color: "#f4eef8", fontFamily: "system-ui" }}>
        <main style={{ maxWidth: 560, padding: 32, textAlign: "center" }}>
          <h1>Gateways is temporarily unavailable</h1>
          <p>The failure was not replaced with sample data. Please retry once the live service is available.</p>
          <button type="button" onClick={reset} style={{ padding: "10px 16px", cursor: "pointer" }}>Retry</button>
        </main>
      </body>
    </html>
  );
}
