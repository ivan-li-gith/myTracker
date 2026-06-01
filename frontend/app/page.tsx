"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  CheckCircle2, Flame, Briefcase, DollarSign, CheckSquare,
  Check, AlertTriangle, ArrowRight, ChevronDown, TrendingUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  Task, HabitWithStreak, Payment, ExpenseSummary, Category, JobApplication, StockHolding,
} from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function countLogsThisWeek(loggedDates: string[]) {
  const weekStart = getWeekStart();
  return (loggedDates || []).filter(d => d >= weekStart).length;
}

function isHabitNeededToday(habit: HabitWithStreak) {
  if (habit.logged_dates?.includes(todayStr())) return false;
  return countLogsThisWeek(habit.logged_dates || []) < (habit.target_freq ?? 7);
}

// ── Types & constants ─────────────────────────────────────────────────────────

type StatusKey = "applied" | "phone_screen" | "interview" | "offer" | "rejected";

const STATUS_CONFIG: Record<StatusKey, { label: string; barColor: string }> = {
  applied:      { label: "Applied",      barColor: "bg-blue-400" },
  phone_screen: { label: "Phone Screen", barColor: "bg-amber-400" },
  interview:    { label: "Interview",    barColor: "bg-violet-500" },
  offer:        { label: "Offer",        barColor: "bg-emerald-500" },
  rejected:     { label: "Rejected",     barColor: "bg-red-400" },
};

type ReminderItem = {
  id: string;
  title: string;
  subtitle: string;
  urgency: "overdue" | "today" | "soon";
  type: "task" | "habit" | "payment";
  rawId: number;
};

const CAT_COLORS = [
  "bg-emerald-400", "bg-teal-400", "bg-cyan-400", "bg-blue-400", "bg-indigo-400",
];

const MAX_VISIBLE = 3;

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, accent, href }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent: string;
  href?: string;
}) {
  const content = (
    <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] px-5 py-4 flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          {icon}
        </div>
        {href && <ArrowRight size={13} className="text-slate-200" />}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 tracking-tight leading-none">{value}</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 mt-2">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block hover:scale-[1.01] active:scale-[0.99] transition-transform duration-150">
      {content}
    </Link>
  ) : <div>{content}</div>;
}

// ── Pipeline Bar ──────────────────────────────────────────────────────────────

function PipelineBar({ label, count, max, barColor }: {
  label: string;
  count: number;
  max: number;
  barColor: string;
}) {
  const pct = max === 0 ? 0 : (count / max) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-slate-500 w-[92px] flex-shrink-0">{label}</span>
      <div className="flex-1 h-[6px] bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[12px] font-bold text-slate-700 w-5 text-right flex-shrink-0">{count}</span>
    </div>
  );
}

// ── Stat Tile ─────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-slate-50 rounded-xl px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

// ── Urgency Card ──────────────────────────────────────────────────────────────

