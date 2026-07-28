import { Suspense } from "react";
import { LoadingScreen } from "@/frontend/components/mc";
import { EventsScreen } from "@/frontend/screens/public/events/events-screen";

export const metadata = { title: "Events — Parallax" };

export default function EventsPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<LoadingScreen label="Loading events" />}>
      <EventsScreen />
    </Suspense>
  );
}
