// The Nearby window's cell styling: buckets shade, the home cell is
// outlined, and nothing about a cell is ever more than its bucket.
import { cellStyle, LEGEND_ORDER } from '@/app/(app)/app/nearby/nearbyCells';

it('shades by bucket and outlines only the home cell', () => {
  expect(cellStyle('none', false).fillOpacity).toBe(0);
  expect(cellStyle('forming', false).fillOpacity).toBeGreaterThan(0);
  expect(cellStyle('few', false).fillOpacity).toBeGreaterThan(cellStyle('forming', false).fillOpacity);
  expect(cellStyle('growing', false).fillOpacity).toBeGreaterThan(cellStyle('few', false).fillOpacity);
  expect(cellStyle('few', true)).toMatchObject({ weight: 2, dashArray: undefined });
  expect(cellStyle('few', false)).toMatchObject({ weight: 1, dashArray: '3 4' });
  expect(LEGEND_ORDER).toEqual(['none', 'forming', 'few', 'growing']);
});
