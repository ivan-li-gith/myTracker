"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Flame } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { HabitWithStreak } from "@/lib/types";

export default function HabitsPage() {
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [targetFreq, setTargetFreq] = useState("1");

  useEffect(() => {
    fetchHabits();
  }, []);

  async function fetchHabits() {
    const data = await apiFetch("/habits");
    setHabits(data);
  }

  async function logHabit(id: number) {
    await apiFetch(`/habits/${id}/log`, { method: "POST" });
    fetchHabits();
  }

  async function deleteHabit(id: number) {
    await apiFetch(`/habits/${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }

  async function createHabit(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        target_freq: parseInt(targetFreq) || 1,
      }),
    });
    setShowModal(false);
    setName("");
    setTargetFreq("1");
    fetchHabits();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Habits</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Add Habit
        </button>
      </div>

      {/* Habit grid */}
      {habits.length === 0 ? (
        <p className="text-center text-slate-400 py-16 text-sm">
          No habits yet. Start building one.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {habits.map((habit) => (
            <div
              key={habit.id}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col"
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-slate-900">{habit.name}</h3>
                {confirmDeleteId === habit.id ? (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => deleteHabit(habit.id)}
                      className="text-red-500 hover:text-red-700 font-medium"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(habit.id)}
                    className="text-slate-300 hover:text-red-400 transition-colors"
                    aria-label="Delete habit"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              {/* Frequency badge */}
              <span className="self-start text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full mb-4">
                {habit.target_freq ?? 1}× / week
              </span>

              {/* Streak */}
              <div className="mb-4">
                {habit.streak > 0 ? (
                  <div className="flex items-center gap-1.5 text-indigo-600 font-semibold text-sm">
                    <Flame size={16} />
                    <span>
                      {habit.streak} week{habit.streak !== 1 ? "s" : ""} streak
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-400 text-sm">No streak yet</span>
                )}
              </div>

              {/* Log button */}
              <button
                onClick={() => logHabit(habit.id)}
                className="mt-auto w-full border border-indigo-600 text-indigo-600 hover:bg-indigo-50 rounded-lg py-2 text-sm font-medium transition-colors"
              >
                Log Today
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Habit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">New Habit</h2>
            <form onSubmit={createHabit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Habit name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Times per week
                </label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={targetFreq}
                  onChange={(e) => setTargetFreq(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
