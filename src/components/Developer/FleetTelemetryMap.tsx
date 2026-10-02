"use client";

import { useEffect, useRef, useState } from "react";
import type { CircleMarker, Map as LeafletMap, TileLayer } from "leaflet";
import { Loader2, MapPinned } from "lucide-react";

export interface FleetRiderPosition {
  id: string;
  partnerId: string | null;
  name: string;
  orderNumber: string;
  lat: number;
  lng: number;
  freshness: "live" | "delayed" | "stale" | "unknown";
  freshnessLabel: string;
}

interface FleetTelemetryMapProps {
  riders: FleetRiderPosition[];
  selectedPartnerId: string | null;
  onSelectPartner: (partnerId: string) => void;
  fallbackCenter: { lat: number; lng: number };
}

type MapState = "loading" | "ready" | "error";

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const TILE_URLS = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

function markerColors(freshness: FleetRiderPosition["freshness"], selected: boolean) {
  if (selected) return { color: "#fff7ed", fillColor: "#e13b26" };
  if (freshness === "live") return { color: "#d1fae5", fillColor: "#059669" };
  if (freshness === "delayed") return { color: "#fef3c7", fillColor: "#d97706" };
  return { color: "#e2e8f0", fillColor: "#64748b" };
}

export default function FleetTelemetryMap({
  riders,
  selectedPartnerId,
  onSelectPartner,
  fallbackCenter,
}: FleetTelemetryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialCenterRef = useRef(fallbackCenter);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const tileThemeRef = useRef<"light" | "dark" | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markersRef = useRef(new Map<string, CircleMarker>());
  const riderByIdRef = useRef(new Map<string, FleetRiderPosition>());
  const onSelectPartnerRef = useRef(onSelectPartner);
  const previousRiderIdsRef = useRef("");
  const previousSelectionRef = useRef<string | null>(null);
  const previousCenterRef = useRef("");
  const [mapState, setMapState] = useState<MapState>("loading");

  useEffect(() => {
    onSelectPartnerRef.current = onSelectPartner;
  }, [onSelectPartner]);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    void (async () => {
      try {
        const leaflet = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (cancelled || !containerRef.current) return;

        leafletRef.current = leaflet;
        map = leaflet.map(containerRef.current, {
          center: [initialCenterRef.current.lat, initialCenterRef.current.lng],
          zoom: 12,
          zoomControl: false,
          scrollWheelZoom: false,
          doubleClickZoom: true,
          preferCanvas: true,
        });

        const initialTheme = document.documentElement.classList.contains("dark")
          ? "dark"
          : "light";
        tileThemeRef.current = initialTheme;
        tileLayerRef.current = leaflet
          .tileLayer(TILE_URLS[initialTheme], {
            attribution: ATTRIBUTION,
            subdomains: "abcd",
            maxZoom: 20,
          })
          .addTo(map);
        leaflet.control.zoom({ position: "bottomright" }).addTo(map);
        mapRef.current = map;
        map.invalidateSize({ animate: false });
        setMapState("ready");
      } catch (error) {
        console.error("Fleet map failed to initialize:", error);
        setMapState("error");
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.clear();
      riderByIdRef.current.clear();
      map?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      tileLayerRef.current = null;
      tileThemeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (mapState !== "ready" || !map || !leaflet) return;

    const syncTheme = () => {
      const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
      if (theme === tileThemeRef.current) return;
      tileLayerRef.current?.remove();
      tileLayerRef.current = leaflet
        .tileLayer(TILE_URLS[theme], {
          attribution: ATTRIBUTION,
          subdomains: "abcd",
          maxZoom: 20,
        })
        .addTo(map);
      tileThemeRef.current = theme;
    };

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [mapState]);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (mapState !== "ready" || !map || !leaflet) return;

    const currentIds = new Set(riders.map((rider) => rider.id));
    riderByIdRef.current = new Map(
      riders.map((rider): [string, FleetRiderPosition] => [rider.id, rider])
    );

    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    riders.forEach((rider) => {
      const selected = rider.partnerId === selectedPartnerId;
      const colors = markerColors(rider.freshness, selected);
      const style = {
        radius: selected ? 10 : 8,
        color: colors.color,
        weight: selected ? 3 : 2,
        opacity: 1,
        fillColor: colors.fillColor,
        fillOpacity: rider.freshness === "stale" || rider.freshness === "unknown" ? 0.68 : 0.92,
      };
      let marker = markersRef.current.get(rider.id);

      if (marker) {
        marker.setLatLng([rider.lat, rider.lng]);
        marker.setStyle(style);
      } else {
        marker = leaflet.circleMarker([rider.lat, rider.lng], style).addTo(map);
        marker.on("click", () => {
          const current = riderByIdRef.current.get(rider.id);
          if (current?.partnerId) onSelectPartnerRef.current(current.partnerId);
        });
        markersRef.current.set(rider.id, marker);
      }

      const tooltip = document.createElement("span");
      tooltip.textContent = `${rider.name} · ${rider.orderNumber} · ${rider.freshnessLabel}`;
      const existingTooltip = marker.getTooltip();
      if (existingTooltip) existingTooltip.setContent(tooltip);
      else marker.bindTooltip(tooltip, { direction: "top", offset: [0, -8] });
    });

    const riderIds = riders.map((rider) => rider.id).sort().join("|");
    const riderSetChanged = riderIds !== previousRiderIdsRef.current;
    const selectionChanged = selectedPartnerId !== previousSelectionRef.current;
    const centerKey = `${fallbackCenter.lat.toFixed(5)},${fallbackCenter.lng.toFixed(5)}`;
    const selectedRider = riders.find((rider) => rider.partnerId === selectedPartnerId);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    if (selectedRider && (riderSetChanged || selectionChanged)) {
      if (reduceMotion) {
        map.setView([selectedRider.lat, selectedRider.lng], Math.max(map.getZoom(), 14), {
          animate: false,
        });
      } else {
        map.flyTo([selectedRider.lat, selectedRider.lng], Math.max(map.getZoom(), 14), {
          duration: 0.45,
        });
      }
    } else if (riderSetChanged && riders.length > 1) {
      const bounds = leaflet.latLngBounds(
        riders.map((rider) => leaflet.latLng(rider.lat, rider.lng))
      );
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14, animate: !reduceMotion });
    } else if (riderSetChanged && riders.length === 1) {
      if (reduceMotion) map.setView([riders[0].lat, riders[0].lng], 14, { animate: false });
      else map.flyTo([riders[0].lat, riders[0].lng], 14, { duration: 0.45 });
    } else if (riderSetChanged && riders.length === 0) {
      map.setView([fallbackCenter.lat, fallbackCenter.lng], 12, { animate: !reduceMotion });
    } else if (riders.length === 0 && centerKey !== previousCenterRef.current) {
      map.setView([fallbackCenter.lat, fallbackCenter.lng], 12, { animate: false });
    } else if (selectionChanged && selectedRider) {
      map.panTo([selectedRider.lat, selectedRider.lng], {
        animate: !reduceMotion,
        duration: reduceMotion ? 0 : 0.45,
      });
    }

    previousRiderIdsRef.current = riderIds;
    previousSelectionRef.current = selectedPartnerId;
    previousCenterRef.current = centerKey;
  }, [fallbackCenter, mapState, onSelectPartner, riders, selectedPartnerId]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-950">
      <div
        ref={containerRef}
        className="h-[300px] w-full sm:h-[360px]"
        role="region"
        aria-label="Live delivery fleet map"
      />
      {mapState !== "ready" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-100/90 text-sm font-semibold text-slate-600 dark:bg-slate-950/90 dark:text-slate-300">
          <span className="flex items-center gap-2">
            {mapState === "loading" ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <MapPinned size={16} aria-hidden="true" />
            )}
            {mapState === "loading" ? "Loading fleet map…" : "Map could not be loaded"}
          </span>
        </div>
      )}
      {mapState === "ready" && riders.length === 0 && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300">
          No active delivery is sharing GPS right now.
        </div>
      )}
    </div>
  );
}
