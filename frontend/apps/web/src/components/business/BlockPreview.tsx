// @ts-nocheck
'use client';

/**
 * BlockPreview — renders a single block in the page builder preview.
 * Each block type gets a visual representation (not pixel-perfect public rendering,
 * but enough to give the builder a real sense of layout).
 */

import React, { type ReactNode } from 'react';
import { Image as ImageIcon, FileEdit, ShoppingBag, Clock, MapPin, Megaphone, HelpCircle, Star, BarChart3, Users, MailOpen, Minus, Link2, Newspaper } from 'lucide-react';

export interface BlockData {
  id?: string;
  block_type: string;
  schema_version?: number;
  sort_order: number;
  data: Record<string, any>;
  settings?: Record<string, any>;
  location_id?: string;
  show_from?: string;
  show_until?: string;
  is_visible?: boolean;
}

export function BlockPreview({ block }: { block: BlockData }) {
  const d = block.data || {};

  switch (block.block_type) {
    case 'hero':
      return <HeroPreview data={d} />;
    case 'text':
      return <TextPreview data={d} />;
    case 'gallery':
      return <GalleryPreview data={d} />;
    case 'catalog_grid':
      return <CatalogGridPreview data={d} />;
    case 'hours':
      return <HoursPreview data={d} />;
    case 'locations_map':
      return <LocationsMapPreview data={d} />;
    case 'cta':
      return <CtaPreview data={d} />;
    case 'faq':
      return <FaqPreview data={d} />;
    case 'reviews':
      return <ReviewsPreview data={d} />;
    case 'divider':
      return <DividerPreview />;
    case 'stats':
      return <StatsPreview data={d} />;
    case 'team':
      return <TeamPreview data={d} />;
    case 'contact_form':
      return <ContactFormPreview data={d} />;
    case 'embed':
      return <EmbedPreview data={d} />;
    case 'posts_feed':
      return <PostsFeedPreview data={d} />;
    default:
      return (
        <div className="p-4 bg-app-surface-raised rounded-lg border border-dashed border-app-border text-center text-sm text-app-text-muted">
          Unknown block: {block.block_type}
        </div>
      );
  }
}


// ─── Block Previews ───────────────────────────

