import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibre,
  MapLayerMouseEvent,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from 'maplibre-gl';
// maplibre looks for its worker next to its own module, which the bundler
// does not keep, so hand it the copy Vite emits
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { FeatureCollection, Point } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Image as ImageType } from '../types';
import { ImageList } from './ImageList';
import './MapView.css';

setWorkerUrl(workerUrl);

// free vector tiles, no key needed: Liberty is the full-colour OSM look, Fiord
// its dark counterpart, following the OS theme
const STYLE = matchMedia('(prefers-color-scheme: dark)').matches
  ? 'https://tiles.openfreemap.org/styles/fiord'
  : 'https://tiles.openfreemap.org/styles/liberty';

type Place = {
  key: string;
  venue: string;
  city: string;
  country: string;
  lng: number;
  lat: number;
  images: ImageType[];
};

// check-ins keyed by their exact coordinates, so the same venue is one dot
// however many beers were had there. Untappd at Home is a virtual venue and
// anything without a usable "lat,lng" is skipped
export const groupPlaces = (images: ImageType[]): Place[] => {
  const places = new Map<string, Place>();
  for (const img of images) {
    const { venue, city, country, latlng } = img.metadata;
    if (venue === 'Untappd at Home') continue;
    const [lat, lng] = latlng.split(',').map(Number);
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) continue;
    const key = `${lat},${lng}`;
    const place = places.get(key) ?? { key, venue, city, country, lng, lat, images: [] };
    place.images.push(img);
    places.set(key, place);
  }
  return [...places.values()];
};

const toGeoJSON = (places: Place[]): FeatureCollection<Point> => ({
  type: 'FeatureCollection',
  features: places.map((p) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    properties: { key: p.key, venue: p.venue, count: p.images.length },
  })),
});

type MapViewProps = {
  images: ImageType[];
  onImageClick: (image: ImageType) => void;
};

export default function MapView({ images, onImageClick }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const places = useMemo(() => groupPlaces(images), [images]);
  const geojson = useMemo(() => toGeoJSON(places), [places]);
  // the map's load handler runs once and must see whatever data is current
  // by then, not the data from the render that created the map
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

  const selected = places.find((p) => p.key === selectedKey);

  useEffect(() => {
    const map = new MapLibre({
      container: containerRef.current!,
      style: STYLE,
      center: [0, 20],
      zoom: 1,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }));

    map.on('load', () => {
      // clustering is native to GeoJSON sources: nearby places merge into one
      // dot whose count is the sum of the check-ins beneath it
      map.addSource('places', {
        type: 'geojson',
        data: geojsonRef.current,
        cluster: true,
        clusterRadius: 40,
        clusterProperties: { count: ['+', ['get', 'count']] },
      });
      map.addLayer({
        id: 'places',
        type: 'circle',
        source: 'places',
        paint: {
          'circle-color': '#d32f2f',
          'circle-opacity': 0.85,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
          'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 9, 50, 18, 500, 28],
        },
      });
      map.addLayer({
        id: 'places-count',
        type: 'symbol',
        source: 'places',
        layout: {
          'text-field': ['to-string', ['get', 'count']],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#fff' },
      });
    });

    const hover = new Popup({ closeButton: false, closeOnClick: false });
    map.on('mousemove', 'places', (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      map.getCanvas().style.cursor = 'pointer';
      if (f && !f.properties.cluster) {
        hover.setLngLat(e.lngLat).setText(f.properties.venue).addTo(map);
      } else {
        hover.remove();
      }
    });
    map.on('mouseleave', 'places', () => {
      map.getCanvas().style.cursor = '';
      hover.remove();
    });

    // a cluster zooms in until it splits, a single place lists its check-ins
    map.on('click', 'places', async (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      if (f.properties.cluster) {
        const source = map.getSource('places') as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(f.properties.cluster_id);
        map.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom });
      } else {
        setSelectedKey(f.properties.key);
      }
    });

    return () => map.remove();
  }, []);

  // filters change the places: swap the data and frame whatever is left
  useEffect(() => {
    const map = mapRef.current;
    if (!map || places.length === 0) return;
    (map.getSource('places') as GeoJSONSource | undefined)?.setData(geojson);
    const bounds = places.reduce(
      (b, p) => b.extend([p.lng, p.lat]),
      new LngLatBounds([places[0].lng, places[0].lat], [places[0].lng, places[0].lat]),
    );
    map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
  }, [geojson]);

  return (
    <div class="map-view">
      <div ref={containerRef} class="map-canvas" />
      {selected && (
        <>
          <h2 class="map-place">
            {selected.venue || 'Unknown venue'}
            <span class="map-place-sub">
              {[
                [selected.city, selected.country].filter(Boolean).join(', '),
                `${selected.images.length} check-in${selected.images.length === 1 ? '' : 's'}`,
              ].filter(Boolean).join(' · ')}
            </span>
          </h2>
          <ImageList images={selected.images} isLoading={false} onImageClick={onImageClick} />
        </>
      )}
      {images.length > 0 && places.length === 0 && <p class="no-results">No check-ins with a location.</p>}
    </div>
  );
}
