'use client';

import { CheckCircle, FileText, ShieldCheck } from 'lucide-react';

interface TrustCapsuleProps {
  verified: boolean;
  rating: number | null;
  reviewCount: number;
  reliabilityScore: number;
  gigsCompleted: number;
  distanceMiles?: number;
  isRecommended?: boolean;
  isLicensed?: boolean;
  isInsured?: boolean;
}

export default function TrustCapsule({
  verified,
  rating,
  reviewCount,
  reliabilityScore,
  gigsCompleted,
  distanceMiles,
  isRecommended,
  isLicensed,
  isInsured,
}: TrustCapsuleProps) {
  return (
    <div className="relative bg-app-surface-sunken rounded-lg px-3 py-2">
      {isRecommended && (
        <span className="absolute -top-2 right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          Best Match
        </span>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {verified && (
          <span className="flex items-center gap-1 text-green-600 font-semibold">
            <CheckCircle className="w-3.5 h-3.5" />
            Verified
          </span>
        )}
        {rating != null && (
          <span className="font-medium text-app-text-strong">
            &#11088; {rating.toFixed(1)} ({reviewCount})
          </span>
        )}
        <span className="font-medium text-app-text-strong">
          &#10003; {Math.round(reliabilityScore)}% reliable
        </span>
        <span className="font-medium text-app-text-strong">
          {gigsCompleted} gigs done
        </span>
        {distanceMiles != null && (
          <span className="font-medium text-app-text-strong">
            {distanceMiles.toFixed(1)} mi away
          </span>
        )}
        {isLicensed && (
          <span className="flex items-center gap-1 text-blue-600 font-semibold">
            <FileText className="w-3.5 h-3.5" />
            Licensed
          </span>
        )}
        {isInsured && (
          <span className="flex items-center gap-1 text-purple-600 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Insured
          </span>
        )}
      </div>
    </div>
  );
}
