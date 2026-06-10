"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2, Circle,
  Flame, Calendar, Trash2, ChevronLeft, ChevronRight, ChevronDown,
  MoreHorizontal, Pencil, Bell, AlertCircle, Plus, X, GripVertical,
} from "lucide-react";
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AddTaskModal from "@/components/AddTaskModal";
import AddHabitModal from "@/components/AddHabitModal";
import EditTaskModal from "@/components/EditTaskModal";
import EditHabitModal from "@/components/EditHabitModal";
import { apiFetch } from "@/lib/api";
import { Task, HabitWithStreak, CreditCardReminder, ReminderOwner } from "@/lib/types";

// ---- Shared input style ----
const INPUT_CLS = "w-full px-3 py-2 bg-[#14162e] border border-white/[0.1] rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors text-sm";

// ---- Utilities ----

function dateToStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr() {
  return dateToStr(new Date());
}

// Convert a UTC ISO timestamp to a local YYYY-MM-DD string so comparisons
// against selectedDate (which is always local) are correct across timezones.
function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

// A habit "exists" on a date if it was created on or before that date
// and was not yet deleted on that date.
function habitExistsOnDate(h: HabitWithStreak, dateStr: string): boolean {
  if (isoToLocalDate(h.created_at) > dateStr) return false;
  if (h.deleted_at && isoToLocalDate(h.deleted_at) <= dateStr) return false;
  return true;
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function calcDaysSince(isoStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(isoStr);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86_400_000);
}

function calcDaysOverdue(dueDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + "T00:00:00");
  return Math.floor((today.getTime() - due.getTime()) / 86_400_000);
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const EMPTY_CC_REMINDER = { card_name: "", owner: "", due_day: "", days_before: "" };

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

