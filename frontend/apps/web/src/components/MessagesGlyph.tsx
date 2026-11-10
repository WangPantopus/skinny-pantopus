// The Messages button's bubble (founder decision 2026-11-08, option "Sky"): one drawing on web, iOS and Android in
// place of the three system icons they used. At rest it is a pale-blue bubble outlined in the brand blue with three
// dots; with unread messages it fills solid with white dots. The unread count stays the red badge the top bar draws.
// Colors come from the accent variables, so dark mode follows the rest of the app.

const BUBBLE = 'M4.09 14.86A8.8 8.8 0 1 1 9.87 19.54C7.35 18.91 5.8 20.6 3.5 21.3C3.9 19.4 4.3 17.2 4.09 14.86Z';
const DOT_XS = [8.1, 12, 15.9];

const SOLID = 'rgb(var(--accent-primary-fill))';
const TINT = 'rgb(var(--accent-primary-tint-strong))';
const INK = 'rgb(var(--accent-primary-text))';

export default function MessagesGlyph({ unread = false, className }: { unread?: boolean; className?: string }) {
  const dot = unread ? '#ffffff' : INK;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={BUBBLE} style={{ fill: unread ? SOLID : TINT, stroke: unread ? SOLID : INK }} />
      {DOT_XS.map((x) => (
        <circle key={x} cx={x} cy={11} r={1.15} stroke="none" style={{ fill: dot }} />
      ))}
    </svg>
  );
}
