// mapUtils.ts
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

/**
 * Mapping of Leaflet Zoom levels to Search Radius in KM.
 */
export const ZOOM_RADIUS_MAP: Record<number, number> = {
  2: 20000, 3: 5000, 4: 2500, 5: 1000, 6: 500, 7: 250,
  8: 100, 9: 75, 10: 50, 11: 25, 12: 10, 13: 5, 
  14: 2.5, 15: 1.5, 16: 1, 17: 0.5, 18: 0.25
};

/**
 * Converts a zoom level to KM radius.
 */
export function zoomToRadius(zoom: number): number {
  const roundedZoom = Math.round(zoom);
  return ZOOM_RADIUS_MAP[roundedZoom] || 100;
}

/**
 * Finds the closest zoom level for a given KM radius.
 */
export function radiusToZoom(radius: number): number {
  if (radius >= 20000) return 2;
  if (radius <= 0.25) return 18;

  const entries = Object.entries(ZOOM_RADIUS_MAP);
  const closest = entries.reduce((prev, curr) => {
    return Math.abs(curr[1] - radius) < Math.abs(prev[1] - radius) ? curr : prev;
  });

  return parseInt(closest[0]);
}

export const setupLeafletDefaults = () => {
  const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [16, 26], 
    iconAnchor: [8, 26], 
    popupAnchor: [0, -26], 
    shadowSize: [26, 26] 
  });
  L.Marker.prototype.options.icon = DefaultIcon;
};

export const getShapeIcon = (shape: 'triangle' | 'circle' | 'square' | 'star' | 'diamond', color: string) => {
  let svgHtml = '';
  const common = `fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"`;

  switch (shape) {
    case 'triangle':
      svgHtml = `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 2L22 20H2L12 2Z" ${common}/></svg>`;
      break;
    case 'square':
      svgHtml = `<svg width="18" height="18" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ${common}/></svg>`;
      break;
    case 'star':
      svgHtml = `<svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" ${common}/></svg>`;
      break;
    case 'diamond':
      svgHtml = `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 2L22 12L12 22L2 12L12 2Z" ${common}/></svg>`;
      break;
    case 'circle':
    default:
      svgHtml = `<svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" ${common}/></svg>`;
      break;
  }
  
  return L.divIcon({
    html: svgHtml,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11]
  });
};