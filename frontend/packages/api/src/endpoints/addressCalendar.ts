// ============================================================
// ADDRESS CALENDAR — what recurs at this address (Wedge Phase 2, D6)
//
//   GET    /api/homes/:id/calendar             the next two weeks
//   PUT    /api/homes/:id/calendar/pickup-day  the household's pickup day
//   DELETE /api/homes/:id/calendar/pickup-day  back to the city default
//
// The same payload also arrives as the Place `address_calendar` section;
// these wrappers exist for the pickup-day control and for refreshing the
// card without refetching the whole dashboard.
// ============================================================

import { get, put, del } from '../client';
import type { PlaceAddressCalendarData } from '@pantopus/types';

export type PickupWeekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export interface AddressCalendarResponse {
  calendar: PlaceAddressCalendarData;
}

export interface SetPickupDayResponse extends AddressCalendarResponse {
  pickup: { weekday: PickupWeekday; dtstart: string; rules: number };
}

export async function getAddressCalendar(homeId: string): Promise<AddressCalendarResponse> {
  return get(`/api/homes/${homeId}/calendar`);
}

export async function setPickupDay(
  homeId: string,
  data: { weekday: PickupWeekday; recycling_every_other_week?: boolean },
): Promise<SetPickupDayResponse> {
  return put(`/api/homes/${homeId}/calendar/pickup-day`, data);
}

export async function clearPickupDay(homeId: string): Promise<AddressCalendarResponse> {
  return del(`/api/homes/${homeId}/calendar/pickup-day`);
}
