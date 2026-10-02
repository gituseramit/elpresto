"use client";

import { useEffect, useState } from "react";
import { Clock3, LogOut, MapPin } from "lucide-react";
import StaffLoginForm from "@/components/Auth/StaffLoginForm";
import ThemeControl from "@/components/ThemeControl";
import StaffAttendanceAction from "@/components/StaffAttendanceAction";
import { clearStaffSession, getStaffSession, isSessionValid, type StaffSession } from "@/lib/staffAuth";

export default function StaffAttendancePage() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const savedSession = getStaffSession("attendance");
    if (savedSession && isSessionValid(savedSession)) setSession(savedSession);
    else if (savedSession) clearStaffSession("attendance");
    setCheckingSession(false);
  }, []);

  const logOut = () => {
    clearStaffSession("attendance");
    setSession(null);
  };

  if (checkingSession) return <main className="attendance-portal grid min-h-screen place-items-center bg-slate-950 text-sm font-bold text-slate-300">Loading staff attendance…</main>;

  if (!session) return <StaffLoginForm
    panel="attendance"
    panelDisplayName="Staff Attendance"
    panelIcon={<Clock3 size={28} />}
    onSuccess={setSession}
    isDark
  />;

  return <main className="attendance-portal min-h-screen bg-slate-950 px-4 py-10 text-white">
    <div className="mx-auto max-w-xl">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-orange-400"><Clock3 size={15} /> Staff Attendance</p>
          <h1 className="mt-2 text-3xl font-black">Hello, {session.name}</h1>
          <p className="mt-1 text-sm text-slate-400">{session.role.replaceAll("_", " ")}</p>
        </div>
        <div className="flex items-center gap-2"><ThemeControl /><button type="button" onClick={logOut} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/5"><LogOut size={14} /> Sign out</button></div>
      </header>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-black/20 sm:p-7">
        <div className="mb-5 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-orange-500/10 text-orange-400"><MapPin size={19} /></span>
          <div><h2 className="text-base font-black">Mark your shift</h2><p className="mt-1 text-xs leading-relaxed text-slate-400">Allow location access when prompted. Your branch distance is checked when you submit.</p></div>
        </div>
        <StaffAttendanceAction compact token={session.token} branchId={session.branchId} />
      </section>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-500">Attendance is available here as a separate staff portal. If your location is unavailable, enable location services and try again.</p>
    </div>
  </main>;
}
