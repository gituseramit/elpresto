"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getRoadRoute, RouteResult } from "@/lib/routing";
import { Navigation, Clock, Compass, ShieldCheck } from "lucide-react";

// Fix Leaflet default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

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
  onRouteCalculated?: (route: {
    distanceKm: number;
    durationMinutes: number;
    coordinates: [number, number][];
  }) => void;
}

export default function DeliveryLiveMap({
  riderLat,
  riderLng,
  customerLat,
  customerLng,
  cafeLat = 25.3409769,
  cafeLng = 81.9116436,
  customerName = "Customer",
  className = "",
  showHud = true,
  onRouteCalculated,
}: DeliveryLiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Markers & Layers refs
  const cafeMarkerRef = useRef<L.Marker | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const riderPulseRef = useRef<L.Circle | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeCasingRef = useRef<L.Polyline | null>(null);
  const traveledLineRef = useRef<L.Polyline | null>(null);

  // Track last fetched origin to prevent thrashing
  const lastFetchedOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  const isFetchingRouteRef = useRef(false);

  const [routeStats, setRouteStats] = useState<{
    distanceKm: number;
    durationMinutes: number;
    isCalculating: boolean;
  }>({
    distanceKm: 0,
    durationMinutes: 0,
    isCalculating: true,
  });

  // Helper to draw or update the road polyline on the map
  const applyRoadPolyline = useCallback(
    (coords: [number, number][], fitBounds = false) => {
      const map = mapRef.current;
      if (!map || coords.length < 2) return;

      // Clean existing route lines
      if (routeCasingRef.current) {
        map.removeLayer(routeCasingRef.current);
        routeCasingRef.current = null;
      }
      if (routePolylineRef.current) {
        map.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
      }

      // Outer glow / casing for high visibility over all map backgrounds
      const casing = L.polyline(coords, {
        color: "#1d4ed8",
        weight: 8,
        opacity: 0.35,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      routeCasingRef.current = casing;

      // Vibrant inner road line
      const polyline = L.polyline(coords, {
        color: "#2563eb",
        weight: 4.5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      routePolylineRef.current = polyline;

      if (fitBounds) {
        map.fitBounds(polyline.getBounds(), { padding: [45, 45], maxZoom: 16 });
      }
    },
    []
  );

  // Main route calculation function
  const updateRoute = useCallback(
    async (
      origin: { lat: number; lng: number },
      destination: { lat: number; lng: number },
      fitBounds = false
    ) => {
      if (isFetchingRouteRef.current) return;
      isFetchingRouteRef.current = true;

      setRouteStats((prev) => ({ ...prev, isCalculating: true }));

      try {
        const route = await getRoadRoute(origin, destination);
        lastFetchedOriginRef.current = origin;

        if (route.coordinates.length > 0) {
          applyRoadPolyline(route.coordinates, fitBounds);

          setRouteStats({
            distanceKm: route.distanceKm,
            durationMinutes: route.durationMinutes,
            isCalculating: false,
          });

          onRouteCalculated?.({
            distanceKm: route.distanceKm,
            durationMinutes: route.durationMinutes,
            coordinates: route.coordinates,
          });
        }
      } catch (err) {
        console.error("Failed to render road route:", err);
      } finally {
        isFetchingRouteRef.current = false;
        setRouteStats((prev) => ({ ...prev, isCalculating: false }));
      }
    },
    [applyRoadPolyline, onRouteCalculated]
  );

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenterLat = riderLat
      ? (riderLat + customerLat) / 2
      : (cafeLat + customerLat) / 2;
    const initialCenterLng = riderLng
      ? (riderLng + customerLng) / 2
      : (cafeLng + customerLng) / 2;

    const map = L.map(containerRef.current, {
      center: [initialCenterLat, initialCenterLng],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // 1. Restaurant Marker
    const cafeIcon = L.divIcon({
      html: `<div style="background:#ea580c;color:white;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 4px 14px rgba(234,88,12,0.45);border:2.5px solid white;">🏪</div>`,
      className: "cafe-pin",
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    const cafeMarker = L.marker([cafeLat, cafeLng], { icon: cafeIcon })
      .addTo(map)
      .bindPopup("<strong>EL PRESTO PIZZA</strong><br/>Pickup Hub (UCER Campus)");
    cafeMarkerRef.current = cafeMarker;

    // 2. Customer Marker
    const customerIcon = L.divIcon({
      html: `<div style="background:#16a34a;color:white;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 4px 14px rgba(22,163,74,0.45);border:2.5px solid white;">🏠</div>`,
      className: "customer-pin",
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    const customerMarker = L.marker([customerLat, customerLng], {
      icon: customerIcon,
    })
      .addTo(map)
      .bindPopup(`<strong>${customerName}</strong><br/>Delivery Destination`);
    customerMarkerRef.current = customerMarker;

    // 3. Delivery Partner Scooter Marker (always visible on map)
    const effectiveInitRiderLat = riderLat ?? cafeLat;
    const effectiveInitRiderLng = riderLng ?? cafeLng;

    const riderIcon = L.divIcon({
      html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <div style="background:linear-gradient(135deg, #2563eb, #1d4ed8);color:white;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 8px 24px rgba(37,99,235,0.6);border:3px solid white;animation:scooterFloat 1.8s ease-in-out infinite;">🛵</div>
        <div style="background:#0f172a;color:#93c5fd;font-size:10px;font-weight:900;padding:2px 8px;border-radius:9999px;margin-top:3px;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.4);border:1px solid rgba(147,197,253,0.35);letter-spacing:0.5px;">RIDER 🛵</div>
      </div>`,
      className: "scooter-pin",
      iconSize: [60, 68],
      iconAnchor: [30, 22],
    });

    const riderMarker = L.marker([effectiveInitRiderLat, effectiveInitRiderLng], {
      icon: riderIcon,
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindPopup(
        riderLat && riderLng
          ? "<strong>🛵 Delivery Partner</strong><br/>Live GPS Location"
          : "<strong>🛵 Delivery Partner</strong><br/>Pickup Hub (Ready to start)"
      );
    riderMarkerRef.current = riderMarker;

    if (riderLat && riderLng) {
      const pulse = L.circle([riderLat, riderLng], {
        radius: 35,
        color: "#3b82f6",
        fillColor: "#93c5fd",
        fillOpacity: 0.25,
        weight: 1.5,
      }).addTo(map);
      riderPulseRef.current = pulse;
    }

    mapRef.current = map;

    // Initial Road Route: From Rider if active, else from Cafe
    const origin = riderLat && riderLng ? { lat: riderLat, lng: riderLng } : { lat: cafeLat, lng: cafeLng };
    updateRoute(origin, { lat: customerLat, lng: customerLng }, true);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [customerLat, customerLng, cafeLat, cafeLng]);

  // Handle Live Rider GPS movement & Road Route recalculation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (riderLat && riderLng) {
      // 1. Create or update Rider Marker
      if (!riderMarkerRef.current) {
        const riderIcon = L.divIcon({
          html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
            <div style="background:linear-gradient(135deg, #2563eb, #1d4ed8);color:white;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 8px 24px rgba(37,99,235,0.6);border:3px solid white;animation:scooterFloat 1.8s ease-in-out infinite;">🛵</div>
            <div style="background:#0f172a;color:#93c5fd;font-size:10px;font-weight:900;padding:2px 8px;border-radius:9999px;margin-top:3px;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.4);border:1px solid rgba(147,197,253,0.35);letter-spacing:0.5px;">RIDER 🛵</div>
          </div>`,
          className: "scooter-pin",
          iconSize: [60, 68],
          iconAnchor: [30, 22],
        });

        const riderMarker = L.marker([riderLat, riderLng], { icon: riderIcon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup("<strong>🛵 Delivery Partner</strong><br/>Live GPS Location");
        riderMarkerRef.current = riderMarker;

        // Pulsing accuracy halo
        const pulse = L.circle([riderLat, riderLng], {
          radius: 35,
          color: "#3b82f6",
          fillColor: "#93c5fd",
          fillOpacity: 0.25,
          weight: 1.5,
        }).addTo(map);
        riderPulseRef.current = pulse;
      } else {
        // Smoothly update positions
        riderMarkerRef.current.setLatLng([riderLat, riderLng]);
        riderMarkerRef.current.setPopupContent("<strong>🛵 Delivery Partner</strong><br/>Live GPS Location");
        if (riderPulseRef.current) {
          riderPulseRef.current.setLatLng([riderLat, riderLng]);
        } else {
          const pulse = L.circle([riderLat, riderLng], {
            radius: 35,
            color: "#3b82f6",
            fillColor: "#93c5fd",
            fillOpacity: 0.25,
            weight: 1.5,
          }).addTo(map);
          riderPulseRef.current = pulse;
        }
      }

      // 2. Draw subtle line from Cafe to Rider showing origin
      if (cafeLat && cafeLng) {
        if (!traveledLineRef.current) {
          traveledLineRef.current = L.polyline(
            [
              [cafeLat, cafeLng],
              [riderLat, riderLng],
            ],
            {
              color: "#94a3b8",
              weight: 3,
              dashArray: "4, 6",
              opacity: 0.7,
            }
          ).addTo(map);
        } else {
          traveledLineRef.current.setLatLngs([
            [cafeLat, cafeLng],
            [riderLat, riderLng],
          ]);
        }
      }

      // 3. Recalculate road route from current rider location to customer
      // Only trigger recalculation if rider has moved > ~25 meters to avoid spamming
      const last = lastFetchedOriginRef.current;
      const movedDist = last
        ? Math.hypot(riderLat - last.lat, riderLng - last.lng)
        : 999;

      if (movedDist > 0.00025) {
        // ~25 meters
        updateRoute({ lat: riderLat, lng: riderLng }, { lat: customerLat, lng: customerLng }, false);
      }
    } else {
      // If rider is not active, remove rider marker and ensure route is Cafe -> Customer
      if (riderMarkerRef.current) {
        map.removeLayer(riderMarkerRef.current);
        riderMarkerRef.current = null;
      }
      if (riderPulseRef.current) {
        map.removeLayer(riderPulseRef.current);
        riderPulseRef.current = null;
      }
      if (traveledLineRef.current) {
        map.removeLayer(traveledLineRef.current);
        traveledLineRef.current = null;
      }
    }
  }, [riderLat, riderLng, customerLat, customerLng, cafeLat, cafeLng, updateRoute]);

  return (
    <div className={`relative w-full h-full min-h-0 overflow-hidden ${className}`}>
      {/* Map Canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Floating HUD: Live Road Distance & ETA Chip */}
      {showHud && (
        <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-lg border border-blue-100 flex items-center gap-2.5 text-xs text-gray-800 pointer-events-auto">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <div className="flex items-center gap-1.5 font-bold">
              <Navigation size={13} className="text-blue-600" />
              <span>
                {routeStats.distanceKm > 0
                  ? `${routeStats.distanceKm} km via road`
                  : "Calculating road route..."}
              </span>
            </div>

            {routeStats.durationMinutes > 0 && (
              <div className="flex items-center gap-1 text-gray-600 font-semibold pl-2 border-l border-gray-200">
                <Clock size={12} className="text-orange-500" />
                <span>~{routeStats.durationMinutes} min drive</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom status badge */}
      <div className="absolute bottom-3 left-3 z-[400] text-[11px] text-gray-700 bg-white/90 px-3 py-1 rounded-full backdrop-blur-md shadow-sm border border-gray-200/60 flex items-center gap-1.5">
        <Compass size={12} className="text-blue-600 animate-spin" style={{ animationDuration: "8s" }} />
        <span>
          {riderLat
            ? "Live GPS Navigation Synchronized"
            : "Showing road route from El Presto"}
        </span>
      </div>
    </div>
  );
}
