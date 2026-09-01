import type { Metadata } from 'next';
import {
  buildShareMetadata,
  displayNameForUser,
  fetchPublicUser,
  normalizePublicProfileIdentifier,
  summarizeText,
} from '@/lib/publicShare';
import { buildUserProfilePath, buildUserProfileShareUrl } from '@pantopus/utils';
import PublicProfileClient from './PublicProfileClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const normalizedUsername = normalizePublicProfileIdentifier(username);
  const result = await fetchPublicUser(normalizedUsername);
  const profile = result.data;

  if (!profile) {
    return {
      title: 'Profile Not Found | Pantopus',
      description: 'This Pantopus profile could not be found.',
    };
  }

  const fullName = displayNameForUser(profile, profile.username || 'Pantopus member');
  const bioSource = typeof profile.bio === 'string' ? profile.bio : '';

  return buildShareMetadata({
    title: fullName,
    description: summarizeText(
      bioSource,
      160,
      `${fullName} on Pantopus. Connect, message, and see their work.`,
    ),
    path: buildUserProfilePath(normalizedUsername),
    appArgument: buildUserProfileShareUrl(normalizedUsername),
    images: profile.profile_picture_url ? [profile.profile_picture_url] : null,
  });
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const normalizedUsername = normalizePublicProfileIdentifier(username);
  const result = await fetchPublicUser(normalizedUsername);

  return (
    <PublicProfileClient username={normalizedUsername} initialProfile={result.data} />
  );
}
