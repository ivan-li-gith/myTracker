"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2, Circle, MoreHorizontal,
  Flame, Calendar, Trash2,
} from "lucide-react";
import AddTaskModal from "@/components/AddTaskModal";
import AddHabitModal from "@/components/AddHabitModal";
import { apiFetch } from "@/lib/api";
import { Task, HabitWithStreak } from "@/lib/types";

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

// ---- Confetti ----

const CONFETTI_COLORS = ["#f97316", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: 5 + (i / 36) * 90 + (Math.sin(i * 2.4) * 5),
    bottom: 20 + Math.abs(Math.sin(i * 1.3)) * 30,
    size: 7 + (i % 5),
    delay: (i % 8) * 0.12,
    duration: 1.2 + (i % 4) * 0.2,
    round: i % 3 !== 0,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className={`absolute confetti-piece ${p.round ? "rounded-full" : "rounded-sm"}`}
          style={{
            backgroundColor: p.color,
            left: `${p.left}%`,
            bottom: `${p.bottom}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            "--conf-delay": `${p.delay}s`,
            "--conf-dur": `${p.duration}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ---- Habit Week Calendar ----

function HabitCalendar({ habits }: { habits: HabitWithStreak[] }) {
  const now = new Date();
  const maxPerDay = habits.length || 1;

  const logCounts = new Map<string, number>();
  habits.forEach((h) => {
    (h.logged_dates || []).forEach((d) => {
      logCounts.set(d, (logCounts.get(d) || 0) + 1);
    });
  });

  function toStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const todayStr = toStr(now);
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay()); // getDay() returns 0 for Sunday

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return { dateStr: toStr(d), dayNum: d.getDate(), label: d.toLocaleDateString("en-US", { weekday: "short" }) };
  });

  function cellStyle(dateStr: string): { bg: string; text: string; sub: string } {
    const isFuture = dateStr > todayStr;
    const count = logCounts.get(dateStr) || 0;
    if (isFuture) return { bg: "bg-slate-50 border border-slate-100", text: "text-slate-300", sub: "" };
    if (count === 0) return { bg: "bg-white border border-slate-200", text: "text-slate-400", sub: "" };
    const ratio = count / maxPerDay;
    if (ratio < 0.34) return { bg: "bg-orange-50 border border-orange-100", text: "text-orange-500", sub: "text-orange-300" };
    if (ratio < 0.67) return { bg: "bg-orange-200 border border-transparent", text: "text-orange-700", sub: "text-orange-500" };
    return { bg: "bg-orange-500 border border-transparent", text: "text-white", sub: "text-orange-100" };
  }

  return (
    <div>
      <div className="flex items-center mb-4 border-b border-slate-200 pb-2">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">This Week</h2>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(({ dateStr, dayNum, label }) => {
          const isToday = dateStr === todayStr;
          const count = logCounts.get(dateStr) || 0;
          const { bg, text, sub } = cellStyle(dateStr);
          return (
            <div
              key={dateStr}
              title={count > 0 ? `${count}/${habits.length} habits logged` : label}
              className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors ${bg} ${
                isToday ? "ring-2 ring-indigo-400 ring-offset-2" : ""
              }`}
            >
              <span className={`text-[11px] font-semibold uppercase tracking-wide leading-none ${isToday ? "text-indigo-400" : "text-slate-400"}`}>
                {label}
              </span>
              <span className={`text-2xl font-bold leading-none ${isToday ? "text-indigo-600" : text}`}>
                {dayNum}
              </span>
              {count > 0 && habits.length > 0 && (
                <span className={`text-[10px] font-semibold leading-none ${sub}`}>
                  {count}/{habits.length}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Habit Card ----

function HabitCard({
  habit,
  onLog,
  onDelete,
}: {
  habit: HabitWithStreak;
  onLog: () => void;
  onDelete: () => void;
}) {
  const today = todayStr();
  const loggedToday = habit.logged_dates?.includes(today);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Swipe-to-log for mobile
  const touchStartX = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const SWIPE_THRESHOLD = 80;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    setSwipeOffset(0);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (loggedToday) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    if (dx > 0) setSwipeOffset(Math.min(dx, 120));
  }

  function handleTouchEnd() {
    if (!loggedToday && swipeOffset >= SWIPE_THRESHOLD) onLog();
    setSwipeOffset(0);
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ touchAction: "pan-y" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe reveal */}
      {!loggedToday && (
        <div className="absolute inset-0 bg-emerald-50 flex items-center pl-4 gap-2">
          <CheckCircle2 size={18} className="text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-600">Log habit</span>
        </div>
      )}
      {/* Card content */}
      <div
        className={`bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between group transition-colors ${
          loggedToday ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 hover:border-indigo-300"
        }`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? "transform 0.2s ease" : "none",
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <span className={`font-medium line-clamp-2 transition-colors ${
            loggedToday ? "text-emerald-700" : "text-slate-800 group-hover:text-indigo-700"
          }`}>
            {habit.name}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
              habit.streak > 0 ? "bg-orange-50 text-orange-600" : "bg-slate-50 text-slate-400"
            }`}>
              <Flame size={14} className={habit.streak > 0 ? "text-orange-500" : "text-slate-300"} />
              <span className="text-xs font-bold">{habit.streak ?? 0}</span>
            </div>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-slate-600 rounded-md transition-all"
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-7 z-10 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-32 text-sm">
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onLog}
          disabled={loggedToday}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-2 ${
            loggedToday
              ? "bg-emerald-50 text-emerald-600 border-emerald-100 cursor-default"
              : "bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 border-slate-100 hover:border-emerald-100"
          }`}
        >
          <CheckCircle2 size={16} />
          {loggedToday ? "Done today!" : "Complete"}
        </button>
      </div>
    </div>
  );
}

// ---- Task List Item (with swipe-to-complete) ----

function TaskListItem({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const touchStartX = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const SWIPE_THRESHOLD = 80;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    setSwipeOffset(0);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (task.completed) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    if (dx > 0) setSwipeOffset(Math.min(dx, 130));
  }

  function handleTouchEnd() {
    if (!task.completed && swipeOffset >= SWIPE_THRESHOLD) onToggle();
    setSwipeOffset(0);
  }

  return (
    <li
      className="group relative overflow-hidden"
      style={{ touchAction: "pan-y" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe reveal background */}
      {!task.completed && (
        <div className="absolute inset-0 bg-emerald-50 flex items-center pl-5 gap-2 pointer-events-none">
          <CheckCircle2 size={18} className="text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-600">Complete</span>
        </div>
      )}
      {/* Row content */}
      <div
        className="relative flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? "transform 0.2s ease" : "none",
        }}
      >
        <div className="flex items-start gap-4 flex-1">
          <button
            onClick={onToggle}
            className={`flex-shrink-0 mt-0.5 transition-colors ${
              task.completed ? "text-emerald-500" : "text-slate-300 hover:text-emerald-500"
            }`}
          >
            {task.completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
          </button>
          <div className="flex-1">
            <p className={`text-[15px] font-medium transition-colors ${
              task.completed ? "text-slate-400 line-through" : "text-slate-800 group-hover:text-slate-900"
            }`}>
              {task.name}
            </p>
            {!task.completed && task.due_date && (
              <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm">
                <Calendar size={10} />
                {task.due_date}
              </span>
            )}
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pl-4">
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            aria-label="Delete task"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </li>
  );
}

// ---- Page ----

export default function TasksAndHabitsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);

  const [showConfetti, setShowConfetti] = useState(false);
  const prevHabitsNeededCount = useRef(-1);

  useEffect(() => {
    apiFetch("/tasks").then(setTasks).catch(console.error);
    apiFetch("/habits").then(setHabits).catch(console.error);
  }, []);

  const today = todayStr();
  const weekStart = getWeekStart();

  function isNeededToday(h: HabitWithStreak) {
    if (h.logged_dates?.includes(today)) return false;
    const logsThisWeek = (h.logged_dates || []).filter((d) => d >= weekStart).length;
    return logsThisWeek < (h.target_freq ?? 7);
  }

  const habitsNeededCount = habits.filter(isNeededToday).length;

  // Confetti when all habits are done for today
  useEffect(() => {
    if (prevHabitsNeededCount.current === -1) {
      prevHabitsNeededCount.current = habitsNeededCount;
      return;
    }
    if (prevHabitsNeededCount.current > 0 && habitsNeededCount === 0 && habits.length > 0) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3500);
    }
    prevHabitsNeededCount.current = habitsNeededCount;
  }, [habitsNeededCount, habits.length]);

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  async function toggleTask(task: Task) {
    const updated = await apiFetch(`/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  }

  async function deleteTask(id: number) {
    await apiFetch(`/tasks/${id}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function logHabit(habit: HabitWithStreak) {
    const updated = await apiFetch(`/habits/${habit.id}/log`, { method: "POST" });
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? updated : h)));
  }

  async function deleteHabit(id: number) {
    await apiFetch(`/habits/${id}`, { method: "DELETE" });
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-[calc(100vh-2rem)] relative pb-24">
      <Confetti active={showConfetti} />

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Habits & Tasks</h1>
      </div>

      {/* Habit History Calendar */}
      {habits.length > 0 && (
        <section className="mb-12">
          <HabitCalendar habits={habits} />
        </section>
      )}

      {/* Habits Section */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Daily Habits</h2>
            <span className="bg-orange-100 text-orange-700 py-0.5 px-2 rounded-full text-xs font-bold">
              {habits.length} Active
            </span>
          </div>
          <AddHabitModal onCreated={(h) => setHabits((prev) => [h, ...prev])} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {habits.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl border border-slate-200 border-dashed p-6 text-center">
              <p className="text-sm text-slate-500 font-medium">No active habits tracked.</p>
            </div>
          ) : (
            habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onLog={() => logHabit(habit)}
                onDelete={() => deleteHabit(habit.id)}
              />
            ))
          )}
        </div>
      </section>

      {/* Tasks */}
      <div className="space-y-10">
        {/* Pending */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Pending Tasks</h2>
              <span className="bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded-full text-xs font-bold">
                {pendingTasks.length}
              </span>
            </div>
            <AddTaskModal onCreated={(t) => setTasks((prev) => [t, ...prev])} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {pendingTasks.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                  <CheckCircle2 size={24} className="text-slate-300" />
                </div>
                <p className="text-[15px] text-slate-500 font-medium">You are all caught up!</p>
                <p className="text-sm text-slate-400 mt-1">Enjoy your free time.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingTasks.map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    onToggle={() => toggleTask(task)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Completed */}
        {completedTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Completed</h2>
              <span className="bg-slate-100 text-slate-500 py-0.5 px-2 rounded-full text-xs font-bold">
                {completedTasks.length}
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden opacity-80">
              <ul className="divide-y divide-slate-200/60">
                {completedTasks.map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    onToggle={() => toggleTask(task)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
