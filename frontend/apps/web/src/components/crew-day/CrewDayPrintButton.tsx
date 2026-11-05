'use client';

import { Printer } from 'lucide-react';
import { CREW_DAY_PRIMARY_BUTTON } from './CrewDayParts';

/** The flyer's "Print this flyer": the browser's own print dialog (the page's print styles drop everything but the paper). */
export default function CrewDayPrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${CREW_DAY_PRIMARY_BUTTON} gap-2 sm:w-auto sm:px-6`}>
      <Printer className="h-5 w-5 flex-none" aria-hidden="true" />
      Print this flyer
    </button>
  );
}
