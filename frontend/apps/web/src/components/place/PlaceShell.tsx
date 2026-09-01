// ============================================================
// PlaceShell — the shared responsive frame for the Place surface.
//
// Mobile / tablet (<lg): the designed single column, full-width with a
// comfortable max — exactly the pre-existing experience.
// Desktop (lg+): a two-column frame — the persistent PlaceNavRail on
// the left, the content column (wider, 760px) on the right — so the
// dashboard and the group details read as one navigable surface
// instead of a phone column floating in space.
// ============================================================

import PlaceNavRail from './PlaceNavRail';

export default function PlaceShell({
  active,
  children,
}: {
  /** Rail highlight: 'overview' | a detail slug | 'pulse'. */
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[640px] lg:max-w-[1040px] lg:grid lg:grid-cols-[218px_minmax(0,1fr)] lg:gap-9 lg:px-8 lg:pt-2">
      <div className="hidden lg:block">
        <PlaceNavRail active={active} />
      </div>
      <div className="min-w-0 lg:max-w-[760px]">{children}</div>
    </div>
  );
}
