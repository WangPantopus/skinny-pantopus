// @ts-nocheck
'use client';

/**
 * PublicBlockRenderer — renders blocks in the public-facing business profile.
 * Higher fidelity than the builder preview — this is what visitors see.
 */

import React from 'react';
import Image from 'next/image';

interface BlockData {
  id?: string;
  block_type: string;
  data: Record<string, any>;
  settings?: Record<string, any>;
  location_id?: string;
}

interface BusinessContext {
  locations: Record<string, any>[];
  hours: Record<string, any>[];
  catalog: Record<string, any>[];
  business: Record<string, any> | null;
  profile: Record<string, any> | null;
  onContact?: () => void | Promise<void>;
  canContact?: boolean;
}

export function PublicBlock({ block, ctx }: { block: BlockData; ctx: BusinessContext }) {
  const d = block.data || {};

  switch (block.block_type) {
    case 'hero':
      return <PublicHero data={d} business={ctx.business} ctx={ctx} />;
    case 'text':
      return <PublicText data={d} />;
    case 'gallery':
      return <PublicGallery data={d} />;
    case 'catalog_grid':
      return <PublicCatalogGrid data={d} catalog={ctx.catalog} />;
    case 'hours':
      return <PublicHours data={d} locations={ctx.locations} hours={ctx.hours} />;
    case 'locations_map':
      return <PublicLocationsMap data={d} locations={ctx.locations} />;
    case 'cta':
      return <PublicCta data={d} ctx={ctx} />;
    case 'faq':
      return <PublicFaq data={d} />;
    case 'reviews':
      return <PublicReviews data={d} business={ctx.business} />;
    case 'stats':
      return <PublicStats data={d} />;
    case 'team':
      return <PublicTeam data={d} />;
    case 'contact_form':
      return <PublicContactForm data={d} onContact={ctx.onContact} canContact={ctx.canContact} />;
    case 'divider':
      return <hr className="my-6 border-app-border" />;
    case 'embed':
      return <PublicEmbed data={d} />;
    case 'posts_feed':
      return <PublicPostsFeed data={d} />;
    default:
      return null; // Unknown blocks are hidden on public pages
  }
}


// ─── Button actions ───────────────────────────

/** An owner-entered link, only if it is a plain http(s) web address. */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

type CtaTarget = { href: string; external?: boolean } | { onClick: () => void | Promise<void> };

/**
 * Where a hero or CTA-block button goes, from the action picked in the page editor. A button whose target
 * is missing (no public phone, no mappable location, no valid link) isn't shown. Message, and any other
 * action (Book among them: public scheduling is not offered), opens the inquiry chat, as the CTA block did.
 */
function ctaTarget(c: Record<string, any>, ctx: BusinessContext): CtaTarget | null {
  const action = (c?.action as string) || (c?.url ? 'link' : 'message');
  const primary = (ctx.locations || []).find((l) => l.is_primary) || (ctx.locations || [])[0];
  if (action === 'call') {
    const phone = String(ctx.profile?.public_phone || primary?.phone || '').replace(/[^\d+]/g, '');
    return phone ? { href: `tel:${phone}` } : null;
  }
  if (action === 'directions') {
    // A home-based business's public point is deliberately approximate, so it gets no directions.
    const point = primary && !primary.is_home_based ? primary.location : null;
    return point?.latitude != null && point?.longitude != null
      ? { href: `https://maps.google.com/?q=${point.latitude},${point.longitude}`, external: true }
      : null;
  }
  if (action === 'link') {
    const href = safeHttpUrl(c?.url);
    return href ? { href, external: true } : null;
  }
  return ctx.onContact ? { onClick: ctx.onContact } : null;
}

