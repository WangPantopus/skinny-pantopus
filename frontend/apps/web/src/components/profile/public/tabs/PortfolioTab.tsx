import Image from 'next/image';

interface PortfolioItem {
  image_url?: string;
  title?: string;
  description?: string;
}

interface PortfolioTabProps {
  profile: Record<string, unknown> & { portfolio?: PortfolioItem[] };
}

export default function PortfolioTab({ profile }: PortfolioTabProps) {
  if (!profile.portfolio || profile.portfolio.length === 0) {
    return (
      <div className="text-center py-12 bg-surface rounded-xl border border-app">
        <div className="text-6xl mb-4">🎨</div>
        <h3 className="text-lg font-semibold text-app mb-2">No portfolio items</h3>
        <p className="text-app-secondary">This user hasn&apos;t added any portfolio items yet.</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {profile.portfolio.map((item: PortfolioItem, i: number) => (
        <div key={i} className="bg-surface rounded-xl border border-app overflow-hidden">
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
