'use client';

import { useRouter } from 'next/navigation';
import { Home, Plus, User, Building2 } from 'lucide-react';
import type { HubHome, HubBusiness, Persona } from './types';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface HubTopBarProps {
  activeHome: HubHome | null;
  homes: HubHome[];
  businesses: HubBusiness[];
  activePersona: Persona;
  userName: string;
  username: string;
  homePickerOpen: boolean;
  setHomePickerOpen: (v: boolean) => void;
  personaPickerOpen: boolean;
  setPersonaPickerOpen: (v: boolean) => void;
  onSwitchHome: (id: string | null) => void;
  onSwitchPersona: (p: Persona) => void;
}

export default function HubTopBar({
  activeHome, homes, businesses, activePersona, userName, username,
  homePickerOpen, setHomePickerOpen,
  personaPickerOpen, setPersonaPickerOpen,
  onSwitchHome, onSwitchPersona,
}: HubTopBarProps) {
  const router = useRouter();
  const firstName = userName?.split(' ')[0] || username;
  const contextLine = activeHome ? activeHome.name : homes.length === 0 ? 'No home attached' : 'Select a home';

  return (
    <div className="flex items-center justify-between gap-3">
      {/* Left: Home switcher */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setHomePickerOpen(!homePickerOpen)}
          className="flex items-center gap-2 px-3 py-1.5 bg-app-surface border border-app-border rounded-full text-sm font-medium text-app-text-strong hover:bg-app-hover dark:hover:bg-gray-700 transition shadow-sm"
        >
          {activeHome ? <Home className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span className="max-w-[120px] truncate hidden sm:inline">
            {activeHome ? activeHome.name : 'Attach Home'}
          </span>
          <svg className="w-3.5 h-3.5 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {homePickerOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setHomePickerOpen(false)} />
            <div className="absolute left-0 top-full mt-1 w-64 bg-app-surface border border-app-border rounded-xl shadow-xl z-50 py-1 overflow-hidden">
              {homes.length === 0 ? (
                <button
                  onClick={() => { setHomePickerOpen(false); router.push('/app/homes/new'); }}
                  className="w-full px-4 py-3 text-left text-sm text-primary-600 hover:bg-app-hover dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Attach a Home
                </button>
              ) : (
                <>
                  {homes.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => onSwitchHome(h.id)}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-app-hover dark:hover:bg-gray-700 flex items-center gap-2 ${
                        h.id === activeHome?.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium' : 'text-app-text-strong'
                      }`}
                    >
                      <Home className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{h.name}</span>
                      {h.isPrimary && (
                        <span className="ml-auto text-[10px] bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 px-1.5 py-0.5 rounded-full">Primary</span>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => { setHomePickerOpen(false); router.push('/app/homes/new'); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-primary-600 hover:bg-app-hover dark:hover:bg-gray-700 flex items-center gap-2 border-t border-app-border mt-1 pt-2"
                  >
                    <Plus className="w-4 h-4" /> Add another home
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Center: Greeting + context */}
      <div className="text-center flex-1 min-w-0">
        <h1 className="text-lg font-bold text-app-text dark:text-white truncate">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-xs text-app-text-secondary dark:text-app-text-muted truncate">{contextLine}</p>
      </div>

      {/* Right: Persona switcher */}
      {businesses.length > 0 ? (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setPersonaPickerOpen(!personaPickerOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-app-surface border border-app-border rounded-full text-sm font-medium text-app-text-strong hover:bg-app-hover dark:hover:bg-gray-700 transition shadow-sm"
          >
            <span className="max-w-[80px] truncate">
              {activePersona.type === 'personal'
                ? 'Personal'
                : businesses.find((b) => b.id === (activePersona as { type: 'business'; businessId: string }).businessId)?.name || 'Business'}
            </span>
            <svg className="w-3.5 h-3.5 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {personaPickerOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPersonaPickerOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-56 bg-app-surface border border-app-border rounded-xl shadow-xl z-50 py-1">
                <button
                  onClick={() => onSwitchPersona({ type: 'personal' })}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-app-hover dark:hover:bg-gray-700 flex items-center gap-2 ${
                    activePersona.type === 'personal' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium' : 'text-app-text-strong'
                  }`}
                >
                  <User className="w-4 h-4" /> Personal
                </button>
                {businesses.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onSwitchPersona({ type: 'business', businessId: b.id })}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-app-hover dark:hover:bg-gray-700 flex items-center gap-2 ${
                      activePersona.type === 'business' && (activePersona as { type: 'business'; businessId: string }).businessId === b.id
                        ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-medium'
                        : 'text-app-text-strong'
                    }`}
                  >
                    <Building2 className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{b.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="w-10" />
      )}
    </div>
  );
}
