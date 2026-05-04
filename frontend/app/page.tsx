"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2, Flame, CreditCard, Briefcase, DollarSign, Calendar, Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Task, HabitWithStreak, Payment, ExpenseSummary, Category, JobApplication } from "@/lib/types";

// ---- Helpers ----

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function countLogsThisWeek(loggedDates: string[]) {
  const weekStart = getWeekStart();
  return (loggedDates || []).filter(d => d >= weekStart).length;
}

function isHabitNeededToday(habit: HabitWithStreak) {
  if (habit.logged_dates?.includes(todayStr())) return false;
  const targetFreq = habit.target_freq ?? 7;
  return countLogsThisWeek(habit.logged_dates || []) < targetFreq;
}

function fmtAmount(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ---- Status config ----

type StatusKey = "applied" | "phone_screen" | "interview" | "offer" | "rejected";

const STATUS_CONFIG: Record<StatusKey, { label: string; color: string }> = {
  applied:      { label: "Applied",      color: "text-blue-700 bg-blue-50" },
  phone_screen: { label: "Phone Screen", color: "text-amber-700 bg-amber-50" },
  interview:    { label: "Interview",    color: "text-violet-700 bg-violet-50" },
  offer:        { label: "Offer",        color: "text-emerald-700 bg-emerald-50" },
  rejected:     { label: "Rejected",     color: "text-red-600 bg-red-50" },
};

// ---- Progress Ring ----

function ProgressRing({ value, max, color, trackColor = "#f1f5f9", label, sublabel }: {
  value: number;
  max: number;
  color: string;
  trackColor?: string;
  label: string;
  sublabel: string;
}) {
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const pct = max === 0 ? 0 : Math.min(value / max, 1);
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-[76px] h-[76px]">
        <svg width="76" height="76" viewBox="0 0 76 76" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="38" cy="38" r={r} fill="none" stroke={trackColor} strokeWidth="7" />
          <circle
            cx="38" cy="38" r={r} fill="none"
            stroke={color} strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[17px] font-bold text-slate-900">{value}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[13px] font-semibold text-slate-800">{label}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{sublabel}</p>
      </div>
    </div>
  );
}

// ---- Focus Card ----

function FocusCard({ icon, accent, title, subtitle, onAction, actionLabel, checking }: {
  icon: React.ReactNode;
  accent: string;
  title: string;
  subtitle?: string;
  onAction: () => void;
  actionLabel: React.ReactNode;
  checking: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] px-5 py-4 flex items-center gap-4 transition-opacity duration-300 ${checking ? "opacity-40" : ""}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-slate-900 truncate">{title}</p>
        {subtitle && <p className="text-[12px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <button
        onClick={onAction}
        disabled={checking}
        className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full border-2 border-slate-200 hover:border-current transition-colors disabled:cursor-not-allowed"
      >
        {checking ? <Check size={13} className="text-slate-400" /> : actionLabel}
      </button>
    </div>
  );
}

// ---- Confetti ----

