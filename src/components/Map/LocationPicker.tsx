"use client";

import dynamic from "next/dynamic";

const DynamicLocationPicker = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[280px] bg-orange-50/50 rounded-2xl flex flex-col items-center justify-center border border-orange-100 gap-2">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      <span className="text-xs text-orange-600 font-medium">Loading Interactive Map...</span>
    </div>
  ),
});

interface LocationPickerProps {
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

export default function LocationPicker(props: LocationPickerProps) {
  return <DynamicLocationPicker {...props} />;
}
