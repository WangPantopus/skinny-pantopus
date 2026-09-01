'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { ThumbsUp, Eye, PartyPopper, Heart, Smile } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

type PartyParticipant = {
  user_id: string;
  name?: string;
  present: boolean;
  avatar_url?: string;
};

type FloatingReaction = {
  id: string;
  emoji: ReactNode;
  fromUser: string;
  createdAt: number;
};

type FamilyMailPartyProps = {
  itemId: string;
  currentUserId: string;
  currentUserName: string;
  /** Polls presence endpoint every 3 seconds */
  checkPresence: (itemId: string) => Promise<PartyParticipant[]>;
  /** Creates or joins a party session */
  createParty: (itemId: string) => Promise<{ sessionId: string }>;
  /** Sends an ephemeral reaction */
  sendReaction: (sessionId: string, emoji: string) => Promise<void>;
  /** Assigns the mail item to a household member */
  assignToMember: (sessionId: string, userId: string) => Promise<void>;
  /** Called when the mail content should be revealed */
  onReveal: () => void;
};

const REACTION_ITEMS: { key: string; icon: ReactNode }[] = [
  { key: 'thumbsup', icon: <ThumbsUp className="w-5 h-5" /> },
  { key: 'eye', icon: <Eye className="w-5 h-5" /> },
  { key: 'party', icon: <PartyPopper className="w-5 h-5" /> },
  { key: 'heart', icon: <Heart className="w-5 h-5" /> },
  { key: 'smile', icon: <Smile className="w-5 h-5" /> },
];
const REACTION_TTL = 5000;
const PRESENCE_POLL_MS = 3000;

// ── Main component ───────────────────────────────────────────

