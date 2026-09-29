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
  Map as LeafletMap,
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
  TileLayer,
} from "leaflet";
import { AlertTriangle, Clock, Locate, Navigation } from "lucide-react";
import { getRoadRoute } from "@/lib/routing";

/* ============================================================ */
/* Types                                                         */
/* ============================================================ */

interface LatLng {
  lat: number;
  lng: number;
}

interface RouteStats {
  distanceKm: number;
  durationMinutes: number;
}

type RouteState = "idle" | "loading" | "ready" | "error";

interface DeliveryLiveMapProps {
  riderLat?: number;
  riderLng?: number;
  customerLat: number;
  customerLng: number;
  cafeLat?: number;
  cafeLng?: number;
  customerName?: string;
  className?: string;
  showHud?: boolean;
  /** When omitted, follows `prefers-color-scheme`. */
  theme?: "light" | "dark";
  onRouteCalculated?: (route: {
    distanceKm: number;
    durationMinutes: number;
    coordinates: [number, number][];
  }) => void;
}

/* ============================================================ */
/* Constants                                                     */
/* ============================================================ */

const EARTH_RADIUS_M = 6_371_000;
const MIN_REFETCH_METERS = 50;
const DEBOUNCE_MS = 500;
const DEFAULT_CAFE: LatLng = { lat: 25.3409769, lng: 81.9116436 };

/* ============================================================ */
/* Helpers                                                       */
/* ============================================================ */

function isValidCoord(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  /* Reject (0, 0) — always a sentinel for "uninitialized" in this app. */
  if (lat === 0 && lng === 0) return false;
  return true;
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const clamped = Math.min(1, Math.max(0, h));
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(clamped));
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/**
 * Accepts routes shaped as `[lat, lng][]`, `{ lat, lng }[]`,
 * `{ latitude, longitude }[]`, or the same wrapped in
 * `{ coordinates: ... }`. Returns a clean `[lat, lng][]`.
 */
