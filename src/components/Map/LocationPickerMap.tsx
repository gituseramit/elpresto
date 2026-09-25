"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getRoadRoute, reverseGeocodeAddress } from "@/lib/routing";
import { Locate, AlertTriangle, CheckCircle, Navigation, Clock } from "lucide-react";

// Fix standard Leaflet default icon issues in bundler
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface LocationPickerMapProps {
  cafeLat: number;
  cafeLng: number;
  radiusKm: number;
  initialLat?: number;
  initialLng?: number;
  onLocationSelect: (data: {
    lat: number;
    lng: number;
    distanceKm: number;
    isWithinRadius: boolean;
    durationMinutes?: number;
  }) => void;
  onAddressResolved?: (addr: {
    fullAddress: string;
    road?: string;
    suburb?: string;
    city?: string;
    postcode?: string;
  }) => void;
  className?: string;
}

export default function LocationPickerMap({
  cafeLat,
  cafeLng,
  radiusKm,
  initialLat,
  initialLng,
  onLocationSelect,
  onAddressResolved,
  className = "",
}: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const routeCasingRef = useRef<L.Polyline | null>(null);

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat || cafeLat + 0.005,
    lng: initialLng || cafeLng + 0.005,
  });

  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isWithin, setIsWithin] = useState<boolean>(true);
  const [isRouting, setIsRouting] = useState<boolean>(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  // Draw or update the road polyline from Cafe to Customer
  const drawRoutePolyline = useCallback((coords: [number, number][]) => {
    const map = mapRef.current;
    if (!map || coords.length < 2) return;

    if (routeCasingRef.current) {
      map.removeLayer(routeCasingRef.current);
      routeCasingRef.current = null;
    }
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    const casing = L.polyline(coords, {
      color: "#ea580c",
      weight: 6,
      opacity: 0.3,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);
    routeCasingRef.current = casing;

    const line = L.polyline(coords, {
      color: "#f97316",
      weight: 3.5,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);
    routeLineRef.current = line;
  }, []);

  // Update selection helper with road routing
  const handleCoordUpdate = useCallback(
    async (lat: number, lng: number) => {
      setCurrentCoords({ lat, lng });
      setIsRouting(true);

      try {
        const route = await getRoadRoute(
          { lat: cafeLat, lng: cafeLng },
          { lat, lng }
        );

        const roadDist = route.distanceKm;
        const within = roadDist <= radiusKm;

        setDistance(roadDist);
        setDuration(route.durationMinutes);
        setIsWithin(within);

        if (route.coordinates.length > 0) {
          drawRoutePolyline(route.coordinates);
        }

        onLocationSelect({
          lat,
          lng,
          distanceKm: roadDist,
          isWithinRadius: within,
          durationMinutes: route.durationMinutes,
        });

        // Reverse geocoding in the background
        reverseGeocodeAddress(lat, lng).then((addr) => {
          if (addr) {
            setResolvedAddress(addr.fullAddress);
            onAddressResolved?.(addr);
          }
        });
      } catch (err) {
        console.error("Road route calculation failed:", err);
      } finally {
        setIsRouting(false);
      }
    },
    [cafeLat, cafeLng, radiusKm, onLocationSelect, onAddressResolved, drawRoutePolyline]
  );

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const startLat = initialLat || cafeLat + 0.005;
    const startLng = initialLng || cafeLng + 0.005;

    const map = L.map(containerRef.current, {
      center: [startLat, startLng],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // 1. Cafe Marker
    const cafeIcon = L.divIcon({
      html: `<div style="background:#ea580c;color:white;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 14px rgba(234,88,12,0.45);border:2.5px solid white;">🏪</div>`,
      className: "custom-cafe-pin",
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    L.marker([cafeLat, cafeLng], { icon: cafeIcon })
      .addTo(map)
      .bindPopup("<strong>EL PRESTO PIZZA</strong><br/>Delivery Hub (UCER Campus)");

    // 2. Delivery Radius Circle (boundary reference)
    L.circle([cafeLat, cafeLng], {
      radius: radiusKm * 1000,
      color: "#f97316",
      fillColor: "#fdba74",
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: "5, 5",
    }).addTo(map);

    // 3. Customer Marker (Draggable)
    const customerIcon = L.divIcon({
      html: `<div style="background:#16a34a;color:white;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 14px rgba(22,163,74,0.5);border:2.5px solid white;cursor:grab;">📍</div>`,
      className: "custom-cust-pin",
      iconSize: [40, 40],
      iconAnchor: [20, 38],
    });

    const marker = L.marker([startLat, startLng], {
      icon: customerIcon,
      draggable: true,
    }).addTo(map);

    marker.bindPopup("<strong>Delivery Location</strong><br/>Drag to fine-tune your spot");

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      handleCoordUpdate(pos.lat, pos.lng);
    });

    // Map Click moves marker
    map.on("click", (e) => {
      marker.setLatLng(e.latlng);
      handleCoordUpdate(e.latlng.lat, e.latlng.lng);
    });

    customerMarkerRef.current = marker;
    mapRef.current = map;

    // Initial Road Route calculation
    handleCoordUpdate(startLat, startLng);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [cafeLat, cafeLng, radiusKm]);

  // GPS Locate User Function
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsLoading(false);

        if (mapRef.current && customerMarkerRef.current) {
          customerMarkerRef.current.setLatLng([latitude, longitude]);
          mapRef.current.setView([latitude, longitude], 16, { animate: true });

          // Accuracy Circle
          if (accuracyCircleRef.current) {
            mapRef.current.removeLayer(accuracyCircleRef.current);
          }

          if (accuracy < 500) {
            const circle = L.circle([latitude, longitude], {
              radius: accuracy,
              color: "#3b82f6",
              fillColor: "#93c5fd",
              fillOpacity: 0.2,
              weight: 1,
            }).addTo(mapRef.current);
            accuracyCircleRef.current = circle;
          }

          handleCoordUpdate(latitude, longitude);
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError("Location access denied. Please click on the map to set your address.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError("GPS signal unavailable. Please select your location on the map.");
        } else {
          setGpsError("Location request timed out. Please select on the map.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={gpsLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl text-sm shadow-md hover:from-orange-600 hover:to-amber-600 transition-all active:scale-95 disabled:opacity-50"
        >
          <Locate size={16} className={gpsLoading ? "animate-spin" : ""} />
          {gpsLoading ? "Detecting GPS..." : "📍 Use My Current Location"}
        </button>

        <span className="text-xs text-gray-500 font-medium">
          💡 Click map or drag pin along roads
        </span>
      </div>

      {gpsError && (
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle size={15} className="flex-shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Map Canvas */}
      <div className="relative rounded-2xl overflow-hidden border border-orange-200 shadow-inner">
        <div ref={containerRef} className="w-full h-[260px] md:h-[300px]" />

        {/* In-Map Road Route indicator chip */}
        <div className="absolute top-2.5 right-2.5 z-[400] bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-gray-700 border border-orange-200 shadow-sm flex items-center gap-1.5">
          <Navigation size={11} className="text-orange-600" />
          <span>Road Route to Hub</span>
        </div>
      </div>

      {/* Distance & Validation Pill */}
      <div
        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs md:text-sm font-semibold transition-colors ${
          isWithin
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-700"
        }`}
      >
        <div className="flex items-center gap-2">
          {isWithin ? (
            <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
          ) : (
            <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
          )}
          <span>
            {isRouting ? (
              "Calculating actual road distance..."
            ) : isWithin ? (
              <>
                ✅ Delivery Available! (~{distance} km via road
                {duration > 0 ? `, ~${duration} min drive` : ""})
              </>
            ) : (
              `❌ Outside Delivery Zone (~${distance} km road distance, max allowed: ${radiusKm} km)`
            )}
          </span>
        </div>

        {duration > 0 && isWithin && (
          <span className="text-[11px] text-green-700 flex items-center gap-1 bg-green-100/60 px-2 py-0.5 rounded-full w-fit">
            <Clock size={12} /> ~{duration} mins travel
          </span>
        )}
      </div>

      {/* Resolved Address text if available */}
      {resolvedAddress && (
        <div className="text-[11px] text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 flex items-center gap-1.5 truncate">
          <span className="font-bold text-gray-600">Location:</span>
          <span className="truncate">{resolvedAddress}</span>
        </div>
      )}
    </div>
  );
}
