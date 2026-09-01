'use client';

import { useState } from 'react';
import { formatTimeAgo } from '@pantopus/ui-utils';
import {
  CONDITION_LABELS,
  CATEGORY_LABELS,
  LAYER_LABELS,
  LAYER_COLORS,
  LISTING_TYPE_LABELS,
  formatDate,
  formatExpiration,
  formatPrice,
} from './listing-detail.types';
import type { ListingDetail } from '@pantopus/types';

interface ListingInfoProps {
  listing: ListingDetail;
}

export default function ListingInfo({ listing }: ListingInfoProps) {
  const [descExpanded, setDescExpanded] = useState(false);

  const description = listing.description || '';
  const truncatedDesc = description.length > 200 ? description.slice(0, 200) + '...' : description;

  return (
    <>
      {/* Price & Title */}
      <div className="bg-app-surface rounded-xl border border-app-border p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            {listing.is_wanted ? (
              <div>
                <span className="text-2xl font-bold text-amber-600">WANTED</span>
                {listing.budget_max && (
                  <span className="ml-2 text-lg text-app-text-secondary">Budget up to ${Number(listing.budget_max).toFixed(0)}</span>
                )}
              </div>
            ) : (
              <div>
                <span className={`text-3xl font-bold ${listing.is_free ? 'text-green-600' : 'text-app-text'}`}>
                  {formatPrice(listing)}
                </span>
                {listing.is_negotiable && (
                  <span className="ml-2 text-sm text-app-text-secondary">Negotiable</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {listing.status && listing.status !== 'active' && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                listing.status === 'sold' ? 'bg-red-100 text-red-700' :
                listing.status === 'pending_pickup' ? 'bg-amber-100 text-amber-700' :
                'bg-app-surface-sunken text-app-text-secondary'
              }`}>
                {listing.status.replace(/_/g, ' ')}
              </span>
            )}
            {formatExpiration(listing.expires_at) && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                formatExpiration(listing.expires_at) === 'Expired' ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {formatExpiration(listing.expires_at)}
              </span>
            )}
          </div>
        </div>

        <h1 className="text-2xl font-bold text-app-text mb-3">{listing.title}</h1>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Layer badge */}
          {listing.layer && (
            <span className={`flex items-center gap-1 px-2.5 py-1 text-sm rounded-full font-medium ${LAYER_COLORS[listing.layer] || 'bg-app-surface-sunken text-app-text-strong'}`}>
              {LAYER_LABELS[listing.layer] || listing.layer}
            </span>
          )}
          {/* Listing type badge */}
          {listing.listing_type && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-app-surface-sunken text-app-text-strong text-sm rounded-full">
              {LISTING_TYPE_LABELS[listing.listing_type] || listing.listing_type.replace(/_/g, ' ')}
            </span>
          )}
          {/* Trust badge */}
          {listing.is_address_attached && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-sm rounded-full font-medium">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              Verified Neighbor
            </span>
          )}
          {listing.condition && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-app-surface-sunken text-app-text-strong text-sm rounded-full">
              {CONDITION_LABELS[listing.condition] || listing.condition}
            </span>
          )}
          {listing.category && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">
              {CATEGORY_LABELS[listing.category] || listing.category.replace(/_/g, ' ')}
            </span>
          )}
          <span className="flex items-center gap-1 px-2.5 py-1 bg-app-surface-sunken text-app-text-secondary text-sm rounded-full">
            Posted {formatTimeAgo(listing.created_at)}
          </span>
        </div>

        {/* Context tags */}
        {listing.context_tags && listing.context_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {listing.context_tags.map((tag: string) => (
              <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Location */}
        {listing.location_name && (
          <div className="flex items-center gap-1.5 text-sm text-app-text-secondary">
            <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>
              {listing.locationUnlocked && listing.location_address
                ? listing.location_address
                : listing.location_name}
            </span>
            {!listing.locationUnlocked && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-medium rounded">
                Approximate
              </span>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {description && (
        <div className="bg-app-surface rounded-xl border border-app-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-app-text mb-3">Description</h2>
          <p className="text-app-text-strong whitespace-pre-wrap text-sm leading-relaxed">
            {descExpanded ? description : truncatedDesc}
          </p>
          {description.length > 200 && (
            <button onClick={() => setDescExpanded(!descExpanded)} className="text-primary-600 text-sm font-medium mt-2 hover:underline">
              {descExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* Details Grid */}
      <div className="bg-app-surface rounded-xl border border-app-border p-6 mb-6">
        <h2 className="text-lg font-semibold text-app-text mb-4">Details</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {listing.layer && (
            <div>
              <p className="text-xs text-app-text-secondary mb-0.5">Layer</p>
              <p className="text-sm font-medium text-app-text">{LAYER_LABELS[listing.layer] || listing.layer}</p>
            </div>
          )}
          {listing.listing_type && (
            <div>
              <p className="text-xs text-app-text-secondary mb-0.5">Type</p>
              <p className="text-sm font-medium text-app-text">{LISTING_TYPE_LABELS[listing.listing_type] || listing.listing_type.replace(/_/g, ' ')}</p>
            </div>
          )}
          {listing.condition && (
            <div>
              <p className="text-xs text-app-text-secondary mb-0.5">Condition</p>
              <p className="text-sm font-medium text-app-text">{CONDITION_LABELS[listing.condition] || listing.condition}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-app-text-secondary mb-0.5">Category</p>
            <p className="text-sm font-medium text-app-text">{CATEGORY_LABELS[listing.category] || (listing.category || 'other').replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-xs text-app-text-secondary mb-0.5">Posted</p>
            <p className="text-sm font-medium text-app-text">{formatDate(listing.created_at)}</p>
          </div>
          {listing.expires_at && (
            <div>
              <p className="text-xs text-app-text-secondary mb-0.5">Expires</p>
              <p className="text-sm font-medium text-app-text">{formatDate(listing.expires_at)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-app-text-secondary mb-0.5">Views</p>
            <p className="text-sm font-medium text-app-text">{listing.view_count || 0}</p>
          </div>
          <div>
            <p className="text-xs text-app-text-secondary mb-0.5">Saves</p>
            <p className="text-sm font-medium text-app-text">{listing.save_count || 0}</p>
          </div>
          <div>
            <p className="text-xs text-app-text-secondary mb-0.5">Messages</p>
            <p className="text-sm font-medium text-app-text">{listing.message_count || 0}</p>
          </div>
        </div>
      </div>
    </>
  );
}
