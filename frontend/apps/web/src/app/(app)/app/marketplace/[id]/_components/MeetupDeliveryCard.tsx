'use client';

import { Home, Users, Sparkles, Car, Lock } from 'lucide-react';

type MeetupDeliveryCardProps = {
  meetupPreference?: string;
  deliveryAvailable?: boolean;
  isAddressAttached?: boolean;
};

const MEETUP_OPTIONS: Record<string, { icon: typeof Home; label: string }> = {
  porch_pickup:  { icon: Home,     label: 'Porch Pickup' },
  public_meetup: { icon: Users,    label: 'Public Meetup' },
  flexible:      { icon: Sparkles, label: 'Flexible — seller accommodates' },
};

export default function MeetupDeliveryCard({
  meetupPreference,
  deliveryAvailable,
  isAddressAttached,
}: MeetupDeliveryCardProps) {
  if (!meetupPreference && !deliveryAvailable) return null;

  const meetup = meetupPreference ? MEETUP_OPTIONS[meetupPreference] : null;

  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-app-text mb-2">Pickup & Delivery</h3>
      <div className="bg-app-surface-sunken rounded-xl p-4 space-y-3">
        {meetup && (() => {
          const Icon = meetup.icon;
          return (
            <div className="flex items-center gap-2.5">
              <Icon className="w-4 h-4 text-app-text-secondary flex-shrink-0" />
              <span className="text-sm text-app-text-strong">{meetup.label}</span>
            </div>
          );
        })()}
        {deliveryAvailable && (
          <div className="flex items-center gap-2.5">
            <Car className="w-4 h-4 text-app-text-secondary flex-shrink-0" />
            <span className="text-sm text-app-text-strong">Delivery available via neighbor gig</span>
          </div>
        )}
        {isAddressAttached && (
          <div className="flex items-center gap-2 mt-1">
            <Lock className="w-3 h-3 text-app-text-muted" />
            <p className="text-xs text-app-text-muted">Exact address shared after offer accepted</p>
          </div>
        )}
      </div>
    </div>
  );
}
