"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Clock, Calendar, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { WorkLogEntry, Category, Company } from "@/lib/types";
import AddWorkLogModal from "@/components/AddWorkLogModal";
import EditWorkLogModal from "@/components/EditWorkLogModal";

// ── helpers ──────────────────────────────────────────────────────────────────

function dateToStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const PALETTE = ["#6366f1", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#14b8a6", "#f97316"];
function isLunch(cat: string) { return cat.toLowerCase() === "lunch"; }
function categoryColor(cat: string): string {
  if (isLunch(cat)) return "#a78bfa"; // violet — cool, distinct, won't visually pop like warm colors
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) & 0x7fffffff;
  return PALETTE[h % PALETTE.length];
}

// Workday bounds: 8:30 AM – 5:30 PM
const WORKDAY_START = 510;  // 8*60+30
const WORKDAY_END   = 1050; // 17*60+30

// If end < start it's likely an AM/PM entry error (e.g. "01:03" meaning 1:03 PM).
// Adding 12h recovers the intended time when the result lands after start.
function effectiveEndMins(start: string, end: string): number {
  const s = timeToMins(start);
  const e = timeToMins(end);
  if (e < s && e + 720 > s) return e + 720;
  return e;
}

// Total logged minutes excluding lunch (unpaid)
function workMins(entries: WorkLogEntry[]): number {
  return entries.reduce((sum, e) => {
    if (isLunch(e.category)) return sum;
    const m = effectiveEndMins(e.start_time, e.end_time) - timeToMins(e.start_time);
    return sum + (m > 0 ? m : 0);
  }, 0);
}

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = dateToStr(new Date());
  const yesterday = dateToStr(new Date(Date.now() - 86_400_000));
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function formatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDuration(start: string, end: string) {
  const mins = effectiveEndMins(start, end) - timeToMins(start);
  return mins > 0 ? formatMins(mins) : null;
}

function totalMins(entries: WorkLogEntry[]): number {
  return entries.reduce((sum, e) => {
    const m = timeToMins(e.end_time) - timeToMins(e.start_time);
    return sum + (m > 0 ? m : 0);
  }, 0);
}

// 9h day (8:30–5:30) minus 1h unpaid lunch = 8h accountable
const TARGET_MINS = 8 * 60;

// ── calendar constants ────────────────────────────────────────────────────────

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ── WorkLogCalendar ───────────────────────────────────────────────────────────

