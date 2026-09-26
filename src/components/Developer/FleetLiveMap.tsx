"use client";

import React, { useState } from "react";
import {
  Bike,
  MapPin,
  Compass,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { DeliveryPartner, Branch } from "@/lib/types";

interface FleetLiveMapProps {
  partners: DeliveryPartner[];
  branches: Branch[];
}

export default function FleetLiveMap({ partners, branches }: FleetLiveMapProps) {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    partners[0]?.id || null
  );

  const selectedPartner = partners.find((p) => p.id === selectedPartnerId);
  const selectedBranch = branches.find(
    (b) => b.id === selectedPartner?.assignedBranchId
  );

  return (
    <div className="space-y-4">
      {/* Fleet Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-500/10 text-cyan-400">
            <Compass size={18} />
          </div>
          <div>
            <h4 className="text-xs font-black text-white">Centralized Fleet Telemetry</h4>
            <p className="text-[10px] text-slate-400">
              Live location & order assignment status across all delivery partners
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {partners.filter((p) => p.availability === "AVAILABLE").length} Available
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            {partners.filter((p) => p.availability === "BUSY").length} On Delivery
          </span>
        </div>
      </div>

      {/* Fleet Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left List of Partners */}
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
          {partners.map((partner) => {
            const isSelected = partner.id === selectedPartnerId;
            const branch = branches.find((b) => b.id === partner.assignedBranchId);

            return (
              <div
                key={partner.id}
                onClick={() => setSelectedPartnerId(partner.id)}
                className={`flex flex-col gap-2 rounded-2xl border p-3.5 transition cursor-pointer ${
                  isSelected
                    ? "border-cyan-400/50 bg-cyan-950/30 shadow-lg ring-1 ring-cyan-400/30"
                    : "border-white/5 bg-slate-900/50 hover:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">🛵</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                      partner.availability === "AVAILABLE"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : partner.availability === "BUSY"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    {partner.availability || "OFFLINE"}
                  </span>
                </div>

                <div>
                  <h5 className="text-xs font-black text-white">{partner.name}</h5>
                  <p className="text-[10px] text-slate-400 font-mono">{partner.mobile}</p>
                  <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                    <MapPin size={10} /> {branch?.name || "Main Hub"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Active Partner Telemetry Card */}
        <div className="lg:col-span-2 rounded-3xl border border-white/5 bg-slate-900/70 p-6 backdrop-blur-xl flex flex-col justify-between">
          {selectedPartner ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                    Rider Telemetry Feed
                  </span>
                  <h3 className="text-lg font-black text-white">{selectedPartner.name}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-mono">Vehicle</span>
                  <span className="text-xs font-bold text-white uppercase">
                    {selectedPartner.vehicleType || "Scooter"}
                  </span>
                </div>
              </div>

              {/* Live Coordinates Box */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
                <div className="rounded-2xl border border-white/5 bg-slate-950 p-3">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">
                    Hub Coordinates
                  </span>
                  <span className="text-white font-bold mt-1 block">
                    {selectedBranch?.lat?.toFixed(4)}, {selectedBranch?.lng?.toFixed(4)}
                  </span>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-950 p-3">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">
                    Active Order
                  </span>
                  <span className="text-indigo-400 font-bold mt-1 block truncate">
                    {selectedPartner.currentOrderId || "No active order"}
                  </span>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-950 p-3 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">
                    Lifetime Deliveries
                  </span>
                  <span className="text-emerald-400 font-bold mt-1 block">
                    {selectedPartner.completedDeliveriesCount || 0} completed
                  </span>
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 text-xs text-slate-400">
                <p className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  Privacy & Multi-Tenant Isolation Enforced
                </p>
                <p className="text-[11px] leading-relaxed">
                  Customers are strictly restricted to reading location data for their own assigned delivery partner via their unique order token. Cross-fleet coordinates are only authorized for Developer and authorized Dispatch Managers.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-xs text-slate-500">
              Select a delivery partner to view telemetry
            </div>
          )}

          <div className="mt-4 border-t border-white/5 pt-3 text-[10px] font-mono text-slate-500 flex justify-between">
            <span>Fleet Protocol: Secure WebSocket / Firebase RT</span>
            <span>Refreshed: Just now</span>
          </div>
        </div>
      </div>
    </div>
  );
}
