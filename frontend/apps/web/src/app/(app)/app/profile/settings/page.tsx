// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken, clearAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import AccountDeleteModal from '@/components/profile/AccountDeleteModal';
import type { User } from '@pantopus/types';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Settings state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState('public');
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const userData = await api.users.getMyProfile();
      setUser(userData);

      // Load saved preferences (from userData or localStorage)
      setEmailNotifications(userData.email_notifications ?? true);
      setPushNotifications(userData.push_notifications ?? true);
      setProfileVisibility(userData.profile_visibility || 'public');
      setShowEmail(userData.show_email ?? false);
      setShowPhone(userData.show_phone ?? false);

    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveSettings = async () => {
    try {
      const settings = {
        email_notifications: emailNotifications,
        push_notifications: pushNotifications,
        profile_visibility: profileVisibility,
        show_email: showEmail,
        show_phone: showPhone,
      };

      await api.users.updateProfile(settings as Record<string, unknown>);
      toast.success('Settings saved successfully');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  const handleLogout = async () => {
    try { await api.auth.logout(); } catch { /* cookies cleared by backend */ }
    clearAuthToken();
    router.push('/login');
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.users.deleteAccount();
      clearAuthToken();
      toast.success('Account scheduled for deletion');
      router.push('/login');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Account deletion failed');
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-app-secondary">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-app">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-xl font-semibold text-app mb-6">Settings</h1>
        <div className="space-y-6">
          {/* Notifications */}
          <div className="bg-surface rounded-xl border border-app p-6">
            <h2 className="text-lg font-semibold text-app mb-4">Notifications</h2>
            <div className="space-y-4">
              <ToggleSetting
                label="Email Notifications"
                description="Receive email updates about your gigs and bids"
                checked={emailNotifications}
                onChange={setEmailNotifications}
              />
              <ToggleSetting
                label="Push Notifications"
                description="Receive push notifications on your device"
                checked={pushNotifications}
                onChange={setPushNotifications}
              />
              <button
                onClick={() => router.push('/app/settings/notifications')}
                className="w-full flex items-center justify-between px-4 py-3 border border-app rounded-lg hover-bg-app transition group mt-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🔔</span>
                  <div className="text-left">
                    <span className="font-medium text-app group-hover:text-primary-600 block">Notification Preferences</span>
                    <span className="text-xs text-app-secondary">Daily briefing, weather alerts, quiet hours</span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-app-muted group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Privacy */}
          <div className="bg-surface rounded-xl border border-app p-6">
            <h2 className="text-lg font-semibold text-app mb-4">Privacy</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">
                  Profile Visibility
                </label>
                <select
                  value={profileVisibility}
                  onChange={(e) => setProfileVisibility(e.target.value)}
                  className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="public">Public - Anyone can view</option>
                  <option value="registered">Registered Users Only</option>
                  <option value="private">Private - Only you</option>
                </select>
              </div>
              <ToggleSetting
                label="Show Email on Profile"
                description="Display your email address on your public profile"
                checked={showEmail}
                onChange={setShowEmail}
              />
              <ToggleSetting
                label="Show Phone Number"
                description="Display your phone number on your public profile"
                checked={showPhone}
                onChange={setShowPhone}
              />
              <button
                onClick={() => router.push('/app/profile/settings/privacy')}
                className="w-full flex items-center justify-between px-4 py-3 border border-app rounded-lg hover-bg-app transition group mt-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🛡️</span>
                  <div className="text-left">
                    <span className="font-medium text-app group-hover:text-primary-600 block">Advanced Privacy & Blocks</span>
                    <span className="text-xs text-app-secondary">Search visibility, field privacy, and profile blocks</span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-app-muted group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Payments & Payouts */}
          <div className="bg-surface rounded-xl border border-app p-6">
            <h2 className="text-lg font-semibold text-app mb-2">Payments & Payouts</h2>
            <p className="text-sm text-app-secondary mb-4">Manage payment methods, Stripe payouts, and view transaction history.</p>
            <button
              onClick={() => router.push('/app/settings/payments')}
              className="w-full flex items-center justify-between px-4 py-3 border border-app rounded-lg hover-bg-app transition group"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">💳</span>
                <span className="font-medium text-app group-hover:text-primary-600">Payment Settings</span>
              </div>
              <svg className="w-5 h-5 text-app-muted group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Account */}
          <div className="bg-surface rounded-xl border border-app p-6">
            <h2 className="text-lg font-semibold text-app mb-4">Account</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-app">
                <div>
                  <p className="font-medium text-app">Email</p>
                  <p className="text-sm text-app-secondary">{user?.email}</p>
                </div>
                <button
                  onClick={() => toast.info('Change email feature coming soon')}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Change
                </button>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-app">
                <div>
                  <p className="font-medium text-app">Password</p>
                  <p className="text-sm text-app-secondary">••••••••</p>
                </div>
                <button
                  onClick={() => router.push('/app/profile/settings/password')}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Change
                </button>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-app">Account Type</p>
                  <p className="text-sm text-app-secondary capitalize">{user?.accountType || user?.account_type || 'Individual'}</p>
                </div>
                <button
                  onClick={() => toast.info('Upgrade to business feature coming soon')}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Upgrade
                </button>
              </div>
            </div>
          </div>

          {/* Blocked Users */}
          <div className="bg-surface rounded-xl border border-app p-6">
            <h2 className="text-lg font-semibold text-app mb-2">Blocked Users</h2>
            <p className="text-sm text-app-secondary mb-4">Manage users you&apos;ve blocked from contacting you.</p>
            <button
              onClick={() => router.push('/app/profile/settings/blocked')}
              className="w-full flex items-center justify-between px-4 py-3 border border-app rounded-lg hover-bg-app transition group"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🚫</span>
                <span className="font-medium text-app group-hover:text-primary-600">Blocked Users</span>
              </div>
              <svg className="w-5 h-5 text-app-muted group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Legal */}
          <div className="bg-surface rounded-xl border border-app p-6">
            <h2 className="text-lg font-semibold text-app mb-4">Legal</h2>
            <div className="space-y-1">
              <a href="https://pantopus.com/terms" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 rounded-lg hover-bg-app transition">
                <span className="text-sm font-medium text-app">Terms of Service</span>
                <svg className="w-4 h-4 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
              <a href="https://pantopus.com/privacy" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 rounded-lg hover-bg-app transition">
                <span className="text-sm font-medium text-app">Privacy Policy</span>
                <svg className="w-4 h-4 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
              <a href="https://pantopus.com/licenses" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 rounded-lg hover-bg-app transition">
                <span className="text-sm font-medium text-app">Licenses</span>
                <svg className="w-4 h-4 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveSettings}
            className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-semibold"
          >
            Save Settings
          </button>

          {/* Danger Zone */}
          <div className="bg-red-50 rounded-xl border border-red-200 p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-app">Log Out</p>
                  <p className="text-sm text-app-secondary">Sign out of your account</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-6 py-2 border border-app-strong text-app-strong rounded-lg hover-bg-app font-medium"
                >
                  Log Out
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-red-900">Delete Account</p>
                  <p className="text-sm text-red-600">Permanently delete your account and all data</p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={deleting}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AccountDeleteModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-app last:border-0">
      <div className="flex-1">
        <p className="font-medium text-app">{label}</p>
        <p className="text-sm text-app-secondary">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          checked ? 'bg-primary-600' : 'bg-surface-muted'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-app-surface shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
