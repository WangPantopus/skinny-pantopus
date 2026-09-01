'use client';

import Image from 'next/image';

interface ChatRichCardProps {
  msgType: string;
  metadata: Record<string, any>;
  msgText: string;
  isMine: boolean;
}

function extractEntityIdFromText(message: string, collection: 'gigs' | 'listings'): string | null {
  if (!message) return null;
  const match = message.match(new RegExp(`/${collection}/([A-Za-z0-9-]+)`));
  return match?.[1] || null;
}

export default function ChatRichCard({ msgType, metadata, msgText, isMine }: ChatRichCardProps) {
  const meta = (metadata || {}) as Record<string, any>;

  if (msgType === 'location') {
    const address = meta.address || msgText || 'Shared location';
    const lat = meta.latitude;
    const lng = meta.longitude;
    const mapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : '#';
    return (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`block rounded-2xl overflow-hidden border ${
          isMine ? 'bg-primary-600 border-primary-500' : 'bg-surface border-app'
        } ${isMine ? 'rounded-br-md' : 'rounded-bl-md'}`}
      >
        <div className="px-3.5 py-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📍</span>
            <span className={`text-xs font-semibold ${isMine ? 'text-white' : 'text-app'}`}>Location</span>
          </div>
          <div className={`text-sm ${isMine ? 'text-blue-100' : 'text-app-text-secondary'}`}>{address}</div>
        </div>
        <div className={`px-3.5 py-2 border-t ${isMine ? 'border-primary-400' : 'border-app'} flex items-center gap-1.5`}>
          <span className="text-xs">🧭</span>
          <span className={`text-xs font-medium ${isMine ? 'text-white' : 'text-primary-600'}`}>Open in Maps</span>
        </div>
      </a>
    );
  }

  if (msgType === 'gig_offer') {
    const gigId = meta.gigId || meta.gig_id || extractEntityIdFromText(msgText, 'gigs');
    const title = meta.title || msgText || 'Task';
    const category = meta.category;
    const status = meta.status;
    const price = meta.price;

    return (
      <a
        href={gigId ? `/app/gigs/${gigId}` : '#'}
        className={`block rounded-2xl overflow-hidden border ${
          isMine ? 'bg-primary-600 border-primary-500' : 'bg-surface border-app'
        } ${isMine ? 'rounded-br-md' : 'rounded-bl-md'} hover:opacity-90 transition-opacity`}
      >
        <div className="px-3.5 py-2.5">
          <div className="flex items-start gap-2">
            <span className="text-lg mt-0.5">💼</span>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${isMine ? 'text-white' : 'text-app'} line-clamp-2`}>
                {title}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {category && (
                  <span className={`text-xs ${isMine ? 'text-blue-200' : 'text-app-text-secondary'}`}>{category}</span>
                )}
                {status && (
                  <span className={`text-xs capitalize ${isMine ? 'text-blue-200' : 'text-app-text-secondary'}`}>
                    {String(status).replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
            {price != null && (
              <span className={`text-sm font-bold ${isMine ? 'text-white' : 'text-app'} whitespace-nowrap`}>
                {String(price).startsWith('$') ? price : `$${Number(price).toFixed(0)}`}
              </span>
            )}
          </div>
        </div>
        <div className={`px-3.5 py-2 border-t ${isMine ? 'border-primary-400' : 'border-app'} flex items-center gap-1.5`}>
          <span className="text-xs">🔗</span>
          <span className={`text-xs font-medium ${isMine ? 'text-white' : 'text-primary-600'}`}>View Task</span>
        </div>
      </a>
    );
  }

  if (msgType === 'listing_offer') {
    const listingId = meta.listingId || meta.listing_id || extractEntityIdFromText(msgText, 'listings');
    const imageUrl = meta.imageUrl || meta.image_url;
    const isFree = meta.isFree ?? meta.is_free;
    const title = meta.title || msgText || 'Listing';
    const category = meta.category;
    const condition = meta.condition;
    const price = meta.price;

    return (
      <a
        href={listingId ? `/app/listings/${listingId}` : '#'}
        className={`block rounded-2xl overflow-hidden border ${
          isMine ? 'bg-primary-600 border-primary-500' : 'bg-surface border-app'
        } ${isMine ? 'rounded-br-md' : 'rounded-bl-md'} hover:opacity-90 transition-opacity`}
      >
        {imageUrl && (
          <div className="relative h-32 w-full min-h-32 overflow-hidden bg-surface-muted">
            <Image
              src={imageUrl as string}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
              quality={80}
            />
            <div className={`absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-xs font-bold ${
              isFree ? 'bg-green-500 text-white' : 'bg-surface text-app shadow'
            }`}>
              {isFree ? 'FREE' : price != null ? `$${Number(price).toFixed(0)}` : 'Make Offer'}
            </div>
          </div>
        )}
        <div className="px-3.5 py-2.5">
          <div className="flex items-start gap-2">
            {!imageUrl && <span className="text-lg mt-0.5">🏷️</span>}
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${isMine ? 'text-white' : 'text-app'} line-clamp-2`}>
                {title}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {category && (
                  <span className={`text-xs ${isMine ? 'text-blue-200' : 'text-app-text-secondary'}`}>{category}</span>
                )}
                {condition && (
                  <span className={`text-xs ${isMine ? 'text-blue-200' : 'text-app-text-secondary'}`}>
                    {({ new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair', poor: 'Poor' } as Record<string, string>)[condition as string] || condition}
                  </span>
                )}
              </div>
            </div>
            {!imageUrl && price != null && (
              <span className={`text-sm font-bold ${isMine ? 'text-white' : 'text-app'} whitespace-nowrap`}>
                {isFree ? 'FREE' : `$${Number(price).toFixed(0)}`}
              </span>
            )}
          </div>
        </div>
        <div className={`px-3.5 py-2 border-t ${isMine ? 'border-primary-400' : 'border-app'} flex items-center gap-1.5`}>
          <span className="text-xs">🔗</span>
          <span className={`text-xs font-medium ${isMine ? 'text-white' : 'text-primary-600'}`}>View Listing</span>
        </div>
      </a>
    );
  }

  return null;
}
