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
        className="flex flex-1 flex-col items-center justify-center p-[calc(var(--mc-unit)*2)]"
      >
        <BackLink
          href="/"
          label="Home"
          className="absolute left-[calc(var(--mc-unit)*2)] top-[calc(var(--mc-unit)*2)] z-20"
        />
        {children}
      </AnimatedBackground>
    </SessionProvider>
  );
}
