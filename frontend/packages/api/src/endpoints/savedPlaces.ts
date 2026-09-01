import { get, post, del } from '../client';

export async function getSavedPlaces() {
  return get('/saved-places');
}

export async function create(data: {
  label: string;
  placeType?: string;
  latitude: number;
  longitude: number;
  city?: string | null;
  state?: string | null;
  sourceId?: string | null;
}) {
  return post('/saved-places', data);
}

export async function remove(id: string) {
  return del(`/saved-places/${id}`);
}
