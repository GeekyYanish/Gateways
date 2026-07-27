import { WorldScreen } from "@/frontend/screens/realm/world-screen";

export const metadata = { title: "World Spawn — Fest Realm" };

export default async function WorldPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[];
    location?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rawView = Array.isArray(params.view) ? params.view[0] : params.view;
  const rawLocation = Array.isArray(params.location)
    ? params.location[0]
    : params.location;
  const initialView =
    rawView === "3d" || rawView === "map" || rawView === "list"
      ? rawView
      : undefined;

  return (
    <WorldScreen initialView={initialView} initialLocation={rawLocation} />
  );
}
