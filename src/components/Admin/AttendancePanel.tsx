"use client";

import { useEffect, useState } from "react";
import { CalendarDays, MapPin, RefreshCw } from "lucide-react";
import { getISTDateString } from "@/lib/orderQueries";

type AttendanceRecord = { id: string; staffName: string; staffId: string; role: string; branchName: string; branchId: string; action: string; createdAtISO: string; distanceMeters: number; radiusMeters: number; status: string; accuracy?: number | null };

export default function AttendancePanel({ token, role }: { token?: string; role?: string }) {
  const [date, setDate] = useState(getISTDateString(0));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const global = role === "DEVELOPER" || role === "SUPER_ADMIN";
  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true); setError("");
    fetch(`/api/staff-attendance?date=${encodeURIComponent(date)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error || "Could not load attendance."); return data.records as AttendanceRecord[]; })
      .then((data) => { if (active) setRecords(data); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Could not load attendance."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, date]);
  const branches = [...new Map(records.map((record) => [record.branchId, record.branchName])).entries()];
  const filteredRecords = records.filter((record) => (!filterBranch || record.branchId === filterBranch) && (!filterStaff || record.staffId === filterStaff));
  const staff = [...new Map(records.map((record) => [record.staffId, record.staffName])).entries()];
  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-xl font-black text-white">Staff Attendance</h2><p className="mt-1 text-sm text-slate-400">Geofence attempts, check-ins, and check-outs.</p></div>
      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-300"><CalendarDays size={15} /><input type="date" value={date} max={getISTDateString(0)} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-white outline-none" /></label>
        {global && <select aria-label="Filter by branch" value={filterBranch} onChange={(e) => { setFilterBranch(e.target.value); setFilterStaff(""); }} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white"><option value="">All branches</option>{branches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>}
        <select aria-label="Filter by staff member" value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white"><option value="">All staff</option>{staff.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      </div>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
      {loading ? <div className="flex items-center gap-2 p-6 text-sm text-slate-400"><RefreshCw size={15} className="animate-spin" /> Loading attendance…</div> : filteredRecords.length === 0 ? <p className="p-6 text-sm text-slate-400">No attendance attempts recorded for this date.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Action / Time</th><th className="px-4 py-3">Distance</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-white/5">{filteredRecords.map((record) => <tr key={record.id}><td className="px-4 py-3 font-semibold text-white">{record.staffName}<span className="block text-[10px] text-slate-500">{record.staffId}</span></td><td className="px-4 py-3 text-slate-300">{record.role.replaceAll("_", " ")}</td><td className="px-4 py-3 text-slate-300"><span className="inline-flex items-center gap-1"><MapPin size={12} />{record.branchName}</span></td><td className="px-4 py-3 text-slate-300">{record.action.replace("CHECK_", "")}<span className="block text-[10px] text-slate-500">{new Date(record.createdAtISO).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}</span></td><td className="px-4 py-3 text-slate-300">{(record.distanceMeters / 1000).toFixed(2)} km <span className="text-slate-500">/ {(record.radiusMeters / 1000).toFixed(2)} km</span></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${record.status === "SUCCESS" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>{record.status === "SUCCESS" ? "SUCCESS" : "OUT OF RANGE"}</span>{record.accuracy && record.accuracy > 100 && <span className="ml-1 text-[10px] text-amber-300">Low GPS precision</span>}</td></tr>)}</tbody></table></div>}
    </div>
    {global && branches.length > 0 && <p className="text-xs text-slate-500">Records from {branches.length} branches are available in the branch filter.</p>}
  </section>;
}
