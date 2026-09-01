'use client';

import { useState, useEffect } from 'react';
import SlidePanel from './SlidePanel';
import FileUpload from '@/components/FileUpload';

const CARRIERS = [
  'USPS',
  'UPS',
  'FedEx',
  'Amazon',
  'DHL',
  'OnTrac',
  'Other',
];

const STATUSES = [
  { value: 'expected', label: 'Expected' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'lost', label: 'Lost' },
  { value: 'returned', label: 'Returned' },
];

export default function PackageSlidePanel({
  open,
  onClose,
  onSave,
  pkg,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => Promise<void>;
  pkg?: Record<string, any> | null; // null = create, object = edit
}) {
  const isEdit = !!pkg;

  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [description, setDescription] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [status, setStatus] = useState('expected');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

  useEffect(() => {
    if (pkg) {
      setCarrier(pkg.carrier || '');
      setTrackingNumber(pkg.tracking_number || '');
      setVendorName(pkg.vendor_name || '');
      setDescription(pkg.description || '');
      setExpectedAt(pkg.expected_at ? pkg.expected_at.split('T')[0] : '');
      setStatus(pkg.status || 'expected');
      setMediaFiles([]);
    } else {
      setCarrier('');
      setTrackingNumber('');
      setVendorName('');
      setDescription('');
      setExpectedAt('');
      setStatus('expected');
      setMediaFiles([]);
    }
    setError('');
  }, [pkg, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    setError('');
    try {
      const payload: Record<string, any> = {
        carrier: carrier || undefined,
        tracking_number: trackingNumber.trim() || undefined,
        vendor_name: vendorName.trim() || undefined,
        description: description.trim() || undefined,
        expected_at: expectedAt ? new Date(expectedAt).toISOString() : undefined,
        _mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
      };
      if (isEdit) {
        payload.status = status;
      }
      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Package' : 'Track Package'}
      subtitle={isEdit ? (pkg?.description || pkg?.vendor_name) : 'Add a package to track'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
            {error}
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1">What is it?</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., New coffee maker, Amazon order"
            className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            maxLength={200}
          />
        </div>

        {/* Vendor / Store */}
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1">Store / Vendor</label>
          <input
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="e.g., Amazon, Target, eBay"
            className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            maxLength={200}
          />
        </div>

        {/* Carrier */}
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-2">Carrier</label>
          <div className="flex flex-wrap gap-2">
            {CARRIERS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCarrier(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  carrier === c
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-app-surface text-app-text-strong border-app-border hover:border-app-border'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Tracking Number */}
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1">Tracking Number</label>
          <input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Optional — paste tracking number"
            className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
          />
        </div>

        {/* Expected Delivery */}
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1">Expected Delivery</label>
          <input
            type="date"
            value={expectedAt}
            onChange={(e) => setExpectedAt(e.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Photos (optional) */}
        <FileUpload
          label="Photos (optional)"
          accept={['image']}
          maxFiles={5}
          maxSize={100 * 1024 * 1024}
          files={mediaFiles}
          onFilesSelected={setMediaFiles}
          helperText="Upload a screenshot of the order or delivery notification."
          compact
        />

        {/* Status (edit only) */}
        {isEdit && (
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${
                    status === s.value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-app-surface text-app-text-secondary border-app-border hover:border-app-border'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-3 border-t border-app-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Package' : 'Track Package'}
          </button>
        </div>
      </form>
    </SlidePanel>
  );
}
