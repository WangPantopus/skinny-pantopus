'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '@pantopus/api';
import type { HomeMember } from '@pantopus/types';
import TransferAdminWizard from './TransferAdminWizard';

// ---- Constants ----

const HOME_TYPES = [
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'studio', label: 'Studio' },
  { value: 'rv', label: 'RV' },
  { value: 'mobile_home', label: 'Mobile Home' },
  { value: 'multi_unit', label: 'Multi-unit' },
  { value: 'other', label: 'Other' },
];

const GUEST_EXPIRY_OPTIONS = [
  { value: '2', label: '2 hours' },
  { value: '8', label: '8 hours' },
  { value: '24', label: '1 day' },
  { value: '48', label: '2 days' },
  { value: '168', label: '1 week' },
];

const VISIBILITY_OPTIONS = [
  { value: 'members', label: 'Members Only' },
  { value: 'managers', label: 'Managers Only' },
  { value: 'sensitive', label: 'Sensitive' },
];

const DAYS_OF_WEEK = [
  { value: '', label: 'Not set' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

// ============================================================
// Main Component
// ============================================================

export default function HomeSettingsTab({
  homeId,
  home,
  members,
  can,
  currentUserId,
  onHomeUpdate,
}: {
  homeId: string;
  home: Record<string, any>;
  members: Record<string, any>[];
  can: (perm: string) => boolean;
  currentUserId: string | null;
  onHomeUpdate: () => void;
}) {
  const canManageDataDestruction =
    home?.can_delete_home === true ||
    (home?.can_delete_home === undefined && home?.owner_id === currentUserId);
  const canEdit = can('home.edit');

  // Loading
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Section 1: Home Info
  const [homeName, setHomeName] = useState('');
  const [homeType, setHomeType] = useState('house');

  // Section 2: Guest Defaults
  const [defaultGuestHours, setDefaultGuestHours] = useState('48');
  const [defaultVisibility, setDefaultVisibility] = useState('members');
  const [guestWelcome, setGuestWelcome] = useState('');

  // Section 3: Home Details
  const [houseRules, setHouseRules] = useState('');
  const [parkingInstructions, setParkingInstructions] = useState('');
  const [entryInstructions, setEntryInstructions] = useState('');
  const [trashDay, setTrashDay] = useState('');
  const [localTips, setLocalTips] = useState('');

  // Section 4: Notifications
  const [notifBills, setNotifBills] = useState(true);
  const [notifTasks, setNotifTasks] = useState(true);
  const [notifMail, setNotifMail] = useState(true);
  const [notifDelivery, setNotifDelivery] = useState(true);
  const [notifGuestPass, setNotifGuestPass] = useState(true);

  // Section 5: Data Management
  const [showTransfer, setShowTransfer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Load settings
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.homeProfile.getHomeSettings(homeId);
      const h = (res as Record<string, any>).home || {};
      const prefs = (res as Record<string, any>).preferences || {};

      setHomeName(h.name || home?.name || '');
      setHomeType(h.home_type || home?.home_type || 'house');

      setDefaultGuestHours(String(prefs.default_guest_pass_hours || h.default_guest_pass_hours || 48));
      setDefaultVisibility(prefs.default_visibility || h.default_visibility || 'members');
      setGuestWelcome(h.guest_welcome_message || '');

      setHouseRules(h.house_rules || '');
      setParkingInstructions(h.parking_instructions || '');
      setEntryInstructions(h.entry_instructions || '');
      setTrashDay(h.trash_day || '');
      setLocalTips(h.local_tips || '');

      // Notification prefs
      if (prefs.notifications) {
        setNotifBills(prefs.notifications.bills !== false);
        setNotifTasks(prefs.notifications.tasks !== false);
        setNotifMail(prefs.notifications.mail !== false);
        setNotifDelivery(prefs.notifications.delivery !== false);
        setNotifGuestPass(prefs.notifications.guest_pass !== false);
      }
    } catch {
      // Fallback to home data
      setHomeName(home?.name || '');
      setHomeType(home?.home_type || 'house');
    }
    setLoading(false);
  }, [homeId, home]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // Save all settings
  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      // Update home info
      await api.homes.updateHome(homeId, {
        home_type: homeType,
      } as Record<string, any>);

      // Update settings & preferences
      await api.homeProfile.updateHomeSettings(homeId, {
        house_rules: houseRules.trim() || undefined,
        parking_instructions: parkingInstructions.trim() || undefined,
        entry_instructions: entryInstructions.trim() || undefined,
        trash_day: trashDay || undefined,
        local_tips: localTips.trim() || undefined,
        guest_welcome_message: guestWelcome.trim() || undefined,
        default_visibility: defaultVisibility,
        default_guest_pass_hours: Number(defaultGuestHours) || 48,
        preferences: {
          notifications: {
            bills: notifBills,
            tasks: notifTasks,
            mail: notifMail,
            delivery: notifDelivery,
            guest_pass: notifGuestPass,
          },
        },
      } as Record<string, any>);

      setSaveMsg('Settings saved!');
      setTimeout(() => setSaveMsg(''), 3000);
      onHomeUpdate();
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
  };

  // Delete home
  const handleDelete = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      await api.homes.deleteHome(homeId);
      window.location.href = '/app';
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to delete home');
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-app-text-muted text-sm">Loading settings...</div>;
  }

  const address = [home?.address, home?.address_line1, home?.address2].filter(Boolean).join(' ');
  const cityLine = [home?.city, home?.state, home?.zipcode, home?.zip_code].filter(Boolean).join(', ');

  return (
    <div className="space-y-6">
      {/* Transfer Admin Wizard */}
      <TransferAdminWizard
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        homeId={homeId}
        members={members as HomeMember[]}
        currentUserId={currentUserId}
        onTransferred={onHomeUpdate}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-app-text">Home Settings</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">Manage your home&apos;s profile, defaults, and preferences</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            {saveMsg && (
              <span className={`text-xs ${saveMsg.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                {saveMsg}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* ===== Section 1: Home Info ===== */}
      <SettingsSection title="Home Info" icon="🏠">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-app-text-secondary mb-1">Home Name</label>
            {canEdit ? (
              <input
                value={homeName}
                onChange={(e) => setHomeName(e.target.value)}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm"
                placeholder="e.g., My Camas Home"
                maxLength={120}
              />
            ) : (
              <p className="text-sm text-app-text">{homeName || '—'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-app-text-secondary mb-1">Address</label>
            <p className="text-sm text-app-text">{address || '—'}</p>
            {cityLine && <p className="text-xs text-app-text-secondary">{cityLine}</p>}
            {home?.verified && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-green-600 font-medium">
                <span>✅</span> Verified — address cannot be changed
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-app-text-secondary mb-1">Home Type</label>
            {canEdit ? (
              <select
                value={homeType}
                onChange={(e) => setHomeType(e.target.value)}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm"
              >
                {HOME_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-app-text capitalize">{homeType?.replace('_', ' ') || '—'}</p>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* ===== Section 2: Guest Defaults ===== */}
      {canEdit && (
        <SettingsSection title="Guest Defaults" icon="🔗">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-app-text-secondary mb-1">Default Guest Pass Expiry</label>
              <select
                value={defaultGuestHours}
                onChange={(e) => setDefaultGuestHours(e.target.value)}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm"
              >
                {GUEST_EXPIRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-app-text-secondary mb-1">Default Visibility for New Items</label>
              <select
                value={defaultVisibility}
                onChange={(e) => setDefaultVisibility(e.target.value)}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm"
              >
                {VISIBILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-app-text-muted mt-0.5">Applies to new tasks, bills, documents, etc.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-app-text-secondary mb-1">Guest Welcome Message</label>
              <textarea
                value={guestWelcome}
                onChange={(e) => setGuestWelcome(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm resize-none"
                placeholder="Welcome to our home! Please make yourself comfortable..."
                maxLength={2000}
              />
              <p className="text-[10px] text-app-text-muted mt-0.5">Shown at the top of guest passes</p>
            </div>
          </div>
        </SettingsSection>
      )}

      {/* ===== Section 3: Home Details ===== */}
      {canEdit && (
        <SettingsSection title="Home Details" icon="📋">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-app-text-secondary mb-1">House Rules</label>
              <textarea
                value={houseRules}
                onChange={(e) => setHouseRules(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm resize-none"
                placeholder="e.g., No shoes inside, quiet hours after 10pm..."
                maxLength={2000}
              />
              <p className="text-[10px] text-app-text-muted mt-0.5">Shown to guests via guest passes</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-app-text-secondary mb-1">Parking Instructions</label>
              <textarea
                value={parkingInstructions}
                onChange={(e) => setParkingInstructions(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm resize-none"
                placeholder="e.g., Park in driveway, street parking on Main St..."
                maxLength={2000}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-app-text-secondary mb-1">Entry Instructions</label>
              <textarea
                value={entryInstructions}
                onChange={(e) => setEntryInstructions(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm resize-none"
                placeholder="e.g., Front door code is 1234, ring bell twice..."
                maxLength={2000}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-app-text-secondary mb-1">Trash Day</label>
              <select
                value={trashDay}
                onChange={(e) => setTrashDay(e.target.value)}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-app-text-secondary mb-1">Local Tips</label>
              <textarea
                value={localTips}
                onChange={(e) => setLocalTips(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm resize-none"
                placeholder="e.g., Best coffee shop is 2 blocks north, grocery store on Oak Ave..."
                maxLength={2000}
              />
              <p className="text-[10px] text-app-text-muted mt-0.5">Helpful for Airbnb guests and visitors</p>
            </div>
          </div>
        </SettingsSection>
      )}

      {/* ===== Section 4: Notifications ===== */}
      <SettingsSection title="Notifications" icon="🔔">
        <div className="space-y-1">
          <NotificationToggle label="Bill reminders" description="Get notified about upcoming due dates" checked={notifBills} onChange={setNotifBills} />
          <NotificationToggle label="Task reminders" description="Reminders for assigned and overdue tasks" checked={notifTasks} onChange={setNotifTasks} />
          <NotificationToggle label="Mail alerts" description="New mail and package notifications" checked={notifMail} onChange={setNotifMail} />
          <NotificationToggle label="Delivery alerts" description="Package delivery status updates" checked={notifDelivery} onChange={setNotifDelivery} />
          <NotificationToggle label="Guest pass activity" description="When someone views a guest pass" checked={notifGuestPass} onChange={setNotifGuestPass} />
        </div>
      </SettingsSection>

      {/* ===== Section 5: Data Management (admins only) ===== */}
      {canManageDataDestruction && (
        <SettingsSection title="Data Management" icon="⚙️">
          <div className="space-y-4">
            {/* Export */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-app-text">Export Home Data</div>
                <div className="text-[10px] text-app-text-muted">Download all data as JSON</div>
              </div>
              <button
                disabled
                className="px-3 py-1.5 rounded-lg border border-app-border text-xs text-app-text-muted cursor-not-allowed"
              >
                Coming soon
              </button>
            </div>

            {/* Transfer */}
            <div className="flex items-center justify-between border-t border-app-border-subtle pt-4">
              <div>
                <div className="text-sm font-medium text-app-text">Transfer Home</div>
                <div className="text-[10px] text-app-text-muted">Transfer primary admin to another member</div>
              </div>
              <button
                onClick={() => setShowTransfer(true)}
                className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
              >
                Transfer
              </button>
            </div>

            {/* Delete */}
            <div className="border-t border-app-border-subtle pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-red-700">Delete Home</div>
                  <div className="text-[10px] text-red-400">Permanently delete this home and all its data</div>
                </div>
                {!showDeleteConfirm && (
                  <button
                    onClick={() => { setShowDeleteConfirm(true); setDeleteStep(1); }}
                    className="px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                  >
                    Delete Home
                  </button>
                )}
              </div>

              {showDeleteConfirm && (
                <div className="mt-3 space-y-3">
                  {/* Step 1 */}
                  {deleteStep === 1 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                      <p className="text-sm font-semibold text-red-800">Are you sure?</p>
                      <p className="text-xs text-red-600">
                        This will permanently delete the home, all tasks, bills, documents, access codes,
                        guest passes, and member associations. This cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeleteStep(2)}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700"
                        >
                          Yes, I understand
                        </button>
                        <button
                          onClick={() => { setShowDeleteConfirm(false); setDeleteStep(0); }}
                          className="px-3 py-1.5 border border-app-border text-app-text-secondary text-xs rounded-lg hover:bg-app-hover"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 2 */}
                  {deleteStep === 2 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                      <p className="text-sm font-semibold text-red-800">Final Confirmation</p>
                      <p className="text-xs text-red-600">
                        All {members.length} member{members.length !== 1 ? 's' : ''} will lose access.
                        All data will be permanently erased.
                      </p>
                      <div>
                        <label className="block text-[10px] text-red-600 mb-1">Type DELETE to confirm</label>
                        <input
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                          className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm font-mono"
                          placeholder="DELETE"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeleteStep(3)}
                          disabled={deleteConfirmText !== 'DELETE'}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          Continue
                        </button>
                        <button
                          onClick={() => { setShowDeleteConfirm(false); setDeleteStep(0); setDeleteConfirmText(''); }}
                          className="px-3 py-1.5 border border-app-border text-app-text-secondary text-xs rounded-lg hover:bg-app-hover"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3 */}
                  {deleteStep === 3 && (
                    <div className="bg-red-100 border border-red-300 rounded-lg p-4 text-center space-y-3">
                      <div className="text-3xl">⚠️</div>
                      <p className="text-sm font-bold text-red-800">
                        This is your last chance. Click below to permanently delete &ldquo;{home?.name || home?.address_line1 || 'this home'}&rdquo;.
                      </p>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          className="px-4 py-2 bg-red-700 text-white text-sm font-bold rounded-lg hover:bg-red-800 disabled:opacity-50"
                        >
                          {deleting ? 'Deleting...' : 'Permanently Delete Home'}
                        </button>
                        <button
                          onClick={() => { setShowDeleteConfirm(false); setDeleteStep(0); setDeleteConfirmText(''); }}
                          className="px-4 py-2 border border-app-border text-app-text-secondary text-sm rounded-lg hover:bg-app-hover"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SettingsSection>
      )}

      {/* Bottom Save button (mobile friendly) */}
      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saveMsg && (
            <span className={`text-xs ${saveMsg.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
              {saveMsg}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Settings Section wrapper ----

function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-5">
      <h3 className="text-sm font-semibold text-app-text mb-4 flex items-center gap-2">
        <span>{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ---- Notification Toggle ----

function NotificationToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between px-1 py-2.5 cursor-pointer hover:bg-app-hover rounded-lg transition">
      <div>
        <div className="text-sm text-app-text">{label}</div>
        <div className="text-[10px] text-app-text-muted">{description}</div>
      </div>
      <div
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        className={`relative w-10 h-6 rounded-full transition-colors ${
          checked ? 'bg-gray-900' : 'bg-gray-300'
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-app-surface shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </div>
    </label>
  );
}