function WorkLogCalendar({
  currentDate,
  dayTotals,
  onSelectDate,
  onFetchDates,
}: {
  currentDate: string;
  dayTotals: Record<string, number>;
  onSelectDate: (d: string) => void;
  onFetchDates: (dates: string[]) => void;
}) {
  const today = dateToStr(new Date());
  const now = new Date();

  function getSunday(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() - d.getDay());
    return dateToStr(d);
  }

  const [weekSunday, setWeekSunday] = useState(() => getSunday(currentDate));
  const [expanded, setExpanded] = useState(false);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  function cellStyle(dateStr: string) {
    const isFuture = dateStr > today;
    if (isFuture) return { bg: "bg-white/[0.03] border-transparent", text: "text-slate-700" };
    const mins = dayTotals[dateStr];
    if (!mins) return { bg: "bg-white/[0.05] border-white/[0.05]", text: "text-slate-400" };
    if (mins < 240) return { bg: "bg-indigo-500/20 border-indigo-500/20", text: "text-indigo-400" };
    if (mins < 360) return { bg: "bg-indigo-500/40 border-transparent", text: "text-indigo-300" };
    return { bg: "bg-indigo-500 border-transparent", text: "text-white" };
  }

  // Fetch missing dates for a given list
  function needDates(dates: string[]) {
    const missing = dates.filter((d) => d <= today && dayTotals[d] === undefined);
    if (missing.length > 0) onFetchDates(missing);
  }

  // Week strip
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekSunday + "T00:00:00");
    d.setDate(d.getDate() + i);
    return dateToStr(d);
  });

  // Fetch initial week on mount and whenever week changes
  useEffect(() => { needDates(weekDays); }, [weekSunday]); // eslint-disable-line react-hooks/exhaustive-deps

  const wFirst = new Date(weekDays[0] + "T00:00:00");
  const wLast = new Date(weekDays[6] + "T00:00:00");
  const weekLabel =
    wFirst.getMonth() === wLast.getMonth()
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
    if (dateToStr(d) <= getSunday(today) + "z") setWeekSunday(dateToStr(d));
  }

  function handleExpand() {
    const ref = new Date(weekSunday + "T00:00:00");
    setViewYear(ref.getFullYear());
    setViewMonth(ref.getMonth());
    setExpanded(true);
    fetchMonthDates(ref.getFullYear(), ref.getMonth());
  }

  // Month grid
  function fetchMonthDates(year: number, month: number) {
    const days = new Date(year, month + 1, 0).getDate();
    const dates: string[] = [];
    for (let d = 1; d <= days; d++) {
      dates.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    needDates(dates);
  }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  function prevMonth() {
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    setViewYear(y); setViewMonth(m);
    fetchMonthDates(y, m);
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    setViewYear(y); setViewMonth(m);
    fetchMonthDates(y, m);
  }
  function handleMonthDayClick(dateStr: string) {
    if (dateStr > today) return;
    onSelectDate(dateStr);
    setWeekSunday(getSunday(dateStr));
    setExpanded(false);
  }

  // ── week view ──
  if (!expanded) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-0.5">
            <button onClick={prevWeek} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.07] transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-semibold text-slate-300 px-2 tabular-nums">{weekLabel}</span>
            <button onClick={nextWeek} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.07] transition-colors">
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
            const isSelected = dateStr === currentDate;
            const isFuture = dateStr > today;
            const { bg, text } = cellStyle(dateStr);
            const d = new Date(dateStr + "T00:00:00");
            const mins = dayTotals[dateStr];
            return (
              <button
                key={dateStr}
                disabled={isFuture}
                onClick={() => !isFuture && onSelectDate(dateStr)}
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
                <span className="text-[9px] leading-none h-3 tabular-nums">
                  {mins ? formatMins(mins) : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── month view ──
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-200">{MONTH_NAMES[viewMonth]} {viewYear}</h2>
          {!isCurrentMonth && (
            <button
              onClick={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); fetchMonthDates(now.getFullYear(), now.getMonth()); }}
              className="px-2 py-0.5 text-[10px] font-semibold text-indigo-400 bg-indigo-500/15 border border-indigo-500/25 rounded-full hover:bg-indigo-500/25 transition-colors"
            >
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={prevMonth} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.07] transition-colors">
            <ChevronLeft size={14} />
          </button>
          <button onClick={nextMonth} disabled={isCurrentMonth} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.07] transition-colors disabled:opacity-25">
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
          if (!dateStr) return <div key={i} className="h-9" />;
          const isToday = dateStr === today;
          const isSelected = dateStr === currentDate;
          const isFuture = dateStr > today;
          const { bg, text } = cellStyle(dateStr);
          const day = parseInt(dateStr.split("-")[2]);
          const mins = dayTotals[dateStr];
          return (
            <button
              key={dateStr}
              disabled={isFuture}
              onClick={() => handleMonthDayClick(dateStr)}
              className={`h-9 w-full rounded-md flex flex-col items-center justify-center border transition-all
                ${bg} ${text}
                ${isSelected ? "ring-2 ring-indigo-400 ring-offset-1 ring-offset-[#1e2245]" : ""}
                ${isToday && !isSelected ? "ring-1 ring-indigo-500/50" : ""}
                ${isFuture ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:brightness-125 active:scale-95"}
                ${isToday ? "font-bold" : "font-medium"}
              `}
            >
              <span className={`text-[11px] leading-none ${isToday ? "font-bold text-indigo-300" : "font-medium"}`}>{day}</span>
              {mins ? <span className="text-[8px] leading-none mt-0.5 tabular-nums opacity-80">{formatMins(mins)}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="text-[10px] text-slate-600">Less</span>
        {["bg-white/[0.05]", "bg-indigo-500/20", "bg-indigo-500/40", "bg-indigo-500"].map((c, idx) => (
          <span key={idx} className={`w-2.5 h-2.5 rounded-sm ${c}`} />
        ))}
        <span className="text-[10px] text-slate-600">More</span>
      </div>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function WorkLogPage() {
  const [currentDate, setCurrentDate] = useState(dateToStr(new Date()));
  const [entries, setEntries] = useState<WorkLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkLogEntry | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dayTotals, setDayTotals] = useState<Record<string, number>>({});
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [addingCompany, setAddingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    apiFetch("/categories?type=work_log")
      .then((data) => setCategories(data ?? []))
      .catch(console.error);
    apiFetch("/companies")
      .then((data: Company[]) => {
        setCompanies(data ?? []);
        if (data?.length > 0) setSelectedCompanyId(data[0].id);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedCompanyId === null) return;
    setLoading(true);
    apiFetch(`/work-log?date=${currentDate}&company_id=${selectedCompanyId}`)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentDate, selectedCompanyId]);

  // Reset calendar totals when switching companies
  useEffect(() => {
    setDayTotals({});
  }, [selectedCompanyId]);

  // Keep current day's work total (lunch excluded) in sync with live entries
  useEffect(() => {
    setDayTotals((prev) => ({ ...prev, [currentDate]: workMins(entries) }));
  }, [entries, currentDate]);

  async function fetchDateTotals(dates: string[]) {
    if (selectedCompanyId === null) return;
    try {
      const results = await Promise.all(
        dates.map((d) =>
          apiFetch(`/work-log?date=${d}&company_id=${selectedCompanyId}`).then((data: WorkLogEntry[]) => ({
            date: d,
            mins: workMins(data),
          }))
        )
      );
      setDayTotals((prev) => {
        const next = { ...prev };
        results.forEach(({ date, mins }) => { next[date] = mins; });
        return next;
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAddCategory(name: string): Promise<Category> {
    const created: Category = await apiFetch("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: "work_log" }),
    });
    setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }

  async function handleDeleteCategory(id: number) {
    await apiFetch(`/categories/${id}`, { method: "DELETE" });
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleCreateCompany() {
    const name = newCompanyName.trim();
    if (!name) return;
    setCompanyError(null);
    try {
      const created: Company = await apiFetch("/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setCompanies((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCompanyId(created.id);
      setNewCompanyName("");
      setAddingCompany(false);
    } catch {
      setCompanyError("Company already exists or could not be saved.");
    }
  }

  async function handleDeleteCompany(id: number) {
    setDeleteError(null);
    try {
      await apiFetch(`/companies/${id}`, { method: "DELETE" });
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      if (selectedCompanyId === id) {
        const remaining = companies.filter((c) => c.id !== id);
        setSelectedCompanyId(remaining[0]?.id ?? null);
      }
    } catch {
      setDeleteError("Cannot delete a company that has work log entries.");
    }
  }

  const work = workMins(entries);
  const unaccounted = Math.max(0, TARGET_MINS - work);

  const catTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      const m = effectiveEndMins(e.start_time, e.end_time) - timeToMins(e.start_time);
      if (m > 0) map[e.category] = (map[e.category] ?? 0) + m;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  // Flat sorted list of segments (entries + unaccounted gaps) clipped to the workday
  const timelineSegments = useMemo(() => {
    const SPAN = WORKDAY_END - WORKDAY_START;
    const entrySegs = entries
      .map((e) => ({
        start: Math.max(timeToMins(e.start_time), WORKDAY_START),
        end:   Math.min(effectiveEndMins(e.start_time, e.end_time), WORKDAY_END),
        color: categoryColor(e.category),
        label: `${e.category}: ${formatTime(e.start_time)} – ${formatTime(e.end_time)}`,
      }))
      .filter((s) => s.end > s.start);

    const sorted = [...entrySegs].sort((a, b) => a.start - b.start);
    const all: { widthPct: number; color: string; label: string }[] = [];
    let cursor = WORKDAY_START;

    for (const seg of sorted) {
      if (seg.start > cursor) {
        all.push({ widthPct: ((seg.start - cursor) / SPAN) * 100, color: "rgba(100,116,139,0.35)", label: "Unaccounted" });
      }
      all.push({ widthPct: ((seg.end - seg.start) / SPAN) * 100, color: seg.color, label: seg.label });
      cursor = Math.max(cursor, seg.end);
    }
    if (cursor < WORKDAY_END) {
      all.push({ widthPct: ((WORKDAY_END - cursor) / SPAN) * 100, color: "rgba(100,116,139,0.35)", label: "Unaccounted" });
    }

    return all;
  }, [entries]);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex gap-4 items-start">
        {/* Company sidebar */}
        <div
          className="shrink-0 transition-all duration-200 ease-in-out"
          style={{ width: sidebarOpen ? "176px" : "32px" }}
        >
          <div className="bg-[#1e2245] border border-white/[0.07] rounded-2xl overflow-hidden">
            {sidebarOpen ? (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Companies</p>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="text-slate-600 hover:text-slate-300 hover:bg-white/[0.07] p-1 rounded-md transition-colors"
                  >
                    <ChevronLeft size={13} />
                  </button>
                </div>

                <div className="py-1.5">
                  {companies.map((c) => (
                    <div key={c.id} className="relative group mx-1.5">
                      <button
                        onClick={() => { setSelectedCompanyId(c.id); setDeleteError(null); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors pr-7 ${
                          selectedCompanyId === c.id
                            ? "bg-indigo-500/20 text-indigo-300"
                            : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
                        }`}
                      >
                        <span className="block truncate">{c.name}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteCompany(c.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-0.5 rounded"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="px-3 pb-3 pt-1 border-t border-white/[0.06] mt-1">
                  {addingCompany ? (
                    <div className="space-y-1.5 pt-2">
                      <input
                        autoFocus
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateCompany();
                          if (e.key === "Escape") { setAddingCompany(false); setNewCompanyName(""); setCompanyError(null); }
                        }}
                        placeholder="Company name"
                        className="w-full bg-[#14162e] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                      {companyError && <p className="text-[10px] text-red-400">{companyError}</p>}
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleCreateCompany}
                          className="flex-1 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-500 transition-colors font-medium"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setAddingCompany(false); setNewCompanyName(""); setCompanyError(null); }}
                          className="px-2 py-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingCompany(true)}
                      className="flex items-center gap-1.5 w-full px-1 py-2 text-xs text-slate-500 hover:text-indigo-400 transition-colors font-medium"
                    >
                      <Plus size={12} />
                      Add company
                    </button>
                  )}
                </div>

                {deleteError && (
                  <div className="px-3 pb-3">
                    <p className="text-[10px] text-red-400 leading-relaxed">{deleteError}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center py-3 gap-2">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="text-slate-600 hover:text-slate-300 hover:bg-white/[0.07] p-1.5 rounded-md transition-colors"
                  title="Show companies"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white tracking-tight">Work Log</h1>
          </div>

          {/* Calendar */}
          <div className="mb-5 bg-[#1e2245] border border-white/[0.07] rounded-2xl px-4 py-4">
            <WorkLogCalendar
              currentDate={currentDate}
              dayTotals={dayTotals}
              onSelectDate={setCurrentDate}
              onFetchDates={fetchDateTotals}
            />
          </div>

          {/* Entries card */}
          <div className="bg-[#1e2245] border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">{formatDisplayDate(currentDate)}</h2>
                {work > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{formatMins(work)} logged</p>
                )}
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                disabled={selectedCompanyId === null}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={14} />
                Add Entry
              </button>
            </div>

            {/* Timeline bar */}
            {!loading && entries.length > 0 && (
              <div className="px-5 pt-3 pb-2 border-b border-white/[0.06]">
                <div
                  className="flex h-5 rounded-md overflow-hidden"
                  style={{ gap: "1px", backgroundColor: "#0d0f1f" }}
                >
                  {timelineSegments.map((seg, i) => (
                    <div
                      key={i}
                      title={seg.label}
                      style={{ flex: `${seg.widthPct} 0 0`, backgroundColor: seg.color }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-600 tabular-nums">8:30 AM</span>
                  <span className="text-[10px] text-slate-600 tabular-nums">5:30 PM</span>
                </div>
              </div>
            )}

            {/* Entry list */}
            {loading ? (
              <div className="px-5 py-12 text-center">
                <div className="w-5 h-5 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin mx-auto" />
              </div>
            ) : entries.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                  <Clock size={20} className="text-slate-600" />
                </div>
                <p className="text-sm text-slate-400 font-medium">No entries for this day</p>
                <p className="text-xs text-slate-600 mt-1">Click &quot;Add Entry&quot; to log a work block.</p>
              </div>
            ) : (
              <ul>
                {entries.map((entry, idx) => {
                  const duration = formatDuration(entry.start_time, entry.end_time);
                  const color = categoryColor(entry.category);
                  return (
                    <li
                      key={entry.id}
                      onClick={() => setEditingEntry(entry)}
                      className={`flex items-start gap-4 px-5 py-4 hover:bg-white/[0.04] cursor-pointer transition-colors ${
                        idx < entries.length - 1 ? "border-b border-white/[0.05]" : ""
                      }`}
                    >
                      <div className="shrink-0 text-right w-[4.5rem] pt-0.5">
                        <p className="text-xs font-semibold text-slate-300 tabular-nums leading-snug">
                          {formatTime(entry.start_time)}
                        </p>
                        <p className="text-xs text-slate-600 tabular-nums leading-snug">
                          {formatTime(entry.end_time)}
                        </p>
                        {duration && (
                          <p className="text-[10px] mt-1 font-medium tabular-nums" style={{ color }}>
                            {duration}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 flex flex-col items-center pt-1 self-stretch">
                        <div className="w-0.5 flex-1 rounded-full opacity-60" style={{ backgroundColor: color }} />
                      </div>

                      <div className="flex-1 min-w-0 pt-0.5">
                        <span
                          className="inline-block text-xs font-semibold px-2 py-0.5 rounded-md mb-2"
                          style={{ backgroundColor: `${color}28`, color }}
                        >
                          {entry.category}
                        </span>
                        {entry.description && (
                          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                            {entry.description}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Category summary + unaccounted footer */}
            {(catTotals.length > 0 || work > 0) && (
              <div className="px-5 py-3 border-t border-white/[0.06] flex flex-wrap gap-x-5 gap-y-1.5">
                {catTotals.map(([cat, mins]) => (
                  <div key={cat} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColor(cat) }} />
                    <span className="text-xs text-slate-400">{cat}</span>
                    <span className="text-xs text-slate-600 tabular-nums">{formatMins(mins)}</span>
                  </div>
                ))}
                {unaccounted > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-slate-700" />
                    <span className="text-xs text-slate-500">Unaccounted</span>
                    <span className="text-xs text-slate-600 tabular-nums">{formatMins(unaccounted)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && selectedCompanyId !== null && (
        <AddWorkLogModal
          date={currentDate}
          companyId={selectedCompanyId}
          categories={categories}
          onAddCategory={handleAddCategory}
          onDeleteCategory={handleDeleteCategory}
          onCreated={(entry) => {
            setEntries((prev) =>
              [...prev, entry].sort((a, b) => a.start_time.localeCompare(b.start_time))
            );
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editingEntry && (
        <EditWorkLogModal
          entry={editingEntry}
          categories={categories}
          onAddCategory={handleAddCategory}
          onDeleteCategory={handleDeleteCategory}
          onSaved={(updated) => {
            setEntries((prev) =>
              prev
                .map((e) => (e.id === updated.id ? updated : e))
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
            );
            setEditingEntry(null);
          }}
          onDeleted={(id) => {
            setEntries((prev) => prev.filter((e) => e.id !== id));
            setEditingEntry(null);
          }}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}
