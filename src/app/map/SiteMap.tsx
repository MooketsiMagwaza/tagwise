// Sites on a map. MapLibre GL (BSD-3) with OpenFreeMap's free vector tiles
// (no key, no account; data from OpenStreetMap). Loaded only on map pages.
// If the map cannot load (offline, no WebGL), the page says so and the list
// beside it still works.

import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { useIsDark } from '../../theme';
import type { Site } from '../../data/types';
import styles from './SiteMap.module.css';

const STYLE = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const KIND_LABEL: Record<Site['kind'], string> = { office: 'Office', warehouse: 'Store', school: 'School', clinic: 'Clinic' };

export function SiteMap({
  sites,
  selected,
  onSelect,
  height = 'tall',
}: {
  sites: Site[];
  selected?: string;
  onSelect?: (id: string) => void;
  height?: 'tall' | 'short';
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Map<string, { marker: Marker; el: HTMLButtonElement }>>(new Map());
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const dark = useIsDark();
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    const pins = markers.current;
    (async () => {
      try {
        const [{ default: maplibregl }] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]);
        if (cancelled || !host.current) return;
        const m = new maplibregl.Map({
          container: host.current,
          style: dark ? STYLE.dark : STYLE.light,
          center: [25.9, -22.4],
          zoom: 5,
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        m.on('error', (e) => {
          if (!m.loaded() && /style|Failed to fetch/i.test(String(e.error?.message ?? ''))) setState('failed');
        });
        m.on('load', () => !cancelled && setState('ready'));
        map.current = m;

        for (const s of sites) {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = `${styles.pin} ${styles[s.kind]}`;
          el.setAttribute('aria-label', `${s.name}, ${KIND_LABEL[s.kind]} in ${s.town}`);
          el.title = s.name;
          el.innerHTML = `<span>${s.code}</span>`;
          el.addEventListener('click', (ev) => {
            ev.stopPropagation();
            onSelectRef.current?.(s.id);
          });
          const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([s.lng, s.lat]).addTo(m);
          pins.set(s.id, { marker, el });
        }
        if (sites.length > 1) {
          const lngs = sites.map((s) => s.lng);
          const lats = sites.map((s) => s.lat);
          m.fitBounds(
            [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
            ],
            { padding: 60, duration: 0, maxZoom: 12 },
          );
        } else if (sites[0]) {
          m.jumpTo({ center: [sites[0].lng, sites[0].lat], zoom: 12 });
        }
      } catch {
        if (!cancelled) setState('failed');
      }
    })();
    const timer = window.setTimeout(() => setState((s) => (s === 'loading' ? 'failed' : s)), 15000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      map.current?.remove();
      map.current = null;
      pins.clear();
    };
    // The sites list is fixed for a page; theme changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap the basemap with the theme.
  useEffect(() => {
    map.current?.setStyle(dark ? STYLE.dark : STYLE.light);
  }, [dark]);

  // Highlight and fly to the chosen site.
  useEffect(() => {
    markers.current.forEach(({ el }, id) => el.classList.toggle(styles.active, id === selected));
    const s = sites.find((x) => x.id === selected);
    if (s && map.current) map.current.flyTo({ center: [s.lng, s.lat], zoom: Math.max(map.current.getZoom(), 9), essential: false });
  }, [selected, sites]);

  return (
    <div className={`${styles.wrap} ${height === 'short' ? styles.short : ''}`}>
      <div ref={host} className={styles.map} role="region" aria-label="Map of sites" />
      {state === 'loading' && <div className={styles.note}>Loading the map…</div>}
      {state === 'failed' && (
        <div className={styles.note}>
          The map could not load here (no internet connection, or the browser has WebGL turned off). The list of sites still works.
        </div>
      )}
    </div>
  );
}
