"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2, Flame, CreditCard, Briefcase, DollarSign, Calendar,
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

// ---- Status config ----

type StatusKey = "applied" | "phone_screen" | "interview" | "offer" | "rejected";

const STATUS_CONFIG: Record<StatusKey, { label: string; color: string }> = {
  applied:      { label: "Applied",      color: "text-blue-700 bg-blue-50" },
  phone_screen: { label: "Phone Screen", color: "text-amber-700 bg-amber-50" },
  interview:    { label: "Interview",    color: "text-violet-700 bg-violet-50" },
  offer:        { label: "Offer",        color: "text-emerald-700 bg-emerald-50" },
  rejected:     { label: "Rejected",     color: "text-red-600 bg-red-50" },
};

// ---- Page ----

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [jobs, setJobs] = useState<JobApplication[]>([]);

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

  // Derived data
  const pendingTasks = tasks
    .filter(t => !t.completed)
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });

  const habitsToDoToday = habits.filter(isHabitNeededToday);

  const unpaidPayments = payments
    .filter(p => !p.is_paid)
    .sort((a, b) => a.days_until_due - b.days_until_due);

  const catMap = new Map(categories.map(c => [c.id, c.name]));

  const jobCounts = (Object.keys(STATUS_CONFIG) as StatusKey[]).reduce<Record<string, number>>(
    (acc, key) => { acc[key] = jobs.filter(j => j.status === key).length; return acc; },
    {}
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Analytics row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Expenses panel */}
        <Panel
          icon={<DollarSign size={15} className="text-emerald-600" />}
          title="Expenses"
          label={new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          aside={<span className="text-lg font-bold text-slate-900">{fmtAmount(expenseSummary?.total)}</span>}
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
                      <td className="py-2 text-slate-700">
                        {row.category_id ? catMap.get(row.category_id) ?? "Uncategorized" : "Uncategorized"}
                      </td>
                      <td className="py-2 text-right font-semibold text-slate-900">{fmtAmount(row.total)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </Panel>

        {/* Jobs pipeline panel */}
        <Panel
          icon={<Briefcase size={15} className="text-indigo-600" />}
          title="Job Pipeline"
          aside={<span className="text-xs text-slate-500 font-medium">{jobs.length} total</span>}
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
                      <td className="py-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="py-2 text-right font-semibold text-slate-900">{jobCounts[key]}</td>
                      <td className="py-2 text-right text-slate-400">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pending Tasks */}
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
              {pendingTasks.map(task => (
                <li key={task.id} className="py-3 flex items-start gap-3">
                  <CheckCircle2 size={15} className="text-slate-200 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{task.name}</p>
                    {task.due_date && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <Calendar size={10} />{fmtDate(task.due_date)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Habits Today */}
        <Panel
          icon={<Flame size={15} className="text-orange-500" />}
          title="Habits Today"
          badge={habitsToDoToday.length}
          badgeColor="bg-orange-100 text-orange-700"
        >
          {habitsToDoToday.length === 0 ? (
            <Empty message="All habits done for today!" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {habitsToDoToday.map(habit => (
                <li key={habit.id} className="py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">{habit.name}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md">
                    <Flame size={11} />{habit.streak ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Upcoming Payments */}
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
              {unpaidPayments.map(payment => (
                <li key={payment.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{payment.name}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 block ${
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
                  <span className="text-sm font-bold text-slate-900 flex-shrink-0">{fmtAmount(payment.amount)}</span>
                </li>
              ))}
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{title}</h2>
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
  return <p className="text-sm text-slate-400 text-center py-6">{message}</p>;
}