function CtaButton({ target, className, children }: { target: CtaTarget; className: string; children: React.ReactNode }) {
  if ('href' in target) {
    return (
      <a
        href={target.href}
        className={`${className} text-center`}
        {...(target.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={() => void target.onClick()} className={className}>
      {children}
    </button>
  );
}

function actionableCtas(list: unknown, ctx: BusinessContext) {
  return (Array.isArray(list) ? list : [])
    .map((c: Record<string, any>) => ({ c, target: ctaTarget(c, ctx) }))
    .filter((x): x is { c: Record<string, any>; target: CtaTarget } => x.target !== null);
}


// ─── Public Block Components ──────────────────

function PublicHero({ data, business, ctx }: { data: Record<string, any>; business: Record<string, any> | null; ctx: BusinessContext }) {
  const ctas = actionableCtas(data.cta, ctx);
  return (
    <section className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white">
      {data.background_file_id && (
        <div className="absolute inset-0 bg-black/40" />
      )}
      <div className="relative z-10 px-8 py-16 md:py-24">
        <h1 className="text-3xl md:text-5xl font-bold leading-tight">
          {(data.headline as string) || (business?.name as string) || 'Welcome'}
        </h1>
        {data.subhead && (
          <p className="mt-3 text-lg md:text-xl text-white/80 max-w-2xl">{data.subhead as string}</p>
        )}
        {ctas.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            {ctas.map(({ c, target }, i: number) => (
              <CtaButton
                key={i}
                target={target}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
                  i === 0
                    ? 'bg-app-surface text-app-text hover:bg-app-hover'
                    : 'bg-glass/20 text-white hover:bg-glass/30 backdrop-blur-sm'
                }`}
              >
                {(c.label as string) || 'Learn More'}
              </CtaButton>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PublicText({ data }: { data: Record<string, any> }) {
  return (
    <section className="py-6">
      {data.heading && (
        <h2 className="text-2xl font-bold text-app-text mb-3">{data.heading as string}</h2>
      )}
      <div className="text-app-text-secondary leading-relaxed whitespace-pre-wrap">
        {(data.body as string) || ''}
      </div>
    </section>
  );
}

function PublicGallery({ data }: { data: Record<string, any> }) {
  const count = (data.image_count as number) || 6;
  return (
    <section className="py-6">
      {data.heading && (
        <h2 className="text-2xl font-bold text-app-text mb-4">{data.heading as string}</h2>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: Math.min(count, 9) }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-app-surface-sunken flex items-center justify-center">
            <svg className="w-8 h-8 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        ))}
      </div>
    </section>
  );
}

function PublicCatalogGrid({ data, catalog }: { data: Record<string, any>; catalog: Record<string, any>[] }) {
  let items = catalog || [];
  if (data.filter_kind) {
    items = items.filter((i) => i.kind === data.filter_kind);
  }
  const maxItems = (data.max_items as number) || 8;
  items = items.slice(0, maxItems);

  if (items.length === 0) return null;

  return (
    <section className="py-6">
      {data.heading && (
        <h2 className="text-2xl font-bold text-app-text mb-4">{data.heading as string}</h2>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.id as string} className="rounded-xl border border-app-border bg-app-surface overflow-hidden hover:shadow-md transition">
            {item.image_url && (
              <Image src={item.image_url as string} alt={item.name as string} className="w-full h-36 object-cover" width={400} height={144} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" quality={80} />
            )}
            {!item.image_url && (
              <div className="w-full h-24 bg-app-surface-sunken flex items-center justify-center">
                <span className="text-2xl">
                  {item.kind === 'menu_item' ? '🍽️' : item.kind === 'product' ? '📦' : '⚡'}
                </span>
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-app-text">{item.name as string}</h3>
                  {item.description && (
                    <p className="text-xs text-app-text-secondary mt-0.5 line-clamp-2">{item.description as string}</p>
                  )}
                </div>
                {item.price_cents != null && (
                  <span className="text-sm font-bold text-app-text whitespace-nowrap">
                    ${((item.price_cents as number) / 100).toFixed(2)}
                    {item.price_max_cents != null && ` – $${((item.price_max_cents as number) / 100).toFixed(2)}`}
                  </span>
                )}
              </div>
              {Array.isArray(item.tags) && item.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(item.tags as string[]).slice(0, 3).map((tag: string, i: number) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-app-surface-sunken text-app-text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PublicHours({ data, locations, hours }: { data: Record<string, any>; locations: Record<string, any>[]; hours: Record<string, any>[] }) {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const formatTime = (t: string | null) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  // Group hours by location
  const locationHoursMap: Record<string, Record<string, any>[]> = {};
  for (const h of hours) {
    const locId = h.location_id as string;
    if (!locationHoursMap[locId]) locationHoursMap[locId] = [];
    locationHoursMap[locId].push(h);
  }

  const locsWithHours = locations.filter((l) => locationHoursMap[l.id as string]?.length > 0);
  if (locsWithHours.length === 0 && hours.length === 0) return null;

  return (
    <section className="py-6">
      {data.heading && (
        <h2 className="text-2xl font-bold text-app-text mb-4">{data.heading as string}</h2>
      )}
      <div className="space-y-4">
        {locsWithHours.map((loc) => {
          const locHours = (locationHoursMap[loc.id as string] || []).sort((a, b) => (a.day_of_week as number) - (b.day_of_week as number));
          return (
            <div key={loc.id as string} className="rounded-xl border border-app-border bg-app-surface p-5">
              <h3 className="text-sm font-semibold text-app-text mb-3">{loc.label as string}</h3>
              <div className="space-y-1.5">
                {locHours.map((h) => (
                  <div key={h.id as string} className="flex justify-between text-sm">
                    <span className="text-app-text-strong font-medium">{DAY_NAMES[h.day_of_week as number]}</span>
                    <span className={h.is_closed ? 'text-red-500' : 'text-app-text-secondary'}>
                      {h.is_closed ? 'Closed' : `${formatTime(h.open_time as string | null)} – ${formatTime(h.close_time as string | null)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PublicLocationsMap({ data, locations }: { data: Record<string, any>; locations: Record<string, any>[] }) {
  if (locations.length === 0) return null;

  return (
    <section className="py-6">
      {data.heading && (
        <h2 className="text-2xl font-bold text-app-text mb-4">{data.heading as string}</h2>
      )}
      <div className="space-y-3">
        {locations.map((loc) => (
          <div key={loc.id as string} className="rounded-xl border border-app-border bg-app-surface p-5 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-app-text">{loc.label as string}</span>
                {loc.is_primary && (
                  <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                    Primary
                  </span>
                )}
              </div>
              <div className="text-sm text-app-text-secondary mt-0.5">{loc.address as string}</div>
              <div className="text-sm text-app-text-secondary">
                {[loc.city, loc.state, loc.zipcode].filter(Boolean).join(', ')}
              </div>
              {loc.phone && (
                <a href={`tel:${loc.phone as string}`} className="text-sm text-violet-600 hover:underline mt-1 inline-block">
                  {loc.phone as string}
                </a>
              )}
            </div>
            {loc.location && (
              <a
                href={`https://maps.google.com/?q=${(loc.location as Record<string, any>).latitude},${(loc.location as Record<string, any>).longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg border border-app-border text-xs font-medium text-app-text-secondary hover:bg-app-hover transition flex-shrink-0"
              >
                Directions
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function PublicCta({ data, ctx }: { data: Record<string, any>; ctx: BusinessContext }) {
  const buttons = actionableCtas(data.buttons, ctx);
  return (
    <section className="py-8 px-8 rounded-2xl bg-gradient-to-r from-violet-50 to-indigo-50 text-center">
      <h2 className="text-2xl font-bold text-app-text">{(data.heading as string) || 'Get in touch'}</h2>
      {data.subhead && <p className="text-app-text-secondary mt-2 max-w-lg mx-auto">{data.subhead as string}</p>}
      {buttons.length > 0 && (
        <div className="mt-5 flex justify-center gap-3">
          {buttons.map(({ c: b, target }, i: number) => (
            <CtaButton
              key={i}
              target={target}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
                i === 0
                  ? 'bg-violet-600 text-white hover:bg-violet-700'
                  : 'border border-app-border text-app-text-strong hover:bg-app-surface'
              }`}
            >
              {(b.label as string) || 'Button'}
            </CtaButton>
          ))}
        </div>
      )}
    </section>
  );
}

function PublicFaq({ data }: { data: Record<string, any> }) {
  const items = (data.items as Record<string, any>[]) || [];
  if (items.length === 0) return null;

  return (
    <section className="py-6">
      {data.heading && (
        <h2 className="text-2xl font-bold text-app-text mb-4">{data.heading as string}</h2>
      )}
      <div className="space-y-3">
        {items.map((item, i: number) => (
          <details key={i} className="group rounded-xl border border-app-border bg-app-surface">
            <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-app-text flex items-center justify-between list-none">
              <span>{(item.q as string) || 'Question'}</span>
              <svg className="w-4 h-4 text-app-text-muted group-open:rotate-180 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-5 pb-4 text-sm text-app-text-secondary leading-relaxed">
              {(item.a as string) || ''}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function PublicReviews({ data, business }: { data: Record<string, any>; business: Record<string, any> | null }) {
  const rating = (business?.average_rating as number) || 0;
  const count = (business?.review_count as number) || 0;

  return (
    <section className="py-6">
      {data.heading && (
        <h2 className="text-2xl font-bold text-app-text mb-4">{data.heading as string}</h2>
      )}
      <div className="rounded-xl border border-app-border bg-app-surface p-6">
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-app-text">{rating ? rating.toFixed(1) : '—'}</div>
          <div>
            <div className="text-yellow-500 text-xl">
              {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
            </div>
            <div className="text-sm text-app-text-secondary mt-0.5">
              {count > 0 ? `Based on ${count} review${count !== 1 ? 's' : ''}` : 'No reviews yet'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PublicStats({ data }: { data: Record<string, any> }) {
  const stats = (data.stats as Record<string, any>[]) || [];
  if (stats.length === 0) return null;

  return (
    <section className="py-8 px-6 rounded-2xl bg-app-surface-raised">
      <div className={`grid gap-6 text-center ${
        stats.length <= 3 ? `grid-cols-${stats.length}` : 'grid-cols-2 md:grid-cols-4'
      }`}>
        {stats.map((s, i: number) => (
          <div key={i}>
            <div className="text-3xl font-bold text-app-text">{s.value as string}</div>
            <div className="text-sm text-app-text-secondary mt-1">{s.label as string}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PublicTeam({ data }: { data: Record<string, any> }) {
  return (
    <section className="py-6">
      {data.heading && (
        <h2 className="text-2xl font-bold text-app-text mb-4">{data.heading as string}</h2>
      )}
      <p className="text-sm text-app-text-secondary">Team members will be displayed here.</p>
    </section>
  );
}

function PublicContactForm({
  data,
  onContact,
  canContact,
}: {
  data: Record<string, any>;
  onContact?: () => void | Promise<void>;
  canContact?: boolean;
}) {
  return (
    <section className="py-6">
      {data.heading && (
        <h2 className="text-2xl font-bold text-app-text mb-4">{data.heading as string}</h2>
      )}
      <div className="rounded-xl border border-app-border bg-app-surface p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1">Name</label>
          <input type="text" className="w-full rounded-lg border border-app-border px-3 py-2 text-sm" placeholder="Your name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1">Email</label>
          <input type="email" className="w-full rounded-lg border border-app-border px-3 py-2 text-sm" placeholder="your@email.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1">Message</label>
          <textarea className="w-full rounded-lg border border-app-border px-3 py-2 text-sm resize-none" rows={4} placeholder="How can we help?" />
        </div>
        <button
          onClick={() => {
            if (onContact) void onContact();
          }}
          className="px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
        >
          {canContact ? 'Send Message' : 'Log in to Contact'}
        </button>
      </div>
    </section>
  );
}

function PublicEmbed({ data }: { data: Record<string, any> }) {
  if (!data.url) return null;
  return (
    <section className="py-6">
      <div className="rounded-xl overflow-hidden border border-app-border bg-app-surface-sunken aspect-video flex items-center justify-center">
        <span className="text-sm text-app-text-muted">Embedded content: {data.url}</span>
      </div>
    </section>
  );
}

function PublicPostsFeed({ data }: { data: Record<string, any> }) {
  return (
    <section className="py-6">
      {data.heading && (
        <h2 className="text-2xl font-bold text-app-text mb-4">{data.heading as string}</h2>
      )}
      <p className="text-sm text-app-text-secondary">Posts will appear here when available.</p>
    </section>
  );
}
