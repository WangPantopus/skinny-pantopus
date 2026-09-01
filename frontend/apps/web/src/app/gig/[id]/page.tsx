import { redirect } from 'next/navigation';

export default async function GigAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/gigs/${id}`);
}
