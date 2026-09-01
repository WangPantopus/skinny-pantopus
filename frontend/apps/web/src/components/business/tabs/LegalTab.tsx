'use client';

import { useState, useEffect } from 'react';
import { Lock, Award, CheckCircle, Clock } from 'lucide-react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

interface Props {
  businessId: string;
  businessType?: string;
}

export default function LegalTab({ businessId, businessType }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ legal_name: '', tax_id_last4: '', support_email: '' });
  const [hasData, setHasData] = useState(false);

  // Nonprofit verification
  const [nonprofitStatus, setNonprofitStatus] = useState<{
    ein_submitted: boolean; ein_approved: boolean; ein_pending: boolean; awaiting_verification: boolean;
  } | null>(null);
  const [uploadingEin, setUploadingEin] = useState(false);

  const isNonprofit = businessType === 'nonprofit_501c3';

  useEffect(() => {
    loadPrivateData();
    if (isNonprofit) loadNonprofitStatus();
  }, [businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadNonprofitStatus = async () => {
    try {
      const result = await api.businesses.getVerificationStatus(businessId);
      if ((result as any).nonprofit_verification) setNonprofitStatus((result as any).nonprofit_verification);
    } catch { /* ignore */ }
  };

  const loadPrivateData = async () => {
    setLoading(true);
    try {
      const result = await api.businesses.getBusinessPrivate(businessId);
      const data = result.private || {};
      setForm({ legal_name: data.legal_name || '', tax_id_last4: data.tax_id_last4 || '', support_email: data.support_email || '' });
      setHasData(!!data.business_user_id);
    } catch (e: any) {
      if (e?.status !== 403) toast.error(e?.message || 'Failed to load legal info');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.businesses.updateBusinessPrivate(businessId, {
        legal_name: form.legal_name || undefined,
        tax_id_last4: form.tax_id_last4 || undefined,
        support_email: form.support_email || undefined,
      });
      toast.success('Legal information updated');
      setHasData(true);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadEvidence = async (evidenceType: 'ein_verification' | 'tax_exempt_letter') => {
    // Use file input to get file ID (simplified — real flow would upload first)
    const fileId = window.prompt('Enter the file ID of your uploaded document');
    if (!fileId?.trim()) return;
    setUploadingEin(true);
    try {
      await api.businesses.uploadVerificationEvidence(businessId, {
        evidence_type: evidenceType,
        file_id: fileId.trim(),
      });
      toast.success('Document submitted for admin review');
      await loadNonprofitStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to upload evidence');
    } finally {
      setUploadingEin(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><div className="animate-spin h-8 w-8 border-3 border-violet-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-app-text">Legal &amp; Finance</h2>
        <button onClick={loadPrivateData} className="text-xs text-violet-600 font-medium hover:underline">Refresh</button>
      </div>

      {/* Privacy banner */}
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
        <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <p className="text-xs text-amber-800">This information is private and only visible to the business owner.</p>
      </div>

      {/* Nonprofit verification */}
      {isNonprofit && (
        <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-violet-600" />
            <h3 className="text-sm font-semibold text-app-text">Nonprofit Verification</h3>
          </div>

          {nonprofitStatus?.ein_approved ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">501(c)(3) Status Verified</p>
                <p className="text-xs text-green-700 mt-0.5">Your platform fee has been set to 0%.</p>
              </div>
            </div>
          ) : nonprofitStatus?.ein_pending ? (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Pending Admin Review</p>
                <p className="text-xs text-amber-700 mt-0.5">Your EIN / tax-exempt documentation is being reviewed.</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-app-text-secondary mb-3">
                Upload your IRS determination letter or EIN verification to confirm your 501(c)(3) status and unlock a 0% platform fee.
              </p>
              <div className="flex gap-2">
                <button onClick={() => handleUploadEvidence('ein_verification')} disabled={uploadingEin}
                  className="flex-1 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition">
                  {uploadingEin ? 'Uploading...' : 'Upload EIN Letter'}
                </button>
                <button onClick={() => handleUploadEvidence('tax_exempt_letter')} disabled={uploadingEin}
                  className="flex-1 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition">
                  {uploadingEin ? 'Uploading...' : 'Upload 501(c)(3) Letter'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legal form */}
      <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4">
        <div>
          <label className="text-xs text-app-text-secondary mb-1 block">Legal Business Name</label>
          <input type="text" value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} placeholder="Registered business name"
            className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-violet-500" />
        </div>
        <div>
          <label className="text-xs text-app-text-secondary mb-1 block">Tax ID (last 4 digits)</label>
          <input type="text" value={form.tax_id_last4} onChange={e => setForm(f => ({ ...f, tax_id_last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="e.g. 1234" maxLength={4}
            className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-violet-500" />
        </div>
        <div>
          <label className="text-xs text-app-text-secondary mb-1 block">Support Email</label>
          <input type="email" value={form.support_email} onChange={e => setForm(f => ({ ...f, support_email: e.target.value }))} placeholder="support@yourbusiness.com"
            className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-violet-500" />
        </div>
        <button onClick={handleSave} disabled={saving}
          className="w-full py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition">
          {saving ? 'Saving...' : hasData ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  );
}
