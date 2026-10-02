"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bike,
  CheckCircle2,
  Clock3,
  Compass,
  MapPin,
  Radio,
} from "lucide-react";
import type { Branch, DeliveryPartner, Order } from "@/lib/types";
import FleetTelemetryMap, {
  type FleetRiderPosition,
} from "@/components/Developer/FleetTelemetryMap";

interface FleetLiveMapProps {
  partners: DeliveryPartner[];
  branches: Branch[];
  orders: Order[];
}

type SignalFreshness = FleetRiderPosition["freshness"];

interface RiderSignal extends FleetRiderPosition {
  updatedAtMs: number | null;
  activeOrderId: string;
}

function readCoordinate(value: unknown, min: number, max: number): number | null {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
      ? Number(value)
      : Number.NaN;
  return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max
    ? numberValue
    : null;
}

function readTimestamp(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 && value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object") {
    const timestamp = value as {
      toMillis?: () => number;
      seconds?: number;
      _seconds?: number;
    };
    if (typeof timestamp.toMillis === "function") {
      const parsed = timestamp.toMillis();
      return Number.isFinite(parsed) ? parsed : null;
    }
    const seconds = timestamp.seconds ?? timestamp._seconds;
    if (typeof seconds === "number" && Number.isFinite(seconds)) {
      return seconds * 1000;
    }
  }
  return null;
}

function describeFreshness(updatedAtMs: number | null, now: number) {
  if (updatedAtMs === null || now === 0) {
    return { freshness: "unknown" as const, label: "Time unavailable", ageLabel: "—" };
  }

  const age = Math.max(0, now - updatedAtMs);
  const freshness: SignalFreshness =
    age <= 30_000 ? "live" : age <= 120_000 ? "delayed" : "stale";
  const ageLabel =
    age < 5_000
      ? "just now"
      : age < 60_000
      ? `${Math.floor(age / 1000)} sec ago`
      : `${Math.floor(age / 60_000)} min ago`;
  const label =
    freshness === "live"
      ? "Live"
      : freshness === "delayed"
      ? "Delayed"
      : "Stale";
  return { freshness, label, ageLabel };
}

function getSignalIdentity(order: Order, partners: DeliveryPartner[]) {
  const rawIds = [order.deliveryPersonId, order.deliveryPartnerId]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase());
  const riderName = typeof order.deliveryPersonName === "string"
    ? order.deliveryPersonName.trim()
    : "";
  const normalizedName = riderName.toLocaleLowerCase();

  const partner =
    partners.find((candidate) =>
      rawIds.some(
        (id) =>
          candidate.id.trim().toLowerCase() === id ||
          candidate.userId?.trim().toLowerCase() === id
      )
    ) ??
    (normalizedName
      ? partners.find((candidate) => candidate.name.trim().toLocaleLowerCase() === normalizedName)
      : undefined);

  const explicitId = rawIds.find((id) => id !== "rider_portal");
  const id = partner?.id ?? (explicitId ? `rider:${explicitId}` : `rider:${normalizedName || order.id}`);
  return {
    id,
    partnerId: partner?.id ?? null,
    name: riderName || partner?.name || "Delivery partner",
  };
}