function UrgencyCard({ item, onCheck, checking }: {
  item: ReminderItem;
  onCheck?: () => void;
  checking: boolean;
}) {
  const styles = {
    overdue: { border: "border-l-red-400",   bg: "bg-red-50/60" },
    today:   { border: "border-l-amber-400", bg: "bg-amber-50/60" },
    soon:    { border: "border-l-slate-200", bg: "bg-slate-50/40" },
  }[item.urgency];

  const checkBorder = {
    overdue: "border-red-300 hover:border-red-500",
    today:   "border-amber-300 hover:border-amber-500",
    soon:    "border-slate-300 hover:border-slate-500",
  }[item.urgency];

  return (
    <div className={`border-l-2 ${styles.border} ${styles.bg} rounded-r-lg px-3 py-2.5 flex items-center gap-2.5 transition-opacity duration-300 ${checking ? "opacity-40" : ""}`}>
      {onCheck ? (
        <button
          onClick={onCheck}
          disabled={checking}
          className={`flex-shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors disabled:cursor-not-allowed ${checkBorder}`}
        >
          {checking && <Check size={9} className="text-slate-400" />}
        </button>
      ) : (
        <Flame size={13} className="text-orange-400 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-slate-800 truncate leading-snug">{item.title}</p>
        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{item.subtitle}</p>
      </div>
    </div>
  );
}

// ── Confetti ──────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ["#f97316","#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899"];

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    id: i, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: 5 + (i / 36) * 90 + (Math.sin(i * 2.4) * 5),
    bottom: 15 + Math.abs(Math.sin(i * 1.3)) * 30,
    size: 7 + (i % 5), delay: (i % 8) * 0.12, duration: 1.2 + (i % 4) * 0.2,
    round: i % 3 !== 0,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(p => (
        <div
          key={p.id}
          className={`absolute confetti-piece ${p.round ? "rounded-full" : "rounded-sm"}`}
          style={{
            backgroundColor: p.color, left: `${p.left}%`, bottom: `${p.bottom}%`,
            width: `${p.size}px`, height: `${p.size}px`,
            "--conf-delay": `${p.delay}s`, "--conf-dur": `${p.duration}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [stocks, setStocks] = useState<StockHolding[]>([]);
  const [checkingTasks, setCheckingTasks] = useState<Set<number>>(new Set());
  const [checkingHabits, setCheckingHabits] = useState<Set<number>>(new Set());
  const [checkingPayments, setCheckingPayments] = useState<Set<number>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set());
  const prevHabitsToDoCount = useRef(-1);

  function toggleCol(col: string) {
    setExpandedCols(prev => {
      const next = new Set(prev);
      next.has(col) ? next.delete(col) : next.add(col);
      return next;
    });
  }

  useEffect(() => {
    const month = currentMonth();
    Promise.allSettled([
      apiFetch("/tasks"),
      apiFetch("/habits"),
      apiFetch("/payments"),
      apiFetch(`/expenses/summary?month=${month}`),
      apiFetch("/categories"),
      apiFetch("/jobs"),
      apiFetch("/stocks"),
    ]).then(([t, h, p, es, cats, j, s]) => {
      if (t.status === "fulfilled") setTasks(t.value || []);
      if (h.status === "fulfilled") setHabits(h.value || []);
      if (p.status === "fulfilled") setPayments(p.value || []);
      if (es.status === "fulfilled") setExpenseSummary(es.value || null);
      if (cats.status === "fulfilled") setCategories(cats.value || []);
      if (j.status === "fulfilled") setJobs(j.value || []);
      if (s.status === "fulfilled") setStocks(s.value || []);
    });
  }, []);

  const habitsToDoToday = habits.filter(isHabitNeededToday);
  const habitsLoggedToday = habits.filter(h => h.logged_dates?.includes(todayStr()));

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

  // ── Action handlers ───────────────────────────────────────────────────────

  async function completeTask(id: number) {
    setCheckingTasks(prev => new Set(prev).add(id));
    await apiFetch(`/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
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

  // ── Derived: Jobs ─────────────────────────────────────────────────────────

  const jobCounts = (Object.keys(STATUS_CONFIG) as StatusKey[]).reduce<Record<StatusKey, number>>(
    (acc, k) => { acc[k] = jobs.filter(j => j.status === k).length; return acc; },
    { applied: 0, phone_screen: 0, interview: 0, offer: 0, rejected: 0 }
  );
  const activeJobs = jobCounts.phone_screen + jobCounts.interview;
  const concludedJobs = jobCounts.offer + jobCounts.rejected;
  const successRate = concludedJobs > 0 ? Math.round((jobCounts.offer / concludedJobs) * 100) : null;
  const responseRate = jobs.length > 0
    ? Math.round(((jobs.length - jobCounts.applied) / jobs.length) * 100)
    : null;
  const maxJobCount = Math.max(...Object.values(jobCounts), 1);
  const weekStart = getWeekStart();
  const jobsThisWeek = jobs.filter(j => j.date_applied && j.date_applied >= weekStart).length;
  const jobsToday = jobs.filter(j => j.date_applied === todayStr()).length;

  // ── Derived: Portfolio ───────────────────────────────────────────────────

  const PORTFOLIO_COLORS_HOME = ["#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#f97316", "#8b5cf6"];
  const activeHoldings = stocks.filter(s => Number(s.shares) > 0);
  const portfolioTotalValue = activeHoldings.reduce((sum, s) => sum + Number(s.shares) * Number(s.current_price), 0);
  const portfolioTotalCost = activeHoldings.reduce((sum, s) => sum + Number(s.shares) * Number(s.buy_price), 0);
  const portfolioUnrealized = portfolioTotalValue - portfolioTotalCost;
  const portfolioUnrealizedPct = portfolioTotalCost > 0 ? ((portfolioUnrealized / portfolioTotalCost) * 100).toFixed(1) : null;
  const portfolioRealized = stocks.reduce((sum, s) => sum + Number(s.realized_gain), 0);
  const portfolioTotalDividends = stocks.reduce((sum, s) => sum + Number(s.total_dividends), 0);
  const topHoldings = [...activeHoldings]
    .sort((a, b) => Number(b.shares) * Number(b.current_price) - Number(a.shares) * Number(a.current_price))
    .slice(0, 5);

  // ── Derived: Finance ──────────────────────────────────────────────────────

  const catMap = new Map(categories.map(c => [c.id, c.name]));
  const unpaidPayments = payments.filter(p => !p.is_paid).sort((a, b) => a.days_until_due - b.days_until_due);
  const sortedCats = expenseSummary ? [...expenseSummary.by_category].sort((a, b) => b.total - a.total) : [];
  const maxCatAmount = sortedCats[0]?.total ?? 1;

  // ── Derived: Reminders ────────────────────────────────────────────────────

  const today = todayStr();
  const weekEnd = addDays(today, 7);

  const overdueItems: ReminderItem[] = [
    ...tasks.filter(t => !t.completed && t.due_date && t.due_date < today).map(t => {
      const daysOver = Math.floor(
        (new Date(today + "T00:00:00").getTime() - new Date(t.due_date! + "T00:00:00").getTime()) / 86400000
      );
      return {
        id: `task-${t.id}`, title: t.name, subtitle: `Task · ${daysOver}d overdue`,
        urgency: "overdue" as const, type: "task" as const, rawId: t.id,
      };
    }),
    ...unpaidPayments.filter(p => p.days_until_due < 0).map(p => ({
      id: `pay-${p.id}`, title: p.name,
      subtitle: `Payment · ${Math.abs(p.days_until_due)}d overdue · ${fmtAmount(p.amount)}`,
      urgency: "overdue" as const, type: "payment" as const, rawId: p.id,
    })),
  ];

  const todayItems: ReminderItem[] = [
    ...tasks.filter(t => !t.completed && t.due_date === today).map(t => ({
      id: `task-${t.id}`, title: t.name, subtitle: "Task · due today",
      urgency: "today" as const, type: "task" as const, rawId: t.id,
    })),
    ...unpaidPayments.filter(p => p.days_until_due === 0).map(p => ({
      id: `pay-${p.id}`, title: p.name,
      subtitle: `Payment · due today · ${fmtAmount(p.amount)}`,
      urgency: "today" as const, type: "payment" as const, rawId: p.id,
    })),
    ...habitsToDoToday.map(h => ({
      id: `habit-${h.id}`, title: h.name,
      subtitle: `Habit · ${h.streak ?? 0} day streak`,
      urgency: "today" as const, type: "habit" as const, rawId: h.id,
    })),
  ];

  const soonItems: ReminderItem[] = [
    ...tasks
      .filter(t => !t.completed && t.due_date && t.due_date > today && t.due_date <= weekEnd)
      .map(t => ({
        id: `task-${t.id}`, title: t.name, subtitle: `Task · ${fmtDate(t.due_date!)}`,
        urgency: "soon" as const, type: "task" as const, rawId: t.id,
      })),
    ...unpaidPayments.filter(p => p.days_until_due > 0 && p.days_until_due <= 7).map(p => ({
      id: `pay-${p.id}`, title: p.name,
      subtitle: `Payment · ${fmtDate(p.due_date)} · ${fmtAmount(p.amount)}`,
      urgency: "soon" as const, type: "payment" as const, rawId: p.id,
    })),
  ];

  const pendingTaskCount = tasks.filter(t => !t.completed).length;
  const overdueTaskCount = overdueItems.filter(r => r.type === "task").length;
  const longestStreak = habits.reduce((m, h) => Math.max(m, h.streak ?? 0), 0);
  const allCaughtUp = overdueItems.length === 0 && todayItems.length === 0 && soonItems.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 pb-24">
      <Confetti active={showConfetti} />

      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {getGreeting()}, Ivan
          </h1>
          <p className="text-base text-slate-400 mt-1">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric", year: "numeric",
            })}
          </p>
        </div>
        {overdueItems.length > 0 && (
          <div className="hidden md:flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-semibold border border-red-100 flex-shrink-0">
            <AlertTriangle size={14} />
            {overdueItems.length} overdue
          </div>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={<DollarSign size={16} className="text-emerald-600" />}
          accent="bg-emerald-50"
          label="Monthly Spend"
          value={
            expenseSummary
              ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(expenseSummary.total)
              : "—"
          }
          sub={expenseSummary ? `${expenseSummary.count} expense${expenseSummary.count !== 1 ? "s" : ""}` : "No data yet"}
          href="/payments"
        />
        <KpiCard
          icon={<TrendingUp size={16} className="text-sky-600" />}
          accent="bg-sky-50"
          label="Portfolio"
          value={stocks.length > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(portfolioTotalValue) : "—"}
          sub={portfolioUnrealizedPct !== null ? `${portfolioUnrealized >= 0 ? "+" : ""}${portfolioUnrealizedPct}% unrealized` : stocks.length > 0 ? `${activeHoldings.length} holding${activeHoldings.length !== 1 ? "s" : ""}` : "No holdings yet"}
          href="/payments"
        />
        <KpiCard
          icon={<Briefcase size={16} className="text-indigo-600" />}
          accent="bg-indigo-50"
          label="Active Pipeline"
          value={activeJobs}
          sub={jobs.length > 0 ? `${jobs.length} total applications` : "No applications yet"}
          href="/jobs"
        />
        <KpiCard
          icon={<CheckSquare size={16} className="text-violet-600" />}
          accent="bg-violet-50"
          label="Tasks Pending"
          value={pendingTaskCount}
          sub={overdueTaskCount > 0 ? `${overdueTaskCount} overdue` : "All on schedule"}
          href="/tasks"
        />
        <KpiCard
          icon={<Flame size={16} className="text-orange-500" />}
          accent="bg-orange-50"
          label="Habits Today"
          value={`${habitsLoggedToday.length}/${habits.filter(h => !h.archived).length}`}
          sub={longestStreak > 0 ? `Best streak: ${longestStreak} days` : "Start your streak"}
          href="/tasks"
        />
      </div>

      {/* Analytics Row: Jobs + Finance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Jobs Panel */}
        <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase size={14} className="text-indigo-600" />
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-900">Jobs Pipeline</h2>
              <span className="text-xs text-slate-400">{jobs.length} total</span>
            </div>
            <Link href="/jobs" className="text-[11px] text-indigo-500 font-semibold hover:text-indigo-700 flex items-center gap-1 transition-colors">
              View all <ArrowRight size={11} />
            </Link>
          </div>
          <div className="p-5 flex flex-col gap-5 flex-1">
            {jobs.length === 0 ? (
              <p className="text-[13px] text-slate-400 text-center py-8">No job applications yet.</p>
            ) : (
              <>
                <div className="flex flex-col gap-2.5">
                  {(Object.entries(STATUS_CONFIG) as [StatusKey, (typeof STATUS_CONFIG)[StatusKey]][]).map(([key, cfg]) => (
                    <PipelineBar
                      key={key}
                      label={cfg.label}
                      count={jobCounts[key]}
                      max={maxJobCount}
                      barColor={cfg.barColor}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <StatTile
                    label="Success Rate"
                    value={successRate !== null ? `${successRate}%` : "—"}
                    sub={
                      concludedJobs > 0
                        ? `${jobCounts.offer} offer${jobCounts.offer !== 1 ? "s" : ""} / ${concludedJobs} concluded`
                        : "No concluded apps yet"
                    }
                  />
                  <StatTile
                    label="Response Rate"
                    value={responseRate !== null ? `${responseRate}%` : "—"}
                    sub={
                      jobs.length > 0
                        ? `${jobs.length - jobCounts.applied} responded`
                        : "No responses yet"
                    }
                  />
                  <StatTile
                    label="This Week"
                    value={String(jobsThisWeek)}
                    sub={jobsToday > 0 ? `${jobsToday} today` : "applied"}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Finance Panel */}
        <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign size={14} className="text-emerald-600" />
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-900">Finance</h2>
              <span className="text-xs text-slate-400">
                {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
            </div>
            <Link href="/payments" className="text-[11px] text-indigo-500 font-semibold hover:text-indigo-700 flex items-center gap-1 transition-colors">
              View all <ArrowRight size={11} />
            </Link>
          </div>
          <div className="p-5 flex flex-col gap-5 flex-1">

            {/* Total spend */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Total Spend</p>
                <p className="text-[32px] font-bold text-slate-900 tracking-tight leading-none mt-1.5">
                  {fmtAmount(expenseSummary?.total)}
                </p>
              </div>
              {expenseSummary && (
                <p className="text-xs text-slate-400 pb-1">{expenseSummary.count} expenses</p>
              )}
            </div>

            {/* Category bars */}
            {sortedCats.length === 0 ? (
              <p className="text-[13px] text-slate-400 text-center py-2">No expenses this month.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {sortedCats.slice(0, 5).map((row, i) => {
                  const name = row.category_id ? catMap.get(row.category_id) ?? "Uncategorized" : "Uncategorized";
                  const pct = Math.round((row.total / (expenseSummary?.total || 1)) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[12px] text-slate-500 w-[90px] flex-shrink-0 truncate">{name}</span>
                      <div className="flex-1 h-[6px] bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${CAT_COLORS[i % CAT_COLORS.length]} transition-all duration-700 ease-out`}
                          style={{ width: `${(row.total / maxCatAmount) * 100}%` }}
                        />
                      </div>
                      <span className="text-[12px] font-semibold text-slate-700 w-[60px] text-right flex-shrink-0">
                        {fmtAmount(row.total)}
                      </span>
                      <span className="text-[11px] text-slate-400 w-[26px] text-right flex-shrink-0">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upcoming payments */}
            {unpaidPayments.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-2.5">
                  Upcoming Payments
                </p>
                <div className="flex flex-col gap-1.5">
                  {unpaidPayments.slice(0, 3).map(p => (
                    <div key={p.id} className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          p.days_until_due < 0 ? "bg-red-400" :
                          p.days_until_due <= 3 ? "bg-amber-400" : "bg-slate-300"
                        }`} />
                        <span className="text-[13px] text-slate-700 truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-[11px] font-semibold tabular-nums ${
                          p.days_until_due < 0 ? "text-red-500" :
                          p.days_until_due <= 3 ? "text-amber-600" : "text-slate-400"
                        }`}>
                          {p.days_until_due < 0
                            ? `${Math.abs(p.days_until_due)}d overdue`
                            : p.days_until_due === 0
                              ? "Today"
                              : `in ${p.days_until_due}d`}
                        </span>
                        <span className="text-[13px] font-bold text-slate-900 tabular-nums">
                          {fmtAmount(p.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {unpaidPayments.length > 3 && (
                    <Link href="/payments" className="text-[11px] text-indigo-500 font-semibold hover:text-indigo-700 transition-colors mt-0.5 block">
                      +{unpaidPayments.length - 3} more payments →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Portfolio Panel */}
      {stocks.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-sky-600" />
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-900">Portfolio</h2>
              <span className="text-xs text-slate-400">{activeHoldings.length} holding{activeHoldings.length !== 1 ? "s" : ""}</span>
            </div>
            <Link href="/payments" className="text-[11px] text-indigo-500 font-semibold hover:text-indigo-700 flex items-center gap-1 transition-colors">
              View all <ArrowRight size={11} />
            </Link>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: summary stats */}
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Total Value</p>
                <p className="text-[32px] font-bold text-slate-900 tracking-tight leading-none mt-1.5">
                  {fmtAmount(portfolioTotalValue)}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Unrealized</p>
                  <p className={`text-sm font-bold mt-1 ${portfolioUnrealized >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {portfolioUnrealized >= 0 ? "+" : ""}{fmtAmount(portfolioUnrealized)}
                  </p>
                  {portfolioUnrealizedPct !== null && (
                    <p className={`text-[11px] mt-0.5 ${portfolioUnrealized >= 0 ? "text-emerald-500" : "text-rose-400"}`}>
                      {portfolioUnrealized >= 0 ? "+" : ""}{portfolioUnrealizedPct}%
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Realized</p>
                  <p className={`text-sm font-bold mt-1 ${portfolioRealized >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {portfolioRealized >= 0 ? "+" : ""}{fmtAmount(portfolioRealized)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Dividends</p>
                  <p className="text-sm font-bold text-indigo-600 mt-1">{fmtAmount(portfolioTotalDividends)}</p>
                </div>
              </div>
            </div>
            {/* Right: top holdings */}
            <div className="flex flex-col gap-2 justify-center">
              {topHoldings.map((h, i) => {
                const val = Number(h.shares) * Number(h.current_price);
                const pct = portfolioTotalValue > 0 ? Math.round((val / portfolioTotalValue) * 100) : 0;
                return (
                  <div key={h.ticker} className="flex items-center gap-3">
                    <span className="text-[12px] text-slate-500 w-12 flex-shrink-0 font-medium">{h.ticker}</span>
                    <div className="flex-1 h-[6px] bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${pct}%`, backgroundColor: PORTFOLIO_COLORS_HOME[i % PORTFOLIO_COLORS_HOME.length] }}
                      />
                    </div>
                    <span className="text-[12px] font-semibold text-slate-700 w-[60px] text-right flex-shrink-0">{fmtAmount(val)}</span>
                    <span className="text-[11px] text-slate-400 w-[26px] text-right flex-shrink-0">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Reminders */}
      <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-violet-600" />
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-900">Reminders</h2>
            </div>
            {overdueItems.length > 0 && (
              <span className="text-[11px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                {overdueItems.length} overdue
              </span>
            )}
            {todayItems.length > 0 && (
              <span className="text-[11px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {todayItems.length} today
              </span>
            )}
          </div>
          <Link href="/tasks" className="text-[11px] text-indigo-500 font-semibold hover:text-indigo-700 flex items-center gap-1 transition-colors flex-shrink-0">
            View all <ArrowRight size={11} />
          </Link>
        </div>

        <div className="p-5">
          {allCaughtUp ? (
            <div className="flex items-center gap-3 py-6 justify-center">
              <CheckCircle2 size={18} className="text-emerald-500" />
              <p className="text-[14px] text-slate-600 font-medium">All caught up — nothing urgent!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              {/* Overdue column */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-red-500 mb-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                  Overdue ({overdueItems.length})
                </p>
                {overdueItems.length === 0 ? (
                  <p className="text-[12px] text-slate-300 pl-3">None</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(expandedCols.has("overdue") ? overdueItems : overdueItems.slice(0, MAX_VISIBLE)).map(item => (
                      <UrgencyCard
                        key={item.id}
                        item={item}
                        onCheck={
                          item.type === "task" ? () => completeTask(item.rawId) :
                          item.type === "payment" ? () => markPaid(item.rawId) : undefined
                        }
                        checking={
                          item.type === "task" ? checkingTasks.has(item.rawId) :
                          item.type === "payment" ? checkingPayments.has(item.rawId) : false
                        }
                      />
                    ))}
                    {overdueItems.length > MAX_VISIBLE && (
                      <button
                        onClick={() => toggleCol("overdue")}
                        className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors pl-3 mt-0.5"
                      >
                        <ChevronDown size={12} className={`transition-transform duration-200 ${expandedCols.has("overdue") ? "rotate-180" : ""}`} />
                        {expandedCols.has("overdue") ? "Show less" : `${overdueItems.length - MAX_VISIBLE} more`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Today column */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-amber-600 mb-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  Due Today ({todayItems.length})
                </p>
                {todayItems.length === 0 ? (
                  <p className="text-[12px] text-slate-300 pl-3">None</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(expandedCols.has("today") ? todayItems : todayItems.slice(0, MAX_VISIBLE)).map(item => (
                      <UrgencyCard
                        key={item.id}
                        item={item}
                        onCheck={
                          item.type === "task" ? () => completeTask(item.rawId) :
                          item.type === "payment" ? () => markPaid(item.rawId) :
                          item.type === "habit" ? () => logHabit(item.rawId) : undefined
                        }
                        checking={
                          item.type === "task" ? checkingTasks.has(item.rawId) :
                          item.type === "payment" ? checkingPayments.has(item.rawId) :
                          item.type === "habit" ? checkingHabits.has(item.rawId) : false
                        }
                      />
                    ))}
                    {todayItems.length > MAX_VISIBLE && (
                      <button
                        onClick={() => toggleCol("today")}
                        className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors pl-3 mt-0.5"
                      >
                        <ChevronDown size={12} className={`transition-transform duration-200 ${expandedCols.has("today") ? "rotate-180" : ""}`} />
                        {expandedCols.has("today") ? "Show less" : `${todayItems.length - MAX_VISIBLE} more`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Upcoming column */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
                  Upcoming ({soonItems.length})
                </p>
                {soonItems.length === 0 ? (
                  <p className="text-[12px] text-slate-300 pl-3">Nothing in the next 7 days</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(expandedCols.has("soon") ? soonItems : soonItems.slice(0, MAX_VISIBLE)).map(item => (
                      <UrgencyCard
                        key={item.id}
                        item={item}
                        onCheck={
                          item.type === "task" ? () => completeTask(item.rawId) :
                          item.type === "payment" ? () => markPaid(item.rawId) : undefined
                        }
                        checking={
                          item.type === "task" ? checkingTasks.has(item.rawId) :
                          item.type === "payment" ? checkingPayments.has(item.rawId) : false
                        }
                      />
                    ))}
                    {soonItems.length > MAX_VISIBLE && (
                      <button
                        onClick={() => toggleCol("soon")}
                        className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors pl-3 mt-0.5"
                      >
                        <ChevronDown size={12} className={`transition-transform duration-200 ${expandedCols.has("soon") ? "rotate-180" : ""}`} />
                        {expandedCols.has("soon") ? "Show less" : `${soonItems.length - MAX_VISIBLE} more`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
