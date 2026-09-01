import { useEffect, useState, useCallback } from 'react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import { Users, ShieldCheck } from 'lucide-react';
import type { SeatListItem } from '@pantopus/types';
import { SeatCard, InviteSeatModal, EditSeatModal } from '../seats';

interface TeamTabProps {
  team: Record<string, any>[];
  businessId: string;
  access: { hasAccess: boolean; isOwner: boolean; role_base: string | null };
  onUpdate: () => void;
}

export default function TeamTab({ businessId, access, onUpdate }: TeamTabProps) {
  const [seats, setSeats] = useState<SeatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editingSeat, setEditingSeat] = useState<SeatListItem | null>(null);

  const canManage = access.isOwner || access.role_base === 'admin';

  const fetchSeats = useCallback(async () => {
    try {
      const res = await api.businessSeats.getBusinessSeats(businessId);
      setSeats(res.seats || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load seats';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchSeats(); }, [fetchSeats]);

  const handleRemove = async (seat: SeatListItem) => {
    const yes = await confirmStore.open({
      title: 'Remove this seat?',
      description: `"${seat.display_name || 'Unnamed seat'}" will be deactivated and lose all access to this business.`,
      confirmLabel: 'Remove',
      variant: 'destructive',
    });
    if (!yes) return;
    try {
      await api.businessSeats.removeSeat(businessId, seat.id);
      toast.success('Seat removed');
      fetchSeats();
      onUpdate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to remove seat';
      toast.error(msg);
    }
  };

  const handleInviteSuccess = () => {
    fetchSeats();
    onUpdate();
  };

  const handleEditSuccess = () => {
    fetchSeats();
    onUpdate();
  };

  // Separate active vs pending seats
  const activeSeats = seats.filter((s) => s.invite_status === 'accepted');
  const pendingSeats = seats.filter((s) => s.invite_status === 'pending');
  const otherSeats = seats.filter((s) => s.invite_status !== 'accepted' && s.invite_status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-app">Team Seats</h2>
          <p className="text-sm text-app-secondary mt-0.5">
            Manage business identities. Each seat is an opaque identity — personal accounts stay private.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
          >
            Create seat
          </button>
        )}
      </div>

      {/* Privacy banner */}
      <div className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-5 py-4">
        <ShieldCheck className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-violet-800">Profiles & Privacy active</p>
          <p className="text-xs text-violet-600 mt-0.5">
            Team members interact through their seat identity. Personal profiles, connections, and activity remain completely separated.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-app bg-surface p-8 text-center">
          <div className="text-app-secondary text-sm">Loading seats…</div>
        </div>
      ) : seats.length === 0 ? (
        <div className="rounded-xl border border-app bg-surface p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-muted flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6 text-app-secondary" />
          </div>
          <p className="text-sm font-medium text-app mb-1">No seats yet</p>
          <p className="text-xs text-app-secondary mb-4">Create a seat and invite someone to join.</p>
          {canManage && (
            <button
              onClick={() => setShowInvite(true)}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
            >
              Create first seat
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active seats */}
          {activeSeats.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-app-secondary mb-2">
                Active ({activeSeats.length})
              </h3>
              <div className="rounded-xl border border-app bg-surface divide-y divide-app">
                {activeSeats.map((seat) => (
                  <SeatCard
                    key={seat.id}
                    seat={seat}
                    canManage={canManage}
                    onEdit={setEditingSeat}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pending invites */}
          {pendingSeats.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-app-secondary mb-2">
                Pending invites ({pendingSeats.length})
              </h3>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 divide-y divide-amber-200">
                {pendingSeats.map((seat) => (
                  <SeatCard
                    key={seat.id}
                    seat={seat}
                    canManage={canManage}
                    onEdit={setEditingSeat}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Declined / expired */}
          {otherSeats.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-app-secondary mb-2">
                Inactive ({otherSeats.length})
              </h3>
              <div className="rounded-xl border border-app bg-surface-muted divide-y divide-app">
                {otherSeats.map((seat) => (
                  <SeatCard
                    key={seat.id}
                    seat={seat}
                    canManage={canManage}
                    onEdit={setEditingSeat}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <InviteSeatModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        businessId={businessId}
        onSuccess={handleInviteSuccess}
      />
      <EditSeatModal
        open={!!editingSeat}
        onClose={() => setEditingSeat(null)}
        businessId={businessId}
        seat={editingSeat}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
