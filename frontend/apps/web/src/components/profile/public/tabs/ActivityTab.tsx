interface ActivityTabProps {
  gigs: Record<string, unknown>[];
  posts: Record<string, unknown>[];
  reviews: Record<string, unknown>[];
  loading: boolean;
}

function audienceLabel(audience: unknown): string {
  if (audience === 'followers') return 'Followers';
  if (audience === 'connections') return 'Connections';
  if (audience === 'nearby') return 'Nearby';
  return 'Post';
}

export default function ActivityTab({ gigs, posts, reviews, loading }: ActivityTabProps) {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        <p className="mt-4 text-app-secondary">Loading activity...</p>
      </div>
    );
  }

  const items = [
    ...posts.slice(0, 8).map((post) => ({
      id: `post-${post.id}`,
      type: 'Post',
      title: String(post.title || post.content || 'Shared a post'),
      sub: `${audienceLabel(post.audience)} • ${String(post.post_type || 'update').replace(/_/g, ' ')}`,
      date: String(post.created_at || ''),
    })),
    ...gigs.slice(0, 6).map((gig) => ({
      id: `gig-${gig.id}`,
      type: 'Mission',
      title: String(gig.title || 'Mission'),
      sub: `${String(gig.category || 'General')} • ${String(gig.status || 'open').toUpperCase()}`,
      date: String(gig.created_at || ''),
    })),
    ...reviews.slice(0, 6).map((review) => ({
      id: `review-${review.id}`,
      type: 'Review',
      title: `${String(review.reviewer_name || 'Someone')} left a review`,
      sub: `${String(review.rating || 0)} ★`,
      date: String(review.created_at || ''),
    })),
  ].sort((a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime());

  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-surface rounded-xl border border-app">
        <div className="text-6xl mb-4">🕰️</div>
        <h3 className="text-lg font-semibold text-app mb-2">No activity yet</h3>
        <p className="text-app-secondary">Recent posts, mission updates, and reviews will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-app p-5 space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-app p-3">
          <p className="text-xs uppercase tracking-wide text-app-secondary">{item.type}</p>
          <p className="text-sm font-medium text-app mt-1">{item.title}</p>
          <p className="text-xs text-app-secondary mt-1">{item.sub} • {new Date(item.date).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}
