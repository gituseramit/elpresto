"use client";

import { useEffect, useState } from "react";
import { Clock3, MapPin, Loader2 } from "lucide-react";
import { getActiveBranches } from "@/lib/branchService";

export default function StaffAttendanceAction({ token, branchId, compact = false }: { token?: string; branchId?: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  useEffect(() => {
    if (branchId !== "ALL") return;
    getActiveBranches().then((items) => { setBranches(items.map(({ id, name }) => ({ id, name }))); if (items.length) setSelectedBranch(items[0].id); }).catch(() => setMessage("Could not load active branches."));
  }, [branchId]);
  if (!token) return null;

  const mark = (action: "CHECK_IN" | "CHECK_OUT") => {
    if (!navigator.geolocation) { setMessage("Location is not available in this browser."); return; }
    setBusy(true); setMessage("Waiting for a precise location…");
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const response = await fetch("/api/staff-attendance", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action, branchId: branchId === "ALL" ? selectedBranch : branchId, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Attendance could not be recorded.");
        setMessage(`${action === "CHECK_IN" ? "Checked in" : "Checked out"} at ${data.branchName}. ${data.lowConfidence ? "GPS accuracy is low; ask a manager to review." : ""}`);
      } catch (error) { setMessage(error instanceof Error ? error.message : "Attendance could not be recorded."); }
      finally { setBusy(false); }
    }, (error) => {
      setBusy(false);
      setMessage(error.code === error.PERMISSION_DENIED ? "Location permission was denied. Enable location access in your browser to mark attendance." : error.code === error.TIMEOUT ? "Could not get your location in time. Please try again outdoors." : "A valid location reading is required to mark attendance.");
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  };

  return <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900 ${compact ? "" : "fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))]"}`}>
    <div className="mb-3 flex items-center gap-2 text-sm font-black"><MapPin size={16} className="text-orange-500" /> Staff Attendance</div>
    {branchId === "ALL" && <label className="mb-2 block text-[11px] font-semibold text-slate-500">Marking attendance at<select value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-800 dark:border-white/10 dark:bg-slate-800 dark:text-white">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>}
    <div className="grid grid-cols-2 gap-2">
      <button disabled={busy || (branchId === "ALL" && !selectedBranch)} onClick={() => mark("CHECK_IN")} className="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-60">{busy ? <Loader2 size={14} className="mx-auto animate-spin" /> : "Check in"}</button>
      <button disabled={busy || (branchId === "ALL" && !selectedBranch)} onClick={() => mark("CHECK_OUT")} className="rounded-xl bg-slate-800 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-60"><span className="inline-flex items-center gap-1"><Clock3 size={13} /> Check out</span></button>
    </div>
    {message && <p role="status" className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>}
  </section>;
}
