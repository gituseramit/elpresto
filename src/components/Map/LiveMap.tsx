"use client";

import dynamic from "next/dynamic";

const DynamicDeliveryLiveMap = dynamic(() => import("./DeliveryLiveMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] bg-blue-50/50 rounded-2xl flex flex-col items-center justify-center border border-blue-100 gap-2">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <span className="text-xs text-blue-600 font-medium">Loading Live Tracking Map...</span>
    </div>
  ),
});

interface LiveMapProps {
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

export default function LiveMap(props: LiveMapProps) {
  return <DynamicDeliveryLiveMap {...props} />;
}
