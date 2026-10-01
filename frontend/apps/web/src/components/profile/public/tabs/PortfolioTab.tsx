import Image from 'next/image';

/** One portfolio item as the profile shows it (see toPortfolioEntries in PublicProfileClient). */
export interface PortfolioEntry {
  id: string;
  image_url?: string;
  title?: string;
  description?: string;
}

interface PortfolioTabProps {
  /** The public portfolio; null while it loads. */
  items: PortfolioEntry[] | null;
  failed?: boolean;
  isOwner?: boolean;
}

export default function PortfolioTab({ items, failed = false, isOwner = false }: PortfolioTabProps) {
  if (!items) {
    return (
      <div className="text-center py-12 bg-surface rounded-xl border border-app">
        {failed ? (
          <>
            <h3 className="text-lg font-semibold text-app mb-2">Couldn&apos;t load the portfolio</h3>
            <p className="text-app-secondary">Check your connection and try again.</p>
          </>
        ) : (
          <p className="text-app-secondary">Loading portfolio…</p>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-surface rounded-xl border border-app">
        <div className="text-6xl mb-4">🎨</div>
        <h3 className="text-lg font-semibold text-app mb-2">No portfolio items</h3>
        <p className="text-app-secondary">
          {isOwner
            ? 'Add photos of your work from the Portfolio tab of your profile in the Pantopus app.'
            : "This user hasn't added any portfolio items yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {items.map((item) => (
        <div key={item.id} className="bg-surface rounded-xl border border-app overflow-hidden">
          {item.image_url && (
            <Image src={item.image_url} alt={item.title || ''} width={600} height={192} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" quality={80} className="w-full h-48 object-cover" />
          )}
          <div className="p-4">
            <h4 className="font-semibold text-app mb-1">{item.title}</h4>
            <p className="text-sm text-app-secondary">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