export default function FamilyMailParty({
  itemId,
  currentUserId,
  currentUserName,
  checkPresence,
  createParty,
  sendReaction,
  assignToMember,
  onReveal,
}: FamilyMailPartyProps) {
  const [participants, setParticipants] = useState<PartyParticipant[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'detect' | 'invite' | 'countdown' | 'revealed' | 'hidden'>('detect');
  const [countdown, setCountdown] = useState(3);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [assigning, setAssigning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reactionCleanupRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Presence polling ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const members = await checkPresence(itemId);
        if (cancelled) return;
        const others = members.filter(m => m.user_id !== currentUserId && m.present);
        setParticipants(others);

        if (phase === 'detect' && others.length > 0) {
          setPhase('invite');
        }
      } catch {
        // Degrade gracefully — no banner if presence fails
      }
    };

    poll();
    pollRef.current = setInterval(poll, PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [itemId, currentUserId, checkPresence, phase]);

  // ── Reaction cleanup (ephemeral — fade after 5s) ──────────
  useEffect(() => {
    reactionCleanupRef.current = setInterval(() => {
      const now = Date.now();
      setReactions(prev => prev.filter(r => now - r.createdAt < REACTION_TTL));
    }, 500);
    return () => {
      if (reactionCleanupRef.current) clearInterval(reactionCleanupRef.current);
    };
  }, []);

  // ── Open Together ─────────────────────────────────────────
  const handleOpenTogether = useCallback(async () => {
    try {
      const result = await createParty(itemId);
      setSessionId(result.sessionId);
      setPhase('countdown');
      setCountdown(3);
    } catch {
      // Fallback to solo open
      setPhase('revealed');
      onReveal();
    }
  }, [createParty, itemId, onReveal]);

  // ── Countdown timer ───────────────────────────────────────
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      setPhase('revealed');
      onReveal();
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown, onReveal]);

  // ── Open Solo ─────────────────────────────────────────────
  const handleOpenSolo = useCallback(() => {
    setPhase('hidden');
    onReveal();
  }, [onReveal]);

  // ── Send reaction ─────────────────────────────────────────
  const handleReaction = useCallback(async (key: string, icon: ReactNode) => {
    if (!sessionId) return;
    const reaction: FloatingReaction = {
      id: `${Date.now()}-${Math.random()}`,
      emoji: icon,
      fromUser: currentUserName,
      createdAt: Date.now(),
    };
    setReactions(prev => [...prev, reaction]);
    try {
      await sendReaction(sessionId, key);
    } catch {
      // Best-effort — reaction is ephemeral
    }
  }, [sessionId, currentUserName, sendReaction]);

  // ── Assign handling ───────────────────────────────────────
  const handleAssign = useCallback(async (userId: string) => {
    if (!sessionId) return;
    setAssigning(true);
    try {
      await assignToMember(sessionId, userId);
    } finally {
      setAssigning(false);
    }
  }, [sessionId, assignToMember]);

  // ── Nothing to show ───────────────────────────────────────
  if (phase === 'detect' || phase === 'hidden') return null;

  // ── Invite banner ─────────────────────────────────────────
  if (phase === 'invite') {
    const other = participants[0];
    return (
      <div className="mx-6 my-3 px-4 py-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl">
        <div className="flex items-center gap-3">
          <PartyPopper className="w-5 h-5 text-purple-600 flex-shrink-0" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {other?.avatar_url ? (
              <img src={other.avatar_url} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300">
                  {(other?.name || '?').charAt(0)}
                </span>
              </div>
            )}
            <p className="text-sm text-purple-900 dark:text-purple-200">
              <span className="font-semibold">{other?.name || 'Someone'}</span> is also viewing this mail
            </p>
          </div>
        </div>
        <p className="text-xs text-purple-700 dark:text-purple-400 ml-9 mt-1 mb-3">Open together?</p>
        <div className="flex items-center gap-2 ml-9">
          <button
            type="button"
            onClick={handleOpenTogether}
            className="px-4 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Open Together
          </button>
          <button
            type="button"
            onClick={handleOpenSolo}
            className="px-4 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-700 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
          >
            Open Solo
          </button>
        </div>
      </div>
    );
  }

  // ── Countdown ─────────────────────────────────────────────
  if (phase === 'countdown') {
    return (
      <div className="mx-6 my-3 px-4 py-6 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          {/* Current user avatar */}
          <div className="w-10 h-10 rounded-full bg-primary-200 dark:bg-primary-800 flex items-center justify-center">
            <span className="text-sm font-bold text-primary-700 dark:text-primary-300">
              {currentUserName.charAt(0)}
            </span>
          </div>
          {/* Other participant(s) */}
          {participants.map((p) => (
            <div key={p.user_id} className="w-10 h-10 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full" />
              ) : (
                <span className="text-sm font-bold text-purple-700 dark:text-purple-300">
                  {(p.name || '?').charAt(0)}
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="text-lg font-bold text-purple-900 dark:text-purple-200">
          Opening together in {countdown}...
        </p>
      </div>
    );
  }

  // ── Revealed — reactions + assign ─────────────────────────
  return (
    <div className="relative">
      {/* Floating reactions */}
      <div className="fixed bottom-24 right-8 pointer-events-none z-40">
        {reactions.map((r) => {
          const age = Date.now() - r.createdAt;
          const opacity = Math.max(0, 1 - age / REACTION_TTL);
          const translateY = -(age / REACTION_TTL) * 80;
          return (
            <div
              key={r.id}
              className="absolute right-0 bottom-0 transition-none"
              style={{
                opacity,
                transform: `translateY(${translateY}px)`,
              }}
            >
              <span className="text-purple-600">{r.emoji}</span>
            </div>
          );
        })}
      </div>

      {/* Reaction bar + assign */}
      <div className="mx-6 my-3 px-4 py-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl">
        {/* Reaction buttons */}
        <div className="flex items-center gap-2 mb-3">
          {REACTION_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handleReaction(item.key, item.icon)}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors text-purple-600"
            >
              {item.icon}
            </button>
          ))}
        </div>

        {/* Assign section */}
        <div className="flex items-center gap-2 border-t border-purple-200 dark:border-purple-700 pt-3">
          <p className="text-xs text-purple-700 dark:text-purple-400 flex-1">
            Who&apos;s handling this?
          </p>
          <button
            type="button"
            onClick={() => handleAssign(currentUserId)}
            disabled={assigning}
            className="px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            Assign to me
          </button>
          {participants.map((p) => (
            <button
              key={p.user_id}
              type="button"
              onClick={() => handleAssign(p.user_id)}
              disabled={assigning}
              className="px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-700 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors disabled:opacity-50"
            >
              Assign to {p.name?.split(' ')[0] || 'them'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
