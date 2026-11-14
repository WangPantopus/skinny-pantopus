'use client';

// ============================================================
// Today before an address (TABCARD 4a, drawing TodayNoAddress): the start
// card for someone with no Home, no saved address and no claim in review, and
// the card that ends the city view. Both send "Type my address" / "Add your
// address" to Place's address-first page (the one with the address box).
// ============================================================

import { Loader2, LocateFixed, MapPin, Sun } from 'lucide-react';

/** Place's address-first page: the address box, then a preview to save. */
export const ADDRESS_FIRST_PATH = '/start';

const PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60 transition';
const SECONDARY = 'inline-flex items-center justify-center gap-2 rounded-xl border border-app px-4 py-2.5 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition';

export function TodayAreaStart({ reading, denied, onUseLocation, onTypeAddress }: {
  /** The browser is answering (its question, then the fix). */
  reading: boolean;
  /** Location was refused, is off, or couldn't be read. */
  denied: boolean;
  onUseLocation: () => void;
  onTypeAddress: () => void;
}) {
  return (
    <section data-testid="today.areaStart" className="rounded-2xl border border-app bg-surface dark:bg-surface-dark p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20" aria-hidden="true">
          <Sun className="h-5 w-5 text-amber-500 dark:text-amber-400" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-app-text">Today starts where you are</h2>
          <p className="mt-1 text-sm leading-relaxed text-app-text-secondary">
            See the sun, weather and air for your city now. Add your address for pickup day, tax deadlines and alerts on your street.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" data-testid="today.areaStart.useLocation" onClick={onUseLocation} disabled={reading} aria-busy={reading} className={PRIMARY}>
          {reading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LocateFixed className="h-4 w-4" aria-hidden="true" />}
          Use my location
        </button>
        <button type="button" data-testid="today.areaStart.typeAddress" onClick={onTypeAddress} className={SECONDARY}>
          <MapPin className="h-4 w-4" aria-hidden="true" />
          Type my address
        </button>
      </div>
      {denied ? (
        <p role="status" data-testid="today.areaStart.denied" className="mt-3 text-sm text-app-text-secondary">
          Location is off for Pantopus. You can type your address instead.
        </p>
      ) : null}
    </section>
  );
}

export function TodayAreaAddAddress({ onAdd }: { onAdd: () => void }) {
  return (
    <section data-testid="today.areaAddAddress" className="rounded-2xl border border-app bg-surface dark:bg-surface-dark p-5">
      <h2 className="text-base font-semibold text-app-text">Add your address for the rest</h2>
      <p className="mt-1 text-sm leading-relaxed text-app-text-secondary">
        Pickup day, tax deadlines, council meetings and alerts for your street.
      </p>
      <button type="button" data-testid="today.areaAddAddress.add" onClick={onAdd} className={`mt-4 w-full sm:w-auto ${PRIMARY}`}>
        Add your address
      </button>
    </section>
  );
}
