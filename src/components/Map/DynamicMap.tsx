"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  DivIcon,
  LayerGroup,
  Map as LeafletMap,
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
  TileLayer,
} from "leaflet";
import { getRoadRoute } from "@/lib/routing";

/* ============================================================= */
/* Types                                                         */
/* ============================================================= */

interface LatLng {
  lat: number;
  lng: number;
}

interface RoadStats {
  distanceKm: number;
  durationMinutes: number;
}

interface DynamicMapProps {
  restaurantLat: number;
  restaurantLng: number;
  customerLat: number;
  customerLng: number;
  /** 0 = rider at restaurant, 1 = rider at customer. */
  deliveryProgress: number;
  className?: string;
  /** Explicit theme. When omitted, follows `prefers-color-scheme`. */
  theme?: "light" | "dark";
  ariaLabel?: string;
  /** Receives distance/duration once the route resolves. */
  onRouteCalculated?: (stats: RoadStats) => void;
}

type RouteState = "idle" | "loading" | "ready" | "error";

/* ============================================================= */
/* Geometry                                                      */
/* ============================================================= */

const EARTH_RADIUS_M = 6_371_000;

function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  /* Clamp to [0, 1] — floating-point error can push h above 1,
   * which would make Math.asin return NaN. */
  const clamped = Math.min(1, Math.max(0, h));
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(clamped));
}

function bearingBetween(a: LatLng, b: LatLng): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function buildCumulative(route: LatLng[]): number[] {
  const cum: number[] = new Array(route.length);
  cum[0] = 0;
  for (let i = 1; i < route.length; i++) {
    cum[i] = cum[i - 1] + distanceMeters(route[i - 1], route[i]);
  }
  return cum;
}

/**
 * Interpolate a position along the route by cumulative distance so
 * the rider moves at a constant speed regardless of how densely the
 * route is sampled.
 */
function positionAlongRoute(
  route: LatLng[],
  cumulative: number[],
  progress: number
): { position: LatLng; bearing: number } | null {
  if (route.length === 0) return null;
  if (route.length === 1) return { position: route[0], bearing: 0 };
  if (cumulative.length !== route.length) return null;

  const p = Math.min(1, Math.max(0, progress));
  const total = cumulative[cumulative.length - 1];
  if (total === 0) return { position: route[0], bearing: 0 };

  const target = p * total;

  // Binary search for the segment containing `target`.
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= target) lo = mid;
    else hi = mid;
  }

  const start = route[lo];
  const end = route[hi];
  const segLen = cumulative[hi] - cumulative[lo];
  const t = segLen > 0 ? (target - cumulative[lo]) / segLen : 0;

  return {
    position: {
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    },
    bearing: bearingBetween(start, end),
  };
}

/* ============================================================= */
/* Route normalization                                           */
/* ============================================================= */

/**
 * Normalize whatever `getRoadRoute` returns into `LatLng[]`.
 * Accepts:
 *   - { coordinates: [{ lat, lng }, ...] }
 *   - { coordinates: [[lat, lng], ...] }
 *   - [[lat, lng], ...]
 *   - [{ lat, lng }, ...]
 */
function normalizeRoute(route: unknown): LatLng[] {
  if (!route) return [];

  let raw: unknown = route;
  if (
    typeof route === "object" &&
    route !== null &&
    "coordinates" in route
  ) {
    raw = (route as { coordinates: unknown }).coordinates;
  }

  if (!Array.isArray(raw)) return [];

  const out: LatLng[] = [];
  for (const entry of raw) {
    if (Array.isArray(entry) && entry.length >= 2) {
      const [a, b] = entry;
      if (typeof a === "number" && typeof b === "number") {
        out.push({ lat: a, lng: b });
      }
      continue;
    }
    if (entry && typeof entry === "object") {
      const o = entry as Record<string, unknown>;
      const lat =
        typeof o.lat === "number"
          ? o.lat
          : typeof o.latitude === "number"
          ? o.latitude
          : null;
      const lng =
        typeof o.lng === "number"
          ? o.lng
          : typeof o.lon === "number"
          ? o.lon
          : typeof o.longitude === "number"
          ? o.longitude
          : null;
      if (lat !== null && lng !== null) out.push({ lat, lng });
    }
  }
  return out;
}