function HeroPreview({ data }: { data: Record<string, any> }) {
  return (
    <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-700 text-white p-8 min-h-[180px] flex flex-col justify-end">
      {data.background_file_id && (
        <div className="absolute inset-0 bg-black/30" />
      )}
      <div className="relative z-10">
        <h2 className="text-2xl font-bold">{(data.headline as string) || 'Headline'}</h2>
        {data.subhead && <p className="mt-1 text-white/80 text-sm">{data.subhead as string}</p>}
        {Array.isArray(data.cta) && data.cta.length > 0 && (
          <div className="mt-3 flex gap-2">
            {(data.cta as Record<string, any>[]).map((c, i: number) => (
              <span key={i} className="px-3 py-1.5 bg-glass/20 rounded-lg text-xs font-semibold backdrop-blur-sm">
                {(c.label as string) || 'Button'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TextPreview({ data }: { data: Record<string, any> }) {
  return (
    <div className="p-4">
      {data.heading && <h3 className="text-lg font-semibold text-app-text mb-2">{data.heading as string}</h3>}
      <p className="text-sm text-app-text-secondary leading-relaxed whitespace-pre-wrap">
        {(data.body as string) || 'Text content goes here...'}
      </p>
    </div>
  );
}

function GalleryPreview({ data }: { data: Record<string, any> }) {
  const count = (data.image_count as number) || (Array.isArray(data.images) ? data.images.length : 0) || 4;
  return (
    <div className="p-4">
      {data.heading && <h3 className="text-base font-semibold text-app-text mb-2">{data.heading as string}</h3>}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: Math.min(count, 6) }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-app-surface-sunken flex items-center justify-center text-app-text-muted text-xs">
            IMG
          </div>
        ))}
      </div>
    </div>
  );
}

function CatalogGridPreview({ data }: { data: Record<string, any> }) {
  const items = (data.items as Record<string, any>[]) || [];
  const placeholder = items.length === 0;
  return (
    <div className="p-4">
      <h3 className="text-base font-semibold text-app-text mb-2">{(data.heading as string) || 'Catalog'}</h3>
      <div className="grid grid-cols-2 gap-2">
        {(placeholder ? [{}, {}, {}, {}] : items.slice(0, 8)).map((_: Record<string, any>, i: number) => (
          <div key={i} className="rounded-lg border border-app-border p-3">
            <div className="w-full h-12 rounded bg-app-surface-sunken mb-2" />
            <div className="text-xs font-medium text-app-text-strong">{(_.name as string) || 'Item name'}</div>
            <div className="text-[10px] text-app-text-muted">{(_.price as string) || '$--'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HoursPreview({ data }: { data: Record<string, any> }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className="p-4">
      <h3 className="text-base font-semibold text-app-text mb-2">{(data.heading as string) || 'Hours'}</h3>
      <div className="space-y-1">
        {days.map((d) => (
          <div key={d} className="flex justify-between text-xs">
            <span className="text-app-text-secondary font-medium">{d}</span>
            <span className="text-app-text-secondary">9:00 AM – 5:00 PM</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LocationsMapPreview({ data }: { data: Record<string, any> }) {
  return (
    <div className="p-4">
      <h3 className="text-base font-semibold text-app-text mb-2">{(data.heading as string) || 'Locations'}</h3>
      <div className="w-full h-32 rounded-lg bg-app-surface-sunken flex items-center justify-center text-app-text-muted text-sm">
        Map preview
      </div>
    </div>
  );
}

function CtaPreview({ data }: { data: Record<string, any> }) {
  return (
    <div className="p-6 rounded-lg bg-violet-50 text-center">
      <h3 className="text-lg font-bold text-app-text">{(data.heading as string) || 'Ready to get started?'}</h3>
      {data.subhead && <p className="text-sm text-app-text-secondary mt-1">{data.subhead as string}</p>}
      <div className="mt-3 flex justify-center gap-2">
        {((data.buttons as Record<string, any>[]) || [{ label: 'Contact Us' }]).map((b: Record<string, any>, i: number) => (
          <span key={i} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold">
            {(b.label as string) || 'Button'}
          </span>
        ))}
      </div>
    </div>
  );
}

function FaqPreview({ data }: { data: Record<string, any> }) {
  const items = (data.items as Record<string, any>[]) || [{ q: 'Question goes here?', a: 'Answer goes here.' }];
  return (
    <div className="p-4">
      <h3 className="text-base font-semibold text-app-text mb-2">{(data.heading as string) || 'FAQ'}</h3>
      <div className="space-y-2">
        {items.slice(0, 5).map((item: Record<string, any>, i: number) => (
          <div key={i} className="border border-app-border rounded-lg p-3">
            <div className="text-sm font-medium text-app-text">{(item.q as string) || 'Question?'}</div>
            <div className="text-xs text-app-text-secondary mt-1">{(item.a as string) || 'Answer...'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewsPreview({ data }: { data: Record<string, any> }) {
  return (
    <div className="p-4">
      <h3 className="text-base font-semibold text-app-text mb-2">{(data.heading as string) || 'Reviews'}</h3>
      <div className="flex items-center gap-3 text-sm text-app-text-secondary">
        <span className="text-yellow-500 text-lg">★★★★★</span>
        <span>Based on customer reviews</span>
      </div>
    </div>
  );
}

function DividerPreview() {
  return <hr className="my-2 border-app-border" />;
}

function StatsPreview({ data }: { data: Record<string, any> }) {
  const stats = (data.stats as Record<string, any>[]) || [
    { label: 'Customers', value: '1,000+' },
    { label: 'Years', value: '5+' },
    { label: 'Rating', value: '4.9' },
  ];
  return (
    <div className="p-4 grid grid-cols-3 gap-4 text-center">
      {stats.map((s: Record<string, any>, i: number) => (
        <div key={i}>
          <div className="text-xl font-bold text-app-text">{s.value as string}</div>
          <div className="text-xs text-app-text-secondary">{s.label as string}</div>
        </div>
      ))}
    </div>
  );
}

function TeamPreview({ data }: { data: Record<string, any> }) {
  return (
    <div className="p-4">
      <h3 className="text-base font-semibold text-app-text mb-2">{(data.heading as string) || 'Our Team'}</h3>
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="text-center">
            <div className="w-12 h-12 rounded-full bg-app-surface-sunken mx-auto" />
            <div className="text-[10px] text-app-text-secondary mt-1">Team member</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactFormPreview({ data }: { data: Record<string, any> }) {
  return (
    <div className="p-4">
      <h3 className="text-base font-semibold text-app-text mb-2">{(data.heading as string) || 'Contact Us'}</h3>
      <div className="space-y-2">
        <div className="h-8 bg-app-surface-sunken rounded border border-app-border" />
        <div className="h-8 bg-app-surface-sunken rounded border border-app-border" />
        <div className="h-16 bg-app-surface-sunken rounded border border-app-border" />
        <div className="w-24 h-8 bg-violet-200 rounded text-center text-xs leading-8 text-violet-700 font-medium">Send</div>
      </div>
    </div>
  );
}

function EmbedPreview({ data }: { data: Record<string, any> }) {
  return (
    <div className="p-4">
      <div className="w-full h-24 rounded-lg bg-app-surface-sunken border border-dashed border-app-border flex items-center justify-center text-sm text-app-text-muted">
        {data.url ? `Embed: ${data.url}` : 'Embed block'}
      </div>
    </div>
  );
}

function PostsFeedPreview({ data }: { data: Record<string, any> }) {
  return (
    <div className="p-4">
      <h3 className="text-base font-semibold text-app-text mb-2">{(data.heading as string) || 'Latest Posts'}</h3>
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-2">
            <div className="w-12 h-12 rounded bg-app-surface-sunken flex-shrink-0" />
            <div>
              <div className="h-3 w-32 bg-app-surface-sunken rounded" />
              <div className="h-2 w-48 bg-app-surface-sunken rounded mt-1.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Block Type Registry (for the add-block palette) ───────────

export const BLOCK_TYPE_REGISTRY: {
  type: string;
  label: string;
  icon: ReactNode;
  description: string;
  defaultData: Record<string, any>;
}[] = [
  {
    type: 'hero',
    label: 'Hero',
    icon: <ImageIcon className="w-4 h-4" />,
    description: 'Large header with headline, subhead, and CTAs',
    defaultData: { headline: '', subhead: '', cta: [] },
  },
  {
    type: 'text',
    label: 'Text',
    icon: <FileEdit className="w-4 h-4" />,
    description: 'Rich text content block',
    defaultData: { heading: '', body: '' },
  },
  {
    type: 'gallery',
    label: 'Gallery',
    icon: <ImageIcon className="w-4 h-4" />,
    description: 'Image gallery grid',
    defaultData: { heading: 'Gallery', images: [], image_count: 6 },
  },
  {
    type: 'catalog_grid',
    label: 'Catalog Grid',
    icon: <ShoppingBag className="w-4 h-4" />,
    description: 'Display catalog items in a grid',
    defaultData: { heading: 'Our Services', filter_kind: '', max_items: 8 },
  },
  {
    type: 'hours',
    label: 'Hours',
    icon: <Clock className="w-4 h-4" />,
    description: 'Show business operating hours',
    defaultData: { heading: 'Business Hours' },
  },
  {
    type: 'locations_map',
    label: 'Locations Map',
    icon: <MapPin className="w-4 h-4" />,
    description: 'Map showing business locations',
    defaultData: { heading: 'Our Locations' },
  },
  {
    type: 'cta',
    label: 'Call to Action',
    icon: <Megaphone className="w-4 h-4" />,
    description: 'Prominent CTA section with buttons',
    defaultData: { heading: 'Ready to get started?', subhead: '', buttons: [{ label: 'Contact Us', action: 'message' }] },
  },
  {
    type: 'faq',
    label: 'FAQ',
    icon: <HelpCircle className="w-4 h-4" />,
    description: 'Frequently asked questions',
    defaultData: { heading: 'FAQ', items: [{ q: '', a: '' }] },
  },
  {
    type: 'reviews',
    label: 'Reviews',
    icon: <Star className="w-4 h-4" />,
    description: 'Show customer reviews summary',
    defaultData: { heading: 'What our customers say' },
  },
  {
    type: 'stats',
    label: 'Stats',
    icon: <BarChart3 className="w-4 h-4" />,
    description: 'Key numbers/metrics showcase',
    defaultData: { stats: [{ label: 'Customers', value: '1,000+' }, { label: 'Years', value: '5+' }, { label: 'Rating', value: '4.9' }] },
  },
  {
    type: 'team',
    label: 'Team',
    icon: <Users className="w-4 h-4" />,
    description: 'Show team members',
    defaultData: { heading: 'Our Team' },
  },
  {
    type: 'contact_form',
    label: 'Contact Form',
    icon: <MailOpen className="w-4 h-4" />,
    description: 'Contact form for inquiries',
    defaultData: { heading: 'Contact Us', fields: ['name', 'email', 'message'] },
  },
  {
    type: 'divider',
    label: 'Divider',
    icon: <Minus className="w-4 h-4" />,
    description: 'Visual separator between sections',
    defaultData: {},
  },
  {
    type: 'embed',
    label: 'Embed',
    icon: <Link2 className="w-4 h-4" />,
    description: 'Embed external content (video, map, widget)',
    defaultData: { url: '' },
  },
  {
    type: 'posts_feed',
    label: 'Pulse',
    icon: <Newspaper className="w-4 h-4" />,
    description: 'Show recent posts from the business',
    defaultData: { heading: 'Latest Posts', max_items: 5 },
  },
];
