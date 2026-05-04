"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { HabitWithStreak } from "@/lib/types";

type ActiveModal = null | "task" | "habit" | "expense";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function isHabitNeededToday(h: HabitWithStreak) {
  const today = todayStr();
  if (h.logged_dates?.includes(today)) return false;
  const weekStart = getWeekStart();
  const logsThisWeek = (h.logged_dates || []).filter((d) => d >= weekStart).length;
  return logsThisWeek < (h.target_freq ?? 7);
}

// ---- Modal shell ----

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function SaveBar({ onClose, label, saving, accent }: { onClose: () => void; label: string; saving: boolean; accent: string }) {
  return (
    <div className="flex gap-2 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 py-2.5 border border-slate-200 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className={`flex-1 py-2.5 text-sm font-medium text-white rounded-xl disabled:opacity-50 transition-colors ${accent}`}
      >
        {saving ? "Saving…" : label}
      </button>
    </div>
  );
}

// ---- Quick modals ----

function QuickTaskModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await apiFetch("/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), due_date: dueDate || null, completed: false }),
    });
    setSaving(false);
    router.refresh();
    onClose();
  }

  return (
    <ModalShell title="Add Task" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What needs to be done?"
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[15px] bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <SaveBar onClose={onClose} label="Add Task" saving={saving} accent="bg-indigo-600 hover:bg-indigo-700" />
      </form>
    </ModalShell>
  );
}

function QuickHabitModal({ onClose }: { onClose: () => void }) {
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);
  const [logging, setLogging] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/habits").then((h) => {
      setHabits((h || []).filter(isHabitNeededToday));
      setLoading(false);
    });
  }, []);

  async function log(id: number) {
    setLogging((prev) => new Set(prev).add(id));
    await apiFetch(`/habits/${id}/log`, { method: "POST" });
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setLogging((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
  }

  return (
    <ModalShell title="Log Habit" onClose={onClose}>
      {loading ? (
        <p className="text-sm text-slate-400 text-center py-4">Loading…</p>
      ) : habits.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm font-semibold text-emerald-600">All habits done for today! 🎉</p>
          <p className="text-xs text-slate-400 mt-1">Great work keeping up your streaks.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 -mx-5">
          {habits.map((h) => (
            <li key={h.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-[15px] font-medium text-slate-800">{h.name}</p>
                <p className="text-xs text-orange-500 font-medium mt-0.5">🔥 {h.streak ?? 0} day streak</p>
              </div>
              <button
                onClick={() => log(h.id)}
                disabled={logging.has(h.id)}
                className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
              >
                {logging.has(h.id) ? "…" : "Done"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
}

function QuickExpenseModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !amount) return;
    setSaving(true);
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    await apiFetch("/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), amount: parseFloat(amount), date, category_id: null }),
    });
    setSaving(false);
    router.refresh();
    onClose();
  }

  return (
    <ModalShell title="Add Expense" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What did you spend on?"
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[15px] font-medium select-none">$</span>
          <input
            type="number"
            required
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <SaveBar onClose={onClose} label="Add Expense" saving={saving} accent="bg-emerald-600 hover:bg-emerald-700" />
      </form>
    </ModalShell>
  );
}

// ---- FAB ----

export default function QuickAddFAB() {
  const [fabOpen, setFabOpen] = useState(false);
  const [modal, setModal] = useState<ActiveModal>(null);

  function openModal(m: ActiveModal) {
    setFabOpen(false);
    setModal(m);
  }

  return (
    <>
      {fabOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setFabOpen(false)} />
      )}

      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
        {fabOpen && (
          <div className="flex flex-col items-end gap-2 mb-1 animate-in slide-in-from-bottom-2 fade-in duration-150">
            <FabAction label="Add Task" bg="bg-indigo-600 hover:bg-indigo-700" onClick={() => openModal("task")} />
            <FabAction label="Log Habit" bg="bg-orange-500 hover:bg-orange-600" onClick={() => openModal("habit")} />
            <FabAction label="Add Expense" bg="bg-emerald-600 hover:bg-emerald-700" onClick={() => openModal("expense")} />
          </div>
        )}
        <button
          onClick={() => setFabOpen((v) => !v)}
          aria-label="Quick add"
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 text-white ${
            fabOpen ? "bg-slate-700 hover:bg-slate-800" : "bg-indigo-600 hover:bg-indigo-700"
          }`}
          style={{ transform: fabOpen ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          <Plus size={26} />
        </button>
      </div>

      {modal === "task" && <QuickTaskModal onClose={() => setModal(null)} />}
      {modal === "habit" && <QuickHabitModal onClose={() => setModal(null)} />}
      {modal === "expense" && <QuickExpenseModal onClose={() => setModal(null)} />}
    </>
  );
}

function FabAction({ label, bg, onClick }: { label: string; bg: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`${bg} text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg transition-colors whitespace-nowrap`}
    >
      {label}
    </button>
  );
}
