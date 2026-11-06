import { redirect } from 'next/navigation';

export default async function ListingsAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/listing/${id}`);
}
