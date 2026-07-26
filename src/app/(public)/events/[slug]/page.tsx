import { EventDetailScreen } from "./event-detail-screen";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <EventDetailScreen slug={slug} />;
}
