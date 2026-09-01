import { redirect } from 'next/navigation';

export default async function GigLegacyReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/app/gigs/${id}/review`);
}
