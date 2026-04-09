"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Check, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { HabitWithStreak } from "@/lib/types";

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getWeekDays(): Date[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const weekDays = getWeekDays();
const todayStr = toLocalDateStr(new Date());

const INDIGO_SHADES = [
  "bg-indigo-500",
  "bg-violet-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-sky-500",
  "bg-indigo-400",
  "bg-violet-400",
];

function HabitMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label="Options"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-36 bg-white border border-slate-100 rounded-xl shadow-lg py-1 text-sm">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pencil size={13} />
            Edit habit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function WeekCalendarCard({
  habits,
  onToggle,
  onEdit,
  onDelete,
}: {
  habits: HabitWithStreak[];
  onToggle: (habitId: number, dateStr: string, isLogged: boolean) => void;
  onEdit: (habit: HabitWithStreak) => void;
  onDelete: (id: number) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const isFuture = selectedDate > todayStr;
  const selectedDay = weekDays.find((d) => toLocalDateStr(d) === selectedDate);
  const selectedLabel = selectedDay
    ? selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    : "";

  const completedOnSelected = habits.filter((h) =>
    h.logged_dates.includes(selectedDate)
  ).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
      {/* Week strip */}
      <div className="flex gap-1 mb-5">
        {weekDays.map((day) => {
          const dateStr = toLocalDateStr(day);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const dayFuture = dateStr > todayStr;
          const dayLabel = day.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
          const completedCount = habits.filter((h) => h.logged_dates.includes(dateStr)).length;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={`flex flex-col items-center flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-sm"
                  : isToday
                  ? "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200"
                  : dayFuture
                  ? "text-slate-300"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="text-[10px] uppercase tracking-wide mb-0.5">{dayLabel}</span>
              <span className="text-sm font-semibold">{day.getDate()}</span>
              {!dayFuture && habits.length > 0 && (
                <div
                  className={`w-1 h-1 rounded-full mt-1 ${
                    completedCount === habits.length
                      ? isSelected ? "bg-white" : "bg-indigo-500"
                      : completedCount > 0
                      ? "bg-indigo-200"
                      : "bg-transparent"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day label + count */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {selectedLabel}
        </span>
        {!isFuture && (
          <span className="text-xs text-slate-400">
            {completedOnSelected} / {habits.length} done
          </span>
        )}
      </div>

      {/* Habit rows */}
      {isFuture ? (
        <p className="text-xs text-slate-400 text-center py-4">
          Can&apos;t log future dates.
        </p>
      ) : habits.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">No habits yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {habits.map((habit, idx) => {
            const isLogged = habit.logged_dates.includes(selectedDate);
            const colorClass = INDIGO_SHADES[idx % INDIGO_SHADES.length];

            return (
              <div
                key={habit.id}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all ${
                  isLogged
                    ? "bg-indigo-50 border border-indigo-100"
                    : "border border-transparent hover:bg-slate-50"
                }`}
              >
                {/* Toggle button */}
                <button
                  onClick={() => onToggle(habit.id, selectedDate, isLogged)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    isLogged ? colorClass : "bg-slate-100 hover:bg-slate-200"
                  }`}
                >
                  {isLogged ? (
                    <Check size={13} className="text-white" strokeWidth={2.5} />
                  ) : (
                    <span className="text-slate-400 text-xs font-bold">
                      {habit.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm font-medium ${
                      isLogged ? "text-indigo-700" : "text-slate-600"
                    }`}
                  >
                    {habit.name}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {habit.target_freq ?? 1}× / week
                  </p>
                </div>

                {isLogged && (
                  <span className="text-[10px] text-indigo-400 font-medium">done</span>
                )}

                {/* 3-dot menu */}
                <HabitMenu
                  onEdit={() => onEdit(habit)}
                  onDelete={() => onDelete(habit.id)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editHabit, setEditHabit] = useState<HabitWithStreak | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [targetFreq, setTargetFreq] = useState("1");

  useEffect(() => {
    fetchHabits();
  }, []);

  async function fetchHabits() {
    const data = await apiFetch("/habits");
    setHabits(data);
  }

  async function toggleLog(habitId: number, dateStr: string, isLogged: boolean) {
    if (isLogged) {
      await apiFetch(`/habits/${habitId}/log?log_date=${dateStr}`, { method: "DELETE" });
    } else {
      await apiFetch(`/habits/${habitId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logged_at: `${dateStr}T12:00:00Z` }),
      });
    }
    fetchHabits();
  }

  async function createHabit(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, target_freq: parseInt(targetFreq) || 1 }),
    });
    setShowAddModal(false);
    setName("");
    setTargetFreq("1");
    fetchHabits();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editHabit) return;
    await apiFetch(`/habits/${editHabit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, target_freq: parseInt(targetFreq) || 1 }),
    });
    setEditHabit(null);
    setName("");
    setTargetFreq("1");
    fetchHabits();
  }

  async function confirmDelete() {
    if (deleteId === null) return;
    await apiFetch(`/habits/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    setHabits((prev) => prev.filter((h) => h.id !== deleteId));
  }

  function openEdit(habit: HabitWithStreak) {
    setEditHabit(habit);
    setName(habit.name);
    setTargetFreq(String(habit.target_freq ?? 1));
  }

  function closeModal() {
    setShowAddModal(false);
    setEditHabit(null);
    setName("");
    setTargetFreq("1");
  }

  const today = new Date();
  const todayLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Habits</h1>
          <p className="text-sm text-slate-400 mt-0.5">{todayLabel}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Add Habit
        </button>
      </div>

      {habits.length === 0 ? (
        <p className="text-center text-slate-400 py-16 text-sm">
          No habits yet. Start building one.
        </p>
      ) : (
        <WeekCalendarCard
          habits={habits}
          onToggle={toggleLog}
          onEdit={openEdit}
          onDelete={(id) => setDeleteId(id)}
        />
      )}

      {/* Add / Edit modal */}
      {(showAddModal || editHabit) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {editHabit ? "Edit Habit" : "New Habit"}
            </h2>
            <form onSubmit={editHabit ? saveEdit : createHabit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
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
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {editHabit ? "Save changes" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Delete habit?</h2>
            <p className="text-sm text-slate-500 mb-5">
              This will permanently remove the habit and all its logs.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
