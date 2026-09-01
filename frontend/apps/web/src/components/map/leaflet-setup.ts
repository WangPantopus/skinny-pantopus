import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet default icon fix — import this once per map to patch broken asset paths.
delete (L.Icon.Default.prototype as Record<string, any>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});
