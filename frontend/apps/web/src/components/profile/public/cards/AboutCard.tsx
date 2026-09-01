import InfoLine from '../atoms/InfoLine';
import InfoRow from '../atoms/InfoRow';
import { homePlaceText, type ResidencyPayload } from '../ResidencyHomeBlock';

interface AboutCardProps {
  profile: Record<string, unknown>;
  residency?: ResidencyPayload | null;
}

export default function AboutCard({ profile, residency }: AboutCardProps) {
  const gigsCompleted = typeof profile.gigs_completed === 'number' ? profile.gigs_completed : 0;
  const gigsPosted = typeof profile.gigs_posted === 'number' ? profile.gigs_posted : 0;
  const bio = typeof profile.bio === 'string' && profile.bio.length > 0 ? profile.bio : 'No bio added yet.';
  const website = typeof profile.website === 'string' ? profile.website : '';
  const createdAt = typeof profile.created_at === 'string'
    ? profile.created_at
    : typeof profile.createdAt === 'string'
      ? profile.createdAt
      : undefined;
  const joinedLabel = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Unknown';

  const workType = gigsCompleted > 0 && gigsPosted > 0
    ? 'Worker & Poster'
    : gigsCompleted > 0
      ? 'Worker'
      : gigsPosted > 0
        ? 'Poster'
        : 'Member';

  return (
    <div className="bg-surface rounded-xl border border-app p-5">
      <h3 className="text-lg font-semibold text-app mb-3">About</h3>
      <p className="text-sm text-app-secondary leading-6">{bio}</p>
      <div className="mt-4 space-y-2 text-sm">
        <InfoLine label="Home" value={homePlaceText(residency ?? undefined)} />
        <InfoLine label="Member since" value={joinedLabel} />
        <InfoLine label="Work type" value={workType} />
        {website && <InfoRow icon="🌐" label="Website" value={website} link />}
      </div>
    </div>
  );
}
