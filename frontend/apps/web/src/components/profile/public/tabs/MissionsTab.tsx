import { useRouter } from 'next/navigation';

interface MissionsTabProps {
  gigs: Record<string, unknown>[];
  loading: boolean;
  completedCount: number;
  postedCount: number;
}

function stringField(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export default function MissionsTab({ gigs, loading, completedCount, postedCount }: MissionsTabProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        <p className="mt-4 text-app-secondary">Loading missions...</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-surface rounded-xl border border-app p-5">
        <h3 className="font-semibold text-app mb-1">As Worker</h3>
        <p className="text-2xl font-bold text-app">{completedCount}</p>
        <p className="text-sm text-app-secondary">Completed missions</p>
      </div>
      <div className="bg-surface rounded-xl border border-app p-5">
        <h3 className="font-semibold text-app mb-1">As Poster</h3>
        <p className="text-2xl font-bold text-app">{postedCount}</p>
        <p className="text-sm text-app-secondary">Posted missions</p>
      </div>

      <div className="md:col-span-2 bg-surface rounded-xl border border-app p-5">
        <h4 className="font-semibold text-app mb-3">Recent mission posts</h4>
        {gigs.length === 0 ? (
          <p className="text-sm text-app-secondary">No mission history yet.</p>
        ) : (
          <div className="space-y-2">
            {gigs.slice(0, 6).map((gig, index) => {
              const id = stringField(gig.id, `mission-${index}`);
              const title = stringField(gig.title, 'Untitled mission');
              const category = stringField(gig.category, 'General');
              const createdAt = stringField(gig.created_at);
              const status = stringField(gig.status, 'open');

              return (
              <button
                key={id}
                onClick={() => router.push(`/app/gigs/${id}`)}
                className="w-full text-left rounded-lg border border-app p-3 hover:bg-surface-raised"
              >
                <p className="text-sm font-medium text-app">{title}</p>
                <p className="text-xs text-app-secondary mt-1">
                  {category} • {createdAt ? new Date(createdAt).toLocaleDateString() : 'Unknown date'} • {status.toUpperCase()}
                </p>
              </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
