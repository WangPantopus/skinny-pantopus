'use client';

import { useState } from 'react';

interface SkillsCardProps {
  skills: string[];
  onAction: () => void;
  ownerView: boolean;
}

export default function SkillsCard({ skills, onAction, ownerView }: SkillsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? skills : skills.slice(0, 6);

  return (
    <div className="bg-surface rounded-xl border border-app p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-app">Skills</h3>
        {ownerView && (
          <button onClick={onAction} className="text-sm text-primary-600">Edit</button>
        )}
      </div>
      {skills.length === 0 ? (
        <p className="text-sm text-app-secondary">No skills added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {visible.map((skill, idx) => (
            <button
              key={`${skill}-${idx}`}
              onClick={onAction}
              className="px-3 py-1.5 rounded-full border border-app bg-surface-muted text-sm text-app-strong"
            >
              {skill}
            </button>
          ))}
        </div>
      )}
      {skills.length > 6 && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-3 text-sm text-primary-600">
          {expanded ? 'Show less' : `Show more (${skills.length - 6})`}
        </button>
      )}
    </div>
  );
}
