'use client';

import { useState } from 'react';
import type { AddressVerdict } from '@pantopus/api';

type ConflictAction = 'request_join' | 'claim_owner' | 'claim_manager';

const PEOPLE_ICON = (
  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  </div>
);

function VerdictLayout({
  icon,
  title,
  description,
  children,
  onBack,
  backLabel = 'Try a different address',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="rounded-xl border border-app-border bg-app-surface p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 mt-0.5">{icon}</div>
          <div>
            <h3 className="text-lg font-semibold text-app-text">{title}</h3>
            <p className="text-sm text-app-text-secondary mt-1">{description}</p>
          </div>
        </div>
        {children}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
      >
        &larr; {backLabel}
      </button>
    </div>
  );
}

const ACTION_OPTIONS: {
  action: ConflictAction;
  title: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    action: 'request_join',
    title: 'Request to Join',
    description: 'Ask the current household to add you as a member.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
      </svg>
    ),
  },
  {
    action: 'claim_owner',
    title: "I'm the Owner",
    description: 'Verify your ownership with documents to claim this address.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    action: 'claim_manager',
    title: "I'm a Property Manager",
    description: 'Verify your management authority over this property.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export default function AlreadyClaimed({
  verdict,
  onAction,
  onBack,
}: {
  verdict: AddressVerdict;
  onAction?: (action: ConflictAction, message?: string) => void;
  onBack: () => void;
}) {
  const household = verdict.existing_household;
  const [selectedAction, setSelectedAction] = useState<ConflictAction | null>(null);
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    if (!selectedAction || !onAction) return;
    onAction(selectedAction, message.trim() || undefined);
  };

  return (
    <VerdictLayout
      icon={PEOPLE_ICON}
      title="Address already has a household"
      description="Someone has already registered a home at this address. Choose how you'd like to proceed."
      onBack={onBack}
    >
      {household && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
          <p className="text-sm text-blue-700">
            {household.member_count} {household.member_count === 1 ? 'member' : 'members'} currently registered
          </p>
        </div>
      )}

      {onAction ? (
        <div className="mt-4 space-y-3">
          {ACTION_OPTIONS.map((opt) => (
            <button
              key={opt.action}
              type="button"
              onClick={() => setSelectedAction(
                selectedAction === opt.action ? null : opt.action,
              )}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedAction === opt.action
                  ? 'border-primary-300 bg-primary-50/50 ring-1 ring-primary-200'
                  : 'border-app-border hover:border-app-border hover:bg-app-hover'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  selectedAction === opt.action
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-app-surface-sunken text-app-text-secondary'
                }`}>
                  {opt.icon}
                </div>
                <div>
                  <p className="font-semibold text-app-text">{opt.title}</p>
                  <p className="text-sm text-app-text-secondary mt-0.5">{opt.description}</p>
                </div>
              </div>
            </button>
          ))}

          {selectedAction && (
            <div className="animate-fade-in">
              <label htmlFor="conflict-message" className="block text-sm font-medium text-app-text-strong mb-1">
                Add a message <span className="text-app-text-muted font-normal">(optional)</span>
              </label>
              <textarea
                id="conflict-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Any additional context about your relationship to this address..."
                rows={3}
                className="w-full px-4 py-3 border border-app-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-app-text placeholder:text-app-text-muted resize-none text-sm"
              />

              <button
                type="button"
                onClick={handleSubmit}
                className="mt-3 w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
              >
                {selectedAction === 'request_join' && 'Send Join Request'}
                {selectedAction === 'claim_owner' && 'Start Ownership Verification'}
                {selectedAction === 'claim_manager' && 'Start Manager Verification'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-app-text-secondary">
            If you live here, you can request to join by contacting the household admin,
            or complete mail verification to prove residency.
          </p>
        </div>
      )}
    </VerdictLayout>
  );
}
