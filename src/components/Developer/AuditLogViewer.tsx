"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Filter,
  ShieldAlert,
  Clock,
  User,
  Building,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AuditLog, Branch } from "@/lib/types";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

interface AuditLogViewerProps {
  branches: Branch[];
}

export default function AuditLogViewer({ branches }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "auditLogs"),
      orderBy("timestamp", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as AuditLog[];
        setLogs(list);
        setLoading(false);
      },
      (err) => {
        console.warn("Could not subscribe to audit logs:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.targetId?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || log.actorRole === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getBranchLabel = (bId?: string | null) => {
    if (!bId) return "System Global";
    const found = branches.find((b) => b.id === bId);
    return found ? `${found.name} (${found.code})` : bId;
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-white">System Security & Audit Trail</h3>
            <p className="text-xs text-slate-400">
              Live audit logging of all configuration, role delegation, and operational events
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-1.5 text-xs text-white"
          >
            <option value="ALL">All Roles</option>
            <option value="DEVELOPER">DEVELOPER</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="ADMIN">ADMIN</option>
            <option value="BRANCH_MANAGER">BRANCH_MANAGER</option>
            <option value="SYSTEM">SYSTEM</option>
          </select>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search action or actor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Log Feed */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 size={24} className="animate-spin text-blue-400" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-8 text-center text-xs text-slate-500">
          No audit logs recorded matching this filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/5 bg-slate-900/60 backdrop-blur-xl">
          <div className="divide-y divide-white/5 text-xs">
            {filteredLogs.map((log) => {
              const dateObj = log.timestamp?.toDate
                ? log.timestamp.toDate()
                : new Date();
              const dateStr = dateObj.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              });
              const timeStr = dateObj.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              });

              const isExpanded = expandedLogId === log.id;

              return (
                <div key={log.id} className="p-4 hover:bg-slate-800/30 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {log.action}
                      </span>
                      <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[9px] text-slate-300">
                        Target: {log.targetType} {log.targetId ? `(${log.targetId})` : ""}
                      </span>
                      <span className="text-slate-400 text-[11px] font-semibold">
                        by <span className="text-white font-bold">{log.actorName}</span> ({log.actorRole})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
                      <span className="text-slate-500 flex items-center gap-1 font-mono text-[10px]">
                        <Building size={11} /> {getBranchLabel(log.branchId)}
                      </span>
                      <span className="font-mono text-[10px]">
                        {dateStr} {timeStr}
                      </span>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="text-slate-500 hover:text-white"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Metadata */}
                  {isExpanded && log.metadata && (
                    <div className="mt-3 rounded-xl bg-slate-950/80 p-3 font-mono text-[10px] text-slate-300 border border-white/5 overflow-x-auto">
                      <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
