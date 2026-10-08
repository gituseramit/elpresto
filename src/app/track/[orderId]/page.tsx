import { redirect } from "next/navigation";

export default async function TrackOrderByIdPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  redirect(`/track?orderId=${encodeURIComponent(orderId)}`);
}
