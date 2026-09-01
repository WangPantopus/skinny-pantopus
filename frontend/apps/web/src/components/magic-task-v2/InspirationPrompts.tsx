'use client';

import { useState, useEffect } from 'react';

const PROMPTS = [
  { icon: '\uD83D\uDECB\uFE0F', text: 'Help moving a couch', distance: '0.3 mi away' },
  { icon: '\uD83D\uDC15', text: 'Dog walker needed this afternoon', distance: '1.2 mi away' },
  { icon: '\uD83D\uDD27', text: 'Leaky faucet repair', distance: '0.8 mi away' },
  { icon: '\uD83D\uDEDA', text: 'Pick up my Costco order', distance: '0.5 mi away' },
  { icon: '\uD83D\uDEE0\uFE0F', text: 'IKEA furniture assembly', distance: '1.0 mi away' },
  { icon: '\uD83C\uDF3F', text: 'Yard cleanup after storm', distance: '0.4 mi away' },
];

const VISIBLE_COUNT = 3;
const ROTATE_MS = 5000;
const FADE_MS = 500;

interface InspirationPromptsProps {
  visible: boolean;
  onSelect: (text: string) => void;
}

export default function InspirationPrompts({ visible, onSelect }: InspirationPromptsProps) {
  const [startIdx, setStartIdx] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setStartIdx((i) => (i + VISIBLE_COUNT) % PROMPTS.length);
        setFading(false);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const currentPrompts = Array.from({ length: VISIBLE_COUNT }, (_, i) =>
    PROMPTS[(startIdx + i) % PROMPTS.length]
  );

  return (
    <div className="inspiration">
      <p className="inspiration-label">People nearby are asking for...</p>
      <div className={`inspiration-cards${fading ? ' fading' : ''}`}>
        {currentPrompts.map((p, i) => (
          <button
            key={`${startIdx}-${i}`}
            className="inspiration-card"
            onClick={() => onSelect(p.text)}
          >
            <span className="card-icon">{p.icon}</span>
            <span className="card-text">{p.text}</span>
            <span className="card-distance">{p.distance}</span>
          </button>
        ))}
      </div>

      <style jsx>{`
        .inspiration {
          display: flex;
          flex-direction: column;
          gap: 10px;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .inspiration-label {
          font-size: 13px;
          color: rgb(var(--app-text-muted));
          margin: 0;
          font-weight: 500;
        }
        .inspiration-cards {
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: opacity ${FADE_MS}ms ease;
        }
        .inspiration-cards.fading {
          opacity: 0;
        }
        .inspiration-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: rgb(var(--app-surface-raised));
          border: 1px solid rgb(var(--app-border-subtle));
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          text-align: left;
          width: 100%;
        }
        .inspiration-card:hover {
          background: rgba(2, 132, 199, 0.08);
          border-color: rgba(2, 132, 199, 0.35);
        }
        .card-icon {
          font-size: 18px;
          flex-shrink: 0;
        }
        .card-text {
          flex: 1;
          font-size: 14px;
          color: rgb(var(--app-text-strong));
          font-weight: 500;
        }
        .card-distance {
          font-size: 12px;
          color: rgb(var(--app-text-muted));
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