function normalizeRouteCoordinates(raw: unknown): [number, number][] {
  if (!raw) return [];

  let value = raw;
  if (
    typeof raw === "object" &&
    raw !== null &&
    "coordinates" in (raw as Record<string, unknown>)
  ) {
    value = (raw as { coordinates: unknown }).coordinates;
  }

  if (!Array.isArray(value)) return [];

  const out: [number, number][] = [];
  for (const entry of value) {
    if (Array.isArray(entry) && entry.length >= 2) {
      const [a, b] = entry;
      if (typeof a === "number" && typeof b === "number") {
        out.push([a, b]);
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
      if (lat !== null && lng !== null) out.push([lat, lng]);
    }
  }
  return out;
}

function prefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/* ============================================================ */
/* Tile sources                                                  */
/* ============================================================ */

const TILES: Record<
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

/* ============================================================ */
/* SVG marker icons                                              */
/* ============================================================ */

const SVG_CAFE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9v11h18V9"/><path d="M9 22V12h6v10"/></svg>`;

const SVG_HOME = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 9v11h14V9"/><path d="M9 22v-7h6v7"/></svg>`;

const SVG_SCOOTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="17.5" r="3"/><circle cx="18.5" cy="17.5" r="3"/><path d="M15 6h4l1 11.5"/><path d="M5.5 17.5l6-11.5h3.5"/></svg>`;

function createCafeIcon(L: typeof import("leaflet")): DivIcon {
  return L.divIcon({
    html: `<div class="elm-pin elm-pin-cafe">${SVG_CAFE}</div>`,
    className: "elm-pin-root",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  });
}

function createCustomerIcon(L: typeof import("leaflet")): DivIcon {
  return L.divIcon({
    html: `<div class="elm-pin elm-pin-customer">${SVG_HOME}</div>`,
    className: "elm-pin-root",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  });
}

function createRiderIcon(L: typeof import("leaflet")): DivIcon {
  return L.divIcon({
    html: `
      <div class="elm-rider">
        <div class="elm-rider-ring" aria-hidden="true"></div>
        <div class="elm-pin elm-pin-rider">${SVG_SCOOTER}</div>
      </div>`,
    className: "elm-pin-root",
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -26],
  });
}

/* ============================================================ */
/* Component                                                     */
/* ============================================================ */

export default function DeliveryLiveMap({
  riderLat,
  riderLng,
  customerLat,
  customerLng,
  cafeLat = DEFAULT_CAFE.lat,
  cafeLng = DEFAULT_CAFE.lng,
  customerName = "Customer",
  className = "",
  showHud = true,
  theme,
  onRouteCalculated,
}: DeliveryLiveMapProps) {
  /* Refs ---------------------------------------------------- */
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);

  const markersRef = useRef<{
    cafe: LeafletMarker | null;
    customer: LeafletMarker | null;
    rider: LeafletMarker | null;
  }>({ cafe: null, customer: null, rider: null });

  const routeLineRef = useRef<LeafletPolyline | null>(null);
  const requestIdRef = useRef(0);
  const routeDebounceRef = useRef<number | null>(null);
  const lastFetchedOriginRef = useRef<LatLng | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mountedRef = useRef(false);
  const hasUserPannedRef = useRef(false);
  const onRouteCalculatedRef = useRef(onRouteCalculated);
  const fetchRouteRef = useRef<
    (origin: LatLng, destination: LatLng, fitBounds: boolean) => void
  >(() => {});

  /* State -------------------------------------------------- */
  const [isReady, setIsReady] = useState(false);
  const [routeState, setRouteState] = useState<RouteState>("idle");
  const [routeStats, setRouteStats] = useState<RouteStats>({
    distanceKm: 0,
    durationMinutes: 0,
  });
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    theme ?? "light"
  );

  /* Keep callback refs in sync (avoids re-running effects) */
  useEffect(() => {
    onRouteCalculatedRef.current = onRouteCalculated;
  }, [onRouteCalculated]);

  /* Memoized coordinates ---------------------------------- */
  const cafe = useMemo<LatLng | null>(
    () =>
      isValidCoord(cafeLat, cafeLng) ? { lat: cafeLat, lng: cafeLng } : null,
    [cafeLat, cafeLng]
  );
  const customer = useMemo<LatLng | null>(
    () =>
      isValidCoord(customerLat, customerLng)
        ? { lat: customerLat, lng: customerLng }
        : null,
    [customerLat, customerLng]
  );
  const rider = useMemo<LatLng | null>(
    () =>
      isValidCoord(riderLat, riderLng)
        ? { lat: riderLat as number, lng: riderLng as number }
        : null,
    [riderLat, riderLng]
  );

  const canInit = Boolean(cafe && customer);

  /* ------------------------------------------------------- */
  /* Theme                                                   */
  /* ------------------------------------------------------- */

  useEffect(() => {
    if (theme) {
      setResolvedTheme(theme);
      return;
    }
    setResolvedTheme(prefersDark() ? "dark" : "light");
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  /* ------------------------------------------------------- */
  /* Map initialization (once)                               */
  /* ------------------------------------------------------- */

  useEffect(() => {
    if (!canInit || !containerRef.current) return;
    if (mapRef.current) return;

    let cancelled = false;
    mountedRef.current = true;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;

      const initialCafe = cafe ?? DEFAULT_CAFE;
      const initialCustomer = customer ?? DEFAULT_CAFE;

      const map = L.map(containerRef.current, {
        center: [
          (initialCafe.lat + initialCustomer.lat) / 2,
          (initialCafe.lng + initialCustomer.lng) / 2,
        ],
        zoom: 13,
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: true,
        dragging: true,
        touchZoom: true,
        keyboard: true,
        preferCanvas: true,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      /* Manual pan detection — stops auto-fit from fighting the user */
      map.on("dragstart", () => {
        hasUserPannedRef.current = true;
      });

      mapRef.current = map;

      const bootstrap = () => {
        if (cancelled || !containerRef.current) return;
        map.invalidateSize({ animate: false });
        setIsReady(true);
      };

      const containerReady =
        containerRef.current.clientWidth > 0 &&
        containerRef.current.clientHeight > 0;

      if (containerReady) {
        bootstrap();
      } else {
        /* Wait for a real size — happens in modals, accordions, tabs */
        const waitForSize = new ResizeObserver(() => {
          if (
            cancelled ||
            !containerRef.current ||
            containerRef.current.clientWidth === 0 ||
            containerRef.current.clientHeight === 0
          ) {
            return;
          }
          waitForSize.disconnect();
          resizeObserverRef.current = null;

          const liveRO = new ResizeObserver(() => {
            mapRef.current?.invalidateSize({ animate: false });
          });
          liveRO.observe(containerRef.current);
          resizeObserverRef.current = liveRO;

          bootstrap();
        });
        waitForSize.observe(containerRef.current);
        resizeObserverRef.current = waitForSize;
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;

      if (routeDebounceRef.current != null) {
        window.clearTimeout(routeDebounceRef.current);
        routeDebounceRef.current = null;
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
      markersRef.current = { cafe: null, customer: null, rider: null };
      routeLineRef.current = null;
      lastFetchedOriginRef.current = null;
      hasUserPannedRef.current = false;

      setIsReady(false);
      setRouteState("idle");
      setRouteStats({ distanceKm: 0, durationMinutes: 0 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canInit]);

  /* ------------------------------------------------------- */
  /* Tile layer swap on theme change                         */
  /* ------------------------------------------------------- */

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !isReady) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const tile = TILES[resolvedTheme];
    tileLayerRef.current = L.tileLayer(tile.url, {
      attribution: tile.attribution,
      maxZoom: 19,
      detectRetina: true,
      crossOrigin: true,
    }).addTo(map);
  }, [resolvedTheme, isReady]);

  /* ------------------------------------------------------- */
  /* Markers — created once, updated on prop change          */
  /* ------------------------------------------------------- */

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !isReady) return;

    const markers = markersRef.current;

    /* Cafe */
    if (cafe) {
      if (!markers.cafe) {
        markers.cafe = L.marker([cafe.lat, cafe.lng], {
          icon: createCafeIcon(L),
          keyboard: true,
          title: "EL PRESTO — Pickup Hub",
        })
          .addTo(map)
          .bindPopup("<strong>EL PRESTO</strong><br />Pickup Hub");
      } else {
        markers.cafe.setLatLng([cafe.lat, cafe.lng]);
      }
    } else if (markers.cafe) {
      map.removeLayer(markers.cafe);
      markers.cafe = null;
    }

    /* Customer */
    if (customer) {
      const safeName = escapeHtml(customerName);
      const popupHtml = `<strong>${safeName}</strong><br />Delivery Destination`;
      if (!markers.customer) {
        markers.customer = L.marker([customer.lat, customer.lng], {
          icon: createCustomerIcon(L),
          keyboard: true,
          title: `Delivery destination for ${customerName}`,
        })
          .addTo(map)
          .bindPopup(popupHtml);
      } else {
        markers.customer.setLatLng([customer.lat, customer.lng]);
        markers.customer.setPopupContent(popupHtml);
      }
    } else if (markers.customer) {
      map.removeLayer(markers.customer);
      markers.customer = null;
    }

    /* Rider */
    if (rider) {
      if (!markers.rider) {
        markers.rider = L.marker([rider.lat, rider.lng], {
          icon: createRiderIcon(L),
          zIndexOffset: 1000,
          keyboard: true,
          title: "Delivery rider",
        })
          .addTo(map)
          .bindPopup("<strong>Delivery Partner</strong><br />Live location");
      } else {
        markers.rider.setLatLng([rider.lat, rider.lng]);
      }
    } else if (markers.rider) {
      map.removeLayer(markers.rider);
      markers.rider = null;
    }
  }, [cafe, customer, rider, customerName, isReady]);

  /* ------------------------------------------------------- */
  /* Fit bounds when endpoints change                        */
  /* ------------------------------------------------------- */

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !isReady || !cafe || !customer) return;
    if (hasUserPannedRef.current) return;

    const bounds = L.latLngBounds(
      [cafe.lat, cafe.lng],
      [customer.lat, customer.lng]
    );

    /* Same-location safety: extend by ~1 km so we don't zoom to maxZoom */
    if (
      Math.abs(cafe.lat - customer.lat) < 1e-4 &&
      Math.abs(cafe.lng - customer.lng) < 1e-4
    ) {
      const pad = 0.01;
      bounds.extend([cafe.lat - pad, cafe.lng - pad]);
      bounds.extend([cafe.lat + pad, cafe.lng + pad]);
    }

    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 16,
      animate: false,
    });
  }, [cafe, customer, isReady]);

  /* ------------------------------------------------------- */
  /* Route drawing                                           */
  /* ------------------------------------------------------- */

  const drawRoute = useCallback(
    (coords: [number, number][], fitBounds: boolean) => {
      const L = leafletRef.current;
      const map = mapRef.current;
      if (!L || !map || coords.length < 2) return;

      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }

      const polyline = L.polyline(coords, {
        color: "#2563eb",
        weight: 4.5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      routeLineRef.current = polyline;

      if (fitBounds && !hasUserPannedRef.current) {
        const bounds = polyline.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 16,
            animate: false,
          });
        }
      }
    },
    []
  );

  /* ------------------------------------------------------- */
  /* Route fetching — abort-stale via requestId              */
  /* ------------------------------------------------------- */

  const fetchRoute = useCallback(
    async (origin: LatLng, destination: LatLng, fitBounds: boolean) => {
      const requestId = ++requestIdRef.current;
      setRouteState("loading");

      try {
        const route = await getRoadRoute(origin, destination);
        if (!mountedRef.current) return;
        if (requestId !== requestIdRef.current) return; /* stale */

        const coords = normalizeRouteCoordinates(route.coordinates);
        if (coords.length < 2) {
          setRouteState("error");
          return;
        }

        lastFetchedOriginRef.current = origin;
        drawRoute(coords, fitBounds);

        const km = Number(route.distanceKm) || 0;
        const minutes = Number(route.durationMinutes) || 0;

        setRouteStats({ distanceKm: km, durationMinutes: minutes });
        setRouteState("ready");

        onRouteCalculatedRef.current?.({
          distanceKm: km,
          durationMinutes: minutes,
          coordinates: coords,
        });
      } catch (err) {
        if (!mountedRef.current) return;
        if (requestId !== requestIdRef.current) return;
        if (process.env.NODE_ENV !== "production") {
          console.warn("Route fetch failed:", err);
        }
        setRouteState("error");
      }
    },
    [drawRoute]
  );

  /* Keep a stable ref so the debounce effect doesn't churn */
  useEffect(() => {
    fetchRouteRef.current = fetchRoute;
  }, [fetchRoute]);

  /* ------------------------------------------------------- */
  /* Debounced recalculation triggered by rider movement     */
  /* ------------------------------------------------------- */

  useEffect(() => {
    if (!isReady || !cafe || !customer) return;

    const origin = rider ?? cafe;
    const destination = customer;

    /* First fetch on mount — fire immediately */
    if (!lastFetchedOriginRef.current) {
      fetchRouteRef.current(origin, destination, true);
      return;
    }

    /* Skip if rider hasn't moved far enough */
    const moved = haversineMeters(origin, lastFetchedOriginRef.current);
    if (moved < MIN_REFETCH_METERS) return;

    if (routeDebounceRef.current != null) {
      window.clearTimeout(routeDebounceRef.current);
    }

    routeDebounceRef.current = window.setTimeout(() => {
      routeDebounceRef.current = null;
      fetchRouteRef.current(origin, destination, false);
    }, DEBOUNCE_MS);

    return () => {
      if (routeDebounceRef.current != null) {
        window.clearTimeout(routeDebounceRef.current);
        routeDebounceRef.current = null;
      }
    };
  }, [rider, cafe, customer, isReady]);

  /* ------------------------------------------------------- */
  /* Recenter                                                */
  /* ------------------------------------------------------- */

  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    hasUserPannedRef.current = false;
    const target = rider ?? cafe ?? customer;
    if (target) {
      map.setView([target.lat, target.lng], 15, { animate: true });
    }
  }, [rider, cafe, customer]);

  /* ------------------------------------------------------- */
  /* Invalid state — no coordinates                          */
  /* ------------------------------------------------------- */

  if (!canInit) {
    return (
      <div
        role="img"
        aria-label="Delivery location unavailable"
        className={`flex h-full min-h-[280px] w-full items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 ${className}`}
      >
        <div className="flex flex-col items-center gap-2 px-6 text-center">
          <AlertTriangle
            size={22}
            className="text-amber-500"
            aria-hidden="true"
          />
          <p className="text-sm font-bold text-gray-600">
            Delivery location unavailable
          </p>
          <p className="text-xs text-gray-400">
            The rider will share their position shortly.
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- */
  /* Render                                                  */
  /* ------------------------------------------------------- */

  const distanceLabel = formatDistance(routeStats.distanceKm);
  const statusLabel =
    routeState === "loading" && routeStats.distanceKm === 0
      ? "Calculating route…"
      : routeState === "error"
      ? "Route unavailable"
      : routeState === "ready" && routeStats.distanceKm > 0
      ? `${distanceLabel} via road`
      : "Ready";

  return (
    <div
      className={`relative h-full w-full min-h-0 overflow-hidden rounded-2xl ${className}`}
    >
      <div
        ref={containerRef}
        role="region"
        aria-label="Live delivery route map"
        className="h-full w-full"
      />

      {/* HUD */}
      {showHud && (
        <div className="pointer-events-none absolute left-3 top-3 z-[400] flex max-w-[calc(100%-4.5rem)] flex-col gap-2 sm:left-4 sm:top-4">
          <div className="pointer-events-auto inline-flex flex-wrap items-center gap-2.5 rounded-2xl border border-blue-100 bg-white px-3.5 py-2 shadow-md">
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${
                routeState === "loading"
                  ? "bg-amber-500"
                  : routeState === "error"
                  ? "bg-red-500"
                  : "bg-blue-600"
              }`}
            />
            <span className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
              <Navigation
                size={13}
                aria-hidden="true"
                className="text-blue-600"
              />
              {statusLabel}
            </span>

            {routeState === "ready" && routeStats.durationMinutes > 0 && (
              <span className="flex items-center gap-1 border-l border-gray-200 pl-2 text-xs font-semibold text-gray-600">
                <Clock
                  size={12}
                  aria-hidden="true"
                  className="text-orange-500"
                />
                ~{routeStats.durationMinutes} min
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recenter button */}
      <button
        type="button"
        onClick={handleRecenter}
        aria-label="Recenter map on current position"
        className="absolute right-4 top-4 z-[400] grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition-transform hover:-translate-y-0.5 hover:bg-orange-50 hover:text-[#D92312] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 active:scale-95"
      >
        <Locate size={16} aria-hidden="true" />
      </button>

      {/* Loading overlay for map bootstrap */}
      {!isReady && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70"
        >
          <div className="flex items-center gap-2 rounded-full border border-gray-100 bg-white px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-gray-700 shadow-md">
            <span className="h-2 w-2 motion-safe:animate-pulse rounded-full bg-[#D92312]" />
            Loading map…
          </div>
        </div>
      )}

      {/* Screen reader status announcements */}
      <span className="sr-only" role="status" aria-live="polite">
        {routeState === "ready" && routeStats.distanceKm > 0
          ? `${distanceLabel} remaining, approximately ${routeStats.durationMinutes} minutes.`
          : routeState === "error"
          ? "Route unavailable."
          : ""}
      </span>

      {/* Scoped styles — keyed so React keeps a single instance */}
      <style key="elm-delivery-map-styles">{`
        .elm-pin-root {
          background: transparent !important;
          border: none !important;
        }
        .elm-pin {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2.5px solid #fff;
          box-shadow: 0 6px 18px rgba(0,0,0,0.22);
          color: #fff;
        }
        .elm-pin svg {
          width: 20px;
          height: 20px;
          display: block;
        }
        .elm-pin-cafe {
          background: linear-gradient(135deg, #ea580c, #f59e0b);
        }
        .elm-pin-customer {
          background: linear-gradient(135deg, #111827, #1f2937);
        }
        .elm-rider {
          position: relative;
          width: 48px;
          height: 48px;
          pointer-events: none;
        }
        .elm-rider-ring {
          position: absolute;
          inset: 6px;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.28);
          animation: elmRiderPulse 2s ease-out infinite;
          pointer-events: none;
        }
        .elm-pin-rider {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.55);
        }
        .elm-pin-rider svg {
          width: 18px;
          height: 18px;
        }
        @keyframes elmRiderPulse {
          0%   { transform: scale(0.7); opacity: 0.9; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .elm-rider-ring {
            animation: none;
            opacity: 0;
          }
        }
        .leaflet-container {
          font-family: inherit;
          background: #f3f4f6;
          border-radius: inherit;
        }
        .leaflet-container a {
          color: #d92312;
        }
        .leaflet-control-attribution {
          font-size: 9px !important;
          background: rgba(255, 255, 255, 0.9) !important;
          backdrop-filter: none !important;
        }
        .leaflet-control-zoom a {
          background: #fff !important;
          color: #1f2937 !important;
          border: 1px solid #e5e7eb !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 30px !important;
          font-weight: 900 !important;
        }
        .leaflet-control-zoom a:hover {
          background: #fef2f2 !important;
          color: #d92312 !important;
        }
      `}</style>
    </div>
  );
}