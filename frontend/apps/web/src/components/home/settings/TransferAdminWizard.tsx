'use client';

import { useState } from 'react';
import * as api from '@pantopus/api';
import type { HomeMember } from '@pantopus/types';
import SlidePanel from '../SlidePanel';

// ============================================================
// TransferAdminWizard — 3-step ownership transfer flow
// Step 1: Choose new primary admin from member list
// Step 2: Review what transfers vs what stays
// Step 3: Confirm with typed confirmation
// ============================================================

export default function TransferAdminWizard({
  open,
  onClose,
  homeId,
  members,
  currentUserId,
  onTransferred,
}: {
  open: boolean;
  onClose: () => void;
  homeId: string;
	  members: HomeMember[];
  currentUserId: string | null;
  onTransferred: () => void;
}) {
  const [step, setStep] = useState(1);
  const [selectedMember, setSelectedMember] = useState<HomeMember | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState('');

  // Filter eligible members: exclude current user and guests
  const eligibleMembers = members.filter((m) => {
    const userId = m.user_id || m.id;
    if (userId === currentUserId) return false;
    const role = m.role_base || m.role || '';
    if (role === 'guest' || role === 'restricted_member') return false;
    return true;
  });

  const handleClose = () => {
    setStep(1);
    setSelectedMember(null);
    setConfirmText('');
    setError('');
    setTransferring(false);
    onClose();
  };

	  const handleTransfer = async () => {
	    if (confirmText !== 'TRANSFER') return;
	    if (!selectedMember) return;
	    setTransferring(true);
    setError('');
    try {
      const userId = selectedMember.user_id || selectedMember.id;
      await api.homeProfile.transferAdmin(homeId, { new_admin_user_id: userId });
      onTransferred();
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transfer failed. Please try again.');
      setTransferring(false);
    }
  };

  const memberName = selectedMember?.user?.name || selectedMember?.name || selectedMember?.user?.username || selectedMember?.username || 'Unknown';
  const memberRole = selectedMember?.role_base || selectedMember?.role || 'member';

  const stepTitle =
    step === 1
      ? 'Choose New Admin'
      : step === 2
        ? 'Review Transfer'
        : 'Confirm Transfer';

  return (
    <SlidePanel
      open={open}
      onClose={handleClose}
      title="Transfer Home Ownership"
      subtitle={`Step ${step} of 3 — ${stepTitle}`}
    >
      <div className="space-y-6">
        {/* Progress bar */}
        <div className="flex gap-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-amber-500' : 'bg-app-surface-sunken'
              }`}
            />
          ))}
        </div>

        {/* ===== Step 1: Choose member ===== */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-app-text-secondary">
              Select the member who will become the new primary admin of this home.
              They will gain full control over settings, members, and data.
            </p>

            {eligibleMembers.length === 0 ? (
              <div className="bg-app-surface-raised border border-app-border rounded-lg p-4 text-center">
                <p className="text-sm text-app-text-secondary">
                  No eligible members to transfer to. Add members with admin or manager roles first.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {eligibleMembers.map((member) => {
                  const mId = member.user_id || member.id;
                  const mName = member.user?.name || member.name || member.user?.username || member.username || 'Unknown';
                  const mRole = member.role_base || member.role || 'member';
                  const mEmail = member.user?.email || member.email || '';
                  const isSelected = selectedMember && (selectedMember.user_id || selectedMember.id) === mId;

                  return (
                    <button
                      key={mId}
                      onClick={() => setSelectedMember(member)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                        isSelected
                          ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-400'
                          : 'border-app-border hover:border-app-border hover:bg-app-hover'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-app-surface-sunken flex items-center justify-center text-sm font-semibold text-app-text-secondary shrink-0">
                        {mName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-app-text truncate">{mName}</div>
                        <div className="text-[10px] text-app-text-muted flex items-center gap-2">
                          <span className="capitalize">{mRole.replace('_', ' ')}</span>
                          {mEmail && <span className="truncate">{mEmail}</span>}
                        </div>
                      </div>
                      {isSelected && (
                        <svg className="w-5 h-5 text-amber-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!selectedMember}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ===== Step 2: Review what transfers ===== */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">👤</span>
                <span className="text-sm font-semibold text-app-text">
                  Transferring to {memberName}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded capitalize">
                  {memberRole.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* What transfers */}
            <div>
              <h4 className="text-xs font-semibold text-app-text-strong mb-2 uppercase tracking-wider">
                What transfers to new admin
              </h4>
              <div className="space-y-2">
                {[
                  { icon: '🏠', label: 'Home ownership', desc: 'Primary admin control over the home' },
                  { icon: '👥', label: 'Member management', desc: 'Ability to invite, remove, and change member roles' },
                  { icon: '🔒', label: 'Security controls', desc: 'Lockdown mode, guest pass management' },
                  { icon: '⚙️', label: 'Home settings', desc: 'All home configuration and preferences' },
                  { icon: '🗑️', label: 'Delete capability', desc: 'Ability to permanently delete the home' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-2.5 p-2 bg-red-50 border border-red-100 rounded-lg">
                    <span className="text-sm mt-0.5">{item.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-app-text">{item.label}</div>
                      <div className="text-[10px] text-app-text-secondary">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What stays */}
            <div>
              <h4 className="text-xs font-semibold text-app-text-strong mb-2 uppercase tracking-wider">
                What stays with you
              </h4>
              <div className="space-y-2">
                {[
                  { icon: '📋', label: 'Your tasks', desc: 'Tasks assigned to you remain yours' },
                  { icon: '💳', label: 'Your bill payments', desc: 'Payment history and split records' },
                  { icon: '📦', label: 'Your packages', desc: 'Package tracking tied to your account' },
                  { icon: '🏷️', label: 'Admin role', desc: 'You keep an admin role in the home' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-2.5 p-2 bg-green-50 border border-green-100 rounded-lg">
                    <span className="text-sm mt-0.5">{item.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-app-text">{item.label}</div>
                      <div className="text-[10px] text-app-text-secondary">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-app-border text-app-text-secondary text-sm rounded-lg hover:bg-app-hover transition"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition"
              >
                Continue to Confirm
              </button>
            </div>
          </div>
        )}

        {/* ===== Step 3: Confirm with typed confirmation ===== */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-amber-800">
                You are about to transfer ownership of this home to {memberName}.
              </p>
              <p className="text-xs text-amber-700">
                After transferring, you will be downgraded to an admin role. The new owner
                can change your role or remove you from the home. This action cannot be
                easily undone.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-app-text-secondary mb-1">
                Type TRANSFER to confirm
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm font-mono"
                placeholder="TRANSFER"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => { setStep(2); setConfirmText(''); setError(''); }}
                className="px-4 py-2 border border-app-border text-app-text-secondary text-sm rounded-lg hover:bg-app-hover transition"
              >
                Back
              </button>
              <button
                onClick={handleTransfer}
                disabled={confirmText !== 'TRANSFER' || transferring}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-40 transition"
              >
                {transferring ? 'Transferring...' : 'Transfer Ownership'}
              </button>
            </div>
          </div>
        )}
      </div>
    </SlidePanel>
  );
}
