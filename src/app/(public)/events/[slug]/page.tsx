import { EventDetailScreen } from "@/frontend/screens/public/events/event-detail-screen";

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fromCategory?: string | string[] }>;
}) {
  const { slug } = await params;
  const source = (await searchParams).fromCategory;
  const fromCategory = Array.isArray(source) ? source[0] : source;

  return <EventDetailScreen slug={slug} fromCategory={fromCategory} />;
}
