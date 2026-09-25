"use client";

import { useState } from "react";
import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DUMMY_MENU } from "@/data/menu";

export default function SeedPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const seedDatabase = async () => {
    setLoading(true);
    setStatus("Seeding database...");
    
    try {
      // Create a menuItems collection
      for (const item of DUMMY_MENU) {
        // Use the id as the document ID for simplicity
        const itemRef = doc(db, "menuItems", item.id);
        await setDoc(itemRef, { ...item, available: true, order: 1 });
      }

      // Seed general settings including cafe coordinates & delivery
      const settingsRef = doc(db, "settings", "general");
      await setDoc(
        settingsRef,
        {
          cafeName: "EL PRESTO PIZZA",
          phone: "+91 6392512314",
          address: "United College of Engineering and Research, Naini, Prayagraj",
          openTime: "10:00",
          closeTime: "23:00",
          orderingEnabled: true,
          soundEnabled: true,
          cafeLat: 25.3409769,
          cafeLng: 81.9116436,
          restaurantLat: 25.3409769,
          restaurantLng: 81.9116436,
          deliveryRadiusKm: 7,
          baseDeliveryFee: 30,
          freeDeliveryThreshold: 499,
          deliveryEnabled: true,
        },
        { merge: true }
      );

      setStatus("Successfully seeded menu items & delivery settings to Firestore!");
    } catch (error: any) {
      console.error(error);
      setStatus(`Error seeding: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Seed Firestore Database</h1>
        <p className="text-gray-600 mb-8">This will push the dummy menu items into your real Firebase Firestore database.</p>
        
        <button 
          onClick={seedDatabase}
          disabled={loading}
          className="w-full py-3 bg-[var(--primary)] text-white font-bold rounded-xl disabled:opacity-50"
        >
          {loading ? "Seeding..." : "Seed Menu Items"}
        </button>
        
        {status && <p className="mt-4 font-medium text-gray-800">{status}</p>}
      </div>
    </div>
  );
}
