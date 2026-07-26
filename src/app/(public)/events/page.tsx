import { Suspense } from "react";
import { LoadingScreen } from "@/components/mc";
import { EventsScreen } from "./events-screen";

export const metadata = { title: "Events — Fest Realm" };

export default function EventsPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<LoadingScreen label="Loading events" />}>
      <EventsScreen />
    </Suspense>
  );
}
