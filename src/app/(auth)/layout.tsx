import { SessionProvider } from "@/frontend/components/auth/session-provider";
import { BackLink } from "@/frontend/components/mc";
import { AnimatedBackground } from "@/frontend/components/scene";

/**
 * Auth screens sit on the "realm-gate" scene — deliberately the quietest one in
 * the set, and at reduced intensity, because a busy parallax behind a login form
 * fights the thing the user is actually trying to do.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AnimatedBackground
        scene="realm-gate"
        intensity={0.5}
        className="flex flex-1 flex-col p-[var(--mc-unit)] sm:p-[calc(var(--mc-unit)*2)]"
      >
        <div className="relative z-20 mx-auto flex w-full max-w-6xl flex-1 flex-col">
          <BackLink href="/" label="Home" className="shrink-0 self-start" />
          <div className="flex flex-1 items-center justify-center py-[calc(var(--mc-unit)*1.5)] sm:py-[calc(var(--mc-unit)*2)]">
            {children}
          </div>
        </div>
      </AnimatedBackground>
    </SessionProvider>
  );
}
