"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getRoadRoute } from "@/lib/routing";

// Fix default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface DynamicMapProps {
  restaurantLat: number;
  restaurantLng: number;
  customerLat: number;
  customerLng: number;
  deliveryProgress: number; // 0 to 1
  className?: string;
}

export default function DynamicMap({
  restaurantLat,
  restaurantLng,
  customerLat,
  customerLng,
  deliveryProgress,
  className = "",
}: DynamicMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [roadPoints, setRoadPoints] = useState<[number, number][]>([]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const centerLat = (restaurantLat + customerLat) / 2;
    const centerLng = (restaurantLng + customerLng) / 2;
    const bounds = L.latLngBounds(
      [restaurantLat, restaurantLng],
      [customerLat, customerLng]
    );

    const map = L.map(containerRef.current, {
      center: [centerLat, centerLng],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    map.fitBounds(bounds, { padding: [50, 50] });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [restaurantLat, restaurantLng, customerLat, customerLng]);

  // Fetch road route and setup markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let isMounted = true;

    // Clear previous layers
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    if (vehicleMarkerRef.current) {
      map.removeLayer(vehicleMarkerRef.current);
      vehicleMarkerRef.current = null;
    }

    // Restaurant marker
    const restaurantIcon = L.divIcon({
      html: "🏪",
      className: "text-2xl",
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    });

    L.marker([restaurantLat, restaurantLng], { icon: restaurantIcon })
      .addTo(map)
      .bindPopup("<strong>ELPESTRO</strong><br />Pickup Hub");

    // Customer marker
    const customerIcon = L.divIcon({
      html: "🏠",
      className: "text-2xl",
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    });

    L.marker([customerLat, customerLng], { icon: customerIcon })
      .addTo(map)
      .bindPopup("<strong>Customer</strong><br />Delivery destination");

    // Fetch road route
    getRoadRoute(
      { lat: restaurantLat, lng: restaurantLng },
      { lat: customerLat, lng: customerLng }
    ).then((route) => {
      if (!isMounted || !mapRef.current) return;

      const points = route.coordinates;
      setRoadPoints(points);

      if (points.length >= 2) {
        const routeLine = L.polyline(points, {
          color: "#2563eb",
          weight: 4,
          opacity: 0.85,
        }).addTo(mapRef.current);
        routeLineRef.current = routeLine;

        // Vehicle marker along actual road
        const vehicleIcon = L.divIcon({
          html: "🛵",
          className: "text-3xl",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const startIndex = 0;
        const endIndex = points.length - 1;
        const index = Math.floor(startIndex + (endIndex - startIndex) * deliveryProgress);
        const clampedIndex = Math.min(Math.max(index, startIndex), endIndex);
        const vehiclePos = points[clampedIndex] || points[0];

        const vehicleMarker = L.marker(vehiclePos, { icon: vehicleIcon }).addTo(mapRef.current);
        vehicleMarkerRef.current = vehicleMarker;
      }
    });

    return () => {
      isMounted = false;
      if (vehicleMarkerRef.current && mapRef.current) {
        mapRef.current.removeLayer(vehicleMarkerRef.current);
      }
    };
  }, [restaurantLat, restaurantLng, customerLat, customerLng]);

  // Update vehicle position when deliveryProgress changes
  useEffect(() => {
    if (!vehicleMarkerRef.current || roadPoints.length < 2) return;

    const startIndex = 0;
    const endIndex = roadPoints.length - 1;
    const index = Math.floor(startIndex + (endIndex - startIndex) * deliveryProgress);
    const clampedIndex = Math.min(Math.max(index, startIndex), endIndex);
    const newPos = roadPoints[clampedIndex];

    if (newPos) {
      vehicleMarkerRef.current.setLatLng(newPos);
    }
  }, [deliveryProgress, roadPoints]);

  return <div ref={containerRef} className={`w-full h-full min-h-[300px] ${className}`} />;
}
