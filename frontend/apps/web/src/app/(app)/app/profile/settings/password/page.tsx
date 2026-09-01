'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

function getStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 2) return { score, label: 'Fair', color: 'bg-amber-500' };
  if (score <= 3) return { score, label: 'Good', color: 'bg-emerald-500' };
  return { score, label: 'Strong', color: 'bg-emerald-600' };
}

function PasswordContent() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const strength = getStrength(newPassword);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await api.auth.updatePassword({
        currentPassword,
        newPassword,
      });
      toast.success('Password updated successfully');
      router.back();
    } catch (err: any) {
      setError(err?.message || 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-app-text" />
        </button>
        <h1 className="text-xl font-bold text-app-text">Change Password</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Current password */}
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-app-text-strong">Current Password</span>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
              className="w-full px-3 py-2.5 pr-10 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </label>

        {/* New password */}
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-app-text-strong">New Password</span>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="w-full px-3 py-2.5 pr-10 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button type="button" onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {/* Strength meter */}
          {newPassword.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className={`h-1 flex-1 rounded-full ${n <= strength.score ? strength.color : 'bg-gray-200'}`} />
                ))}
              </div>
              <p className={`text-xs font-medium ${strength.score <= 1 ? 'text-red-600' : strength.score <= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {strength.label}
              </p>
            </div>
          )}
        </label>

        {/* Confirm password */}
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-app-text-strong">Confirm New Password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
            className={`w-full px-3 py-2.5 border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 ${
              mismatch ? 'border-red-400 focus:ring-red-400' : 'border-app-border focus:ring-emerald-400'
            }`}
          />
          {mismatch && <p className="text-xs text-red-600">Passwords do not match</p>}
        </label>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Security note */}
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-700 leading-relaxed">
            Use a unique password with at least 8 characters, including uppercase, numbers, and symbols for best security.
          </p>
        </div>

        <button type="submit" disabled={!canSubmit}
          className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-base hover:bg-emerald-700 disabled:opacity-50 transition">
          {submitting ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}

export default function PasswordPage() { return <Suspense><PasswordContent /></Suspense>; }
