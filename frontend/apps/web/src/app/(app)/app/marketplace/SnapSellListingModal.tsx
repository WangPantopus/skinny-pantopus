// @ts-nocheck
'use client';

import { useState, useCallback } from 'react';
import * as api from '@pantopus/api';
import { getErrorMessage } from '@pantopus/utils';
import { ImagePlus } from 'lucide-react';
import Image from 'next/image';
import { CATEGORIES, CONDITIONS, LISTING_TYPE_TEMPLATES, type ListingTypeKey } from './constants';
import type { SnapSellListingBootstrap } from './snapSellTypes';
import { toast } from '@/components/ui/toast-store';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function isListingTypeKey(k: string): k is ListingTypeKey {
  return k in LISTING_TYPE_TEMPLATES;
}

interface SnapSellListingModalProps {
  onClose: () => void;
  userLocation: { latitude: number; longitude: number } | null;
  onComplete: (bootstrap: SnapSellListingBootstrap) => void;
}

export default function SnapSellListingModal({ onClose, userLocation, onComplete }: SnapSellListingModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const continueFlow = useCallback(async () => {
    if (files.length === 0) {
      onComplete({ files: [], needsTypeStep: true });
      return;
    }
    setAiLoading(true);
    try {
      const imageDataUrls = await Promise.all(files.map((f) => fileToDataUrl(f)));
      const res = await api.ai.draftListingFromImages({
        images: imageDataUrls,
        latitude: userLocation?.latitude,
        longitude: userLocation?.longitude,
      });
      const d = res.draft;
      const bootstrap: SnapSellListingBootstrap = {
        files,
        needsTypeStep: true,
      };
      if (d.title) bootstrap.title = d.title;
      if (d.description) bootstrap.description = d.description;
      if (d.category) {
        const catKeys = CATEGORIES.map((c) => c.key);
        if (catKeys.includes(d.category)) bootstrap.category = d.category;
      }
      if (d.condition && CONDITIONS.includes(d.condition as (typeof CONDITIONS)[number])) {
        bootstrap.condition = d.condition;
      }
      if (d.meetupPreference && ['porch_pickup', 'public_meetup', 'flexible'].includes(d.meetupPreference)) {
        bootstrap.meetupPreference = d.meetupPreference;
      }
      if (d.deliveryAvailable != null) bootstrap.deliveryAvailable = d.deliveryAvailable;
      if (d.budgetMax != null && d.budgetMax > 0) bootstrap.budgetMax = String(d.budgetMax);
      if (res.priceSuggestion) {
        bootstrap.price = String(res.priceSuggestion.median);
        bootstrap.priceSuggestion = { low: res.priceSuggestion.low, high: res.priceSuggestion.high };
      } else if (d.price != null) {
        bootstrap.price = String(d.price);
      }
      if (d.isFree) {
        bootstrap.listingType = 'free_item';
        bootstrap.needsTypeStep = false;
      } else if (d.listingType && isListingTypeKey(d.listingType)) {
        bootstrap.listingType = d.listingType;
        bootstrap.needsTypeStep = false;
      }
      onComplete(bootstrap);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      onComplete({ files, needsTypeStep: true });
    } finally {
      setAiLoading(false);
    }
  }, [files, userLocation?.latitude, userLocation?.longitude, onComplete]);

  const skip = useCallback(() => {
    onComplete({ files: [], needsTypeStep: true });
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-black/30 z-[1000] flex items-center justify-center p-4">
      <div className="bg-app-surface rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-app-surface border-b border-app-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-xl font-semibold text-app-text">Snap & Sell</h2>
          <button type="button" onClick={onClose} className="text-app-text-muted hover:text-app-text-secondary" aria-label="Close">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-sm text-app-text-secondary">
            Add photos of your item. We will suggest a title, category, and price. You can skip and fill everything manually.
          </p>
          <div
            className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
              aiLoading ? 'border-primary-300 bg-primary-50/50 pointer-events-none' : 'border-app-border hover:border-gray-400'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const list = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'));
              if (list.length === 0) return;
              setFiles((prev) => [...prev, ...list].slice(0, 10));
            }}
          >
            {aiLoading ? (
              <p className="text-sm font-medium text-app-text">Analyzing your photos…</p>
            ) : (
              <>
                <ImagePlus className="w-10 h-10 mx-auto text-app-text-muted mb-2" />
                <p className="text-sm text-app-text mb-3">Drag images here or choose files</p>
                <label className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium cursor-pointer hover:bg-primary-700">
                  Choose photos
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const newFiles = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
                      setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
                      e.target.value = '';
                    }}
                  />
                </label>
              </>
            )}
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {files.map((file, i) => (
                <div key={`${file.name}-${i}`} className="relative w-20 h-20 rounded-lg overflow-hidden bg-app-surface-sunken border border-app-border">
                  {/* unoptimized: local blob URL */}
                  <Image src={URL.createObjectURL(file)} alt="" width={80} height={80} className="w-full h-full object-cover" unoptimized />
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={skip}
              disabled={aiLoading}
              className="px-4 py-2.5 border border-app-border text-app-text-strong rounded-lg hover:bg-app-hover font-medium text-sm disabled:opacity-50"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={continueFlow}
              disabled={aiLoading}
              className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiLoading ? 'Analyzing…' : files.length > 0 ? 'Continue with AI' : 'Continue without photos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
