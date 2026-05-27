"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search, X, Loader2, Receipt, RefreshCw,
  ArrowUpRight, ArrowDownLeft, RotateCcw,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Expense, MoneyTransfer, RecurringCharge, Category, Bank, PriceHistoryEntry, CancellationPeriod } from "@/lib/types";

type SearchItem = {
  kind: "expense" | "recurring" | "transfer";
  key: string;
  date: string;
  month: string;
  name: string;
  category: string | null;
  amount: number;
  isReturn?: boolean;
  isSent?: boolean;
};

function getPriceForMonth(rc: RecurringCharge, month: string): number {
  if (!rc.price_history?.length) return Number(rc.amount);
  const monthStart = `${month}-01`;
  const applicable = rc.price_history.filter((h: PriceHistoryEntry) => h.effective_from <= monthStart);
  if (!applicable.length) {
    const earliest = rc.price_history.reduce((min: PriceHistoryEntry, h: PriceHistoryEntry) =>
      h.effective_from < min.effective_from ? h : min
    );
    return Number(earliest.amount);
  }
  return Number(applicable.reduce((latest: PriceHistoryEntry, h: PriceHistoryEntry) =>
    h.effective_from > latest.effective_from ? h : latest
  ).amount);
}

function isCanceledForMonth(rc: RecurringCharge, month: string): boolean {
  const monthStart = `${month}-01`;
  return rc.cancellation_periods.some(
    (p: CancellationPeriod) =>
      p.canceled_from <= monthStart && (p.reactivated_from === null || p.reactivated_from > monthStart)
  );
}

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [yearDataLoaded, setYearDataLoaded] = useState(false);
  const [yearDataLoading, setYearDataLoading] = useState(false);
  const [yearExpenses, setYearExpenses] = useState<Expense[]>([]);
  const [yearTransfers, setYearTransfers] = useState<MoneyTransfer[]>([]);
  const [recurringCharges, setRecurringCharges] = useState<RecurringCharge[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 50);
    if (yearDataLoaded || yearDataLoading) return;
    setYearDataLoading(true);
    const year = new Date().getFullYear();
    Promise.all([
      apiFetch(`/expenses?year=${year}`),
      apiFetch(`/money-transfers?year=${year}`),
      apiFetch("/recurring-charges"),
      apiFetch("/categories"),
      apiFetch("/banks"),
    ]).then(([exps, trans, rcs, cats, bks]) => {
      setYearExpenses(exps);
      setYearTransfers(trans);
      setRecurringCharges(rcs);
      setCategories(cats);
      setBanks(bks);
      setYearDataLoaded(true);
    }).catch(console.error).finally(() => setYearDataLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); setSearchQuery(""); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const searchYear = new Date().getFullYear();
  const searchMonthMax = new Date().getMonth() + 1;
  const allCatsMap = new Map(categories.map((c: Category) => [c.id, c.name]));
  const q = searchQuery.toLowerCase().trim();

  const rawSearchItems: SearchItem[] = [];
  if (q && yearDataLoaded) {
    for (const e of yearExpenses) {
      const catName = allCatsMap.get(e.category_id ?? -1) ?? null;
      if (
        e.name.toLowerCase().includes(q) ||
        catName?.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q)
      ) {
        rawSearchItems.push({
          kind: "expense", key: `e-${e.id}`,
          date: e.date, month: e.date.slice(0, 7),
          name: e.name, category: catName,
          amount: Number(e.amount), isReturn: Number(e.amount) < 0,
        });
      }
    }
    for (let m = 1; m <= searchMonthMax; m++) {
      const monthStr = `${searchYear}-${String(m).padStart(2, "0")}`;
      for (const rc of recurringCharges) {
        if (isCanceledForMonth(rc, monthStr)) continue;
        const catName = allCatsMap.get(rc.category_id ?? -1) ?? null;
        if (
          rc.name.toLowerCase().includes(q) ||
          catName?.toLowerCase().includes(q) ||
          rc.notes?.toLowerCase().includes(q)
        ) {
          const lastDay = new Date(searchYear, m, 0).getDate();
          const day = Math.min(rc.charge_date, lastDay);
          rawSearchItems.push({
            kind: "recurring", key: `r-${rc.id}-${monthStr}`,
            date: `${monthStr}-${String(day).padStart(2, "0")}`,
            month: monthStr, name: rc.name,
            category: catName, amount: getPriceForMonth(rc, monthStr),
          });
        }
      }
    }
    for (const t of yearTransfers) {
      const bankName = t.bank_id != null ? banks.find((b: Bank) => b.id === t.bank_id)?.name : undefined;
      if (
        t.name?.toLowerCase().includes(q) ||
        t.person.toLowerCase().includes(q) ||
        t.platform?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q) ||
        bankName?.toLowerCase().includes(q)
      ) {
        rawSearchItems.push({
          kind: "transfer", key: `t-${t.id}`,
          date: t.date, month: t.date.slice(0, 7),
          name: t.name || (t.direction === "sent" ? `Sent to ${t.person}` : `Received from ${t.person}`),
          category: [t.platform, bankName].filter(Boolean).join(" · ") || null,
          amount: Number(t.amount),
          isSent: t.direction === "sent",
        });
      }
    }
    rawSearchItems.sort((a, b) => b.date.localeCompare(a.date));
  }

  const searchGroups: { month: string; label: string; items: SearchItem[] }[] = [];
  for (const item of rawSearchItems) {
    let group = searchGroups.find((g) => g.month === item.month);
    if (!group) {
      const [y, m] = item.month.split("-").map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      group = { month: item.month, label, items: [] };
      searchGroups.push(group);
    }
    group.items.push(item);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center pt-[8vh] px-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); setSearchQuery(""); } }}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          {yearDataLoading
            ? <Loader2 size={18} className="text-slate-400 shrink-0 animate-spin" />
            : <Search size={18} className="text-slate-400 shrink-0" />}
          <input
            ref={inputRef}
            type="text"
            placeholder="Search expenses, recurring charges, transfers…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-sm outline-none bg-transparent text-slate-700 placeholder-slate-400"
          />
          <button
            onClick={() => { onClose(); setSearchQuery(""); }}
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        {q ? (
          <div className="max-h-[60vh] overflow-y-auto">
            {!yearDataLoaded ? (
              <div className="p-8 flex justify-center">
                <Loader2 size={20} className="animate-spin text-slate-400" />
              </div>
            ) : searchGroups.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-500 text-sm font-medium">No transactions found for {searchYear}</p>
              </div>
            ) : (
              searchGroups.map((group) => (
                <div key={group.month}>
                  <div className="px-4 py-2 bg-slate-50 border-b border-t border-slate-100 sticky top-0">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{group.label}</span>
                  </div>
                  {group.items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          item.kind === "expense"
                            ? item.isReturn ? "bg-emerald-50" : "bg-indigo-50"
                            : item.kind === "recurring"
                            ? "bg-violet-50"
                            : item.isSent ? "bg-red-50" : "bg-emerald-50"
                        }`}>
                          {item.kind === "expense"
                            ? item.isReturn
                              ? <RotateCcw size={13} className="text-emerald-500" />
                              : <Receipt size={13} className="text-indigo-500" />
                            : item.kind === "recurring"
                            ? <RefreshCw size={13} className="text-violet-500" />
                            : item.isSent
                            ? <ArrowUpRight size={13} className="text-red-500" />
                            : <ArrowDownLeft size={13} className="text-emerald-500" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              {formatDate(item.date)}
                            </span>
                            {item.category && (
                              <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ml-4 ${
                        item.isReturn
                          ? "text-emerald-600"
                          : item.kind === "transfer" && !item.isSent
                          ? "text-emerald-600"
                          : "text-slate-700"
                      }`}>
                        {item.isReturn ? "+" : item.kind === "transfer" ? (item.isSent ? "−" : "+") : ""}
                        {formatAmount(Math.abs(item.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="px-4 py-6 text-center">
            <p className="text-slate-400 text-sm">Type to search across all your transactions</p>
          </div>
        )}
      </div>
    </div>
  );
}
