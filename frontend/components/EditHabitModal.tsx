"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { HabitWithStreak } from "@/lib/types";

const INPUT_CLS = "w-full px-3 py-2 bg-[#14162e] border border-white/[0.1] rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors text-sm";

interface Props {
  habit: HabitWithStreak;
  onSaved: (updated: HabitWithStreak) => void;
  onClose: () => void;
}

export default function EditHabitModal({ habit, onSaved, onClose }: Props) {
  const [name, setName] = useState(habit.name);
  const [frequency, setFrequency] = useState(habit.target_freq != null ? String(habit.target_freq) : "none");
  const [category, setCategory] = useState(habit.category ?? "standard");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function categoryStyle(c: "morning" | "standard" | "night", active: boolean) {
    if (!active) return "bg-white/[0.05] text-slate-500 border-white/[0.08] hover:bg-white/[0.08] hover:text-slate-300";
    if (c === "morning") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    if (c === "night") return "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
    return "bg-orange-500/20 text-orange-300 border-orange-500/30";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const updated = await apiFetch(`/habits/${habit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          target_freq: frequency === "none" ? null : parseInt(frequency),
          category,
        }),
      });
      // PATCH returns HabitRead (no streak/logged_dates), merge to preserve them
      onSaved({ ...habit, ...updated });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1e2245] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-base font-bold text-white">Edit Habit</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 hover:bg-white/[0.07] p-1.5 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Habit Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
            <div className="flex gap-2">
              {(["morning", "standard", "night"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${categoryStyle(c, category === c)}`}
                >
                  {c === "morning" ? "☀ Morning" : c === "night" ? "⌾ Night" : "Daily"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Frequency (times per week)</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="none">No target (daily streak)</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n} time{n > 1 ? "s" : ""} a week</option>
              ))}
              <option value="7">Every day (7 times)</option>
            </select>
          </div>

          <div className="pt-1 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white/[0.06] border border-white/[0.08] text-slate-300 rounded-lg hover:bg-white/[0.09] transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-500 transition-colors font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
