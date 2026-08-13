import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-mc-void p-8 text-center text-mc-text">
      <div><h1 className="text-mc-accent text-lg">404 — Lost in the realm</h1><p className="mt-4 text-mc-text-dim">That page does not exist.</p><Link className="mt-6 inline-block text-mc-eyebrow underline" href="/">Return home</Link></div>
    </main>
  );
}
