"use client";

import dynamic from "next/dynamic";

const DynamicMap = dynamic(() => import("./DynamicMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] bg-gray-200/50 rounded-2xl flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
    </div>
  ),
});

interface MapProps {
  restaurantLat: number;
  restaurantLng: number;
  customerLat: number;
  customerLng: number;
  deliveryProgress: number;
  className?: string;
}

export default function Map(props: MapProps) {
  return <DynamicMap {...props} />;
}