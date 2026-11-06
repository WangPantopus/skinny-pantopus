'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';

export default function BusinessTeamInvitePage() {
  const params = useParams();
  const router = useRouter();
  const businessId = String(params.id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    username: '',
    role_base: 'viewer',
    title: '',
  });

  const submit = async () => {
    if (!form.username.trim()) {
      setError('Username is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.businessIam.addTeamMember(businessId, {
        username: form.username.trim().replace(/^@/, ''),
        role_base: form.role_base,
        title: form.title.trim() || undefined,
      });
      router.push(`/app/business/${businessId}/team`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to invite member');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-app-text">Invite Team Member</h1>
        <Link href={`/app/business/${businessId}/team`} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover">
          Back
        </Link>
      </div>

      <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4">
        <Field label="Username" value={form.username} onChange={(v) => setForm((f) => ({ ...f, username: v }))} placeholder="@username" />
        <label className="block">
          <div className="text-sm font-medium text-app-text-strong mb-1">Role</div>
          <select value={form.role_base} onChange={(e) => setForm((f) => ({ ...f, role_base: e.target.value }))} className="w-full rounded-lg border border-app-border px-3 py-2 text-sm">
            {['viewer', 'staff', 'editor', 'admin'].map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
        <Field label="Title" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="Store Manager" />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
          {saving ? 'Sending...' : 'Send Invite'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-app-text-strong mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-app-border px-3 py-2 text-sm"
      />
    </label>
  );
}
