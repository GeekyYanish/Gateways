import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/frontend/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fest Realm — Another World Awaits",
  description:
    "A Minecraft-inspired college fest portal. Create your adventurer, explore the realm, and register for events.",
};

export const viewport: Viewport = {
  themeColor: "#0b0710",
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom is deliberately left enabled — disabling it is an accessibility
  // failure. The world map handles its own gestures without blocking the page.
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fontVariables} h-full`}>
      <body className="min-h-full flex flex-col bg-mc-void text-mc-text">
        {children}
      </body>
    </html>
  );
}