const CONFETTI_COLORS = ["#f97316", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: 5 + (i / 36) * 90 + (Math.sin(i * 2.4) * 5),
    bottom: 15 + Math.abs(Math.sin(i * 1.3)) * 30,
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

// ---- Weekly Summary ----

function WeeklySummary({ habits }: { habits: HabitWithStreak[] }) {
  const weekStart = getWeekStart();
  const today = todayStr();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const passedDays = weekDays.filter((d) => d <= today);
  const loggedDays = passedDays.filter((day) => habits.some((h) => h.logged_dates?.includes(day)));

  const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
  const perfectSoFar = passedDays.length > 0 && loggedDays.length === passedDays.length;

  return (
    <section>
      <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-400 mb-4">
        This Week
      </h2>
      <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] px-6 py-5">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">
              {loggedDays.length}
              <span className="text-slate-300 text-2xl">/{passedDays.length}</span>
            </p>
            <p className="text-[13px] text-slate-500 mt-1">habit days logged this week</p>
            {perfectSoFar && passedDays.length >= 3 && (
              <p className="text-xs font-semibold text-emerald-600 mt-2">🏆 Perfect week so far!</p>
            )}
          </div>
          <div className="flex gap-1.5">
            {weekDays.map((day, i) => {
              const isPast = day <= today;
              const isToday = day === today;
              const logged = habits.some((h) => h.logged_dates?.includes(day));
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                      !isPast
                        ? "bg-slate-50 text-slate-200"
                        : logged
                          ? "bg-orange-100 text-orange-600"
                          : isToday
                            ? "bg-slate-100 text-slate-400 ring-2 ring-slate-300"
                            : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    {logged && isPast ? "✓" : ""}
                  </div>
                  <span className={`text-[10px] font-medium ${isToday ? "text-slate-600" : "text-slate-300"}`}>
                    {DAY_LABELS[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- Page ----

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [jobs, setJobs] = useState<JobApplication[]>([]);

  const [checkingTasks, setCheckingTasks] = useState<Set<number>>(new Set());
  const [checkingHabits, setCheckingHabits] = useState<Set<number>>(new Set());
  const [checkingPayments, setCheckingPayments] = useState<Set<number>>(new Set());

  const [showConfetti, setShowConfetti] = useState(false);
  const prevHabitsToDoCount = useRef(-1);

  useEffect(() => {
    const month = currentMonth();
    Promise.allSettled([
      apiFetch("/tasks"),
      apiFetch("/habits"),
      apiFetch("/payments"),
      apiFetch(`/expenses/summary?month=${month}`),
      apiFetch("/categories"),
      apiFetch("/jobs"),
    ]).then(([t, h, p, es, cats, j]) => {
      if (t.status === "fulfilled") setTasks(t.value || []);
      if (h.status === "fulfilled") setHabits(h.value || []);
      if (p.status === "fulfilled") setPayments(p.value || []);
      if (es.status === "fulfilled") setExpenseSummary(es.value || null);
      if (cats.status === "fulfilled") setCategories(cats.value || []);
      if (j.status === "fulfilled") setJobs(j.value || []);
    });
  }, []);

  // Confetti: trigger when habitsToDoToday transitions from >0 to 0
  const habitsToDoToday = habits.filter(isHabitNeededToday);

  useEffect(() => {
    if (prevHabitsToDoCount.current === -1) {
      prevHabitsToDoCount.current = habitsToDoToday.length;
      return;
    }
    if (prevHabitsToDoCount.current > 0 && habitsToDoToday.length === 0 && habits.length > 0) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3500);
    }
    prevHabitsToDoCount.current = habitsToDoToday.length;
  }, [habitsToDoToday.length, habits.length]);

  // ---- Check-off handlers ----

  async function completeTask(id: number) {
    setCheckingTasks(prev => new Set(prev).add(id));
    await apiFetch(`/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    setTimeout(() => {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true } : t));
      setCheckingTasks(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 400);
  }

  async function logHabit(id: number) {
    setCheckingHabits(prev => new Set(prev).add(id));
    await apiFetch(`/habits/${id}/log`, { method: "POST" });
    setTimeout(() => {
      setHabits(prev => prev.map(h =>
        h.id === id ? { ...h, logged_dates: [...(h.logged_dates || []), todayStr()] } : h
      ));
      setCheckingHabits(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 400);
  }

  async function markPaid(id: number) {
    setCheckingPayments(prev => new Set(prev).add(id));
    await apiFetch(`/payments/${id}/mark-paid`, { method: "POST" });
    setTimeout(() => {
      setPayments(prev => prev.map(p => p.id === id ? { ...p, is_paid: true } : p));
      setCheckingPayments(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 400);
  }

  // ---- Derived data ----

  const pendingTasks = tasks
    .filter(t => !t.completed)
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });

  const habitsLoggedToday = habits.filter(h => h.logged_dates?.includes(todayStr()));

  const unpaidPayments = payments
    .filter(p => !p.is_paid)
    .sort((a, b) => a.days_until_due - b.days_until_due);

  const catMap = new Map(categories.map(c => [c.id, c.name]));

  const jobCounts = (Object.keys(STATUS_CONFIG) as StatusKey[]).reduce<Record<string, number>>(
    (acc, key) => { acc[key] = jobs.filter(j => j.status === key).length; return acc; },
    {}
  );

  const activeJobs = jobs.filter(j => j.status === "phone_screen" || j.status === "interview").length;

  const focusTask = pendingTasks[0] ?? null;
  const focusHabit = habitsToDoToday[0] ?? null;
  const focusPayment = unpaidPayments[0] ?? null;
  const allCaughtUp = !focusTask && !focusHabit && !focusPayment;

  const habitsTotal = habitsLoggedToday.length + habitsToDoToday.length;
  const completedTasks = tasks.filter(t => t.completed).length;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-10 pb-24">
      <Confetti active={showConfetti} />

      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          {getGreeting()}, Ivan
        </h1>
        <p className="text-base text-slate-400 mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Today's Focus */}
      <section>
        <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-400 mb-4">
          Today&apos;s Focus
        </h2>
        {allCaughtUp ? (
          <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] px-6 py-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-slate-900">You&apos;re all caught up</p>
              <p className="text-[12px] text-slate-400 mt-0.5">Nothing urgent today — enjoy the day.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {focusTask && (
              <FocusCard
                icon={<CheckCircle2 size={18} className="text-emerald-600" />}
                accent="bg-emerald-50"
                title={focusTask.name}
                subtitle={focusTask.due_date ? `Due ${fmtDate(focusTask.due_date)}` : "Task"}
                onAction={() => completeTask(focusTask.id)}
                actionLabel={<Check size={13} className="text-slate-300" />}
                checking={checkingTasks.has(focusTask.id)}
              />
            )}
            {focusHabit && (
              <FocusCard
                icon={<Flame size={18} className="text-orange-500" />}
                accent="bg-orange-50"
                title={focusHabit.name}
                subtitle={`${focusHabit.streak ?? 0} day streak`}
                onAction={() => logHabit(focusHabit.id)}
                actionLabel={<Check size={13} className="text-slate-300" />}
                checking={checkingHabits.has(focusHabit.id)}
              />
            )}
            {focusPayment && (
              <FocusCard
                icon={<CreditCard size={18} className="text-amber-600" />}
                accent="bg-amber-50"
                title={focusPayment.name}
                subtitle={
                  focusPayment.days_until_due < 0
                    ? `${Math.abs(focusPayment.days_until_due)}d overdue · ${fmtAmount(focusPayment.amount)}`
                    : focusPayment.days_until_due === 0
                      ? `Due today · ${fmtAmount(focusPayment.amount)}`
                      : `Due ${fmtDate(focusPayment.due_date)} · ${fmtAmount(focusPayment.amount)}`
                }
                onAction={() => markPaid(focusPayment.id)}
                actionLabel={<Check size={13} className="text-slate-300" />}
                checking={checkingPayments.has(focusPayment.id)}
              />
            )}
          </div>
        )}
      </section>

      {/* Progress Rings */}
      <section>
        <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-400 mb-4">
          Progress
        </h2>
        <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] py-8 px-6">
          <div className="flex items-center justify-around max-w-sm mx-auto">
            <ProgressRing
              value={habitsLoggedToday.length}
              max={habitsTotal}
              color="#f97316"
              label="Habits"
              sublabel={`${habitsLoggedToday.length} of ${habitsTotal} today`}
            />
            <div className="w-px h-16 bg-slate-100" />
            <ProgressRing
              value={completedTasks}
              max={tasks.length}
              color="#6366f1"
              label="Tasks"
              sublabel={`${pendingTasks.length} remaining`}
            />
            <div className="w-px h-16 bg-slate-100" />
            <ProgressRing
              value={activeJobs}
              max={jobs.length}
              color="#0ea5e9"
              label="Jobs"
              sublabel={`${activeJobs} active`}
            />
          </div>
        </div>
      </section>

      {/* Weekly Summary */}
      {habits.length > 0 && <WeeklySummary habits={habits} />}

      {/* Analytics row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel
          icon={<DollarSign size={15} className="text-emerald-600" />}
          title="Expenses"
          label={new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          aside={<span className="text-base font-bold text-slate-900">{fmtAmount(expenseSummary?.total)}</span>}
        >
          {!expenseSummary || expenseSummary.by_category.length === 0 ? (
            <Empty message="No expenses this month." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="text-left pb-2 font-bold">Category</th>
                  <th className="text-right pb-2 font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expenseSummary.by_category
                  .sort((a, b) => b.total - a.total)
                  .map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 text-slate-700">
                        {row.category_id ? catMap.get(row.category_id) ?? "Uncategorized" : "Uncategorized"}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-slate-900">{fmtAmount(row.total)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          icon={<Briefcase size={15} className="text-indigo-600" />}
          title="Job Pipeline"
          aside={<span className="text-xs text-slate-400 font-medium">{jobs.length} total</span>}
        >
          {jobs.length === 0 ? (
            <Empty message="No job applications yet." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="text-left pb-2 font-bold">Status</th>
                  <th className="text-right pb-2 font-bold">Count</th>
                  <th className="text-right pb-2 font-bold">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(Object.entries(STATUS_CONFIG) as [StatusKey, { label: string; color: string }][])
                  .filter(([key]) => jobCounts[key] > 0)
                  .map(([key, cfg]) => (
                    <tr key={key} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-slate-900">{jobCounts[key]}</td>
                      <td className="py-2.5 text-right text-slate-400">
                        {Math.round((jobCounts[key] / jobs.length) * 100)}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {/* Action columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <Panel
          icon={<CheckCircle2 size={15} className="text-emerald-600" />}
          title="Pending Tasks"
          badge={pendingTasks.length}
          badgeColor="bg-emerald-100 text-emerald-700"
        >
          {pendingTasks.length === 0 ? (
            <Empty message="All tasks complete!" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingTasks.map(task => {
                const checking = checkingTasks.has(task.id);
                return (
                  <li
                    key={task.id}
                    className={`py-3 flex items-start gap-3 transition-opacity duration-300 ${checking ? "opacity-40" : ""}`}
                  >
                    <button
                      onClick={() => completeTask(task.id)}
                      disabled={checking}
                      className="mt-0.5 flex-shrink-0 w-[15px] h-[15px] rounded-full border-2 border-slate-300 hover:border-emerald-500 flex items-center justify-center transition-colors disabled:cursor-not-allowed"
                    >
                      {checking && <Check size={9} className="text-emerald-500" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-slate-800">{task.name}</p>
                      {task.due_date && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          <Calendar size={10} />{fmtDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          icon={<Flame size={15} className="text-orange-500" />}
          title="Habits Today"
          badge={habitsToDoToday.length}
          badgeColor="bg-orange-100 text-orange-700"
        >
          {habitsToDoToday.length === 0 ? (
            <Empty message="All habits done for today! 🎉" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {habitsToDoToday.map(habit => {
                const checking = checkingHabits.has(habit.id);
                return (
                  <li
                    key={habit.id}
                    className={`py-3 flex items-center justify-between gap-3 transition-opacity duration-300 ${checking ? "opacity-40" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => logHabit(habit.id)}
                        disabled={checking}
                        className="flex-shrink-0 w-[15px] h-[15px] rounded-full border-2 border-slate-300 hover:border-orange-500 flex items-center justify-center transition-colors disabled:cursor-not-allowed"
                      >
                        {checking && <Check size={9} className="text-orange-500" />}
                      </button>
                      <span className="text-[15px] font-medium text-slate-800 truncate">{habit.name}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md flex-shrink-0">
                      <Flame size={11} />{habit.streak ?? 0}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          icon={<CreditCard size={15} className="text-amber-600" />}
          title="Upcoming Payments"
          badge={unpaidPayments.length}
          badgeColor="bg-amber-100 text-amber-700"
        >
          {unpaidPayments.length === 0 ? (
            <Empty message="No outstanding payments." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {unpaidPayments.map(payment => {
                const checking = checkingPayments.has(payment.id);
                return (
                  <li
                    key={payment.id}
                    className={`py-3 flex items-center gap-3 transition-opacity duration-300 ${checking ? "opacity-40" : ""}`}
                  >
                    <button
                      onClick={() => markPaid(payment.id)}
                      disabled={checking}
                      className="flex-shrink-0 w-[15px] h-[15px] rounded-full border-2 border-slate-300 hover:border-amber-500 flex items-center justify-center transition-colors disabled:cursor-not-allowed"
                    >
                      {checking && <Check size={9} className="text-amber-500" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-slate-800 truncate">{payment.name}</p>
                      <span className={`text-[11px] font-semibold uppercase tracking-wider mt-0.5 block ${
                        payment.days_until_due < 0
                          ? "text-red-500"
                          : payment.days_until_due <= 3
                            ? "text-amber-500"
                            : "text-slate-400"
                      }`}>
                        {payment.days_until_due < 0
                          ? `${Math.abs(payment.days_until_due)}d overdue`
                          : payment.days_until_due === 0
                            ? "Due today"
                            : `Due ${fmtDate(payment.due_date)}`}
                      </span>
                    </div>
                    <span className="text-[15px] font-bold text-slate-900 flex-shrink-0">{fmtAmount(payment.amount)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ---- Sub-components ----

function Panel({ icon, title, label, aside, badge, badgeColor, children }: {
  icon: React.ReactNode;
  title: string;
  label?: string;
  aside?: React.ReactNode;
  badge?: number;
  badgeColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-[11px] font-semibold text-slate-900 uppercase tracking-[0.08em]">{title}</h2>
          {label && <span className="text-xs text-slate-400 font-medium">{label}</span>}
          {badge !== undefined && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
          )}
        </div>
        {aside}
      </div>
      <div className="p-5 overflow-y-auto max-h-[420px]">
        {children}
      </div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="text-[13px] text-slate-400 text-center py-6">{message}</p>;
}