function getActiveRiderSignals(
  orders: Order[],
  partners: DeliveryPartner[],
  now: number
): RiderSignal[] {
  const latestByRider = new Map<string, RiderSignal>();

  for (const order of orders) {
    const status = String(order.status || "").toLowerCase();
    const deliveryStatus = String(order.deliveryStatus || "").toLowerCase();
    if (
      status === "completed" ||
      status === "cancelled" ||
      deliveryStatus === "delivered" ||
      (status !== "out_for_delivery" && deliveryStatus !== "out_for_delivery")
    ) {
      continue;
    }

    const location = order.deliveryPersonLocation;
    const lat =
      readCoordinate(location?.lat, -90, 90) ??
      readCoordinate(order.deliveryPersonLatitude, -90, 90);
    const lng =
      readCoordinate(location?.lng, -180, 180) ??
      readCoordinate(order.deliveryPersonLongitude, -180, 180);
    if (lat === null || lng === null || (lat === 0 && lng === 0)) continue;

    const identity = getSignalIdentity(order, partners);
    const updatedAtMs =
      readTimestamp(location?.updatedAt) ??
      readTimestamp(order.deliveryLocationUpdatedAt);
    const freshnessInfo = describeFreshness(updatedAtMs, now);
    const next: RiderSignal = {
      ...identity,
      activeOrderId: order.id,
      orderNumber: order.orderNumber || order.id,
      lat,
      lng,
      updatedAtMs,
      freshness: freshnessInfo.freshness,
      freshnessLabel:
        freshnessInfo.ageLabel === "—"
          ? freshnessInfo.label
          : `${freshnessInfo.label} · ${freshnessInfo.ageLabel}`,
    };

    const previous = latestByRider.get(identity.id);
    if (
      !previous ||
      (updatedAtMs ?? 0) >= (previous.updatedAtMs ?? 0)
    ) {
      latestByRider.set(identity.id, next);
    }
  }

  return Array.from(latestByRider.values());
}

function freshnessClasses(freshness: SignalFreshness) {
  if (freshness === "live") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";
  if (freshness === "delayed") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  if (freshness === "stale") return "bg-slate-500/15 text-slate-600 dark:text-slate-300";
  return "bg-slate-500/10 text-slate-500 dark:text-slate-400";
}

