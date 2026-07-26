import { MotionConfig } from "framer-motion";
import { SessionProvider } from "@/components/auth/session-provider";
import { BlockToaster } from "@/components/mc";

/**
 * Public pages: events, event details, leaderboard, schedule, sponsors.
 *
 * These deliberately do NOT require an account. A fest site whose event list is
 * behind a login cannot be shared, cannot be linked from social media, and gives
 * a prospective attendee nothing to look at before committing to a signup.
 *
 * SessionProvider is still mounted — not to gate anything, but so signed-in
 * visitors get the personalised touches (their own row highlighted on the
 * leaderboard, a register button instead of a prompt).
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <MotionConfig reducedMotion="user">
        {children}
        <BlockToaster />
      </MotionConfig>
    </SessionProvider>
  );
}
