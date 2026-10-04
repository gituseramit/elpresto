"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Download, MapPin, RefreshCw } from "lucide-react";
import { getISTDateString } from "@/lib/orderQueries";

type AttendanceRecord = { id: string; staffName: string; staffId: string; role: string; branchName: string; branchId: string; action: string; createdAtISO: string; attendanceDate?: string; distanceMeters: number; radiusMeters: number; status: string; accuracy?: number | null };

function csvCell(value: unknown, protectFormula = false): string {
  let text = value == null ? "" : String(value);
  if (protectFormula && /^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export default function AttendancePanel({ token, role }: { token?: string; role?: string }) {
  const [startDate, setStartDate] = useState(getISTDateString(0));
  const [endDate, setEndDate] = useState(getISTDateString(0));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const global = role === "DEVELOPER" || role === "SUPER_ADMIN";
  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadRecords = async (showLoading: boolean) => {
      if (showLoading && active) setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ startDate, endDate });
        const response = await fetch(`/api/staff-attendance?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load attendance.");
        if (active) {
          setRecords(data.records as AttendanceRecord[]);
          setUpdatedAt(new Date());
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load attendance.");
      } finally {
        if (active && showLoading) setLoading(false);
      }
    };

    if (!startDate || !endDate || startDate > endDate) {
      setRecords([]);
      setError("Choose both dates, with the start date on or before the end date.");
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadRecords(true);
    const interval = startDate === endDate
      ? window.setInterval(() => void loadRecords(false), 10000)
      : undefined;
    const refreshOnFocus = () => void loadRecords(false);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      active = false;
      if (interval !== undefined) window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [token, startDate, endDate, refreshVersion]);
  const branches = [...new Map(records.map((record) => [record.branchId, record.branchName])).entries()];
  const filteredRecords = records.filter((record) => (!filterBranch || record.branchId === filterBranch) && (!filterStaff || record.staffId === filterStaff));
  const staff = [...new Map(records.map((record) => [record.staffId, record.staffName])).entries()];
  const successfulRecords = filteredRecords.filter((record) => record.status === "SUCCESS");
  const latestActionByStaff = new Map<string, string>();
  for (const record of successfulRecords) {
    if (!latestActionByStaff.has(record.staffId)) latestActionByStaff.set(record.staffId, record.action);
  }
  const checkedInStaffCount = [...latestActionByStaff.values()].filter((action) => action === "CHECK_IN").length;
  const exportRecords = () => {
    const headers = ["Date", "Time (IST)", "Staff name", "Staff ID", "Role", "Branch", "Action", "Status", "Distance (m)", "Allowed radius (m)", "GPS accuracy (m)"];
    const rows = filteredRecords.map((record) => [
      record.attendanceDate || record.createdAtISO.slice(0, 10),
      new Date(record.createdAtISO).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
      record.staffName,
      record.staffId,
      record.role.replaceAll("_", " "),
      record.branchName,
      record.action.replace("CHECK_", ""),
      record.status === "SUCCESS" ? "SUCCESS" : "OUT OF RANGE",
      record.distanceMeters,
      record.radiusMeters,
      record.accuracy,
    ]);
    const csv = [headers, ...rows]
      .map((row, rowIndex) => row.map((value, columnIndex) => csvCell(value, rowIndex > 0 && [2, 3, 4, 5, 6, 7].includes(columnIndex))).join(","))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `staff-attendance-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-xl font-black text-white">Staff Attendance</h2><p className="mt-1 text-sm text-slate-400">Geofence attempts, check-ins, and check-outs.</p></div>
      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-300"><CalendarDays size={15} /><span>From</span><input aria-label="Attendance start date" type="date" value={startDate} max={getISTDateString(0)} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-white outline-none" /></label>
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-300"><CalendarDays size={15} /><span>To</span><input aria-label="Attendance end date" type="date" value={endDate} max={getISTDateString(0)} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-white outline-none" /></label>
        {global && <select aria-label="Filter by branch" value={filterBranch} onChange={(e) => { setFilterBranch(e.target.value); setFilterStaff(""); }} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white"><option value="">All branches</option>{branches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>}
        <select aria-label="Filter by staff member" value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white"><option value="">All staff</option>{staff.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        <button type="button" onClick={() => { setLoading(true); setRefreshVersion((version) => version + 1); }} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800" aria-label="Refresh attendance"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button>
        <button type="button" onClick={exportRecords} disabled={loading || filteredRecords.length === 0 || !startDate || !endDate || startDate > endDate} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"><Download size={14} /> Export CSV</button>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.07] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">{startDate === endDate ? "Staff checked in" : "Staff last marked check-in"}</p><p className="mt-1 text-2xl font-black text-white">{checkedInStaffCount}</p></div>
      <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Successful attendance marks</p><p className="mt-1 text-2xl font-black text-white">{successfulRecords.length}</p></div>
      <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last synced</p><p className="mt-2 text-sm font-semibold text-slate-200">{updatedAt ? updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Waiting for data"}</p></div>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
      {loading ? <div className="flex items-center gap-2 p-6 text-sm text-slate-400"><RefreshCw size={15} className="animate-spin" /> Loading attendance…</div> : filteredRecords.length === 0 ? <p className="p-6 text-sm text-slate-400">No attendance attempts recorded for this date range.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Action / Time</th><th className="px-4 py-3">Distance</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-white/5">{filteredRecords.map((record) => <tr key={record.id}><td className="px-4 py-3 font-semibold text-white">{record.staffName}<span className="block text-[10px] text-slate-500">{record.staffId}</span></td><td className="px-4 py-3 text-slate-300">{record.role.replaceAll("_", " ")}</td><td className="px-4 py-3 text-slate-300"><span className="inline-flex items-center gap-1"><MapPin size={12} />{record.branchName}</span></td><td className="px-4 py-3 text-slate-300">{record.action.replace("CHECK_", "")}<span className="block text-[10px] text-slate-500">{record.attendanceDate || new Date(record.createdAtISO).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })} · {new Date(record.createdAtISO).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}</span></td><td className="px-4 py-3 text-slate-300">{(record.distanceMeters / 1000).toFixed(2)} km <span className="text-slate-500">/ {(record.radiusMeters / 1000).toFixed(2)} km</span></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${record.status === "SUCCESS" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>{record.status === "SUCCESS" ? "SUCCESS" : "OUT OF RANGE"}</span>{record.accuracy && record.accuracy > 100 && <span className="ml-1 text-[10px] text-amber-300">Low GPS precision</span>}</td></tr>)}</tbody></table></div>}
    </div>
    {global && branches.length > 0 && <p className="text-xs text-slate-500">Records from {branches.length} branches are available in the branch filter.</p>}
  </section>;
}
