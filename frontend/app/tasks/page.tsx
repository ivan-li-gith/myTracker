"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2, Circle,
  Flame, Calendar, Trash2, ChevronLeft, ChevronRight, ChevronDown,
  MoreHorizontal, Pencil, Bell, AlertCircle, Plus, X,
} from "lucide-react";
import AddTaskModal from "@/components/AddTaskModal";
import AddHabitModal from "@/components/AddHabitModal";
import EditTaskModal from "@/components/EditTaskModal";
import EditHabitModal from "@/components/EditHabitModal";
import { apiFetch } from "@/lib/api";
import { Task, HabitWithStreak, CreditCardReminder } from "@/lib/types";

function dateToStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr() {
  return dateToStr(new Date());
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function getWeekDays(weekOffset: number) {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay() - weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return { dateStr: dateToStr(d), dayNum: d.getDate(), label: d.toLocaleDateString("en-US", { weekday: "short" }) };
  });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

// Positive = days past due, 0 = due today, negative = days until due
function calcDaysOverdue(dueDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + "T00:00:00");
  return Math.floor((today.getTime() - due.getTime()) / 86_400_000);
}

function weekRangeLabel(days: ReturnType<typeof getWeekDays>) {
  const first = new Date(days[0].dateStr + "T00:00:00");
  const last = new Date(days[6].dateStr + "T00:00:00");
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  if (first.getMonth() === last.getMonth()) {
    return `${fmt(first)} ${first.getDate()} – ${last.getDate()}`;
  }
  return `${fmt(first)} ${first.getDate()} – ${fmt(last)} ${last.getDate()}`;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const EMPTY_CC_REMINDER = { card_name: "", owner: "", due_day: "" };

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

// ---- Collapsible Section Shell ----

function CollapsibleSection({
  title,
  icon,
  badge,
  titleClass = "text-slate-900",
  action,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon?: string | null;
  badge?: React.ReactNode;
  titleClass?: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-5 bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 min-w-0 group"
        >
          <ChevronDown
            size={15}
            className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          />
          {icon && <span className="text-base leading-none shrink-0">{icon}</span>}
          <h2 className={`text-sm font-bold uppercase tracking-wider ${titleClass}`}>{title}</h2>
          {badge && <div className="shrink-0">{badge}</div>}
        </button>
        {action}
      </div>
      {open && <div>{children}</div>}
    </section>
  );
}

// ---- Habit Week Calendar ----

function HabitCalendar({
  habits,
  weekOffset,
  onPrevWeek,
  onNextWeek,
  selectedDate,
  onSelectDate,
}: {
  habits: HabitWithStreak[];
  weekOffset: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const today = todayStr();
  const maxPerDay = habits.length || 1;
  const weekDays = getWeekDays(weekOffset);

  const logCounts = new Map<string, number>();
  habits.forEach((h) => {
    (h.logged_dates || []).forEach((d) => {
      logCounts.set(d, (logCounts.get(d) || 0) + 1);
    });
  });

  function cellStyle(dateStr: string): { bg: string; text: string; sub: string } {
    const isFuture = dateStr > today;
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          {weekOffset === 0 ? "This Week" : weekRangeLabel(weekDays)}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevWeek}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Previous week"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={onNextWeek}
            disabled={weekOffset === 0}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next week"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(({ dateStr, dayNum, label }) => {
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const isFuture = dateStr > today;
          const count = logCounts.get(dateStr) || 0;
          const { bg, text, sub } = cellStyle(dateStr);
          return (
            <button
              key={dateStr}
              disabled={isFuture}
              onClick={() => onSelectDate(dateStr)}
              title={count > 0 ? `${count}/${habits.length} habits logged` : label}
              className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-colors w-full ${bg} ${
                isSelected ? "ring-2 ring-indigo-500 ring-offset-2" : ""
              } ${isFuture ? "cursor-not-allowed" : "cursor-pointer hover:opacity-80"}`}
            >
              <span className={`text-[11px] font-semibold uppercase tracking-wide leading-none ${isToday ? "text-indigo-400" : "text-slate-400"}`}>
                {label}
              </span>
              <span className={`text-2xl font-bold leading-none ${isToday ? "text-indigo-600" : text}`}>
                {dayNum}
              </span>
              {isToday && !isSelected
                ? <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-0.5" />
                : count > 0 && habits.length > 0
                  ? <span className={`text-[10px] font-semibold leading-none ${sub}`}>{count}/{habits.length}</span>
                  : null
              }
            </button>
          );
        })}
      </div>

      {weekOffset > 0 && (
        <p className="mt-3 text-xs text-slate-400 text-center">
          Viewing {weekOffset === 1 ? "last week" : `${weekOffset} weeks ago`} — click a day to edit
        </p>
      )}
    </div>
  );
}

// ---- Row Action Menu ----

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  }

  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded transition-all"
        aria-label="Row actions"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 60 }}
          className="bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-28 text-sm"
        >
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pencil size={13} /> Edit
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Habit Row ----

function HabitRow({
  habit,
  selectedDate,
  onToggle,
  onEdit,
  onDelete,
}: {
  habit: HabitWithStreak;
  selectedDate: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isLogged = habit.logged_dates?.includes(selectedDate);

  return (
    <li
      className={`flex items-center gap-3 px-4 py-2.5 group transition-colors ${
        isLogged ? "bg-emerald-50/50" : "hover:bg-slate-50"
      }`}
    >
      <button
        onClick={onToggle}
        className="shrink-0 transition-colors"
        aria-label={isLogged ? "Mark incomplete" : "Mark complete"}
      >
        {isLogged
          ? <CheckCircle2 size={20} className="text-emerald-500" />
          : <Circle size={20} className="text-slate-300 hover:text-emerald-400" />
        }
      </button>

      <div className="flex-1 min-w-0">
        <span
          className={`block truncate text-sm font-medium transition-colors ${
            isLogged ? "text-slate-400" : "text-slate-700"
          }`}
        >
          {habit.name}
        </span>
        {habit.target_freq != null && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            {habit.target_freq === 7 ? "Every day" : `${habit.target_freq}× a week`}
          </p>
        )}
      </div>

      {habit.streak > 0 && (
        <div className="flex items-center gap-0.5 shrink-0 text-orange-400">
          <Flame size={12} />
          <span className="text-xs font-semibold">{habit.streak}</span>
        </div>
      )}

      <RowMenu onEdit={onEdit} onDelete={onDelete} />
    </li>
  );
}

// ---- Task List Item ----

function TaskListItem({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
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
      {!task.completed && (
        <div className="absolute inset-0 bg-emerald-50 flex items-center pl-4 gap-2 pointer-events-none">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <span className="text-xs font-semibold text-emerald-600">Complete</span>
        </div>
      )}
      {/* Content div has a CSS transform for swipe — RowMenu must live outside it
          because transform creates a containing block that breaks position:fixed */}
      <div
        className={`relative flex items-start gap-3 pl-4 pr-10 py-2.5 bg-white transition-colors ${
          task.completed ? "" : "hover:bg-slate-50"
        }`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? "transform 0.2s ease" : "none",
        }}
      >
        <button
          onClick={onToggle}
          className={`shrink-0 mt-0.5 transition-colors ${
            task.completed ? "text-emerald-500" : "text-slate-300 hover:text-emerald-500"
          }`}
        >
          {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`truncate text-sm font-medium transition-colors ${
              task.completed ? "text-slate-400 line-through" : "text-slate-700"
            }`}>
              {task.name}
            </span>
            {!task.completed && task.due_date && (() => {
              const overdue = calcDaysOverdue(task.due_date!);
              if (overdue > 0) return (
                <span
                  title={`Due ${task.due_date}`}
                  className="shrink-0 inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded"
                >
                  {overdue} {overdue === 1 ? "day" : "days"} overdue
                </span>
              );
              if (overdue === 0) return (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                  <Calendar size={9} /> Due today
                </span>
              );
              return (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  <Calendar size={9} /> {task.due_date}
                </span>
              );
            })()}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Created {formatDate(task.created_at)}
          </p>
        </div>
      </div>

      {/* RowMenu is outside the transformed div so its fixed dropdown hits the viewport */}
      <div className="absolute right-4 inset-y-0 flex items-center z-10">
        <RowMenu onEdit={onEdit} onDelete={onDelete} />
      </div>
    </li>
  );
}

// ---- Page ----

export default function TasksAndHabitsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingHabit, setEditingHabit] = useState<HabitWithStreak | null>(null);
  const [completedFilter, setCompletedFilter] = useState<"today" | "all">("today");

  const [showConfetti, setShowConfetti] = useState(false);
  const prevHabitsNeededCount = useRef(-1);

  const [ccReminders, setCcReminders] = useState<CreditCardReminder[]>([]);
  const [showCcReminderModal, setShowCcReminderModal] = useState(false);
  const [editCcReminder, setEditCcReminder] = useState<CreditCardReminder | null>(null);
  const [ccReminderForm, setCcReminderForm] = useState(EMPTY_CC_REMINDER);
  const [ccReminderSaveError, setCcReminderSaveError] = useState<string | null>(null);
  const [ccReminderDeleteId, setCcReminderDeleteId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch("/tasks").then(setTasks).catch(console.error);
    apiFetch("/habits").then(setHabits).catch(console.error);
    apiFetch("/credit-card-reminders").then(setCcReminders).catch(console.error);
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
  const allCompletedTasks = tasks.filter((t) => t.completed);
  const completedTasks = completedFilter === "today"
    ? allCompletedTasks.filter((t) => !!t.completed_at && dateToStr(new Date(t.completed_at)) === selectedDate)
    : allCompletedTasks;

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

  async function toggleHabit(habit: HabitWithStreak) {
    const date = selectedDate;
    const isLogged = habit.logged_dates.includes(date);

    // Optimistic update
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id
          ? {
              ...h,
              logged_dates: isLogged
                ? h.logged_dates.filter((d) => d !== date)
                : [...h.logged_dates, date],
            }
          : h
      )
    );

    try {
      if (isLogged) {
        await apiFetch(`/habits/${habit.id}/log?log_date=${date}`, { method: "DELETE" });
      } else {
        await apiFetch(`/habits/${habit.id}/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logged_at: `${date}T12:00:00Z` }),
        });
      }
    } catch {
      // Rollback on error
      setHabits((prev) =>
        prev.map((h) =>
          h.id === habit.id
            ? {
                ...h,
                logged_dates: isLogged
                  ? [...h.logged_dates, date]
                  : h.logged_dates.filter((d) => d !== date),
              }
            : h
        )
      );
    }
  }

  async function deleteHabit(id: number) {
    await apiFetch(`/habits/${id}`, { method: "DELETE" });
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }

  async function saveCcReminder(e: React.FormEvent) {
    e.preventDefault();
    setCcReminderSaveError(null);
    const due_day = parseInt(ccReminderForm.due_day);
    if (isNaN(due_day) || due_day < 1 || due_day > 31) {
      setCcReminderSaveError("Due day must be between 1 and 31");
      return;
    }
    try {
      const body = { card_name: ccReminderForm.card_name.trim(), owner: ccReminderForm.owner.trim() || null, due_day };
      if (editCcReminder) {
        await apiFetch(`/credit-card-reminders/${editCcReminder.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await apiFetch("/credit-card-reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      const fresh: CreditCardReminder[] = await apiFetch("/credit-card-reminders");
      setCcReminders(fresh ?? []);
      setShowCcReminderModal(false);
      setEditCcReminder(null);
      setCcReminderForm(EMPTY_CC_REMINDER);
    } catch (err) {
      setCcReminderSaveError(err instanceof Error ? err.message : "Failed to save reminder");
    }
  }

  async function confirmDeleteReminder() {
    if (ccReminderDeleteId == null) return;
    await apiFetch(`/credit-card-reminders/${ccReminderDeleteId}`, { method: "DELETE" });
    setCcReminders((prev) => prev.filter((r) => r.id !== ccReminderDeleteId));
    setCcReminderDeleteId(null);
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-[calc(100vh-2rem)] relative pb-24">
      <Confetti active={showConfetti} />

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Reminders</h1>
      </div>

      {/* Habit History Calendar */}
      {habits.length > 0 && (
        <section className="mb-5 bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] p-5">
          <HabitCalendar
            habits={habits}
            weekOffset={weekOffset}
            onPrevWeek={() => setWeekOffset((o) => o + 1)}
            onNextWeek={() => setWeekOffset((o) => Math.max(0, o - 1))}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </section>
      )}

      {/* Habit Sections */}

      {(
        [
          { key: "morning", label: "Morning Routine", icon: "☀️", titleClass: "text-amber-600", badgeClass: "bg-amber-100 text-amber-700" },
          { key: "standard", label: "Daily Habits",   icon: "🎯", titleClass: "text-slate-900", badgeClass: "bg-orange-100 text-orange-700" },
          { key: "night",   label: "Night Routine",   icon: "🌙", titleClass: "text-indigo-700", badgeClass: "bg-indigo-100 text-indigo-700" },
        ] as const
      ).map(({ key, label, icon, titleClass, badgeClass }) => {
        const group = habits.filter((h) => (h.category ?? "standard") === key);
        return (
          <CollapsibleSection
            key={key}
            title={label}
            icon={icon}
            titleClass={titleClass}
            badge={
              <span className={`py-0.5 px-2 rounded-full text-xs font-bold ${badgeClass}`}>
                {group.length}
              </span>
            }
            action={
              <AddHabitModal
                defaultCategory={key}
                onCreated={(h) => setHabits((prev) => [h, ...prev])}
              />
            }
          >
            <div className="overflow-hidden">
              {group.length === 0 ? (
                <div className="px-4 py-5 text-center">
                  <p className="text-sm text-slate-400">No {label.toLowerCase()} habits yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {group.map((habit) => (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      selectedDate={selectedDate}
                      onToggle={() => toggleHabit(habit)}
                      onEdit={() => setEditingHabit(habit)}
                      onDelete={() => deleteHabit(habit.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </CollapsibleSection>
        );
      })}

      {/* Task Sections */}
      <CollapsibleSection
        title="Pending Tasks"
        icon="📋"
        badge={
          <span className="bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded-full text-xs font-bold">
            {pendingTasks.length}
          </span>
        }
        action={<AddTaskModal onCreated={(t) => setTasks((prev) => [t, ...prev])} />}
      >
        <div className="overflow-hidden">
          {pendingTasks.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-slate-400">All caught up!</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingTasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  onToggle={() => toggleTask(task)}
                  onEdit={() => setEditingTask(task)}
                  onDelete={() => deleteTask(task.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </CollapsibleSection>

      {allCompletedTasks.length > 0 && (
        <CollapsibleSection
          title="Completed"
          icon="✅"
          titleClass="text-slate-500"
          badge={
            <span className="bg-slate-100 text-slate-500 py-0.5 px-2 rounded-full text-xs font-bold">
              {completedTasks.length}
            </span>
          }
          action={
            <div className="flex gap-1">
              {(["today", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setCompletedFilter(f)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors capitalize ${
                    completedFilter === f
                      ? "bg-slate-200 text-slate-700"
                      : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {f === "today" ? "Today" : "All"}
                </button>
              ))}
            </div>
          }
          defaultOpen={false}
        >
          <div className="overflow-hidden opacity-75">
            {completedTasks.length === 0 ? (
              <div className="px-4 py-5 text-center">
                <p className="text-sm text-slate-400">No tasks completed today.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {completedTasks.map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    onToggle={() => toggleTask(task)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Credit Card Reminders */}
      <CollapsibleSection
        title="Credit Card Reminders"
        icon="💳"
        badge={
          ccReminders.length > 0 ? (
            <span className="bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded-full text-xs font-bold">
              {ccReminders.length}
            </span>
          ) : null
        }
        action={
          <button
            onClick={() => { setEditCcReminder(null); setCcReminderForm(EMPTY_CC_REMINDER); setCcReminderSaveError(null); setShowCcReminderModal(true); }}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
            aria-label="Add credit card reminder"
          >
            <Plus size={16} />
          </button>
        }
      >
        {ccReminders.length === 0 ? (
          <div className="px-4 py-5 text-center">
            <p className="text-sm text-slate-400">No credit card reminders yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Card</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Owner</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Day</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ccReminders.map((reminder) => {
                  const today = new Date();
                  const todayDay = today.getDate();
                  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                  const daysUntilDue = reminder.due_day >= todayDay
                    ? reminder.due_day - todayDay
                    : (daysInMonth - todayDay) + reminder.due_day;
                  const dueSoon = daysUntilDue <= 5;
                  return (
                    <tr key={reminder.id} className={`group transition-colors ${dueSoon ? "bg-amber-50 hover:bg-amber-100/70" : "hover:bg-slate-50"}`}>
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          {dueSoon && <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />}
                          {reminder.card_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{reminder.owner ?? <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`font-medium ${dueSoon ? "text-amber-700" : "text-slate-700"}`}>
                          {ordinal(reminder.due_day)} of month
                        </span>
                        {dueSoon && (
                          <span className="ml-2 text-xs text-amber-600 font-semibold">
                            {daysUntilDue === 0 ? "Due today!" : `Due in ${daysUntilDue}d`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <RowMenu
                          onEdit={() => {
                            setEditCcReminder(reminder);
                            setCcReminderForm({ card_name: reminder.card_name, owner: reminder.owner ?? "", due_day: String(reminder.due_day) });
                            setCcReminderSaveError(null);
                            setShowCcReminderModal(true);
                          }}
                          onDelete={() => setCcReminderDeleteId(reminder.id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onSaved={(updated) => {
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setEditingTask(null);
          }}
          onClose={() => setEditingTask(null)}
        />
      )}

      {editingHabit && (
        <EditHabitModal
          habit={editingHabit}
          onSaved={(updated) => {
            setHabits((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
            setEditingHabit(null);
          }}
          onClose={() => setEditingHabit(null)}
        />
      )}

      {/* Credit Card Reminder Modal */}
      {showCcReminderModal && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Bell size={16} className="text-indigo-500" />
                {editCcReminder ? "Edit Reminder" : "Add Credit Card Reminder"}
              </h2>
              <button onClick={() => { setShowCcReminderModal(false); setEditCcReminder(null); setCcReminderForm(EMPTY_CC_REMINDER); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveCcReminder} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Card Name <span className="text-red-500">*</span></label>
                <input
                  autoFocus
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="e.g. Chase Sapphire"
                  value={ccReminderForm.card_name}
                  onChange={(e) => setCcReminderForm((f) => ({ ...f, card_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Owner</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="e.g. Ivan"
                  value={ccReminderForm.owner}
                  onChange={(e) => setCcReminderForm((f) => ({ ...f, owner: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Due Day of Month <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="e.g. 15"
                  value={ccReminderForm.due_day}
                  onChange={(e) => setCcReminderForm((f) => ({ ...f, due_day: e.target.value }))}
                  required
                />
                <p className="text-xs text-slate-400 mt-1">Day of the month the payment is due (1–31).</p>
              </div>
              {ccReminderSaveError && <p className="text-sm text-red-500">{ccReminderSaveError}</p>}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => { setShowCcReminderModal(false); setEditCcReminder(null); setCcReminderForm(EMPTY_CC_REMINDER); }} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors">
                  {editCcReminder ? "Save Changes" : "Add Reminder"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirmation */}
      {ccReminderDeleteId !== null && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Remove reminder?</h2>
            <p className="text-sm text-slate-500 mb-5">This will permanently remove this credit card reminder.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCcReminderDeleteId(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
              <button onClick={confirmDeleteReminder} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Remove</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
