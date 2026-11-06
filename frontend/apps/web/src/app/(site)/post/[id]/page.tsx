import { redirect } from 'next/navigation';

export default async function PostAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/posts/${id}`);
}