// ---- Calendar Widget (week strip + expandable month grid) ----

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function CalendarWidget({
  habits,
  selectedDate,
  onSelectDate,
}: {
  habits: HabitWithStreak[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const today = todayStr();
  const now = new Date();

  function getSunday(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() - d.getDay());
    return dateToStr(d);
  }

  const [weekSunday, setWeekSunday] = useState(() => getSunday(today));
  const [expanded, setExpanded] = useState(false);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const logCounts = new Map<string, number>();
  habits.forEach((h) => {
    (h.logged_dates || []).forEach((d) => {
      logCounts.set(d, (logCounts.get(d) || 0) + 1);
    });
  });
  function habitsOnDate(dateStr: string) {
    return habits.filter(h => habitExistsOnDate(h, dateStr)).length;
  }

  function cellBg(dateStr: string) {
    const isFuture = dateStr > today;
    const count = logCounts.get(dateStr) || 0;
    if (isFuture) return { bg: "bg-white/[0.03] border-transparent", text: "text-slate-700" };
    if (count === 0) return { bg: "bg-white/[0.05] border-white/[0.05]", text: "text-slate-400" };
    const ratio = count / (habitsOnDate(dateStr) || 1);
    if (ratio < 0.34) return { bg: "bg-orange-500/20 border-orange-500/20", text: "text-orange-400" };
    if (ratio < 0.67) return { bg: "bg-orange-500/40 border-transparent", text: "text-orange-300" };
    return { bg: "bg-orange-500 border-transparent", text: "text-white" };
  }

  // ---- Week strip ----

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekSunday + "T00:00:00");
    d.setDate(d.getDate() + i);
    return dateToStr(d);
  });

  const wFirst = new Date(weekDays[0] + "T00:00:00");
  const wLast  = new Date(weekDays[6] + "T00:00:00");
  const weekLabel = wFirst.getMonth() === wLast.getMonth()
    ? `${wFirst.toLocaleDateString("en-US", { month: "short" })} ${wFirst.getDate()} – ${wLast.getDate()}`
    : `${wFirst.toLocaleDateString("en-US", { month: "short" })} ${wFirst.getDate()} – ${wLast.toLocaleDateString("en-US", { month: "short" })} ${wLast.getDate()}`;

  function prevWeek() {
    const d = new Date(weekSunday + "T00:00:00");
    d.setDate(d.getDate() - 7);
    setWeekSunday(dateToStr(d));
  }
  function nextWeek() {
    const d = new Date(weekSunday + "T00:00:00");
    d.setDate(d.getDate() + 7);
    setWeekSunday(dateToStr(d));
  }
  function handleWeekDayClick(dateStr: string) {
    if (dateStr > today) return;
    onSelectDate(dateStr);
  }
  function handleExpand() {
    const ref = new Date(weekSunday + "T00:00:00");
    setViewYear(ref.getFullYear());
    setViewMonth(ref.getMonth());
    setExpanded(true);
  }

  // ---- Month grid ----

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }
  function handleMonthDayClick(dateStr: string) {
    if (dateStr > today) return;
    onSelectDate(dateStr);
    setWeekSunday(getSunday(dateStr));
    setExpanded(false);
  }

  // ---- Render ----

  if (!expanded) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-0.5">
            <button onClick={prevWeek} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.07] transition-colors" aria-label="Previous week">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-semibold text-slate-300 px-2 tabular-nums">{weekLabel}</span>
            <button onClick={nextWeek} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.07] transition-colors" aria-label="Next week">
              <ChevronRight size={14} />
            </button>
          </div>
          <button
            onClick={handleExpand}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
          >
            <Calendar size={11} />
            Month
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((dateStr) => {
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const isFuture = dateStr > today;
            const { bg, text } = cellBg(dateStr);
            const d = new Date(dateStr + "T00:00:00");
            const count = logCounts.get(dateStr) || 0;
            return (
              <button
                key={dateStr}
                disabled={isFuture}
                onClick={() => handleWeekDayClick(dateStr)}
                className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl border transition-all
                  ${bg} ${text}
                  ${isSelected ? "ring-2 ring-indigo-400 ring-offset-1 ring-offset-[#1e2245]" : ""}
                  ${isFuture ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:brightness-125 active:scale-95"}
                `}
              >
                <span className={`text-[10px] font-semibold uppercase leading-none tracking-wide ${isToday ? "text-indigo-400" : "text-slate-500"}`}>
                  {DAY_LABELS[d.getDay()]}
                </span>
                <span className={`text-sm font-bold leading-none ${isToday ? "text-indigo-300" : ""}`}>
                  {d.getDate()}
                </span>
                <span className="text-[9px] leading-none" style={{ opacity: count > 0 && !isFuture ? 0.75 : 0 }}>
                  {count}/{habitsOnDate(dateStr)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-200">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
          {!isCurrentMonth && (
            <button onClick={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); }} className="px-2 py-0.5 text-[10px] font-semibold text-indigo-400 bg-indigo-500/15 border border-indigo-500/25 rounded-full hover:bg-indigo-500/25 transition-colors">
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={prevMonth} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.07] transition-colors" aria-label="Previous month">
            <ChevronLeft size={14} />
          </button>
          <button onClick={nextMonth} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.07] transition-colors" aria-label="Next month">
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-200 hover:bg-white/[0.07] rounded-lg transition-colors ml-1"
          >
            <ChevronDown size={11} className="rotate-180" />
            Week
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((l) => (
          <div key={l} className="text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wide py-0.5">{l}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={i} className="h-7" />;
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const isFuture = dateStr > today;
          const { bg, text } = cellBg(dateStr);
          const day = parseInt(dateStr.split("-")[2]);
          return (
            <button
              key={dateStr}
              disabled={isFuture}
              onClick={() => handleMonthDayClick(dateStr)}
              className={`h-7 w-full rounded-md flex items-center justify-center text-[11px] border transition-all
                ${bg} ${text}
                ${isSelected ? "ring-2 ring-indigo-400 ring-offset-1 ring-offset-[#1e2245]" : ""}
                ${isToday && !isSelected ? "ring-1 ring-indigo-500/50" : ""}
                ${isFuture ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:brightness-125 active:scale-95"}
                ${isToday ? "font-bold" : "font-medium"}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="text-[10px] text-slate-600">Less</span>
        {["bg-white/[0.05]", "bg-orange-500/20", "bg-orange-500/40", "bg-orange-500"].map((c, idx) => (
          <span key={idx} className={`w-2.5 h-2.5 rounded-sm ${c}`} />
        ))}
        <span className="text-[10px] text-slate-600">More</span>
      </div>
    </div>
  );
}

// ---- Collapsible Section ----

function CollapsibleSection({
  title,
  icon,
  badge,
  titleClass = "text-slate-200",
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
    <section className="bg-[#1e2245] border border-white/[0.07] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06]">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 min-w-0 group">
          <ChevronDown
            size={14}
            className={`shrink-0 text-slate-500 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          />
          {icon && <span className="text-base leading-none shrink-0">{icon}</span>}
          <h2 className={`text-sm font-semibold ${titleClass}`}>{title}</h2>
          {badge && <div className="shrink-0">{badge}</div>}
        </button>
        {action}
      </div>
      {open && <div>{children}</div>}
    </section>
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
        className="p-1.5 text-slate-600 hover:text-slate-300 hover:bg-white/[0.08] rounded-lg transition-all"
        aria-label="Row actions"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 60 }}
          className="bg-[#242750] border border-white/[0.1] rounded-xl shadow-2xl py-1.5 w-32"
        >
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-white/[0.07] transition-colors text-sm"
          >
            <Pencil size={13} className="text-slate-500" /> Edit
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/[0.1] transition-colors text-sm"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Sortable Task Item (pending tasks drag-and-drop) ----

function SortableTaskItem({
  task, onToggle, onEdit, onDelete,
}: { task: Task; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="relative border-b border-white/[0.05] last:border-b-0"
    >
      <div className={`relative flex items-center gap-3 pl-4 pr-10 py-3 bg-[#1e2245] hover:bg-[#232650] transition-colors`}>
        <div
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none text-slate-700 hover:text-slate-500 transition-colors"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </div>
        <button
          onClick={onToggle}
          className="shrink-0 text-slate-600 hover:text-emerald-400 transition-colors"
        >
          <Circle size={19} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-200">{task.name}</span>
            {task.due_date && (() => {
              const overdue = calcDaysOverdue(task.due_date!);
              if (overdue > 0) return (
                <span className="shrink-0 inline-flex items-center text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/20 px-1.5 py-0.5 rounded">
                  {overdue}d overdue
                </span>
              );
              if (overdue === 0) return (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/20 px-1.5 py-0.5 rounded">
                  <Calendar size={9} /> Due today
                </span>
              );
              return (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-slate-500 bg-white/[0.06] px-1.5 py-0.5 rounded">
                  <Calendar size={9} /> {task.due_date}
                </span>
              );
            })()}
          </div>
          {task.description && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{task.description}</p>
          )}
          <p className="text-[10px] text-slate-600 mt-0.5">
            Created {formatDate(task.created_at)}
            {(() => {
              const d = calcDaysSince(task.created_at);
              if (d === 0) return null;
              return <span className="text-red-400 ml-1">{d === 1 ? "1 day" : `${d} days`}</span>;
            })()}
          </p>
        </div>
      </div>
      <div className="absolute right-3 inset-y-0 flex items-center z-10">
        <RowMenu onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}

// ---- Sortable CC Row (credit card drag-and-drop within a group) ----

function SortableCcRow({
  reminder, paidCards, todayDay, daysInCurrentMonth, onTogglePaid, onEdit, onDelete,
}: {
  reminder: CreditCardReminder;
  paidCards: Set<number>;
  todayDay: number;
  daysInCurrentMonth: number;
  onTogglePaid: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: reminder.id });
  const daysUntilDue = reminder.due_day >= todayDay
    ? reminder.due_day - todayDay
    : (daysInCurrentMonth - todayDay) + reminder.due_day;
  const dueSoon = daysUntilDue <= (reminder.days_before ?? 5);
  const paid = paidCards.has(reminder.id);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`group flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.04] last:border-b-0 transition-colors ${
        paid ? "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.09]" : "hover:bg-white/[0.04]"
      }`}
    >
      <div className="cursor-grab active:cursor-grabbing touch-none shrink-0 text-slate-700 hover:text-slate-500 transition-colors" {...attributes} {...listeners}>
        <GripVertical size={12} />
      </div>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        paid ? "bg-emerald-500/20" : dueSoon ? "bg-amber-500/20" : "bg-white/[0.07]"
      }`}>
        {paid
          ? <CheckCircle2 size={14} className="text-emerald-400" />
          : dueSoon
            ? <AlertCircle size={14} className="text-amber-400" />
            : <Bell size={14} className="text-slate-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${paid ? "text-slate-500" : "text-slate-200"}`}>{reminder.card_name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {paid ? (
            <span className="text-xs text-emerald-500 font-medium">Paid this month</span>
          ) : (
            <>
              <span className={`text-xs font-medium ${dueSoon ? "text-amber-400" : "text-slate-500"}`}>
                Due {ordinal(reminder.due_day)}
              </span>
              {dueSoon && (
                <span className="text-xs font-semibold text-amber-400">
                  · {daysUntilDue === 0 ? "today" : `in ${daysUntilDue}d`}
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <button
        onClick={onTogglePaid}
        className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors ${
          paid
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25"
            : "bg-white/[0.05] text-slate-500 border-white/[0.07] hover:bg-white/[0.09] hover:text-slate-300"
        }`}
      >
        <CheckCircle2 size={10} />
        {paid ? "Paid" : "Mark paid"}
      </button>
      <RowMenu onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

// ---- Sortable Completed Task Item ----

function SortableCompletedTaskItem({
  task, onToggle, onEdit, onDelete,
}: { task: Task; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="relative border-b border-white/[0.05] last:border-b-0"
    >
      <div className="relative flex items-center gap-3 pl-4 pr-10 py-3 bg-[#1e2245] transition-colors">
        <div
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none text-slate-700 hover:text-slate-500 transition-colors"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </div>
        <button onClick={onToggle} className="shrink-0 text-emerald-400 transition-colors">
          <CheckCircle2 size={19} />
        </button>
        <div className="flex-1 min-w-0">
          <span className="block truncate text-sm font-medium text-slate-600 line-through decoration-slate-700">
            {task.name}
          </span>
          {task.description && (
            <p className="text-xs text-slate-600 mt-0.5 truncate">{task.description}</p>
          )}
          <p className="text-[10px] text-slate-600 mt-0.5">
            Created {formatDate(task.created_at)}
            {task.completed_at && (() => {
              const start = new Date(task.created_at); start.setHours(0,0,0,0);
              const end = new Date(task.completed_at!); end.setHours(0,0,0,0);
              const d = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
              return <span className="text-slate-500 ml-1">{d === 0 ? "completed same day" : `${d === 1 ? "1 day" : `${d} days`} to complete`}</span>;
            })()}
          </p>
        </div>
      </div>
      <div className="absolute right-3 inset-y-0 flex items-center z-10">
        <RowMenu onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}

// ---- Sortable Habit Row ----

function SortableHabitRow({
  habit, selectedDate, onToggle, onEdit, onDelete,
}: {
  habit: HabitWithStreak; selectedDate: string;
  onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id });
  const isLogged = habit.logged_dates?.includes(selectedDate);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`flex items-center gap-3 px-4 py-3 group cursor-pointer transition-colors ${
        isLogged ? "bg-emerald-500/[0.08]" : "hover:bg-white/[0.04]"
      }`}
      onClick={onToggle}
    >
      <div
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none text-slate-700 hover:text-slate-500 transition-colors"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={12} />
      </div>
      <div className="shrink-0">
        {isLogged
          ? <CheckCircle2 size={19} className="text-emerald-400" />
          : <Circle size={19} className="text-slate-600 group-hover:text-slate-400 transition-colors" />}
      </div>
      <div className="flex-1 min-w-0">
        <span className={`block truncate text-sm font-medium transition-colors ${
          isLogged ? "text-slate-500 line-through decoration-slate-600" : "text-slate-200"
        }`}>
          {habit.name}
        </span>
        {habit.target_freq != null && (
          <p className="text-[10px] text-slate-600 mt-0.5">
            {habit.target_freq === 7 ? "Every day" : `${habit.target_freq}x a week`}
          </p>
        )}
      </div>
      {habit.streak > 0 && (
        <div className="flex items-center gap-0.5 shrink-0 text-orange-400">
          <Flame size={12} />
          <span className="text-xs font-bold">{habit.streak}</span>
        </div>
      )}
      <div onClick={(e) => e.stopPropagation()}>
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
  const [reminderOwners, setReminderOwners] = useState<ReminderOwner[]>([]);
  const [newOwnerInput, setNewOwnerInput] = useState("");
  const [addingOwner, setAddingOwner] = useState(false);
  const [ownerSaveError, setOwnerSaveError] = useState<string | null>(null);

  const paidMonthKey = `cc_paid_${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [paidCards, setPaidCards] = useState<Set<number>>(new Set());
  useEffect(() => {
    const stored = localStorage.getItem(paidMonthKey);
    if (stored) { try { setPaidCards(new Set(JSON.parse(stored) as number[])); } catch {} }
  }, [paidMonthKey]);

  useEffect(() => {
    apiFetch("/tasks").then(setTasks).catch(console.error);
    apiFetch("/habits").then(setHabits).catch(console.error);
    apiFetch("/credit-card-reminders").then(setCcReminders).catch(console.error);
    apiFetch("/reminder-owners").then(setReminderOwners).catch(console.error);
  }, []);

  const today = todayStr();
  const weekStart = getWeekStart();

  function isNeededToday(h: HabitWithStreak) {
    if (h.deleted_at) return false;
    if (!habitExistsOnDate(h, today)) return false;
    if (h.logged_dates?.includes(today)) return false;
    const logsThisWeek = (h.logged_dates || []).filter((d) => d >= weekStart).length;
    return logsThisWeek < (h.target_freq ?? 7);
  }

  const habitsNeededCount = habits.filter(isNeededToday).length;

  useEffect(() => {
    if (prevHabitsNeededCount.current === -1) {
      prevHabitsNeededCount.current = habitsNeededCount;
      return;
    }
    const activeHabits = habits.filter(h => !h.deleted_at);
    if (prevHabitsNeededCount.current > 0 && habitsNeededCount === 0 && activeHabits.length > 0) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3500);
    }
    prevHabitsNeededCount.current = habitsNeededCount;
  }, [habitsNeededCount, habits.length]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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

  function handleTaskDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = pendingTasks.findIndex((t) => t.id === active.id);
    const newIdx = pendingTasks.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(pendingTasks, oldIdx, newIdx);
    setTasks((prev) => [...prev.filter((t) => t.completed), ...reordered]);
    apiFetch("/tasks/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reordered.map((t) => t.id)),
    }).catch(console.error);
  }

  function handleCcDragEnd(event: DragEndEvent, ownerKey: string, groupReminders: CreditCardReminder[]) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = groupReminders.findIndex((r) => r.id === active.id);
    const newIdx = groupReminders.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(groupReminders, oldIdx, newIdx);
    setCcReminders((prev) => [
      ...prev.filter((r) => (r.owner ?? "__none__") !== ownerKey),
      ...reordered,
    ]);
    apiFetch("/credit-card-reminders/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reordered.map((r) => r.id)),
    }).catch(console.error);
  }

  function handleCompletedTaskDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = completedTasks.findIndex((t) => t.id === active.id);
    const newIdx = completedTasks.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(completedTasks, oldIdx, newIdx);
    setTasks((prev) => [...prev.filter((t) => !t.completed), ...reordered]);
    apiFetch("/tasks/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reordered.map((t) => t.id)),
    }).catch(console.error);
  }

  function handleHabitDragEnd(event: DragEndEvent, category: string, categoryHabits: HabitWithStreak[]) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = categoryHabits.findIndex((h) => h.id === active.id);
    const newIdx = categoryHabits.findIndex((h) => h.id === over.id);
    const reordered = arrayMove(categoryHabits, oldIdx, newIdx);
    const reorderedIds = new Set(reordered.map((h) => h.id));
    setHabits((prev) => [...prev.filter((h) => !reorderedIds.has(h.id)), ...reordered]);
    apiFetch("/habits/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reordered.map((h) => h.id)),
    }).catch(console.error);
  }

  async function toggleHabit(habit: HabitWithStreak) {
    const date = selectedDate;
    const isLogged = habit.logged_dates.includes(date);

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
    // Use midnight of selectedDate in local time so the habit disappears from
    // that date onward, not just from today (which would leave past dates stale).
    const deletedAt = new Date(selectedDate + "T00:00:00").toISOString();
    await apiFetch(`/habits/${id}?deleted_at=${encodeURIComponent(deletedAt)}`, { method: "DELETE" });
    setHabits((prev) => prev.map((h) => h.id === id ? { ...h, deleted_at: deletedAt } : h));
  }

  async function saveCcReminder(e: React.FormEvent) {
    e.preventDefault();
    setCcReminderSaveError(null);
    const due_day = parseInt(ccReminderForm.due_day);
    if (isNaN(due_day) || due_day < 1 || due_day > 31) {
      setCcReminderSaveError("Due day must be between 1 and 31");
      return;
    }
    const days_before = ccReminderForm.days_before ? parseInt(ccReminderForm.days_before) : null;
    try {
      const body = {
        card_name: ccReminderForm.card_name.trim(),
        owner: ccReminderForm.owner || null,
        due_day,
        days_before,
      };
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

  async function addReminderOwner() {
    const name = newOwnerInput.trim();
    if (!name) return;
    setOwnerSaveError(null);
    try {
      const created: ReminderOwner = await apiFetch("/reminder-owners", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
      });
      setReminderOwners((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setCcReminderForm((f) => ({ ...f, owner: created.name }));
      setNewOwnerInput("");
      setAddingOwner(false);
    } catch {
      setOwnerSaveError("Owner already exists or could not be saved.");
    }
  }

  async function deleteReminderOwner(id: number) {
    await apiFetch(`/reminder-owners/${id}`, { method: "DELETE" });
    setReminderOwners((prev) => prev.filter((o) => o.id !== id));
    if (ccReminderForm.owner === reminderOwners.find((o) => o.id === id)?.name) {
      setCcReminderForm((f) => ({ ...f, owner: "" }));
    }
  }

  function togglePaid(id: number) {
    setPaidCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(paidMonthKey, JSON.stringify([...next]));
      return next;
    });
  }

  async function confirmDeleteReminder() {
    if (ccReminderDeleteId == null) return;
    await apiFetch(`/credit-card-reminders/${ccReminderDeleteId}`, { method: "DELETE" });
    setCcReminders((prev) => prev.filter((r) => r.id !== ccReminderDeleteId));
    setCcReminderDeleteId(null);
  }

  // ---- CC reminder list rendering ----

  const todayDate = new Date();
  const todayDay = todayDate.getDate();
  const daysInCurrentMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();

  function renderCcContent() {
    if (ccReminders.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-500">No reminders yet.</p>
        </div>
      );
    }
    const ownerGroups = new Map<string, CreditCardReminder[]>();
    for (const r of ccReminders) {
      const key = r.owner ?? "__none__";
      if (!ownerGroups.has(key)) ownerGroups.set(key, []);
      ownerGroups.get(key)!.push(r);
    }
    const sortedOwners = [...ownerGroups.keys()].sort((a, b) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return a.localeCompare(b);
    });

    return (
      <div className="flex-1 overflow-y-auto grid" style={{ gridTemplateRows: "auto 1fr" }}>
        <div>
        {sortedOwners.map((ownerKey) => {
          const groupReminders = ownerGroups.get(ownerKey)!;
          const ownerLabel = ownerKey === "__none__" ? "No Owner" : ownerKey;
          return (
            <div key={ownerKey}>
              <div className="flex items-center justify-between px-4 py-5 bg-white/[0.04] border-b border-white/[0.05]">
                <span className="text-sm font-semibold text-slate-300">{ownerLabel}</span>
                <span className="text-xs font-medium text-slate-500">{groupReminders.length} card{groupReminders.length !== 1 ? "s" : ""}</span>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleCcDragEnd(e, ownerKey, groupReminders)}
              >
                <SortableContext items={groupReminders.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  {groupReminders.map((reminder) => (
                    <SortableCcRow
                      key={reminder.id}
                      reminder={reminder}
                      paidCards={paidCards}
                      todayDay={todayDay}
                      daysInCurrentMonth={daysInCurrentMonth}
                      onTogglePaid={() => togglePaid(reminder.id)}
                      onEdit={() => {
                        setEditCcReminder(reminder);
                        setCcReminderForm({
                          card_name: reminder.card_name,
                          owner: reminder.owner ?? "",
                          due_day: String(reminder.due_day),
                          days_before: reminder.days_before != null ? String(reminder.days_before) : "",
                        });
                        setCcReminderSaveError(null);
                        setShowCcReminderModal(true);
                      }}
                      onDelete={() => setCcReminderDeleteId(reminder.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          );
        })}
        </div>
        <div className="bg-white/[0.04]" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto min-h-screen pb-24">
      <Confetti active={showConfetti} />

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Reminders</h1>
      </div>

      {/* Month calendar */}
      {habits.some(h => !h.deleted_at) && (
        <section className="mb-4 bg-[#1e2245] border border-white/[0.07] rounded-2xl p-5">
          <CalendarWidget
            habits={habits}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </section>
      )}

      {/* Two-column: habits (left 3/5) + CC reminders (right 2/5) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">

        {/* Left — all habit sections */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {(
            [
              { key: "morning", label: "Morning Routine", icon: "☀️", titleClass: "text-amber-300", badgeClass: "bg-amber-500/20 text-amber-300", maxHeight: 185 },
              { key: "standard", label: "Daily Habits",   icon: "🎯", titleClass: "text-slate-200",  badgeClass: "bg-orange-500/20 text-orange-300", maxHeight: 125 },
              { key: "night",   label: "Night Routine",   icon: "🌙", titleClass: "text-indigo-300", badgeClass: "bg-indigo-500/20 text-indigo-300", maxHeight: 185 },
            ] as const
          ).map(({ key, label, icon, titleClass, badgeClass, maxHeight }) => {
            const group = habits.filter((h) =>
              (h.category ?? "standard") === key && habitExistsOnDate(h, selectedDate)
            );
            const doneToday = group.filter((h) => h.logged_dates?.includes(selectedDate)).length;
            return (
              <CollapsibleSection
                key={key}
                title={label}
                icon={icon}
                titleClass={titleClass}
                badge={
                  group.length > 0 ? (
                    <span className={`py-0.5 px-2 rounded-full text-[10px] font-bold ${
                      doneToday === group.length && group.length > 0
                        ? "bg-emerald-500/20 text-emerald-400"
                        : badgeClass
                    }`}>
                      {doneToday}/{group.length}
                    </span>
                  ) : null
                }
                action={
                  <AddHabitModal
                    defaultCategory={key}
                    selectedDate={selectedDate}
                    onCreated={(h) => setHabits((prev) => [h, ...prev])}
                  />
                }
              >
                {group.length === 0 ? (
                  <div className="flex items-center justify-center" style={{ height: maxHeight }}>
                    <p className="text-sm text-slate-500">No {label.toLowerCase()} habits yet.</p>
                  </div>
                ) : (
                  <div className="overflow-y-auto" style={{ height: maxHeight }}>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleHabitDragEnd(e, key, group)}>
                      <SortableContext items={group.map((h) => h.id)} strategy={verticalListSortingStrategy}>
                        <ul className="divide-y divide-white/[0.05]">
                          {group.map((habit) => (
                            <SortableHabitRow
                              key={habit.id}
                              habit={habit}
                              selectedDate={selectedDate}
                              onToggle={() => toggleHabit(habit)}
                              onEdit={() => setEditingHabit(habit)}
                              onDelete={() => deleteHabit(habit.id)}
                            />
                          ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}
              </CollapsibleSection>
            );
          })}
        </div>

        {/* Right — credit card reminders */}
        <div className="lg:col-span-2">
          <section className="bg-[#1e2245] border border-white/[0.07] rounded-2xl overflow-hidden h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">💳</span>
                <h2 className="text-sm font-semibold text-slate-200">Credit Cards</h2>
                {ccReminders.length > 0 && (
                  <span className={`py-0.5 px-2 rounded-full text-[10px] font-bold ${
                    paidCards.size === ccReminders.length && ccReminders.length > 0
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-indigo-500/20 text-indigo-300"
                  }`}>
                    {paidCards.size}/{ccReminders.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setEditCcReminder(null); setCcReminderForm(EMPTY_CC_REMINDER); setCcReminderSaveError(null); setShowCcReminderModal(true); }}
                className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                aria-label="Add credit card reminder"
              >
                <Plus size={16} />
              </button>
            </div>
            {renderCcContent()}
          </section>
        </div>
      </div>

      {/* Pending tasks */}
      <div className="mb-4">
        <CollapsibleSection
          title="Pending Tasks"
          icon="📋"
          badge={
            <span className={`py-0.5 px-2 rounded-full text-[10px] font-bold ${
              pendingTasks.length === 0
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-indigo-500/20 text-indigo-300"
            }`}>
              {pendingTasks.length}
            </span>
          }
          action={<AddTaskModal onCreated={(t) => setTasks((prev) => [t, ...prev])} />}
        >
          {pendingTasks.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: 310 }}>
              <p className="text-sm text-slate-500">All caught up!</p>
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ height: 310 }}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
                <SortableContext items={pendingTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div>
                    {pendingTasks.map((task) => (
                      <SortableTaskItem
                        key={task.id}
                        task={task}
                        onToggle={() => toggleTask(task)}
                        onEdit={() => setEditingTask(task)}
                        onDelete={() => deleteTask(task.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </CollapsibleSection>
      </div>

      {/* Completed tasks */}
      {allCompletedTasks.length > 0 && (
        <CollapsibleSection
          title="Completed"
          icon="✅"
          titleClass="text-slate-400"
          badge={
            <span className="bg-white/[0.07] text-slate-500 py-0.5 px-2 rounded-full text-[10px] font-bold">
              {completedTasks.length}
            </span>
          }
          action={
            <div className="flex gap-1">
              {(["today", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setCompletedFilter(f)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    completedFilter === f
                      ? "bg-white/[0.1] text-slate-200"
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]"
                  }`}
                >
                  {f === "today" ? "Today" : "All"}
                </button>
              ))}
            </div>
          }
          defaultOpen={false}
        >
          <div className="opacity-70">
            {completedTasks.length === 0 ? (
              <div className="flex items-center justify-center" style={{ height: 310 }}>
                <p className="text-sm text-slate-500">No tasks completed today.</p>
              </div>
            ) : (
              <div className="overflow-y-auto" style={{ height: 310 }}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCompletedTaskDragEnd}>
                  <SortableContext items={completedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    <div>
                      {completedTasks.map((task) => (
                        <SortableCompletedTaskItem
                          key={task.id}
                          task={task}
                          onToggle={() => toggleTask(task)}
                          onEdit={() => setEditingTask(task)}
                          onDelete={() => deleteTask(task.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Edit modals */}
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

      {/* CC reminder modal */}
      {showCcReminderModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2245] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Bell size={15} className="text-indigo-400" />
                {editCcReminder ? "Edit Reminder" : "Add Card Reminder"}
              </h2>
              <button
                onClick={() => { setShowCcReminderModal(false); setEditCcReminder(null); setCcReminderForm(EMPTY_CC_REMINDER); setAddingOwner(false); setNewOwnerInput(""); setOwnerSaveError(null); }}
                className="text-slate-500 hover:text-slate-200 hover:bg-white/[0.07] p-1.5 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveCcReminder} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Card Name <span className="text-red-400">*</span></label>
                <input autoFocus className={INPUT_CLS} placeholder="e.g. Chase Sapphire" value={ccReminderForm.card_name} onChange={(e) => setCcReminderForm((f) => ({ ...f, card_name: e.target.value }))} required />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-400">Owner</label>
                  {!addingOwner && (
                    <button type="button" onClick={() => setAddingOwner(true)} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                      <Plus size={11} /> New
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <select className={INPUT_CLS} value={ccReminderForm.owner} onChange={(e) => setCcReminderForm((f) => ({ ...f, owner: e.target.value }))}>
                    <option value="">No owner</option>
                    {reminderOwners.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                  </select>
                  {addingOwner && (
                    <div className="bg-[#14162e] border border-white/[0.08] rounded-lg p-2 flex flex-col gap-1">
                      {reminderOwners.map((o) => (
                        <div key={o.id} className="flex items-center justify-between px-2 py-1 rounded hover:bg-white/[0.05] group">
                          <span className="text-sm text-slate-300">{o.name}</span>
                          <button type="button" onClick={() => deleteReminderOwner(o.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"><X size={13} /></button>
                        </div>
                      ))}
                      <div className="flex items-center gap-1 mt-1">
                        <input autoFocus className="flex-1 bg-[#1e2245] border border-white/[0.1] rounded-md px-2 py-1 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" placeholder="Owner name" value={newOwnerInput} onChange={(e) => setNewOwnerInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addReminderOwner(); } if (e.key === "Escape") { setAddingOwner(false); setNewOwnerInput(""); } }} />
                        <button type="button" onClick={addReminderOwner} className="px-2.5 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-500 transition-colors">Add</button>
                        <button type="button" onClick={() => { setAddingOwner(false); setNewOwnerInput(""); setOwnerSaveError(null); }} className="p-1 text-slate-500 hover:text-slate-300 transition-colors"><X size={13} /></button>
                      </div>
                      {ownerSaveError && <p className="text-xs text-red-400 px-2">{ownerSaveError}</p>}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Due Day of Month <span className="text-red-400">*</span></label>
                  <input type="number" min={1} max={31} className={INPUT_CLS} placeholder="e.g. 15" value={ccReminderForm.due_day} onChange={(e) => setCcReminderForm((f) => ({ ...f, due_day: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Notify Days Before</label>
                  <input type="number" min={1} max={30} className={INPUT_CLS} placeholder="e.g. 5" value={ccReminderForm.days_before} onChange={(e) => setCcReminderForm((f) => ({ ...f, days_before: e.target.value }))} />
                </div>
              </div>

              {ccReminderSaveError && <p className="text-sm text-red-400">{ccReminderSaveError}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowCcReminderModal(false); setEditCcReminder(null); setCcReminderForm(EMPTY_CC_REMINDER); setAddingOwner(false); setNewOwnerInput(""); setOwnerSaveError(null); }} className="flex-1 px-4 py-2.5 bg-white/[0.06] border border-white/[0.08] text-slate-300 rounded-lg hover:bg-white/[0.09] transition-colors font-medium text-sm">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors font-medium text-sm active:scale-95">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2245] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-white mb-1">Remove reminder?</h2>
            <p className="text-sm text-slate-400 mb-6">This credit card reminder will be permanently removed.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCcReminderDeleteId(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/[0.07] rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={confirmDeleteReminder} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors active:scale-95">
                Remove
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
