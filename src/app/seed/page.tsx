"use client";

import { useState } from "react";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DUMMY_MENU } from "@/data/menu";

export default function SeedPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const seedDatabase = async () => {
    setLoading(true);
    setStatus("Seeding database...");
    
    try {
      // Seed the starter catalog only on an empty database. Never overwrite
      // live products or recreate intentionally deleted starter products.
      const existingMenu = await getDocs(collection(db, "menuItems"));
      if (existingMenu.empty) {
        for (const [index, item] of DUMMY_MENU.entries()) {
          const itemRef = doc(db, "menuItems", item.id);
          const itemData: Partial<typeof item> = { ...item };
          delete itemData.id;
          await setDoc(itemRef, {
            ...itemData,
            available: true,
            order: index + 1,
          });
        }
      }

      // Initialize general settings only when no admin configuration exists.
      const settingsRef = doc(db, "settings", "general");
      const existingSettings = await getDoc(settingsRef);
      if (!existingSettings.exists()) {
        await setDoc(settingsRef, {
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
        });
      }

      setStatus(
        existingMenu.empty
          ? "Starter menu created. Existing site settings were preserved."
          : "Live menu already exists, so starter products were left untouched. Existing site settings were preserved."
      );
    } catch (error: unknown) {
      console.error(error);
      setStatus(`Error seeding: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Seed Firestore Database</h1>
        <p className="text-gray-600 mb-8">This initializes the starter menu only when the live catalog is empty. Existing products and admin settings are preserved.</p>
        
        <button 
          onClick={seedDatabase}
          disabled={loading}
          className="w-full py-3 bg-[var(--primary)] text-white font-bold rounded-xl disabled:opacity-50"
        >
          {loading ? "Checking catalog..." : "Initialize Empty Catalog"}
        </button>
        
        {status && <p className="mt-4 font-medium text-gray-800">{status}</p>}
      </div>
    </div>
  );
}
