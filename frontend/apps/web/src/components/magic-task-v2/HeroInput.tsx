'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

const PLACEHOLDERS = [
  'Need someone to help move a couch tonight',
  'Can someone pick up my Costco order?',
  'Looking for a dog walker this week',
  'My kitchen faucet is leaking, need a plumber',
  'Anyone free to help assemble IKEA furniture?',
];

const ROTATE_MS = 4000;
const FADE_MS = 600;

interface HeroInputProps {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
}

export default function HeroInput({ value, onChange, disabled }: HeroInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [focused, setFocused] = useState(false);

  // Rotate placeholder text
  useEffect(() => {
    if (value.length > 0) return;
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length);
        setFading(false);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [value]);

  // Auto-grow textarea
  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(120, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [value, autoGrow]);

  const charCount = value.length;

  return (
    <div className="hero-input-wrapper">
      <h2 className="hero-heading">What do you need help with?</h2>
      <div className={`hero-textarea-container${focused ? ' focused' : ''}`}>
        <textarea
          ref={textareaRef}
          className="hero-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          rows={3}
          maxLength={2000}
        />
        {value.length === 0 && (
          <span className={`hero-placeholder${fading ? ' fading' : ''}`}>
            {PLACEHOLDERS[placeholderIdx]}
          </span>
        )}
        {charCount > 0 && (
          <span className="hero-charcount">{charCount}/2000</span>
        )}
      </div>

      <style jsx>{`
        .hero-input-wrapper {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .hero-heading {
          font-size: 22px;
          font-weight: 700;
          color: rgb(var(--app-text));
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hero-heading::before {
          content: '✨';
        }
        .hero-textarea-container {
          position: relative;
          border: 2px solid rgb(var(--app-border));
          border-radius: 16px;
          transition: border-color 0.2s, box-shadow 0.2s;
          background: rgb(var(--app-surface));
        }
        .hero-textarea-container.focused {
          border-color: var(--color-primary-600);
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.2);
        }
        .hero-textarea {
          width: 100%;
          min-height: 120px;
          padding: 16px;
          font-size: 18px;
          line-height: 1.5;
          color: rgb(var(--app-text));
          border: none;
          outline: none;
          resize: none;
          background: transparent;
          font-family: inherit;
        }
        .hero-placeholder {
          position: absolute;
          top: 16px;
          left: 16px;
          right: 16px;
          font-size: 18px;
          line-height: 1.5;
          color: rgb(var(--app-text-muted));
          pointer-events: none;
          transition: opacity ${FADE_MS}ms ease;
          opacity: 1;
        }
        .hero-placeholder.fading {
          opacity: 0;
        }
        .hero-charcount {
          position: absolute;
          bottom: 8px;
          right: 12px;
          font-size: 12px;
          color: rgb(var(--app-text-muted));
        }
      `}</style>
    </div>
  );
}
