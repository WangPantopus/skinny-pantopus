import TrustChip from '../atoms/TrustChip';

interface OwnerInsightsTabProps {
  profile: Record<string, unknown>;
  displayReviewCount: number;
  displayRating: number;
}

function numberField(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

export default function OwnerInsightsTab({ profile, displayReviewCount, displayRating }: OwnerInsightsTabProps) {
  const profileStrength = [
    profile.bio,
    profile.profile_picture_url,
    Array.isArray(profile.skills) && profile.skills.length > 0,
    Array.isArray(profile.services) && profile.services.length > 0,
    Array.isArray(profile.portfolio) && profile.portfolio.length > 0,
  ].filter(Boolean).length;

  const percent = Math.round((profileStrength / 5) * 100);

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-app p-5">
        <h3 className="text-lg font-semibold text-app">Profile Strength</h3>
        <p className="text-3xl font-bold text-app mt-1">{percent}%</p>
        <p className="text-sm text-app-secondary mt-1">Complete the next items to improve conversion.</p>
        <ul className="mt-3 text-sm text-app-secondary space-y-1">
          <li>• Add 1–3 featured services</li>
          <li>• Add at least 3 skills</li>
          <li>• Add one portfolio highlight</li>
          <li>• Set availability details</li>
        </ul>
      </div>
      <div className="bg-surface rounded-xl border border-app p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <TrustChip title="Rating" value={displayReviewCount > 0 ? displayRating.toFixed(1) : 'New'} detail={`${displayReviewCount} reviews`} />
        <TrustChip title="Followers" value={numberField(profile.followers_count)} detail="community reach" />
        <TrustChip title="Completed" value={numberField(profile.gigs_completed)} detail="as worker" />
        <TrustChip title="Posted" value={numberField(profile.gigs_posted)} detail="as poster" />
      </div>
    </div>
  );
}
