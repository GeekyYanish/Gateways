import { redirect } from "next/navigation";

/**
 * `/dashboard` is still the destination of a great many links — the realm
 * guard's `?next=`, the world map's Village Square, the login redirect — so it
 * cannot simply be deleted along with the Inventory screen it used to render.
 * It forwards to Profile instead, which is the new first item in the sidebar.
 */
export default function DashboardPage() {
  redirect("/dashboard/profile");
}
