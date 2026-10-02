"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LoyaltyReward } from "@/lib/types";
import { Gift, Plus, Trash2 } from "lucide-react";

const emptyForm = { name: "", type: "discount" as "discount" | "item", pointsCost: 100, discountAmount: 50, discountType: "flat" as "flat" | "percentage", itemName: "" };

export default function LoyaltyRewardsManager() {
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => onSnapshot(query(collection(db, "loyaltyRewards"), orderBy("name")), (snapshot) => setRewards(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as LoyaltyReward))), () => setMessage("Could not load loyalty rewards.")), []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setMessage("");
    try {
      const id = `reward-${Date.now()}`;
      await setDoc(doc(db, "loyaltyRewards", id), { ...form, pointsCost: Math.max(1, Math.floor(form.pointsCost)), active: true, createdAt: serverTimestamp() });
      setForm(emptyForm); setMessage("Reward added.");
    } catch { setMessage("Could not save this reward."); }
    finally { setSaving(false); }
  };

  return <div className="mt-5 border-t border-white/10 pt-5">
    <h3 className="mb-3 flex items-center gap-2 text-xs font-black text-white"><Gift size={15} className="text-amber-400" /> Manage redeemable rewards</h3>
    <form onSubmit={save} className="grid gap-2 rounded-xl bg-slate-950/60 p-3 sm:grid-cols-2">
      <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Reward title" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white" />
      <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "discount" | "item" })} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white"><option value="discount">Discount reward</option><option value="item">Free item reward</option></select>
      <input required type="number" min="1" value={form.pointsCost} onChange={(e) => setForm({ ...form, pointsCost: Number(e.target.value) })} placeholder="Points cost" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white" />
      {form.type === "discount" ? <div className="flex gap-2"><select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as "flat" | "percentage" })} className="rounded-lg border border-white/10 bg-slate-900 px-2 text-xs text-white"><option value="flat">₹ off</option><option value="percentage">% off</option></select><input required type="number" min="1" max={form.discountType === "percentage" ? 100 : undefined} value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: Number(e.target.value) })} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white" /></div> : <input required value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} placeholder="Free item name" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white" />}
      <button disabled={saving} className="inline-flex items-center justify-center gap-1 rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-white disabled:opacity-60"><Plus size={14} /> Add reward</button>
    </form>
    {message && <p role="status" className="mt-2 text-xs text-slate-400">{message}</p>}
    <div className="mt-3 divide-y divide-white/5 rounded-xl border border-white/5">
      {rewards.length === 0 ? <p className="p-3 text-xs text-slate-500">No rewards yet.</p> : rewards.map((reward) => <div key={reward.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div><p className="text-xs font-bold text-white">{reward.name} <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-[9px] uppercase text-slate-400">{reward.type}</span></p><p className="mt-1 text-[10px] text-slate-400">{reward.pointsCost} points · {reward.type === "item" ? reward.itemName : reward.discountType === "percentage" ? `${reward.discountAmount}% off` : `₹${reward.discountAmount} off`}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => updateDoc(doc(db, "loyaltyRewards", reward.id), { active: !reward.active })} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${reward.active ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-700 text-slate-400"}`}>{reward.active ? "Active" : "Paused"}</button><button type="button" aria-label={`Delete ${reward.name}`} onClick={() => deleteDoc(doc(db, "loyaltyRewards", reward.id))} className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-300"><Trash2 size={14} /></button></div></div>)}
    </div>
  </div>;
}
