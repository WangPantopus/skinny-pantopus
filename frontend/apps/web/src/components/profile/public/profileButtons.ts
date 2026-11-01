// The profile's two button styles (the drawings' 48 pt buttons): they grow with the text instead of clipping it.
const base =
  'min-h-[3rem] px-4 py-2 rounded-xl inline-flex items-center justify-center gap-2 text-[1.0625rem] leading-[1.375rem] font-semibold text-center transition disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-link)]';

export const primaryButton = `${base} bg-primary-600 text-white hover:bg-primary-700`;

export const secondaryButton = `${base} border border-app-strong bg-surface text-app hover-bg-app`;

/** Two buttons side by side that stack once the text no longer fits. */
export const buttonRow = 'flex flex-wrap gap-2.5 [&>*]:flex-1 [&>*]:basis-[9.5rem]';
