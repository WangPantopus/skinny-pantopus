import { redirect } from 'next/navigation';

export default async function GigNewLegacyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry != null) query.append(key, entry);
      }
      continue;
    }
    if (value != null) query.set(key, value);
  }

  const queryString = query.toString();
  redirect(queryString ? `/app/gigs/new?${queryString}` : '/app/gigs-v2/new');
}