export default function FleetLiveMap({ partners, branches, orders }: FleetLiveMapProps) {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    partners[0]?.id || null
  );
  const [now, setNow] = useState(0);

  useEffect(() => {
    const updateClock = () => setNow(Date.now());
    updateClock();
    const interval = window.setInterval(updateClock, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedPartnerId && partners.some((partner) => partner.id === selectedPartnerId)) return;
    setSelectedPartnerId(partners[0]?.id ?? null);
  }, [partners, selectedPartnerId]);

  const selectedPartner = partners.find((partner) => partner.id === selectedPartnerId);
  const selectedBranch = branches.find(
    (branch) => branch.id === selectedPartner?.assignedBranchId
  );

  const riderSignals = useMemo(
    () => getActiveRiderSignals(orders, partners, now),
    [now, orders, partners]
  );
  const selectedSignal = riderSignals.find(
    (signal) => signal.partnerId === selectedPartnerId
  );
  const liveCount = riderSignals.filter((signal) => signal.freshness === "live").length;
  const fallbackBranch =
    selectedBranch &&
    readCoordinate(selectedBranch.lat, -90, 90) !== null &&
    readCoordinate(selectedBranch.lng, -180, 180) !== null
      ? selectedBranch
      : branches.find(
          (branch) =>
            readCoordinate(branch.lat, -90, 90) !== null &&
            readCoordinate(branch.lng, -180, 180) !== null
        );
  const fallbackCenter = useMemo(
    () => ({
      lat: readCoordinate(fallbackBranch?.lat, -90, 90) ?? 25.3409769,
      lng: readCoordinate(fallbackBranch?.lng, -180, 180) ?? 81.9116436,
    }),
    [fallbackBranch]
  );

  const availableCount = partners.filter((partner) => partner.availability === "AVAILABLE").length;
  const busyCount = partners.filter((partner) => partner.availability === "BUSY").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-slate-900/60 dark:shadow-none">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <Compass size={18} aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white">
              Centralized Fleet Telemetry
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Rider GPS and delivery status sync from active orders
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {availableCount} Available
          </span>
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {busyCount} On delivery
          </span>
          <span className="flex items-center gap-1 text-cyan-700 dark:text-cyan-300">
            <Radio size={12} aria-hidden="true" />
            {liveCount} Fresh GPS
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
          {partners.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-400">
              No delivery partners are configured yet.
            </div>
          ) : (
            partners.map((partner) => {
              const isSelected = partner.id === selectedPartnerId;
              const branch = branches.find((item) => item.id === partner.assignedBranchId);
              const signal = riderSignals.find((item) => item.partnerId === partner.id);

              return (
                <button
                  key={partner.id}
                  type="button"
                  onClick={() => setSelectedPartnerId(partner.id)}
                  aria-pressed={isSelected}
                  className={`flex w-full flex-col gap-2 rounded-2xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                    isSelected
                      ? "border-cyan-500/50 bg-cyan-50 shadow-sm dark:border-cyan-400/50 dark:bg-cyan-950/30 dark:shadow-lg dark:ring-1 dark:ring-cyan-400/20"
                      : "border-slate-200 bg-white hover:border-cyan-300 dark:border-white/5 dark:bg-slate-900/50 dark:hover:border-white/10"
                  }`}
                >
                  <span className="flex w-full items-center justify-between">
                    <Bike size={19} className="text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                        partner.availability === "AVAILABLE"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : partner.availability === "BUSY"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : "bg-slate-500/15 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {partner.availability || "OFFLINE"}
                    </span>
                  </span>

                  <span className="block">
                    <span className="block text-xs font-black text-slate-900 dark:text-white">
                      {partner.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      {partner.mobile}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-500">
                      <MapPin size={10} aria-hidden="true" /> {branch?.name || "Main Hub"}
                    </span>
                  </span>

                  <span className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2 dark:border-white/5">
                    <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                      {signal ? signal.orderNumber : "No active GPS signal"}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${freshnessClasses(signal?.freshness ?? "unknown")}`}>
                      {signal?.freshnessLabel ?? "No GPS"}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-slate-900/70 dark:shadow-none sm:p-6 lg:col-span-2">
          {selectedPartner ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-white/10">
                <div className="min-w-0">
                  <span className="font-mono text-xs font-bold uppercase text-cyan-700 dark:text-cyan-400">
                    Rider telemetry feed
                  </span>
                  <h3 className="truncate text-lg font-black text-slate-900 dark:text-white">
                    {selectedPartner.name}
                  </h3>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    Vehicle
                  </span>
                  <span className="text-xs font-bold uppercase text-slate-900 dark:text-white">
                    {selectedPartner.vehicleType || "Scooter"}
                  </span>
                </div>
              </div>

              <FleetTelemetryMap
                riders={riderSignals}
                selectedPartnerId={selectedPartnerId}
                onSelectPartner={setSelectedPartnerId}
                fallbackCenter={fallbackCenter}
              />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/5 dark:bg-slate-950">
                  <span className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-500">
                    Hub coordinates
                  </span>
                  <span className="mt-1 block font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {selectedBranch?.lat?.toFixed(4) ?? "—"}, {selectedBranch?.lng?.toFixed(4) ?? "—"}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/5 dark:bg-slate-950">
                  <span className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-500">
                    Rider GPS
                  </span>
                  <span className="mt-1 block font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {selectedSignal
                      ? `${selectedSignal.lat.toFixed(5)}, ${selectedSignal.lng.toFixed(5)}`
                      : "No active signal"}
                  </span>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${freshnessClasses(selectedSignal?.freshness ?? "unknown")}`}>
                    {selectedSignal?.freshnessLabel ?? "Waiting for GPS"}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/5 dark:bg-slate-950">
                  <span className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-500">
                    Active order
                  </span>
                  <span className="mt-1 block truncate font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400">
                    {selectedSignal?.orderNumber || selectedPartner.currentOrderId || "No active order"}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/5 dark:bg-slate-950">
                  <span className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-500">
                    Lifetime deliveries
                  </span>
                  <span className="mt-1 block text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {selectedPartner.completedDeliveriesCount || 0} completed
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-900/10 bg-cyan-50/70 p-4 text-xs text-cyan-950 dark:border-white/5 dark:bg-slate-950/60 dark:text-slate-300">
                <p className="mb-1 flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  Signal freshness
                </p>
                <p className="text-[11px] leading-relaxed">
                  Green markers were updated within 30 seconds, amber markers within 2 minutes, and gray markers are older. Rider positions come from the active delivery order and update when the rider portal shares a new GPS reading.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-64 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              Select a delivery partner to inspect the fleet map.
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 font-mono text-[10px] text-slate-500 dark:border-white/5 dark:text-slate-500">
            <span className="flex items-center gap-1.5">
              <Radio size={12} aria-hidden="true" /> Firestore live order feed
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 size={12} aria-hidden="true" /> GPS writes about every 6 sec while sharing
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
