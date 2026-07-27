import { notFound } from "next/navigation";
import { KitchenSink } from "@/frontend/screens/dev/kitchen-sink";

/**
 * Dev-only design-system showcase.
 *
 * Gated on NODE_ENV so it never ships in a production build — it is an internal
 * review surface, not a page for fest attendees.
 */
export default function KitchenSinkPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <KitchenSink />;
}
