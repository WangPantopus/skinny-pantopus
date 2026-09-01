import Image from 'next/image';
import UserIdentityLink from '@/components/user/UserIdentityLink';

interface NormalizedService {
  id: string;
  name: string;
  promise: string;
  price: number | string | null;
  availability: string;
}

interface PortfolioItem {
  image_url?: string;
  title?: string;
  description?: string;
}

interface ProfileData {
  portfolio?: PortfolioItem[];
  skills?: string[];
  services?: NormalizedService[];
  bio?: string;
  profile_picture_url?: string;
  followers_count?: number;
  gigs_completed?: number;
  gigs_posted?: number;
  [key: string]: unknown;
}

function PortfolioPreview({ profile }: { profile: ProfileData }) {
  if (!Array.isArray(profile.portfolio) || profile.portfolio.length === 0) {
    return <p className="text-sm text-app-secondary">No portfolio highlights yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {profile.portfolio.slice(0, 6).map((item: PortfolioItem, i: number) => (
        <div key={i} className="aspect-[4/3] rounded-lg overflow-hidden bg-surface-muted border border-app">
          {item.image_url ? (
            <Image src={item.image_url} alt={item.title || `Portfolio ${i + 1}`} width={400} height={300} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" quality={80} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-app-muted text-xs px-2 text-center">{item.title || 'Portfolio item'}</div>
          )}
        </div>
      ))}
    </div>
  );
}

interface ReviewData {
  id: string;
  rating: number;
  comment?: string;
  reviewer?: {
    id?: string;
    username?: string;
    profile_picture_url?: string;
  };
  reviewer_username?: string;
  reviewer_name?: string;
  reviewer_avatar?: string;
  [key: string]: unknown;
}

interface GigData {
  id: string;
  title?: string;
  category?: string;
  created_at?: string;
  status?: string;
  [key: string]: unknown;
}

interface OverviewTabProps {
  profile: ProfileData;
  services: NormalizedService[];
  skills: string[];
  reviews: ReviewData[];
  userGigs: GigData[];
  gigsLoading: boolean;
  onRequest: () => void;
  onSkillRequest: () => void;
  onViewPortfolio: () => void;
}

export default function OverviewTab({
  profile,
  services,
  skills,
  reviews,
  userGigs,
  gigsLoading,
  onRequest,
  onSkillRequest,
  onViewPortfolio,
}: OverviewTabProps) {
  const previewReviews = reviews.slice(0, 2);
  const activityPreview = userGigs.slice(0, 2);

  return (
    <div className="space-y-5">
      <section className="bg-surface rounded-xl border border-app p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-app">Featured Services</h3>
        </div>
        {services.length === 0 ? (
          <div className="rounded-lg border border-dashed border-app-strong p-4 text-sm text-app-secondary">
            <p className="mb-3">No services listed yet. Visitors can still request help directly.</p>
            <button onClick={onRequest} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium">Request help</button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {services.map((service) => (
              <div key={service.id} className="rounded-lg border border-app p-4 bg-surface-muted">
                <p className="font-semibold text-app">{service.name}</p>
                <p className="text-sm text-app-secondary mt-1 line-clamp-2">{service.promise}</p>
                <p className="text-sm text-app-strong mt-2 font-medium">
                  {service.price ? `From $${service.price}` : 'Pricing on request'}
                </p>
                <p className="text-xs text-app-secondary mt-1 line-clamp-1">{service.availability}</p>
                <button onClick={onRequest} className="mt-3 w-full px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium">Request this</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-surface rounded-xl border border-app p-5">
        <h3 className="text-lg font-semibold text-app mb-3">Skills</h3>
        <div className="flex flex-wrap gap-2">
          {skills.slice(0, 6).map((skill, index) => (
            <button
              key={`${skill}-${index}`}
              onClick={onSkillRequest}
              className="px-3 py-1.5 rounded-full bg-surface-muted text-app-strong text-sm border border-app hover:bg-surface-muted"
            >
              {skill}
              {index < 3 && <span className="ml-1 text-[10px] text-app-secondary">Featured</span>}
            </button>
          ))}
          {skills.length === 0 && <p className="text-sm text-app-secondary">No skills listed yet.</p>}
        </div>
      </section>

      <section className="bg-surface rounded-xl border border-app p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-app">Portfolio highlights</h3>
          <button onClick={onViewPortfolio} className="text-sm text-primary-600">View all</button>
        </div>
        <PortfolioPreview profile={profile} />
      </section>

      <section className="bg-surface rounded-xl border border-app p-5">
        <h3 className="text-lg font-semibold text-app mb-3">Reviews preview</h3>
        {previewReviews.length === 0 ? (
          <div className="rounded-lg border border-dashed border-app-strong p-4 text-sm text-app-secondary">
            No reviews yet. Hire to be the first to review.
          </div>
        ) : (
          <div className="space-y-3">
            {previewReviews.map((review) => (
              <div key={review.id} className="rounded-lg border border-app p-3 bg-surface-muted">
                <div className="flex items-center justify-between">
                  <UserIdentityLink
                    userId={review.reviewer?.id}
                    username={review.reviewer_username || review.reviewer?.username}
                    displayName={review.reviewer_name || 'Anonymous'}
                    avatarUrl={review.reviewer_avatar || review.reviewer?.profile_picture_url}
                    textClassName="font-medium text-app hover:text-primary-600"
                  />
                  <p className="text-amber-500 text-sm">{'★'.repeat(review.rating || 0)}</p>
                </div>
                {review.comment && <p className="text-sm text-app-secondary mt-1 line-clamp-2">{review.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-surface rounded-xl border border-app p-5">
        <h3 className="text-lg font-semibold text-app mb-3">Activity preview</h3>
        {gigsLoading ? (
          <p className="text-sm text-app-secondary">Loading recent activity...</p>
        ) : activityPreview.length === 0 ? (
          <p className="text-sm text-app-secondary">No recent activity yet.</p>
        ) : (
          <div className="space-y-2">
            {activityPreview.map((gig) => (
              <div key={gig.id} className="rounded-lg border border-app p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-app">{gig.title}</p>
                  <p className="text-xs text-app-secondary">{gig.category || 'General'} • {gig.created_at ? new Date(gig.created_at).toLocaleDateString() : 'Unknown date'}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-surface-muted text-app-secondary">{(gig.status || 'open').toUpperCase()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