function extractRoadStats(route: unknown): RoadStats | null {
  if (!route || typeof route !== "object") return null;
  const r = route as Record<string, unknown>;

  const distanceKm =
    typeof r.distanceKm === "number"
      ? r.distanceKm
      : typeof r.distanceMeters === "number"
      ? r.distanceMeters / 1000
      : null;

  const durationMinutes =
    typeof r.durationMinutes === "number"
      ? r.durationMinutes
      : typeof r.durationSeconds === "number"
      ? r.durationSeconds / 60
      : null;

  if (distanceKm === null || durationMinutes === null) return null;
  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationMinutes: Math.max(1, Math.round(durationMinutes)),
  };
}

/* ============================================================= */
/* Coordinate validation                                         */
/* ============================================================= */

function isValidLatLng(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  /* Reject exact (0, 0) — almost always an "uninitialized" sentinel
   * in this app, and it drops the map in the Gulf of Guinea. */
  if (lat === 0 && lng === 0) return false;
  return true;
}

/* ============================================================= */
/* Tile sources                                                  */
/* ============================================================= */

const TILE_SOURCES: Record<
  "light" | "dark",
  { url: string; attribution: string }
> = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function prefersDarkScheme(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function shouldDetectRetina(): boolean {
  if (typeof navigator === "undefined") return true;
  const conn = (navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  if (!conn) return true;
  if (conn.saveData) return false;
  const t = conn.effectiveType;
  return t !== "slow-2g" && t !== "2g" && t !== "3g";
}

/* ============================================================= */
/* Component                                                     */
/* ============================================================= */

export default function DynamicMap({
  restaurantLat,
  restaurantLng,
  customerLat,
  customerLng,
  deliveryProgress,
  className = "",
  theme,
  ariaLabel = "Delivery route map",
  onRouteCalculated,
}: DynamicMapProps) {
  /* Refs ----------------------------------------------------- */
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const staticMarkersRef = useRef<LayerGroup | null>(null);
  const routeLineRef = useRef<LeafletPolyline | null>(null);
  const vehicleMarkerRef = useRef<LeafletMarker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);

  const routePointsRef = useRef<LatLng[]>([]);
  const cumulativeRef = useRef<number[]>([]);
  const currentPosRef = useRef<LatLng | null>(null);
  const targetProgressRef = useRef<number>(deliveryProgress);
  const lastBoundsKeyRef = useRef<string>("");
  const reducedMotionRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  /* State ---------------------------------------------------- */
  const [isReady, setIsReady] = useState(false);
  const [routeState, setRouteState] = useState<RouteState>("idle");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    theme ?? "light"
  );

  /* Derived -------------------------------------------------- */
  const restaurant = useMemo<LatLng>(
    () => ({ lat: restaurantLat, lng: restaurantLng }),
    [restaurantLat, restaurantLng]
  );
  const customer = useMemo<LatLng>(
    () => ({ lat: customerLat, lng: customerLng }),
    [customerLat, customerLng]
  );

  const hasValidCoordinates =
    isValidLatLng(restaurant.lat, restaurant.lng) &&
    isValidLatLng(customer.lat, customer.lng);

  /* ---------------------------------------------------------- */
  /* Theme resolution                                           */
  /* ---------------------------------------------------------- */

  useEffect(() => {
    if (theme) {
      setResolvedTheme(theme);
      return;
    }
    setResolvedTheme(prefersDarkScheme() ? "dark" : "light");
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  /* ---------------------------------------------------------- */
  /* Reduced motion listener                                    */
  /* ---------------------------------------------------------- */

  useEffect(() => {
    reducedMotionRef.current = prefersReducedMotion();
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      reducedMotionRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /* ---------------------------------------------------------- */
  /* Keep deliveryProgress ref in sync                          */
  /* ---------------------------------------------------------- */

  useEffect(() => {
    targetProgressRef.current = deliveryProgress;
    animateRider();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryProgress]);

  /* ---------------------------------------------------------- */
  /* Map initialization                                         */
  /* ---------------------------------------------------------- */

  useEffect(() => {
    if (!containerRef.current || !hasValidCoordinates) return;
    if (mapRef.current) return;

    let cancelled = false;
    mountedRef.current = true;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
        doubleClickZoom: true,
        dragging: true,
        touchZoom: true,
        keyboard: true,
        preferCanvas: true,
      });

      // Move zoom controls to bottom-right by default.
      map.zoomControl?.setPosition("bottomright");

      mapRef.current = map;

      /* ResizeObserver — stored in a ref so cleanup can find it. */
      const ro = new ResizeObserver(() => {
        mapRef.current?.invalidateSize({ animate: false });
      });
      ro.observe(containerRef.current);
      resizeObserverRef.current = ro;

      // Wait for the container to have real dimensions before
      // declaring the map ready. This avoids fitBounds on a 0×0 box.
      const ready = () => {
        if (cancelled) return;
        map.invalidateSize({ animate: false });
        setIsReady(true);
      };
      if (containerRef.current.clientWidth > 0) {
        ready();
      } else {
        ro.disconnect();
        const ro2 = new ResizeObserver(() => {
          if (!containerRef.current) return;
          if (containerRef.current.clientWidth > 0) {
            ro2.disconnect();
            resizeObserverRef.current = null;
            const ro3 = new ResizeObserver(() => {
              mapRef.current?.invalidateSize({ animate: false });
            });
            ro3.observe(containerRef.current);
            resizeObserverRef.current = ro3;
            ready();
          }
        });
        ro2.observe(containerRef.current);
        resizeObserverRef.current = ro2;
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;

      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      leafletRef.current = null;
      tileLayerRef.current = null;
      staticMarkersRef.current = null;
      routeLineRef.current = null;
      vehicleMarkerRef.current = null;
      routePointsRef.current = [];
      cumulativeRef.current = [];
      currentPosRef.current = null;
      lastBoundsKeyRef.current = "";
      setIsReady(false);
      setRouteState("idle");
    };
  }, [hasValidCoordinates]);

  /* ---------------------------------------------------------- */
  /* Tile layer — added and swapped independently of the map    */
  /* ---------------------------------------------------------- */

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !isReady) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const tile = TILE_SOURCES[resolvedTheme];
    tileLayerRef.current = L.tileLayer(tile.url, {
      attribution: tile.attribution,
      maxZoom: 19,
      detectRetina: shouldDetectRetina(),
    }).addTo(map);
  }, [resolvedTheme, isReady]);

  /* ---------------------------------------------------------- */
  /* Rider animation                                            */
  /* ---------------------------------------------------------- */

  const setBearingOnMarker = useCallback((bearing: number) => {
    const marker = vehicleMarkerRef.current;
    if (!marker) return;
    const root = marker.getElement();
    const rotate = root?.querySelector<HTMLElement>(".elp-rider-rotate");
    if (rotate) {
      rotate.style.transform = `rotate(${bearing}deg)`;
    }
  }, []);

  const animateRider = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const marker = vehicleMarkerRef.current;
    const route = routePointsRef.current;
    const cum = cumulativeRef.current;
    if (!marker || route.length < 2 || cum.length !== route.length) return;

    const target = positionAlongRoute(route, cum, targetProgressRef.current);
    if (!target) return;

    const reduced = reducedMotionRef.current;

    if (reduced || !currentPosRef.current) {
      currentPosRef.current = target.position;
      marker.setLatLng([target.position.lat, target.position.lng]);
      setBearingOnMarker(target.bearing);
      return;
    }

    const step = () => {
      if (!mountedRef.current) return;
      const m = vehicleMarkerRef.current;
      const cur = currentPosRef.current;
      if (!m || !cur) return;

      const dLat = target.position.lat - cur.lat;
      const dLng = target.position.lng - cur.lng;
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);

      if (dist < 1e-7) {
        currentPosRef.current = target.position;
        m.setLatLng([target.position.lat, target.position.lng]);
        setBearingOnMarker(target.bearing);
        rafRef.current = null;
        return;
      }

      const alpha = 0.15;
      const next: LatLng = {
        lat: cur.lat + dLat * alpha,
        lng: cur.lng + dLng * alpha,
      };
      currentPosRef.current = next;
      m.setLatLng([next.lat, next.lng]);
      setBearingOnMarker(target.bearing);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  }, [setBearingOnMarker]);

  /* ---------------------------------------------------------- */
  /* Markers + route fetch                                      */
  /* ---------------------------------------------------------- */

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !isReady) return;

    let cancelled = false;
    setRouteState("loading");

    // Clear previous layers
    if (staticMarkersRef.current) {
      map.removeLayer(staticMarkersRef.current);
      staticMarkersRef.current = null;
    }
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    if (vehicleMarkerRef.current) {
      map.removeLayer(vehicleMarkerRef.current);
      vehicleMarkerRef.current = null;
    }
    routePointsRef.current = [];
    cumulativeRef.current = [];
    currentPosRef.current = null;

    const layer = L.layerGroup().addTo(map);
    staticMarkersRef.current = layer;

    const restaurantIcon: DivIcon = L.divIcon({
      html: `
        <div class="elp-pin elp-pin-restaurant">
          <span aria-hidden="true">🏪</span>
        </div>
      `,
      className: "elp-marker-root",
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -32],
    });

    const customerIcon: DivIcon = L.divIcon({
      html: `
        <div class="elp-pin elp-pin-customer">
          <span aria-hidden="true">🏠</span>
        </div>
      `,
      className: "elp-marker-root",
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -32],
    });

    L.marker([restaurant.lat, restaurant.lng], {
      icon: restaurantIcon,
      keyboard: true,
      title: "EL PRESTO — Pickup Hub",
    })
      .bindPopup("<strong>EL PRESTO</strong><br />Pickup Hub")
      .addTo(layer);

    L.marker([customer.lat, customer.lng], {
      icon: customerIcon,
      keyboard: true,
      title: "Delivery destination",
    })
      .bindPopup("<strong>Delivery Address</strong><br />Your location")
      .addTo(layer);

    /* Only re-fit bounds when the endpoints actually change. */
    const boundsKey = `${restaurant.lat},${restaurant.lng}|${customer.lat},${customer.lng}`;
    if (lastBoundsKeyRef.current !== boundsKey) {
      lastBoundsKeyRef.current = boundsKey;
      const b = L.latLngBounds(
        [restaurant.lat, restaurant.lng],
        [customer.lat, customer.lng]
      );
      /* If both markers are effectively the same point, L.latLngBounds
       * would zoom to maxZoom and hide everything. Enforce a minimum
       * extent so the map stays readable. */
      if (
        Math.abs(restaurant.lat - customer.lat) < 1e-4 &&
        Math.abs(restaurant.lng - customer.lng) < 1e-4
      ) {
        const pad = 0.01;
        b.extend([restaurant.lat - pad, restaurant.lng - pad]);
        b.extend([restaurant.lat + pad, restaurant.lng + pad]);
      }
      map.fitBounds(b, { padding: [48, 48], maxZoom: 16, animate: false });
    }

    getRoadRoute(restaurant, customer)
      .then((route) => {
        if (cancelled || !mapRef.current) return;

        const points = normalizeRoute(route);
        const finalPoints =
          points.length >= 2 ? points : [restaurant, customer];
        const cumulative = buildCumulative(finalPoints);

        // Draw polyline first — if this throws, we don't commit the
        // route to the refs.
        const dashed = points.length < 2;
        const line = L.polyline(
          finalPoints.map((p) => [p.lat, p.lng] as [number, number]),
          {
            color: "#D92312",
            weight: dashed ? 3 : 4,
            opacity: dashed ? 0.6 : 0.9,
            dashArray: dashed ? "6 8" : undefined,
            lineCap: "round",
            lineJoin: "round",
          }
        ).addTo(mapRef.current);

        routeLineRef.current = line;
        routePointsRef.current = finalPoints;
        cumulativeRef.current = cumulative;

        // Fit to route bounds so loops / detours stay visible.
        if (points.length >= 2) {
          const routeBounds = line.getBounds();
          if (routeBounds.isValid()) {
            mapRef.current.fitBounds(routeBounds, {
              padding: [48, 48],
              maxZoom: 16,
              animate: false,
            });
          }
        }

        // Rider marker
        const vehicleIcon: DivIcon = L.divIcon({
          html: `
            <div class="elp-rider-root">
              <div class="elp-rider-rotate">
                <span aria-hidden="true">🛵</span>
              </div>
            </div>
          `,
          className: "elp-marker-root",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        // Place the rider at the CURRENT progress, not at 0.
        const start =
          positionAlongRoute(
            finalPoints,
            cumulative,
            targetProgressRef.current
          ) ?? { position: finalPoints[0], bearing: 0 };

        const marker = L.marker(
          [start.position.lat, start.position.lng],
          {
            icon: vehicleIcon,
            interactive: false,
            keyboard: false,
            zIndexOffset: 1000,
          }
        ).addTo(mapRef.current);

        vehicleMarkerRef.current = marker;
        currentPosRef.current = start.position;
        setBearingOnMarker(start.bearing);

        setRouteState(dashed ? "error" : "ready");

        if (!dashed && onRouteCalculated) {
          const stats = extractRoadStats(route);
          if (stats) onRouteCalculated(stats);
        }
      })
      .catch((err) => {
        if (cancelled || !mountedRef.current) return;
        if (process.env.NODE_ENV !== "production") {
          console.warn("Route fetch failed, using straight-line fallback:", err);
        }
        if (!mapRef.current) return;

        const fallback: LatLng[] = [restaurant, customer];
        const cumulative = buildCumulative(fallback);

        const line = L.polyline(
          fallback.map((p) => [p.lat, p.lng] as [number, number]),
          {
            color: "#D92312",
            weight: 3,
            opacity: 0.6,
            dashArray: "6 8",
            lineCap: "round",
          }
        ).addTo(mapRef.current);

        routeLineRef.current = line;
        routePointsRef.current = fallback;
        cumulativeRef.current = cumulative;

        const vehicleIcon: DivIcon = L.divIcon({
          html: `
            <div class="elp-rider-root">
              <div class="elp-rider-rotate">
                <span aria-hidden="true">🛵</span>
              </div>
            </div>
          `,
          className: "elp-marker-root",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const start =
          positionAlongRoute(fallback, cumulative, targetProgressRef.current) ??
          { position: fallback[0], bearing: 0 };

        const marker = L.marker(
          [start.position.lat, start.position.lng],
          {
            icon: vehicleIcon,
            interactive: false,
            keyboard: false,
            zIndexOffset: 1000,
          }
        ).addTo(mapRef.current);

        vehicleMarkerRef.current = marker;
        currentPosRef.current = start.position;
        setBearingOnMarker(start.bearing);
        setRouteState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [
    restaurant,
    customer,
    isReady,
    onRouteCalculated,
    setBearingOnMarker,
  ]);

  /* ---------------------------------------------------------- */
  /* Render                                                     */
  /* ---------------------------------------------------------- */

  if (!hasValidCoordinates) {
    return (
      <div
        role="img"
        aria-label="Delivery location unavailable"
        className={`flex h-full min-h-[300px] w-full items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 ${className}`}
      >
        <div className="text-center">
          <p className="text-sm font-bold text-gray-500">
            Delivery location unavailable
          </p>
          <p className="mt-1 text-xs text-gray-400">
            The rider will share their position shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={`relative h-full w-full ${className}`}
    >
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden rounded-2xl"
      />

      {/* Loading overlay */}
      {(!isReady || routeState === "loading") && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/40"
        >
          <div className="flex items-center gap-2 rounded-full border border-white bg-white/95 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-gray-700 shadow-md">
            <span className="h-2 w-2 motion-safe:animate-pulse rounded-full bg-[#D92312]" />
            Loading route…
          </div>
        </div>
      )}

      {/* Fallback notice */}
      {routeState === "error" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-amber-200 bg-amber-50/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800 shadow-sm"
        >
          Approximate route
        </div>
      )}

      {/* Screen reader status announcements */}
      <span className="sr-only" role="status" aria-live="polite">
        {routeState === "ready"
          ? "Route loaded."
          : routeState === "error"
          ? "Showing an approximate straight-line route."
          : ""}
      </span>

      {/* Scoped styles — keyed so React keeps one instance */}
      <style key="elp-dynamic-map-styles">{`
        .elp-marker-root {
          background: transparent !important;
          border: none !important;
        }
        .elp-pin {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          line-height: 1;
          border: 2px solid #fff;
          box-shadow: 0 6px 18px rgba(0,0,0,0.28);
        }
        .elp-pin-restaurant {
          background: linear-gradient(135deg,#D92312,#F59E0B);
        }
        .elp-pin-customer {
          background: #1F2937;
        }
        .elp-rider-root {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .elp-rider-rotate {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg,#D92312,#F59E0B);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          line-height: 1;
          border: 2.5px solid #fff;
          box-shadow: 0 4px 14px rgba(217,35,18,0.45);
          transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .elp-rider-rotate {
            transition: none;
          }
        }
        .leaflet-container {
          font-family: inherit;
          background: #f3f4f6;
        }
        .leaflet-container a {
          color: #D92312;
        }
        .leaflet-control-attribution {
          font-size: 9px !important;
          background: rgba(255, 255, 255, 0.85) !important;
          backdrop-filter: none !important;
        }
        .leaflet-control-zoom a {
          background: #fff !important;
          color: #1f2937 !important;
          border: 1px solid #e5e7eb !important;
          width: 30px !important;
          height: 30px !important;
          line-height: 28px !important;
          font-weight: 900 !important;
        }
        .leaflet-control-zoom a:hover {
          background: #fef2f2 !important;
          color: #D92312 !important;
        }
      `}</style>
    </div>
  );
}