'use client';

import { useState, useCallback } from 'react';
import GuestSignupModal from './GuestSignupModal';

type ContributionMode = 'cook' | 'takeout' | 'groceries';

type SlotSignupButtonProps = {
  supportTrainId: string;
  slotId: string;
  slotLabel: string;
  slotDate: string;
  isOpen: boolean;
  appUrl: string;
  fallbackUrl: string | null;
  enabledModes: ContributionMode[];
};

export default function SlotSignupButton({
  supportTrainId,
  slotId,
  slotLabel,
  slotDate,
  isOpen,
  appUrl,
  fallbackUrl,
  enabledModes,
}: SlotSignupButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [signedUp, setSignedUp] = useState(false);

  const handleSuccess = useCallback(() => {
    setSignedUp(true);
  }, []);

  if (signedUp) {
    return (
      <span className="inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
        Signed Up
      </span>
    );
  }

  if (!isOpen) {
    return (
      <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
        Filled
      </span>
    );
  }

  // No compatible contribution modes (e.g. gift_funds-only train) — show Open badge instead
  if (enabledModes.length === 0) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        Open
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex rounded-full bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700"
      >
        Sign Up
      </button>
      {showModal && (
        <GuestSignupModal
          supportTrainId={supportTrainId}
          slotId={slotId}
          slotLabel={slotLabel}
          slotDate={slotDate}
          appUrl={appUrl}
          fallbackUrl={fallbackUrl}
          enabledModes={enabledModes}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
