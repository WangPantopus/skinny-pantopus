type PublicShareMediaProps = {
  images: string[];
  heroAlt: string;
};

/**
 * Hero + thumbnail grid for public gig/listing share pages (server-rendered).
 */
export default function PublicShareMedia({ images, heroAlt }: PublicShareMediaProps) {
  if (images.length === 0) return null;

  const [hero, ...rest] = images;

  return (
    <div className="w-full bg-surface-muted">
      <div className="aspect-[16/9] w-full">
        <img src={hero} alt={heroAlt} className="h-full w-full object-cover" />
      </div>
      {rest.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
          {rest.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="aspect-video overflow-hidden rounded-xl bg-surface-muted"
            >
              <img
                src={src}
                alt={`${heroAlt} — image ${i + 2}`}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
