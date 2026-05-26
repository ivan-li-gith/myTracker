"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  CreditCard as CreditCardIcon, Receipt, MoreHorizontal,
  CheckCircle2, Plus, X, ChevronLeft, ChevronRight, Pencil, Trash2,
  ScanLine, Upload, Loader2, Users, ChevronDown,
  TrendingDown, Wallet, Tag, RefreshCw, DollarSign, ArrowDownLeft, ArrowUpRight, Send, RotateCcw, Search, Zap, GraduationCap, AlertCircle, Bell,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Expense, Category, CreditCard, RecurringCharge, PriceHistoryEntry, CancellationPeriod, MoneyTransfer, Bank, Person, UtilityBill, UtilityBillPriceHistoryEntry, UtilityReimbursement, Loan, CreditCardReminder } from "@/lib/types";

// ---- Price history helper ----

function getPriceForMonth(rc: RecurringCharge, month: string): number {
  if (!rc.price_history?.length) return Number(rc.amount);
  const monthStart = `${month}-01`;
  const applicable = rc.price_history.filter((h) => h.effective_from <= monthStart);
  if (!applicable.length) {
    // Month predates all history entries — use the earliest recorded price.
    const earliest = rc.price_history.reduce((min, h) => h.effective_from < min.effective_from ? h : min);
    return Number(earliest.amount);
  }
  return Number(applicable.reduce((latest, h) => h.effective_from > latest.effective_from ? h : latest).amount);
}

function getUtilBillPriceForMonth(bill: UtilityBill, month: string): number {
  if (!bill.price_history?.length) return Number(bill.amount);
  const monthStart = `${month}-01`;
  const applicable = bill.price_history.filter((h) => h.effective_from <= monthStart);
  if (!applicable.length) {
    return Number(bill.price_history.reduce((min, h) => h.effective_from < min.effective_from ? h : min).amount);
  }
  return Number(applicable.reduce((latest, h) => h.effective_from > latest.effective_from ? h : latest).amount);
}

function isCanceledForMonth(rc: RecurringCharge, month: string): boolean {
  const monthStart = `${month}-01`;
  return rc.cancellation_periods.some(
    (p) => p.canceled_from <= monthStart && (p.reactivated_from === null || p.reactivated_from > monthStart)
  );
}

function formatPriceRange(entry: PriceHistoryEntry, nextEntry: PriceHistoryEntry | null): string {
  if (entry.effective_from === "2000-01-01") {
    if (!nextEntry) return "Current";
    const [ny, nm] = nextEntry.effective_from.split("-").map(Number);
    const end = new Date(ny, nm - 2, 1);
    return `Until ${end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
  }
  const [sy, sm] = entry.effective_from.split("-").map(Number);
  const start = new Date(sy, sm - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  if (!nextEntry) return "Current";
  const [ny, nm] = nextEntry.effective_from.split("-").map(Number);
  const end = new Date(ny, nm - 2, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return `${start} – ${end}`;
}

// ---- Helpers ----

function fmtAmount(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: -1 | 1) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---- Row menu ----

function RowMenu({ onEdit, onDelete, onLogPrice, onToggleCancel, isCanceled, onReturn }: {
  onEdit: () => void;
  onDelete: () => void;
  onLogPrice?: () => void;
  onToggleCancel?: () => void;
  isCanceled?: boolean;
  onReturn?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        (!dropRef.current || !dropRef.current.contains(e.target as Node))
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  }

  return (
    <div>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && createPortal(
        <div
          ref={dropRef}
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-32 text-sm"
          style={{ top: pos.top, right: pos.right }}
        >
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pencil size={14} /> Edit
          </button>
          {onReturn && (
            <button
              onClick={() => { setOpen(false); onReturn(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <RotateCcw size={14} /> Return
            </button>
          )}
          {onLogPrice && (
            <button
              onClick={() => { setOpen(false); onLogPrice(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-violet-600 hover:bg-violet-50 transition-colors"
            >
              <DollarSign size={14} /> Inc price
            </button>
          )}
          {onToggleCancel && (
            <button
              onClick={() => { setOpen(false); onToggleCancel(); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors ${isCanceled ? "text-emerald-600 hover:bg-emerald-50" : "text-amber-600 hover:bg-amber-50"}`}
            >
              {isCanceled ? <><RefreshCw size={14} /> Reactivate</> : <><X size={14} /> Cancel</>}
            </button>
          )}
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

// ---- Finance Summary ----

const BAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-sky-500", "bg-emerald-500",
  "bg-amber-500", "bg-rose-500", "bg-pink-500", "bg-cyan-500",
];

const CARD_COLOR_MAP: Record<string, string> = {
  slate: "#64748b", blue: "#3b82f6", violet: "#8b5cf6",
  emerald: "#10b981", amber: "#f59e0b", rose: "#f43f5e",
  sky: "#0ea5e9", pink: "#ec4899",
};

function resolveCardColor(color: string | null, idx: number): string {
  if (color && CARD_COLOR_MAP[color]) return CARD_COLOR_MAP[color];
  const fallbacks = Object.values(CARD_COLOR_MAP);
  return fallbacks[idx % fallbacks.length];
}

function FinanceSummary({
  expenses,
  categories,
  creditCards,
  month,
  recurringCharges,
  moneyTransfers,
  loans,
}: {
  expenses: Expense[];
  categories: Category[];
  creditCards: CreditCard[];
  month: string;
  recurringCharges: RecurringCharge[];
  moneyTransfers: MoneyTransfer[];
  loans: Loan[];
}) {
  const grossSpend = expenses.reduce((s, e) => Number(e.amount) > 0 ? s + Number(e.amount) : s, 0);
  const refunds = expenses.reduce((s, e) => Number(e.amount) < 0 ? s + Math.abs(Number(e.amount)) : s, 0);
  const netSpend = grossSpend - refunds;
  const positiveCount = expenses.filter((e) => Number(e.amount) > 0).length;
  const refundCount = expenses.filter((e) => Number(e.amount) < 0).length;
  const transfersTotal = moneyTransfers.reduce((s, t) => s + (t.direction === "sent" ? 1 : -1) * Number(t.amount), 0);
  const transferCount = moneyTransfers.length;

  const today = new Date();
  const todayMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const todayDay = today.getDate();

  const applicableRecurring = recurringCharges.filter((c) => {
    if (isCanceledForMonth(c, month)) return false;
    if (month < todayMonthStr) return true;
    if (month > todayMonthStr) return false;
    return todayDay >= c.charge_date;
  });
  const recurringTotal = applicableRecurring.reduce((s, c) => s + getPriceForMonth(c, month), 0);
  const grandTotal = netSpend + recurringTotal + transfersTotal;

  const catTotals = new Map<number | null, number>();
  for (const e of expenses) {
    const amt = Number(e.amount);
    if (amt > 0) catTotals.set(e.category_id, (catTotals.get(e.category_id) ?? 0) + amt);
  }
  for (const rc of applicableRecurring) {
    const amt = getPriceForMonth(rc, month);
    catTotals.set(rc.category_id, (catTotals.get(rc.category_id) ?? 0) + amt);
  }
  const catGrossTotal = Array.from(catTotals.values()).reduce((s, v) => s + v, 0);
  const catBreakdown = Array.from(catTotals.entries())
    .map(([id, total], i) => ({
      name: id != null ? (categories.find((c) => c.id === id)?.name ?? "Unknown") : "Uncategorized",
      total,
      pct: catGrossTotal > 0 ? (total / catGrossTotal) * 100 : 0,
      color: BAR_COLORS[i % BAR_COLORS.length],
    }))
    .sort((a, b) => b.total - a.total);

  const cardTotals = new Map<number | null, number>();
  for (const e of expenses) {
    const amt = Number(e.amount);
    if (amt > 0) cardTotals.set(e.credit_card_id, (cardTotals.get(e.credit_card_id) ?? 0) + amt);
  }
  for (const rc of applicableRecurring) {
    const amt = getPriceForMonth(rc, month);
    cardTotals.set(rc.credit_card_id, (cardTotals.get(rc.credit_card_id) ?? 0) + amt);
  }
  const cardGrossTotal = Array.from(cardTotals.values()).reduce((s, v) => s + v, 0);
  const cardBreakdown = Array.from(cardTotals.entries())
    .map(([id, total], i) => {
      const card = creditCards.find((c) => c.id === id);
      return {
        name: card ? `${card.name}${card.last_four ? ` ····${card.last_four}` : ""}` : "No card",
        total,
        pct: cardGrossTotal > 0 ? (total / cardGrossTotal) * 100 : 0,
        color: resolveCardColor(card?.color ?? null, i),
      };
    })
    .sort((a, b) => b.total - a.total);

  const [y, m] = month.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long" });

  const showBreakdowns = catBreakdown.length > 0 || cardBreakdown.length > 0;

  const TOP_N = 5;
  const [showAllCats, setShowAllCats] = useState(false);
  const [showAllCards, setShowAllCards] = useState(false);

  return (
    <div className="mb-6 flex flex-col gap-3">
      {/* Hero + mini-stats bar */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-stretch divide-x divide-slate-100">
          {/* Hero: Total */}
          <div className="px-5 py-3 shrink-0 flex flex-col justify-center min-w-[140px]">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Total</p>
            <p className="text-2xl font-bold text-slate-900 leading-none">{fmtAmount(grandTotal)}</p>
            <p className="text-[10px] text-slate-400 mt-1">one-time + recurring + transfers</p>
          </div>

          {/* Mini stats */}
          <div className="flex-1 flex flex-wrap items-center gap-x-5 gap-y-0.5 px-5 py-3">
            {/* One-time */}
            <div className="flex items-baseline gap-1.5">
              <Wallet size={11} className="text-indigo-400 shrink-0 self-center" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">One-time</span>
              <span className="text-sm font-bold text-slate-800">{fmtAmount(netSpend)}</span>
              {positiveCount > 0 && <span className="text-[10px] text-slate-400">{positiveCount} exp.</span>}
            </div>

            {/* Recurring */}
            <div className="flex items-baseline gap-1.5">
              <RefreshCw size={11} className="text-violet-400 shrink-0 self-center" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Recurring</span>
              <span className="text-sm font-bold text-slate-800">{fmtAmount(recurringTotal)}</span>
              {applicableRecurring.length > 0 && <span className="text-[10px] text-slate-400">{applicableRecurring.length} charges</span>}
            </div>

            {/* Transfers */}
            <div className="flex items-baseline gap-1.5">
              <Send size={11} className="text-violet-400 shrink-0 self-center" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Transfers</span>
              <span className={`text-sm font-bold ${transfersTotal < 0 ? "text-emerald-600" : "text-slate-800"}`}>{fmtAmount(transfersTotal)}</span>
              {transferCount > 0 && <span className="text-[10px] text-slate-400">{transferCount} this month</span>}
            </div>

            {/* Transactions */}
            <div className="flex items-baseline gap-1.5">
              <Receipt size={11} className="text-indigo-400 shrink-0 self-center" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Txns</span>
              <span className="text-sm font-bold text-slate-800">{expenses.length}</span>
              {positiveCount > 0 && <span className="text-[10px] text-slate-400">avg {fmtAmount(grossSpend / positiveCount)}</span>}
            </div>

            {/* Refunds */}
            {refundCount > 0 && (
              <div className="flex items-baseline gap-1.5">
                <RotateCcw size={11} className="text-emerald-500 shrink-0 self-center" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Refunds</span>
                <span className="text-sm font-bold text-emerald-600">{fmtAmount(refunds)}</span>
                <span className="text-[10px] text-slate-400">{refundCount} item{refundCount !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        </div>

        {/* Loan strip — only shown if loans exist */}
        {loans.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-0.5 px-5 py-2 border-t border-slate-100 bg-slate-50/70">
            <div className="flex items-baseline gap-1.5">
              <GraduationCap size={11} className="text-slate-400 shrink-0 self-center" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Loan Balance</span>
              <span className="text-sm font-bold text-slate-800">
                {fmtAmount(loans.reduce((s, l) => s + Number(l.unpaid_principal) + Number(l.unpaid_interest), 0))}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <TrendingDown size={11} className="text-indigo-400 shrink-0 self-center" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Principal</span>
              <span className="text-sm font-bold text-slate-800">
                {fmtAmount(loans.reduce((s, l) => s + Number(l.unpaid_principal), 0))}
              </span>
              <span className="text-[10px] text-slate-400">{loans.length} loan{loans.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <AlertCircle size={11} className="text-amber-400 shrink-0 self-center" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Interest</span>
              <span className="text-sm font-bold text-slate-800">
                {fmtAmount(loans.reduce((s, l) => s + Number(l.unpaid_interest), 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {showBreakdowns && (
        <div className={`grid gap-4 ${catBreakdown.length > 0 && cardBreakdown.length > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
          {catBreakdown.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Tag size={14} className="text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">By Category</h3>
              </div>
              <div className="flex flex-col gap-3">
                {(showAllCats ? catBreakdown : catBreakdown.slice(0, TOP_N)).map((cat) => (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate mr-2">{cat.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400 font-medium">{cat.pct.toFixed(0)}%</span>
                        <span className="text-sm font-semibold text-slate-800">{fmtAmount(cat.total)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${cat.color}`} style={{ width: `${cat.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {catBreakdown.length > TOP_N && (
                <button
                  onClick={() => setShowAllCats((v) => !v)}
                  className="mt-3 text-xs text-slate-400 hover:text-slate-600 font-medium flex items-center gap-1 transition-colors"
                >
                  <ChevronDown size={13} className={`transition-transform ${showAllCats ? "rotate-180" : ""}`} />
                  {showAllCats ? "Show less" : `${catBreakdown.length - TOP_N} more`}
                </button>
              )}
            </div>
          )}

          {cardBreakdown.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <CreditCardIcon size={14} className="text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">By Credit Card</h3>
              </div>
              <div className="flex flex-col gap-3">
                {(showAllCards ? cardBreakdown : cardBreakdown.slice(0, TOP_N)).map((card) => (
                  <div key={card.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate mr-2">{card.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400 font-medium">{card.pct.toFixed(0)}%</span>
                        <span className="text-sm font-semibold text-slate-800">{fmtAmount(card.total)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${card.pct}%`, backgroundColor: card.color }} />
                    </div>
                  </div>
                ))}
              </div>
              {cardBreakdown.length > TOP_N && (
                <button
                  onClick={() => setShowAllCards((v) => !v)}
                  className="mt-3 text-xs text-slate-400 hover:text-slate-600 font-medium flex items-center gap-1 transition-colors"
                >
                  <ChevronDown size={13} className={`transition-transform ${showAllCards ? "rotate-180" : ""}`} />
                  {showAllCards ? "Show less" : `${cardBreakdown.length - TOP_N} more`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Receipt Scanner ----

type ScannedRow = { name: string; amount: string; date: string; category_id: string; notes: string };

function ScanModal({
  onClose,
  onSave,
  expenseCategories,
  creditCards,
}: {
  onClose: () => void;
  onSave: (rows: ScannedRow[], creditCardId: string) => Promise<void>;
  expenseCategories: Category[];
  creditCards: CreditCard[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<ScannedRow[] | null>(null);
  const [creditCardId, setCreditCardId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
  }, []);

  async function scan() {
    if (!files.length) return;
    setScanning(true);
    setError(null);
    try {
      const results = await Promise.all(
        files.map((file) => {
          const form = new FormData();
          form.append("file", file);
          return apiFetch("/scan/receipt", { method: "POST", body: form });
        })
      );
      const all = results.flatMap((r) =>
        (r.transactions ?? []).map((t: { name: string; amount: number; date: string }) => ({
          name: t.name,
          amount: String(t.amount),
          date: t.date,
          category_id: "",
          notes: "",
        }))
      );
      if (!all.length) {
        setError("No transactions found in any of the files. Try clearer images.");
      } else {
        setRows(all);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed. Check your ANTHROPIC_API_KEY and try again.");
    } finally {
      setScanning(false);
    }
  }

  function updateRow(i: number, field: keyof ScannedRow, value: string) {
    setRows((prev) => prev ? prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r) : prev);
  }

  function removeRow(i: number) {
    setRows((prev) => prev ? prev.filter((_, idx) => idx !== i) : prev);
  }

  async function handleSave() {
    if (!rows?.length) return;
    setSaving(true);
    try {
      await onSave(rows, creditCardId);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ScanLine size={18} className="text-indigo-500" />
            Scan Receipt or Bill
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!rows ? (
            <div className="flex flex-col gap-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                  dragging ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                }`}
              >
                <Upload size={28} className="text-slate-400" />
                <div className="text-center">
                  {files.length === 0 ? (
                    <>
                      <p className="text-sm font-medium text-slate-700">Drop files here or click to browse</p>
                      <p className="text-xs text-slate-400 mt-1">JPEG, PNG, or PDF — multiple files supported</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-700">{files.length} file{files.length !== 1 ? "s" : ""} selected</p>
                      <p className="text-xs text-slate-400 mt-1">{files.map((f) => f.name).join(", ")}</p>
                    </>
                  )}
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    if (picked.length) setFiles((prev) => [...prev, ...picked]);
                    e.target.value = "";
                  }}
                />
              </div>

              {files.length > 0 && (
                <button
                  onClick={() => setFiles([])}
                  className="text-xs text-slate-400 hover:text-slate-600 self-start transition-colors"
                >
                  Clear selection
                </button>
              )}

              {error && <p className="text-sm text-red-500 text-center">{error}</p>}

              <button
                onClick={scan}
                disabled={!files.length || scanning}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {scanning
                  ? <><Loader2 size={16} className="animate-spin" /> Scanning{files.length > 1 ? ` ${files.length} files` : ""}…</>
                  : <><ScanLine size={16} /> Scan with Claude</>}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-500">
                Review and edit the extracted transactions before saving.
              </p>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700 shrink-0">Credit card for all</label>
                <select
                  value={creditCardId}
                  onChange={(e) => setCreditCardId(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">None</option>
                  {creditCards.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.last_four ? ` ····${c.last_four}` : ""}</option>
                  ))}
                </select>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-2.5">Description</th>
                      <th className="text-left px-4 py-2.5 w-28">Amount</th>
                      <th className="text-left px-4 py-2.5 w-32">Date</th>
                      <th className="text-left px-4 py-2.5 w-36">Category</th>
                      <th className="text-left px-4 py-2.5">Notes</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <input
                            value={row.name}
                            onChange={(e) => updateRow(i, "name", e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => updateRow(i, "amount", e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => updateRow(i, "date", e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.category_id}
                            onChange={(e) => updateRow(i, "category_id", e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                          >
                            <option value="">None</option>
                            {expenseCategories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.notes}
                            onChange={(e) => updateRow(i, "notes", e.target.value)}
                            placeholder="Optional"
                            className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => removeRow(i)}
                            className="text-slate-300 hover:text-red-400 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={() => { setRows(null); setFiles([]); setError(null); }}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors self-start"
              >
                ← Scan different files
              </button>
            </div>
          )}
        </div>

        {rows && (
          <div className="flex gap-3 justify-end p-6 border-t border-slate-100">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!rows.length || saving}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : `Save ${rows.length} transaction${rows.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Constants ----

const EMPTY_EXPENSE = { name: "", amount: "", date: "", category_id: "", credit_card_id: "", notes: "", service_period_start: "", service_period_end: "" };
const EMPTY_RECURRING = { name: "", amount: "", charge_date: "", category_id: "", credit_card_id: "", notes: "" };
const EMPTY_CC_FORM = { name: "", color: "blue" };
const EMPTY_TRANSFER = { name: "", date: "", direction: "sent", person: "", platform: "", bank_id: "", category_id: "", amount: "", notes: "", split_with: "" };
const TRANSFER_PLATFORMS = ["Zelle", "Venmo", "Cash App", "PayPal", "Apple Pay", "Other"];
const UTILITY_NAMES = ["Electric", "Water", "Internet", "Gas", "Trash"];
const EMPTY_BILL = { utility: "", is_recurring: false, service_period_start: "", service_period_end: "", charge_date: "", charge_day: "", billing_start: "", amount: "", split_with: "", notes: "" };
const EMPTY_LOAN = { name: "", disbursement_date: "", original_principal: "", unpaid_principal: "", interest_rate: "", unpaid_interest: "", total_interest_paid: "0", notes: "" };
const EMPTY_CC_REMINDER = { card_name: "", owner: "", due_day: "" };

// ---- Page ----

export default function PaymentsAndExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [recurringCharges, setRecurringCharges] = useState<RecurringCharge[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "credit_card" | "expense" | "recurring" | "transfer" | "loan" | "cc_reminder"; id: number } | null>(null);

  const [showScanModal, setShowScanModal] = useState(false);
  const [monthTotal, setMonthTotal] = useState<number | null>(null);

  // Expanded transaction groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Expanded recurring charge price history
  const [expandedRecurringIds, setExpandedRecurringIds] = useState<Set<number>>(new Set());
  function toggleRecurring(id: number) {
    setExpandedRecurringIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Split state
  const [knownPeople, setKnownPeople] = useState<Person[]>([]);
  const [splitPeople, setSplitPeople] = useState<string[]>([]);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [splitDropOpen, setSplitDropOpen] = useState(false);
  const splitDropRef = useRef<HTMLDivElement>(null);
  const [transferSplitPeople, setTransferSplitPeople] = useState<string[]>([]);
  const [transferSplitDropOpen, setTransferSplitDropOpen] = useState(false);
  const transferSplitDropRef = useRef<HTMLDivElement>(null);
  const [catDropOpen, setCatDropOpen] = useState(false);
  const catDropRef = useRef<HTMLDivElement>(null);
  const [cardDropOpen, setCardDropOpen] = useState(false);
  const cardDropRef = useRef<HTMLDivElement>(null);
  const [recurringCardDropOpen, setRecurringCardDropOpen] = useState(false);
  const recurringCardDropRef = useRef<HTMLDivElement>(null);

  // Expense sort & filter
  const [expenseSort, setExpenseSort] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [cardFilterIds, setCardFilterIds] = useState<Set<number | null>>(new Set());
  const [ccFilterDropOpen, setCcFilterDropOpen] = useState(false);
  const ccFilterDropRef = useRef<HTMLDivElement>(null);

  // Inline category creation (expense modal)
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Credit card modal
  const [showCreditCardModal, setShowCreditCardModal] = useState(false);
  const [editCreditCard, setEditCreditCard] = useState<CreditCard | null>(null);
  const [creditCardForm, setCreditCardForm] = useState(EMPTY_CC_FORM);
  const [ccSaveError, setCCSaveError] = useState<string | null>(null);

  // Inline card creation (inside expense modal)
  const [addingCard, setAddingCard] = useState(false);
  const [newCardName, setNewCardName] = useState("");
  const [newCardColor, setNewCardColor] = useState("blue");

  // Expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE);
  const [expenseSaveError, setExpenseSaveError] = useState<string | null>(null);

  // Recurring modal
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editRecurring, setEditRecurring] = useState<RecurringCharge | null>(null);
  const [recurringForm, setRecurringForm] = useState(EMPTY_RECURRING);
  const [addingRecurringCat, setAddingRecurringCat] = useState(false);
  const [newRecurringCatName, setNewRecurringCatName] = useState("");
  const [recurringCatDropOpen, setRecurringCatDropOpen] = useState(false);
  const recurringCatDropRef = useRef<HTMLDivElement>(null);
  const [recurringSaveError, setRecurringSaveError] = useState<string | null>(null);

  // Log price change modal
  const [showLogPriceModal, setShowLogPriceModal] = useState(false);
  const [logPriceTarget, setLogPriceTarget] = useState<RecurringCharge | null>(null);
  const [logPriceForm, setLogPriceForm] = useState({ amount: "", effectiveMonth: "" });
  const [logPriceSaveError, setLogPriceSaveError] = useState<string | null>(null);

  // Money transfers
  const [moneyTransfers, setMoneyTransfers] = useState<MoneyTransfer[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editTransfer, setEditTransfer] = useState<MoneyTransfer | null>(null);
  const [transferForm, setTransferForm] = useState(EMPTY_TRANSFER);
  const [transferSaveError, setTransferSaveError] = useState<string | null>(null);

  // Banks
  const [banks, setBanks] = useState<Bank[]>([]);
  const [addingBank, setAddingBank] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [bankDropOpen, setBankDropOpen] = useState(false);
  const bankDropRef = useRef<HTMLDivElement>(null);
  const [personDropOpen, setPersonDropOpen] = useState(false);
  const personDropRef = useRef<HTMLDivElement>(null);

  // Utility ledger
  const [utilityBills, setUtilityBills] = useState<UtilityBill[]>([]);
  const [utilityReimbursements, setUtilityReimbursements] = useState<UtilityReimbursement[]>([]);
  const [showBillModal, setShowBillModal] = useState(false);
  const [editBill, setEditBill] = useState<UtilityBill | null>(null);
  const [billForm, setBillForm] = useState(EMPTY_BILL);
  const [billSaveError, setBillSaveError] = useState<string | null>(null);
  const [billSplitPeople, setBillSplitPeople] = useState<string[]>([]);
  const [billSplitDropOpen, setBillSplitDropOpen] = useState(false);
  const billSplitDropRef = useRef<HTMLDivElement>(null);
  const [utilitiesOpen, setUtilitiesOpen] = useState(true);
  const [utilBillsOpen, setUtilBillsOpen] = useState(true);
  const [utilBalancesOpen, setUtilBalancesOpen] = useState(true);
  const [expandedUtilPersons, setExpandedUtilPersons] = useState<Set<string>>(new Set());
  const [showUtilLogPriceModal, setShowUtilLogPriceModal] = useState(false);
  const [utilLogPriceTarget, setUtilLogPriceTarget] = useState<UtilityBill | null>(null);
  const [utilLogPriceForm, setUtilLogPriceForm] = useState({ amount: "", effectiveMonth: "" });
  const [utilLogPriceSaveError, setUtilLogPriceSaveError] = useState<string | null>(null);

  // Credit card reminders
  const [ccReminders, setCcReminders] = useState<CreditCardReminder[]>([]);
  const [ccRemindersOpen, setCcRemindersOpen] = useState(true);
  const [showCcReminderModal, setShowCcReminderModal] = useState(false);
  const [editCcReminder, setEditCcReminder] = useState<CreditCardReminder | null>(null);
  const [ccReminderForm, setCcReminderForm] = useState(EMPTY_CC_REMINDER);
  const [ccReminderSaveError, setCcReminderSaveError] = useState<string | null>(null);

  // College loans
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loansOpen, setLoansOpen] = useState(true);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [loanForm, setLoanForm] = useState(EMPTY_LOAN);
  const [loanSaveError, setLoanSaveError] = useState<string | null>(null);

  // Section collapse state
  const [recurringOpen, setRecurringOpen] = useState(true);
  const [expensesOpen, setExpensesOpen] = useState(true);
  const [transfersOpen, setTransfersOpen] = useState(true);
  const [owedOpen, setOwedOpen] = useState(true);
  const [expandedOwedIds, setExpandedOwedIds] = useState<Set<string>>(new Set());
  const [expandedLedgerGroups, setExpandedLedgerGroups] = useState<Set<string>>(new Set());
  const [recordPaymentId, setRecordPaymentId] = useState<string | null>(null);
  const [recordPaymentAmount, setRecordPaymentAmount] = useState("");
  const [recordPaymentDate, setRecordPaymentDate] = useState(toLocalDate(new Date()));
  const [recordPaymentNotes, setRecordPaymentNotes] = useState("");

  // All-time data for the split ledger
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allTransfers, setAllTransfers] = useState<MoneyTransfer[]>([]);

  // Global year search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [yearExpenses, setYearExpenses] = useState<Expense[]>([]);
  const [yearTransfers, setYearTransfers] = useState<MoneyTransfer[]>([]);
  const [yearDataLoaded, setYearDataLoaded] = useState(false);
  const [yearDataLoading, setYearDataLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch("/categories").then(setExpenseCategories).catch(console.error);
    apiFetch("/credit-cards").then(setCreditCards).catch(console.error);
    apiFetch("/banks").then(setBanks).catch(console.error);
    apiFetch("/people").then(setKnownPeople).catch(console.error);
    apiFetch("/recurring-charges").then(setRecurringCharges).catch(console.error);
    apiFetch("/expenses").then(setAllExpenses).catch(console.error);
    apiFetch("/money-transfers").then(setAllTransfers).catch(console.error);
    apiFetch("/utility-bills").then(setUtilityBills).catch(console.error);
    apiFetch("/utility-reimbursements").then(setUtilityReimbursements).catch(console.error);
    apiFetch("/loans").then(setLoans).catch(console.error);
    apiFetch("/credit-card-reminders").then(setCcReminders).catch(console.error);
  }, []);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (splitDropRef.current && !splitDropRef.current.contains(e.target as Node)) setSplitDropOpen(false);
      if (catDropRef.current && !catDropRef.current.contains(e.target as Node)) setCatDropOpen(false);
      if (recurringCatDropRef.current && !recurringCatDropRef.current.contains(e.target as Node)) setRecurringCatDropOpen(false);
      if (cardDropRef.current && !cardDropRef.current.contains(e.target as Node)) setCardDropOpen(false);
      if (recurringCardDropRef.current && !recurringCardDropRef.current.contains(e.target as Node)) setRecurringCardDropOpen(false);
      if (bankDropRef.current && !bankDropRef.current.contains(e.target as Node)) setBankDropOpen(false);
      if (personDropRef.current && !personDropRef.current.contains(e.target as Node)) setPersonDropOpen(false);
      if (transferSplitDropRef.current && !transferSplitDropRef.current.contains(e.target as Node)) setTransferSplitDropOpen(false);
      if (billSplitDropRef.current && !billSplitDropRef.current.contains(e.target as Node)) setBillSplitDropOpen(false);
      if (ccFilterDropRef.current && !ccFilterDropRef.current.contains(e.target as Node)) setCcFilterDropOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    apiFetch(`/expenses?month=${selectedMonth}`).then(setExpenses).catch(console.error);
    apiFetch(`/expenses/summary?month=${selectedMonth}`)
      .then((s) => setMonthTotal(Number(s.total)))
      .catch(console.error);
    apiFetch(`/money-transfers?month=${selectedMonth}`).then(setMoneyTransfers).catch(console.error);
  }, [selectedMonth]);

  const getCatName = (id: number | null, cats: Category[]) =>
    id != null ? (cats.find((c) => c.id === id)?.name ?? null) : null;

  const getCardDisplayName = (id: number | null) => {
    if (id == null) return null;
    const card = creditCards.find((c) => c.id === id);
    if (!card) return null;
    return card.last_four ? `${card.name} ····${card.last_four}` : card.name;
  };

  // Group expenses by name (with optional CC filter applied first)
  type ExpenseGroup = { key: string; name: string; items: Expense[]; total: number };
  const filteredExpenses = cardFilterIds.size === 0
    ? expenses
    : expenses.filter((e) => cardFilterIds.has(e.credit_card_id));
  const expenseGroups: ExpenseGroup[] = [];
  for (const expense of filteredExpenses) {
    const key = expense.name.toLowerCase().trim();
    const existing = expenseGroups.find((g) => g.key === key);
    if (existing) {
      existing.items.push(expense);
      existing.total += Number(expense.amount);
    } else {
      expenseGroups.push({ key, name: expense.name, items: [expense], total: Number(expense.amount) });
    }
  }
  expenseGroups.forEach((g) => {
    if (expenseSort === "date-asc") {
      g.items.sort((a, b) => a.date.localeCompare(b.date));
    } else if (expenseSort === "amount-desc") {
      g.items.sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)));
    } else if (expenseSort === "amount-asc") {
      g.items.sort((a, b) => Math.abs(Number(a.amount)) - Math.abs(Number(b.amount)));
    } else {
      g.items.sort((a, b) => b.date.localeCompare(a.date));
    }
  });
  if (expenseSort === "date-asc") {
    expenseGroups.sort((a, b) => (a.items[0]?.date ?? "").localeCompare(b.items[0]?.date ?? ""));
  } else if (expenseSort === "amount-desc") {
    expenseGroups.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  } else if (expenseSort === "amount-asc") {
    expenseGroups.sort((a, b) => Math.abs(a.total) - Math.abs(b.total));
  } else {
    expenseGroups.sort((a, b) => (b.items[0]?.date ?? "").localeCompare(a.items[0]?.date ?? ""));
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // ---- Credit Cards ----

  function openEditCreditCard(card: CreditCard) {
    setEditCreditCard(card);
    setCreditCardForm({ name: card.name, color: card.color ?? "blue" });
    setCCSaveError(null);
    setShowCreditCardModal(true);
  }

  async function saveCreditCard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCCSaveError(null);
    const body = { name: creditCardForm.name, color: creditCardForm.color || null };
    try {
      const updated = await apiFetch(`/credit-cards/${editCreditCard!.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setCreditCards((prev) => prev.map((c) => c.id === editCreditCard!.id ? updated : c));
      setShowCreditCardModal(false);
      setEditCreditCard(null);
      setCreditCardForm(EMPTY_CC_FORM);
    } catch (err) {
      setCCSaveError(err instanceof Error ? err.message : "Failed to save credit card");
    }
  }

  function resetInlineCard() {
    setAddingCard(false);
    setNewCardName("");
    setNewCardColor("blue");
  }

  async function addCardInline() {
    const name = newCardName.trim();
    if (!name) return;
    const created = await apiFetch("/credit-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: newCardColor }),
    });
    setCreditCards((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setExpenseForm((f) => ({ ...f, credit_card_id: String(created.id) }));
    resetInlineCard();
  }

  async function addRecurringCardInline() {
    const name = newCardName.trim();
    if (!name) return;
    const created = await apiFetch("/credit-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: newCardColor }),
    });
    setCreditCards((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setRecurringForm((f) => ({ ...f, credit_card_id: String(created.id) }));
    resetInlineCard();
  }

  async function deleteCreditCard(id: number) {
    await apiFetch(`/credit-cards/${id}`, { method: "DELETE" });
    setCreditCards((prev) => prev.filter((c) => c.id !== id));
    if (expenseForm.credit_card_id === String(id)) setExpenseForm((f) => ({ ...f, credit_card_id: "" }));
    if (recurringForm.credit_card_id === String(id)) setRecurringForm((f) => ({ ...f, credit_card_id: "" }));
  }

  // ---- Year search ----

  function openYearSearch() {
    setSearchOpen(true);
    if (yearDataLoaded || yearDataLoading) return;
    setYearDataLoading(true);
    const year = new Date().getFullYear();
    Promise.all([
      apiFetch(`/expenses?year=${year}`),
      apiFetch(`/money-transfers?year=${year}`),
    ]).then(([exps, trans]: [Expense[], MoneyTransfer[]]) => {
      setYearExpenses(exps);
      setYearTransfers(trans);
      setYearDataLoaded(true);
    }).catch(console.error).finally(() => setYearDataLoading(false));
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchOpen(false);
  }

  // ---- Money Transfers ----

  async function addBankInline() {
    const name = newBankName.trim();
    if (!name) return;
    const created: Bank = await apiFetch("/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBanks((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setTransferForm((f) => ({ ...f, bank_id: String(created.id) }));
    setNewBankName("");
    setAddingBank(false);
  }

  async function deleteBank(id: number) {
    await apiFetch(`/banks/${id}`, { method: "DELETE" });
    setBanks((prev) => prev.filter((b) => b.id !== id));
    if (transferForm.bank_id === String(id)) setTransferForm((f) => ({ ...f, bank_id: "" }));
  }

  function openAddTransfer() {
    setEditTransfer(null);
    setTransferForm(EMPTY_TRANSFER);
    setTransferSplitPeople([]);
    setTransferSaveError(null);
    setAddingBank(false); setNewBankName(""); setBankDropOpen(false);
    setPersonDropOpen(false); setAddingPerson(false); setNewPersonName("");
    setShowTransferModal(true);
  }

  function openEditTransfer(t: MoneyTransfer) {
    setEditTransfer(t);
    setTransferForm({
      name: t.name ?? "",
      date: t.date,
      direction: t.direction,
      person: t.person,
      platform: t.platform ?? "",
      bank_id: t.bank_id != null ? String(t.bank_id) : "",
      category_id: t.category_id != null ? String(t.category_id) : "",
      amount: String(t.amount),
      notes: t.notes ?? "",
      split_with: t.split_with ?? "",
    });
    setTransferSplitPeople(t.split_with ? t.split_with.split(",") : []);
    setTransferSaveError(null);
    setAddingBank(false); setNewBankName(""); setBankDropOpen(false);
    setPersonDropOpen(false); setAddingPerson(false); setNewPersonName("");
    setShowTransferModal(true);
  }

  async function doSaveTransfer(): Promise<void> {
    if (!transferForm.person.trim()) {
      throw new Error(transferForm.direction === "sent" ? "Please select who you sent to." : "Please select who you received from.");
    }
    const body = {
      name: transferForm.name.trim() || null,
      date: transferForm.date,
      direction: transferForm.direction,
      person: transferForm.person.trim(),
      platform: transferForm.platform.trim() || null,
      bank_id: transferForm.bank_id ? parseInt(transferForm.bank_id) : null,
      category_id: transferForm.category_id ? parseInt(transferForm.category_id) : null,
      amount: parseFloat(transferForm.amount),
      notes: transferForm.notes.trim() || null,
      split_with: transferSplitPeople.length > 0 ? transferSplitPeople.join(",") : null,
    };
    if (editTransfer) {
      const updated: MoneyTransfer = await apiFetch(`/money-transfers/${editTransfer.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setAllTransfers((prev) => prev.map((t) => t.id === editTransfer.id ? updated : t));
      if (updated.date.startsWith(selectedMonth)) {
        setMoneyTransfers((prev) => prev.map((t) => t.id === editTransfer.id ? updated : t));
      } else {
        setMoneyTransfers((prev) => prev.filter((t) => t.id !== editTransfer.id));
      }
    } else {
      const created: MoneyTransfer = await apiFetch("/money-transfers", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setAllTransfers((prev) => [created, ...prev]);
      if (created.date.startsWith(selectedMonth)) {
        setMoneyTransfers((prev) => [created, ...prev]);
      }
    }
  }

  async function saveTransfer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTransferSaveError(null);
    try {
      await doSaveTransfer();
      setShowTransferModal(false);
      setEditTransfer(null);
      setTransferForm(EMPTY_TRANSFER);
      setTransferSplitPeople([]);
      setAddingBank(false); setNewBankName(""); setBankDropOpen(false);
      setPersonDropOpen(false); setAddingPerson(false); setNewPersonName("");
    } catch (err) {
      setTransferSaveError(err instanceof Error ? err.message : "Failed to save transfer");
    }
  }

  async function saveTransferAndAddAnother() {
    setTransferSaveError(null);
    try {
      await doSaveTransfer();
      setTransferForm((f) => ({ ...EMPTY_TRANSFER, date: f.date, direction: f.direction }));
      setTransferSplitPeople([]);
      setPersonDropOpen(false); setAddingPerson(false); setNewPersonName("");
    } catch (err) {
      setTransferSaveError(err instanceof Error ? err.message : "Failed to save transfer");
    }
  }

  // ---- Utility Ledger ----

  function openAddBill() {
    setEditBill(null);
    setBillForm({ ...EMPTY_BILL, charge_date: toLocalDate(new Date()) });
    setBillSplitPeople([]);
    setBillSaveError(null);
    setShowBillModal(true);
  }

  function openEditBill(b: UtilityBill) {
    setEditBill(b);
    setBillForm({
      utility: b.utility,
      is_recurring: b.is_recurring,
      service_period_start: b.service_period_start ?? "",
      service_period_end: b.service_period_end ?? "",
      charge_date: b.charge_date ?? "",
      charge_day: b.charge_day != null ? String(b.charge_day) : "",
      billing_start: b.billing_start ? b.billing_start.substring(0, 7) : "",
      amount: String(b.amount),
      split_with: b.split_with ?? "",
      notes: b.notes ?? "",
    });
    setBillSplitPeople(b.split_with ? b.split_with.split(",") : []);
    setBillSaveError(null);
    setShowBillModal(true);
  }

  async function saveBill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBillSaveError(null);
    try {
      const isRec = billForm.is_recurring;
      const body = {
        utility: billForm.utility.trim(),
        is_recurring: isRec,
        service_period_start: !isRec && billForm.service_period_start ? billForm.service_period_start : null,
        service_period_end: !isRec && billForm.service_period_end ? billForm.service_period_end : null,
        charge_date: !isRec && billForm.charge_date ? billForm.charge_date : null,
        charge_day: isRec && billForm.charge_day ? parseInt(billForm.charge_day) : null,
        billing_start: isRec && billForm.billing_start ? `${billForm.billing_start}-01` : null,
        amount: parseFloat(billForm.amount),
        split_with: billSplitPeople.length > 0 ? billSplitPeople.join(",") : null,
        notes: billForm.notes.trim() || null,
      };
      if (editBill) {
        const updated: UtilityBill = await apiFetch(`/utility-bills/${editBill.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        setUtilityBills((prev) => prev.map((b) => b.id === editBill.id ? updated : b));
      } else {
        const created: UtilityBill = await apiFetch("/utility-bills", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        setUtilityBills((prev) => [created, ...prev]);
      }
      setShowBillModal(false);
      setEditBill(null);
      setBillForm(EMPTY_BILL);
      setBillSplitPeople([]);
    } catch (err) {
      setBillSaveError(err instanceof Error ? err.message : "Failed to save bill");
    }
  }

  async function deleteBill(id: number) {
    await apiFetch(`/utility-bills/${id}`, { method: "DELETE" });
    setUtilityBills((prev) => prev.filter((b) => b.id !== id));
  }

  async function saveUtilLogPrice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!utilLogPriceTarget) return;
    setUtilLogPriceSaveError(null);
    const amount = parseFloat(utilLogPriceForm.amount);
    if (isNaN(amount) || amount <= 0) { setUtilLogPriceSaveError("Amount must be a positive number"); return; }
    if (!utilLogPriceForm.effectiveMonth) { setUtilLogPriceSaveError("Effective month is required"); return; }
    try {
      const entry: UtilityBillPriceHistoryEntry = await apiFetch(`/utility-bills/${utilLogPriceTarget.id}/price-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, effective_from: `${utilLogPriceForm.effectiveMonth}-01` }),
      });
      setUtilityBills((prev) => prev.map((b) =>
        b.id === utilLogPriceTarget.id
          ? { ...b, amount, price_history: [...b.price_history, entry] }
          : b
      ));
      setShowUtilLogPriceModal(false);
      setUtilLogPriceTarget(null);
      setUtilLogPriceForm({ amount: "", effectiveMonth: "" });
    } catch (err) {
      setUtilLogPriceSaveError(err instanceof Error ? err.message : "Failed to save price change");
    }
  }

  async function togglePersonPaid(name: string, isPaid: boolean, owed: number, existingReimbs: UtilityReimbursement[]) {
    if (isPaid) {
      await Promise.all(existingReimbs.map((r) => apiFetch(`/utility-reimbursements/${r.id}`, { method: "DELETE" })));
      const ids = new Set(existingReimbs.map((r) => r.id));
      setUtilityReimbursements((prev) => prev.filter((r) => !ids.has(r.id)));
    } else {
      const created: UtilityReimbursement = await apiFetch("/utility-reimbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: name, amount: owed, date: `${selectedMonth}-01` }),
      });
      setUtilityReimbursements((prev) => [created, ...prev]);
    }
  }

  // Utility balance: per person, what they owe vs what they've paid — scoped to selectedMonth
  const utilityBalances = (() => {
    const today = new Date();
    const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const todayDay = today.getDate();
    const todayStr = `${todayMonth}-${String(todayDay).padStart(2, "0")}`;
    const personMap = new Map<string, { owed: number; paid: number; bills: { bill: UtilityBill; share: number }[]; reimbursements: UtilityReimbursement[] }>();
    for (const bill of utilityBills) {
      if (!bill.split_with) continue;
      const names = bill.split_with.split(",").map((n) => n.trim());
      const shareRatio = 1 / (names.length + 1);
      let monthShare: number | null = null;
      if (bill.is_recurring && bill.billing_start) {
        const billStart = bill.billing_start.substring(0, 7);
        if (billStart <= selectedMonth) {
          const chargeOccurred =
            selectedMonth < todayMonth ||
            (selectedMonth === todayMonth && (bill.charge_day != null ? todayDay >= bill.charge_day : true));
          if (chargeOccurred) monthShare = getUtilBillPriceForMonth(bill, selectedMonth) * shareRatio;
        }
      } else {
        if (bill.charge_date && bill.charge_date.startsWith(selectedMonth) && bill.charge_date <= todayStr) {
          monthShare = Number(bill.amount) * shareRatio;
        }
      }
      if (monthShare === null) continue;
      for (const name of names) {
        if (!personMap.has(name)) personMap.set(name, { owed: 0, paid: 0, bills: [], reimbursements: [] });
        const entry = personMap.get(name)!;
        entry.owed += monthShare;
        entry.bills.push({ bill, share: monthShare });
      }
    }
    for (const r of utilityReimbursements) {
      if (!r.date.startsWith(selectedMonth)) continue;
      if (!personMap.has(r.person)) personMap.set(r.person, { owed: 0, paid: 0, bills: [], reimbursements: [] });
      const entry = personMap.get(r.person)!;
      entry.paid += Number(r.amount);
      entry.reimbursements.push(r);
    }
    return Array.from(personMap.entries())
      .map(([name, data]) => ({ name, ...data, outstanding: data.owed - data.paid }))
      .filter((e) => e.owed > 0 || e.paid > 0)
      .sort((a, b) => b.outstanding - a.outstanding);
  })();

  // ---- Expenses ----

  async function addExpenseCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const created: Category = await apiFetch("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setExpenseCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setExpenseForm((f) => ({ ...f, category_id: String(created.id) }));
    setNewCatName("");
    setAddingCat(false);
  }

  function resetSplit() {
    setSplitPeople([]);
    setAddingPerson(false);
    setNewPersonName("");
    setSplitDropOpen(false);
  }

  function toggleSplitPerson(name: string) {
    setSplitPeople((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
  }

  async function addNewPerson() {
    const name = newPersonName.trim();
    if (!name) return;
    if (!knownPeople.find((p) => p.name === name)) {
      try {
        const created: Person = await apiFetch("/people", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
        setKnownPeople((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        // already exists or other error — still allow selecting the name locally
      }
    }
    if (!splitPeople.includes(name)) setSplitPeople((prev) => [...prev, name]);
    setNewPersonName("");
    setAddingPerson(false);
  }

  async function deleteCategory(id: number) {
    await apiFetch(`/categories/${id}`, { method: "DELETE" });
    setExpenseCategories((prev) => prev.filter((c) => c.id !== id));
    if (expenseForm.category_id === String(id)) setExpenseForm((f) => ({ ...f, category_id: "" }));
  }

  async function deleteRecurringCategory(id: number) {
    await apiFetch(`/categories/${id}`, { method: "DELETE" });
    setExpenseCategories((prev) => prev.filter((c) => c.id !== id));
    if (recurringForm.category_id === String(id)) setRecurringForm((f) => ({ ...f, category_id: "" }));
  }

  async function removePerson(name: string) {
    const person = knownPeople.find((p) => p.name === name);
    if (person) {
      await apiFetch(`/people/${person.id}`, { method: "DELETE" });
      setKnownPeople((prev) => prev.filter((p) => p.id !== person.id));
    }
    setSplitPeople((prev) => prev.filter((n) => n !== name));
  }

  function openAddExpense() {
    setEditExpense(null);
    setExpenseForm({ ...EMPTY_EXPENSE, date: toLocalDate(new Date()) });
    setExpenseSaveError(null);
    resetSplit();
    setAddingCat(false); setNewCatName(""); setCatDropOpen(false);
    setCardDropOpen(false);
    resetInlineCard();
    setShowExpenseModal(true);
  }

  function openEditExpense(ex: Expense) {
    setEditExpense(ex);
    setExpenseForm({
      name: ex.name,
      amount: String(ex.amount),
      date: ex.date,
      category_id: ex.category_id != null && expenseCategories.find((c) => c.id === ex.category_id)
        ? String(ex.category_id) : "",
      credit_card_id: ex.credit_card_id != null && creditCards.find((c) => c.id === ex.credit_card_id)
        ? String(ex.credit_card_id) : "",
      notes: ex.notes ?? "",
      service_period_start: ex.service_period_start ?? "",
      service_period_end: ex.service_period_end ?? "",
    });
    setExpenseSaveError(null);
    const preSelected = ex.split_with ? ex.split_with.split(",") : [];
    setSplitPeople(preSelected);
    setAddingPerson(false); setNewPersonName(""); setSplitDropOpen(false);
    setAddingCat(false); setNewCatName(""); setCatDropOpen(false);
    setCardDropOpen(false);
    resetInlineCard();
    setShowExpenseModal(true);
  }

  async function doSaveExpense(): Promise<Expense | null> {
    const amount = parseFloat(expenseForm.amount);
    if (isNaN(amount)) throw new Error("Amount is required and must be a valid number");
    const body = {
      name: expenseForm.name,
      amount,
      date: expenseForm.date,
      category_id: expenseForm.category_id ? parseInt(expenseForm.category_id) : null,
      credit_card_id: expenseForm.credit_card_id ? parseInt(expenseForm.credit_card_id) : null,
      notes: expenseForm.notes || null,
      split_with: splitPeople.length > 0 ? splitPeople.join(",") : null,
      service_period_start: expenseForm.service_period_start || null,
      service_period_end: expenseForm.service_period_end || null,
    };
    if (editExpense) {
      const updated = await apiFetch(`/expenses/${editExpense.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setExpenses((prev) => prev.map((ex) => (ex.id === editExpense.id ? updated : ex)));
      setAllExpenses((prev) => prev.map((ex) => ex.id === editExpense.id ? updated : ex));
      return updated;
    } else {
      const created = await apiFetch("/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setAllExpenses((prev) => [created, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      if (created.date.startsWith(selectedMonth)) {
        setExpenses((prev) => [created, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
        setMonthTotal((prev) => (prev ?? 0) + Number(created.amount));
      }
      return created;
    }
  }

  async function saveExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setExpenseSaveError(null);
    try {
      await doSaveExpense();
      setShowExpenseModal(false);
      setEditExpense(null);
      setExpenseForm(EMPTY_EXPENSE);
      resetSplit();
    } catch (err) {
      setExpenseSaveError(err instanceof Error ? err.message : "Failed to save expense");
    }
  }

  async function saveExpenseAndAddAnother() {
    setExpenseSaveError(null);
    try {
      await doSaveExpense();
      setExpenseForm({ ...EMPTY_EXPENSE, date: expenseForm.date });
      resetSplit();
    } catch (err) {
      setExpenseSaveError(err instanceof Error ? err.message : "Failed to save expense");
    }
  }

  async function deleteExpense(id: number) {
    await apiFetch(`/expenses/${id}`, { method: "DELETE" });
    setExpenses((prev) => prev.filter((ex) => ex.id !== id));
    setAllExpenses((prev) => prev.filter((ex) => ex.id !== id));
  }

  async function returnExpense(expense: Expense) {
    if (Number(expense.amount) <= 0) return;
    const updated = await apiFetch(`/expenses/${expense.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: -Math.abs(Number(expense.amount)) }),
    });
    setExpenses((prev) => prev.map((ex) => ex.id === expense.id ? updated : ex));
    setAllExpenses((prev) => prev.map((ex) => ex.id === expense.id ? updated : ex));
  }

  // ---- Recurring charges ----

  async function addRecurringCategory() {
    const name = newRecurringCatName.trim();
    if (!name) return;
    const created: Category = await apiFetch("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setExpenseCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setRecurringForm((f) => ({ ...f, category_id: String(created.id) }));
    setNewRecurringCatName("");
    setAddingRecurringCat(false);
  }

  function openAddRecurring() {
    setEditRecurring(null);
    setRecurringForm(EMPTY_RECURRING);
    setRecurringSaveError(null);
    setAddingRecurringCat(false);
    setNewRecurringCatName("");
    setRecurringCatDropOpen(false);
    setRecurringCardDropOpen(false);
    resetSplit();
    setShowRecurringModal(true);
  }

  function openEditRecurring(rc: RecurringCharge) {
    setEditRecurring(rc);
    setRecurringForm({
      name: rc.name,
      amount: String(rc.amount),
      charge_date: String(rc.charge_date),
      category_id: rc.category_id != null ? String(rc.category_id) : "",
      credit_card_id: rc.credit_card_id != null ? String(rc.credit_card_id) : "",
      notes: rc.notes ?? "",
    });
    setSplitPeople(rc.split_with ? rc.split_with.split(",") : []);
    setAddingPerson(false); setNewPersonName(""); setSplitDropOpen(false);
    setRecurringSaveError(null);
    setAddingRecurringCat(false);
    setNewRecurringCatName("");
    setRecurringCatDropOpen(false);
    setRecurringCardDropOpen(false);
    setShowRecurringModal(true);
  }

  async function saveRecurring(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRecurringSaveError(null);
    const amount = parseFloat(recurringForm.amount);
    const charge_date = parseInt(recurringForm.charge_date);
    if (isNaN(amount) || amount <= 0) {
      setRecurringSaveError("Amount must be a positive number");
      return;
    }
    if (isNaN(charge_date) || charge_date < 1 || charge_date > 31) {
      setRecurringSaveError("Charge date must be between 1 and 31");
      return;
    }
    const body = {
      name: recurringForm.name,
      amount,
      charge_date,
      category_id: recurringForm.category_id ? parseInt(recurringForm.category_id) : null,
      credit_card_id: recurringForm.credit_card_id ? parseInt(recurringForm.credit_card_id) : null,
      notes: recurringForm.notes || null,
      split_with: splitPeople.length > 0 ? splitPeople.join(",") : null,
    };
    try {
      if (editRecurring) {
        const updated = await apiFetch(`/recurring-charges/${editRecurring.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        setRecurringCharges((prev) => prev.map((rc) => rc.id === editRecurring.id ? updated : rc));
      } else {
        const created = await apiFetch("/recurring-charges", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        setRecurringCharges((prev) => [...prev, created].sort((a, b) => a.charge_date - b.charge_date));
      }
      setShowRecurringModal(false);
      setEditRecurring(null);
      setRecurringForm(EMPTY_RECURRING);
      resetSplit();
    } catch (err) {
      setRecurringSaveError(err instanceof Error ? err.message : "Failed to save recurring charge");
    }
  }

  async function deleteRecurring(id: number) {
    await apiFetch(`/recurring-charges/${id}`, { method: "DELETE" });
    setRecurringCharges((prev) => prev.filter((rc) => rc.id !== id));
  }

  async function cancelRecurring(rc: RecurringCharge) {
    const now = new Date();
    const isCurrentMonth = selectedMonth === currentMonth();
    const hasPosted = isCurrentMonth && now.getDate() >= rc.charge_date;
    const canceledFromMonth = hasPosted ? shiftMonth(selectedMonth, 1) : selectedMonth;
    await apiFetch(`/recurring-charges/${rc.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canceled_from: `${canceledFromMonth}-01` }),
    });
    const updated: RecurringCharge[] = await apiFetch("/recurring-charges");
    setRecurringCharges(updated);
  }

  async function reactivateRecurring(rc: RecurringCharge) {
    await apiFetch(`/recurring-charges/${rc.id}/reactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reactivated_from: `${selectedMonth}-01` }),
    });
    const updated: RecurringCharge[] = await apiFetch("/recurring-charges");
    setRecurringCharges(updated);
  }

  async function saveLogPrice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!logPriceTarget) return;
    setLogPriceSaveError(null);
    const amount = parseFloat(logPriceForm.amount);
    if (isNaN(amount) || amount <= 0) {
      setLogPriceSaveError("Amount must be a positive number");
      return;
    }
    if (!logPriceForm.effectiveMonth) {
      setLogPriceSaveError("Effective month is required");
      return;
    }
    try {
      await apiFetch(`/recurring-charges/${logPriceTarget.id}/price-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, effective_from: `${logPriceForm.effectiveMonth}-01` }),
      });
      const updated: RecurringCharge[] = await apiFetch("/recurring-charges");
      setRecurringCharges(updated);
      setShowLogPriceModal(false);
      setLogPriceTarget(null);
      setLogPriceForm({ amount: "", effectiveMonth: "" });
    } catch (err) {
      setLogPriceSaveError(err instanceof Error ? err.message : "Failed to save price change");
    }
  }

  // ---- Loans ----

  async function saveLoan(e: React.FormEvent) {
    e.preventDefault();
    setLoanSaveError(null);
    try {
      const body = {
        name: loanForm.name,
        disbursement_date: loanForm.disbursement_date,
        original_principal: loanForm.original_principal,
        unpaid_principal: loanForm.unpaid_principal,
        interest_rate: loanForm.interest_rate,
        unpaid_interest: loanForm.unpaid_interest,
        total_interest_paid: loanForm.total_interest_paid,
        notes: loanForm.notes.trim() || null,
      };
      if (editLoan) {
        await apiFetch(`/loans/${editLoan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/loans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const fresh: Loan[] = await apiFetch("/loans");
      setLoans(fresh ?? []);
      setShowLoanModal(false);
      setEditLoan(null);
      setLoanForm(EMPTY_LOAN);
    } catch (err) {
      setLoanSaveError(err instanceof Error ? err.message : "Failed to save loan");
    }
  }

  // ---- Credit Card Reminders ----

  async function saveCcReminder(e: React.FormEvent) {
    e.preventDefault();
    setCcReminderSaveError(null);
    const due_day = parseInt(ccReminderForm.due_day);
    if (isNaN(due_day) || due_day < 1 || due_day > 31) {
      setCcReminderSaveError("Due day must be between 1 and 31");
      return;
    }
    try {
      const body = {
        card_name: ccReminderForm.card_name.trim(),
        owner: ccReminderForm.owner.trim() || null,
        due_day,
      };
      if (editCcReminder) {
        await apiFetch(`/credit-card-reminders/${editCcReminder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/credit-card-reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
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

  // ---- Misc ----

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "credit_card") await deleteCreditCard(deleteTarget.id);
    else if (deleteTarget.type === "expense") await deleteExpense(deleteTarget.id);
    else if (deleteTarget.type === "recurring") await deleteRecurring(deleteTarget.id);
    else if (deleteTarget.type === "loan") {
      await apiFetch(`/loans/${deleteTarget.id}`, { method: "DELETE" });
      const fresh: Loan[] = await apiFetch("/loans");
      setLoans(fresh ?? []);
    } else if (deleteTarget.type === "cc_reminder") {
      await apiFetch(`/credit-card-reminders/${deleteTarget.id}`, { method: "DELETE" });
      setCcReminders((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    } else {
      await apiFetch(`/money-transfers/${deleteTarget.id}`, { method: "DELETE" });
      setMoneyTransfers((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setAllTransfers((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  }

  async function saveScanResults(rows: ScannedRow[], creditCardId: string) {
    const created = await Promise.all(
      rows.map((row) =>
        apiFetch("/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.name,
            amount: parseFloat(row.amount),
            date: row.date,
            category_id: row.category_id ? parseInt(row.category_id) : null,
            credit_card_id: creditCardId ? parseInt(creditCardId) : null,
            notes: row.notes.trim() || null,
          }),
        })
      )
    );
    const inMonth = created.filter((ex: Expense) => ex.date.startsWith(selectedMonth));
    setAllExpenses((prev) => [...created, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
    if (inMonth.length) {
      setExpenses((prev) => [...inMonth, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      setMonthTotal((prev) => (prev ?? 0) + inMonth.reduce((s: number, ex: Expense) => s + Number(ex.amount), 0));
    }
  }

  // Recurring charge status for selected month
  const todayForRecurring = new Date();
  const todayMonthStr = `${todayForRecurring.getFullYear()}-${String(todayForRecurring.getMonth() + 1).padStart(2, "0")}`;
  const todayDay = todayForRecurring.getDate();

  function recurringApplied(charge: RecurringCharge): boolean {
    if (selectedMonth < todayMonthStr) return true;
    if (selectedMonth > todayMonthStr) return false;
    return todayDay >= charge.charge_date;
  }

  // ---- Search results ----
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

  const searchYear = new Date().getFullYear();
  const searchMonthMax = new Date().getMonth() + 1;
  const allCatsMap = new Map(expenseCategories.map((c) => [c.id, c.name]));
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
        if (rc.name.toLowerCase().includes(q) || catName?.toLowerCase().includes(q) || rc.notes?.toLowerCase().includes(q)) {
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
      if (
        t.name?.toLowerCase().includes(q) ||
        t.person.toLowerCase().includes(q) ||
        t.platform?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q) ||
        (t.bank_id != null && banks.find((b) => b.id === t.bank_id)?.name.toLowerCase().includes(q))
      ) {
        const bankName = t.bank_id != null ? banks.find((b) => b.id === t.bank_id)?.name : undefined;
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

  // All-time per-person split ledger
  const ledgerToday = new Date();
  const ledgerTodayMonth = `${ledgerToday.getFullYear()}-${String(ledgerToday.getMonth() + 1).padStart(2, "0")}`;
  const ledgerTodayDay = ledgerToday.getDate();

  function rcLedgerStartMonth(rc: RecurringCharge): string {
    // "2000-01-01" is a placeholder meaning "active from the start of tracking"
    if (rc.price_history.some((h) => h.effective_from.startsWith("2000-01"))) return "2026-01";
    const sorted = rc.price_history.map((h) => h.effective_from.substring(0, 7)).sort();
    return sorted[0] ?? "2026-01";
  }

  // Category-grouped ledger: group all split debts by category, then by person
  type CatPersonData = {
    categoryId: number | null;
    categoryName: string;
    person: Person;
    splitExpenses: (Expense & { share: number })[];
    recurringItems: { rc: RecurringCharge; total: number; months: { month: string; amount: number }[] }[];
    splitTransfers: (MoneyTransfer & { share: number })[];
  };

  const catPersonMap = new Map<string, CatPersonData>();
  const catInsertOrder: (number | null)[] = [];

  for (const e of allExpenses) {
    if (!e.split_with) continue;
    const names = e.split_with.split(",").map((n) => n.trim());
    const share = Number(e.amount) / (names.length + 1);
    for (const name of names) {
      const person = knownPeople.find((p) => p.name === name);
      if (!person) continue;
      const catId = e.category_id;
      const catKey = `${catId}:${person.id}`;
      if (!catPersonMap.has(catKey)) {
        if (!catInsertOrder.includes(catId)) catInsertOrder.push(catId);
        const catName = catId != null ? (allCatsMap.get(catId) ?? "Unknown") : "Uncategorized";
        catPersonMap.set(catKey, { categoryId: catId, categoryName: catName, person, splitExpenses: [], recurringItems: [], splitTransfers: [] });
      }
      catPersonMap.get(catKey)!.splitExpenses.push({ ...e, share });
    }
  }

  for (const rc of recurringCharges) {
    if (!rc.split_with) continue;
    const names = rc.split_with.split(",").map((n) => n.trim());
    const share = 1 / (names.length + 1);
    const start = rcLedgerStartMonth(rc);
    let [rcy, rcm] = start.split("-").map(Number);
    const [endY, endM] = ledgerTodayMonth.split("-").map(Number);
    const rcMonths: { month: string; amount: number }[] = [];
    let rcTotal = 0;
    while (rcy < endY || (rcy === endY && rcm <= endM)) {
      const monthStr = `${rcy}-${String(rcm).padStart(2, "0")}`;
      const isCurrentMonth = monthStr === ledgerTodayMonth;
      const chargeOccurred = !isCurrentMonth || ledgerTodayDay >= rc.charge_date;
      if (chargeOccurred && !isCanceledForMonth(rc, monthStr)) {
        const amt = getPriceForMonth(rc, monthStr) * share;
        rcTotal += amt;
        rcMonths.push({ month: monthStr, amount: amt });
      }
      rcm++;
      if (rcm > 12) { rcm = 1; rcy++; }
    }
    for (const name of names) {
      const person = knownPeople.find((p) => p.name === name);
      if (!person) continue;
      const catId = rc.category_id;
      const catKey = `${catId}:${person.id}`;
      if (!catPersonMap.has(catKey)) {
        if (!catInsertOrder.includes(catId)) catInsertOrder.push(catId);
        const catName = catId != null ? (allCatsMap.get(catId) ?? "Unknown") : "Uncategorized";
        catPersonMap.set(catKey, { categoryId: catId, categoryName: catName, person, splitExpenses: [], recurringItems: [], splitTransfers: [] });
      }
      catPersonMap.get(catKey)!.recurringItems.push({ rc, total: rcTotal, months: rcMonths });
    }
  }

  for (const t of allTransfers) {
    if (!t.split_with || t.direction !== "sent") continue;
    const names = t.split_with.split(",").map((n) => n.trim());
    const share = Number(t.amount) / (names.length + 1);
    for (const name of names) {
      const person = knownPeople.find((p) => p.name === name);
      if (!person) continue;
      const catId = t.category_id;
      const catKey = `${catId}:${person.id}`;
      if (!catPersonMap.has(catKey)) {
        if (!catInsertOrder.includes(catId)) catInsertOrder.push(catId);
        const catName = catId != null ? (allCatsMap.get(catId) ?? "Unknown") : "Uncategorized";
        catPersonMap.set(catKey, { categoryId: catId, categoryName: catName, person, splitExpenses: [], recurringItems: [], splitTransfers: [] });
      }
      catPersonMap.get(catKey)!.splitTransfers.push({ ...t, share });
    }
  }

  const catGroupMap2 = new Map<number | null, CatPersonData[]>();
  for (const catId of catInsertOrder) {
    if (!catGroupMap2.has(catId)) catGroupMap2.set(catId, []);
  }
  for (const data of catPersonMap.values()) {
    catGroupMap2.get(data.categoryId)!.push(data);
  }

  const categoryBalances = catInsertOrder
    .map((catId) => {
      const entries = catGroupMap2.get(catId) ?? [];
      return {
        categoryId: catId,
        categoryName: entries[0]?.categoryName ?? "Uncategorized",
        people: entries
          .map((entry) => {
            const totalOwed = entry.splitExpenses.reduce((s, e) => s + e.share, 0)
              + entry.recurringItems.reduce((s, r) => s + r.total, 0)
              + entry.splitTransfers.reduce((s, t) => s + t.share, 0);
            // Only deduct transfers tagged with the same category
            const payments = allTransfers.filter(
              (t) =>
                t.person === entry.person.name &&
                t.direction === "received" &&
                t.category_id === catId
            );
            const totalPaid = payments.reduce((s, t) => s + Number(t.amount), 0);
            return { ...entry, totalOwed, totalPaid, outstanding: totalOwed - totalPaid, payments };
          })
          .filter((e) => e.totalOwed > 0),
      };
    })
    .filter((g) => g.people.length > 0);

  async function recordPayment(person: Person, categoryId: number | null) {
    const amount = parseFloat(recordPaymentAmount);
    if (isNaN(amount) || amount <= 0) return;
    const body = {
      name: null,
      direction: "received",
      person: person.name,
      platform: null,
      bank_id: null,
      category_id: categoryId,
      amount,
      date: recordPaymentDate,
      notes: recordPaymentNotes.trim() || null,
    };
    const created: MoneyTransfer = await apiFetch("/money-transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setAllTransfers((prev) => [created, ...prev]);
    if (created.date.startsWith(selectedMonth)) {
      setMoneyTransfers((prev) => [created, ...prev]);
    }
    setRecordPaymentId(null);
    setRecordPaymentAmount("");
    setRecordPaymentDate(toLocalDate(new Date()));
    setRecordPaymentNotes("");
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-[calc(100vh-2rem)] relative pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Finances</h1>
          <p className="text-slate-500 mt-1">Track your upcoming bills and recent spending.</p>
        </div>
        {/* Month selector — top of page */}
        <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-1 py-1 self-start md:self-auto">
          <button
            onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
            disabled={selectedMonth <= "2026-01"}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[130px] text-center">
            {formatMonthLabel(selectedMonth)}
          </span>
          <button
            onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Global Year Search */}
      <div className="relative mb-6" ref={searchRef}>
        <div className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white shadow-sm transition-all ${searchOpen ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"}`}>
          {yearDataLoading
            ? <Loader2 size={16} className="text-slate-400 shrink-0 animate-spin" />
            : <Search size={16} className="text-slate-400 shrink-0" />}
          <input
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={openYearSearch}
            className="flex-1 text-sm outline-none bg-transparent text-slate-700 placeholder-slate-400"
          />
          {searchQuery && (
            <button onClick={clearSearch} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
              <X size={16} />
            </button>
          )}
        </div>

        {searchOpen && searchQuery.trim() && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-40 max-h-[30rem] overflow-y-auto">
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
                  <div className="px-4 py-2 bg-slate-50 border-b border-t border-slate-100 sticky top-0 z-10">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{group.label}</span>
                  </div>
                  {group.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-b-0 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          item.kind === "expense"
                            ? item.isReturn ? "bg-emerald-50" : "bg-indigo-50"
                            : item.kind === "recurring"
                            ? "bg-violet-50"
                            : item.isSent ? "bg-red-50" : "bg-emerald-50"
                        }`}>
                          {item.kind === "expense"
                            ? item.isReturn ? <RotateCcw size={13} className="text-emerald-500" /> : <Receipt size={13} className="text-indigo-500" />
                            : item.kind === "recurring"
                            ? <RefreshCw size={13} className="text-violet-500" />
                            : item.isSent ? <ArrowUpRight size={13} className="text-red-500" /> : <ArrowDownLeft size={13} className="text-emerald-500" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{fmtDate(item.date)}</span>
                            {item.category && (
                              <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{item.category}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ml-4 ${item.isReturn ? "text-emerald-600" : item.kind === "transfer" && !item.isSent ? "text-emerald-600" : "text-slate-700"}`}>
                        {item.isReturn ? "+" : item.kind === "transfer" ? (item.isSent ? "−" : "+") : ""}{fmtAmount(Math.abs(item.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Finance Summary */}
      <FinanceSummary
        expenses={expenses}
        categories={expenseCategories}
        creditCards={creditCards}
        month={selectedMonth}
        recurringCharges={recurringCharges}
        moneyTransfers={moneyTransfers}
        loans={loans}
      />

      {/* Bitches Who Owe Me Section */}
      {categoryBalances.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
            <button
              onClick={() => setOwedOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider hover:text-slate-600 transition-colors"
            >
              <Users size={16} className="text-rose-500" />
              Bitches Who Owe Me
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${owedOpen ? "" : "-rotate-90"}`} />
            </button>
          </div>

          {owedOpen && (
            <div className="space-y-4">
              {categoryBalances.map(({ categoryId, categoryName, people }) => (
                <div key={`cat-${categoryId}`} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Category header */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <Tag size={12} className="text-violet-500 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{categoryName}</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {people.map(({ person, totalOwed, totalPaid, outstanding, splitExpenses, recurringItems, splitTransfers, payments }) => {
                      const personKey = `${categoryId}:${person.id}`;
                      const isExpanded = expandedOwedIds.has(personKey);
                      const isRecording = recordPaymentId === personKey;
                      const settled = outstanding <= 0.005;
                      return (
                        <div key={personKey}>
                          {/* Person row */}
                          <div className="flex items-center gap-3 px-4 py-3">
                            <button
                              onClick={() => setExpandedOwedIds((prev) => {
                                const n = new Set(prev);
                                n.has(personKey) ? n.delete(personKey) : n.add(personKey);
                                return n;
                              })}
                              className="flex items-center gap-3 flex-1 min-w-0 text-left"
                            >
                              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 text-xs font-bold shrink-0">
                                {person.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900">{person.name}</p>
                                <p className="text-xs text-slate-400">
                                  {fmtAmount(totalOwed)}{totalPaid > 0 && <> − {fmtAmount(totalPaid)} = <span className={settled ? "text-emerald-600" : "text-rose-500"}>{fmtAmount(outstanding)}</span></>}
                                </p>
                              </div>
                              <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                            </button>
                            <div className="flex items-center gap-3 shrink-0">
                              {settled ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">Settled</span>
                              ) : (
                                <span className="text-sm font-semibold text-rose-600">{fmtAmount(outstanding)}</span>
                              )}
                              {!settled && (
                                <button
                                  onClick={() => {
                                    if (isRecording) {
                                      setRecordPaymentId(null);
                                    } else {
                                      setRecordPaymentId(personKey);
                                      setRecordPaymentAmount("");
                                      setRecordPaymentDate(toLocalDate(new Date()));
                                      setRecordPaymentNotes("");
                                    }
                                  }}
                                  className="text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition-colors"
                                >
                                  Record payment
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Inline payment form */}
                          {isRecording && (
                            <div className="px-4 pb-3 pt-1 bg-emerald-50/60 border-t border-emerald-100">
                              <p className="text-xs font-medium text-emerald-700 mb-2">Recording payment from {person.name}</p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  placeholder="Amount"
                                  value={recordPaymentAmount}
                                  onChange={(e) => setRecordPaymentAmount(e.target.value)}
                                  className="w-28 text-sm border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                  autoFocus
                                />
                                <input
                                  type="date"
                                  value={recordPaymentDate}
                                  onChange={(e) => setRecordPaymentDate(e.target.value)}
                                  className="text-sm border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                />
                                <input
                                  type="text"
                                  placeholder="Notes (optional)"
                                  value={recordPaymentNotes}
                                  onChange={(e) => setRecordPaymentNotes(e.target.value)}
                                  className="flex-1 text-sm border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                />
                                <button
                                  onClick={() => recordPayment(person, categoryId)}
                                  disabled={!recordPaymentAmount || isNaN(parseFloat(recordPaymentAmount))}
                                  className="text-xs px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-colors disabled:opacity-40"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setRecordPaymentId(null)}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  <X size={15} />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Expanded transaction list */}
                          {isExpanded && (() => {
                            const expGroups = splitExpenses.reduce((acc, e) => {
                              const g = acc.find((x) => x.name === e.name);
                              if (g) { g.items.push(e); g.totalShare += e.share; }
                              else acc.push({ name: e.name, items: [e], totalShare: e.share });
                              return acc;
                            }, [] as { name: string; items: typeof splitExpenses; totalShare: number }[]);
                            const txGroups = splitTransfers.reduce((acc, t) => {
                              const label = t.name || `Sent to ${t.person}`;
                              const g = acc.find((x) => x.label === label);
                              if (g) { g.items.push(t); g.totalShare += t.share; }
                              else acc.push({ label, items: [t], totalShare: t.share });
                              return acc;
                            }, [] as { label: string; items: typeof splitTransfers; totalShare: number }[]);
                            const paymentsKey = `${personKey}:payments`;
                            const paymentsExpanded = expandedLedgerGroups.has(paymentsKey);
                            return (
                              <div className="bg-slate-50/60 border-t border-slate-100 divide-y divide-slate-100">
                                {/* Grouped one-off expenses */}
                                {expGroups.map((group) => {
                                  const gKey = `${personKey}:exp:${group.name}`;
                                  const gExpanded = expandedLedgerGroups.has(gKey);
                                  return (
                                    <div key={gKey}>
                                      <button
                                        onClick={() => setExpandedLedgerGroups((prev) => { const n = new Set(prev); n.has(gKey) ? n.delete(gKey) : n.add(gKey); return n; })}
                                        className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-slate-100/60 text-left"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <Receipt size={13} className="text-slate-400 shrink-0" />
                                          <span className="text-xs text-slate-700 truncate">{group.name}</span>
                                          {group.items.length > 1 && <span className="text-xs text-slate-400 shrink-0">{group.items.length}×</span>}
                                          <ChevronDown size={11} className={`text-slate-400 shrink-0 transition-transform ${gExpanded ? "" : "-rotate-90"}`} />
                                        </div>
                                        <span className="text-xs font-medium text-rose-500 shrink-0 ml-3">+{fmtAmount(group.totalShare)}</span>
                                      </button>
                                      {gExpanded && group.items.map((e) => (
                                        <div key={e.id} className="flex items-center justify-between pl-10 pr-5 py-1.5 bg-slate-100/50">
                                          <span className="text-xs text-slate-400">{fmtDate(e.date)} · total {fmtAmount(Number(e.amount))}</span>
                                          <span className="text-xs text-slate-400">+{fmtAmount(e.share)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                                {/* Recurring charges with expand/collapse per charge */}
                                {recurringItems.map(({ rc, total, months }) => {
                                  const rcKey = `${personKey}:rc:${rc.id}`;
                                  const rcExpanded = expandedLedgerGroups.has(rcKey);
                                  return (
                                    <div key={rcKey}>
                                      <button
                                        onClick={() => setExpandedLedgerGroups((prev) => { const n = new Set(prev); n.has(rcKey) ? n.delete(rcKey) : n.add(rcKey); return n; })}
                                        className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-slate-100/60 text-left"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <RefreshCw size={13} className="text-violet-400 shrink-0" />
                                          <span className="text-xs text-slate-700 truncate">{rc.name}</span>
                                          {months.length > 1 && <span className="text-xs text-slate-400 shrink-0">{months.length}×</span>}
                                          <ChevronDown size={11} className={`text-slate-400 shrink-0 transition-transform ${rcExpanded ? "" : "-rotate-90"}`} />
                                        </div>
                                        <span className="text-xs font-medium text-rose-500 shrink-0 ml-3">+{fmtAmount(total)}</span>
                                      </button>
                                      {rcExpanded && months.map(({ month, amount }) => (
                                        <div key={month} className="flex items-center justify-between pl-10 pr-5 py-1.5 bg-slate-100/50">
                                          <span className="text-xs text-slate-400">{formatMonthLabel(month)}</span>
                                          <span className="text-xs text-slate-400">+{fmtAmount(amount)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                                {/* Split transfers */}
                                {txGroups.map((group) => {
                                  const gKey = `${personKey}:tx:${group.label}`;
                                  const gExpanded = expandedLedgerGroups.has(gKey);
                                  return (
                                    <div key={gKey}>
                                      <button
                                        onClick={() => setExpandedLedgerGroups((prev) => { const n = new Set(prev); n.has(gKey) ? n.delete(gKey) : n.add(gKey); return n; })}
                                        className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-slate-100/60 text-left"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <ArrowUpRight size={13} className="text-violet-400 shrink-0" />
                                          <span className="text-xs text-slate-700 truncate">{group.label}</span>
                                          {group.items.length > 1 && <span className="text-xs text-slate-400 shrink-0">{group.items.length}×</span>}
                                          <ChevronDown size={11} className={`text-slate-400 shrink-0 transition-transform ${gExpanded ? "" : "-rotate-90"}`} />
                                        </div>
                                        <span className="text-xs font-medium text-rose-500 shrink-0 ml-3">+{fmtAmount(group.totalShare)}</span>
                                      </button>
                                      {gExpanded && group.items.map((t) => (
                                        <div key={t.id} className="flex items-center justify-between pl-10 pr-5 py-1.5 bg-slate-100/50">
                                          <span className="text-xs text-slate-400">{fmtDate(t.date)} · total {fmtAmount(Number(t.amount))}</span>
                                          <span className="text-xs text-slate-400">+{fmtAmount(t.share)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                                {/* Category-matched payments received */}
                                {payments.length > 0 && (
                                  <div>
                                    <button
                                      onClick={() => setExpandedLedgerGroups((prev) => { const n = new Set(prev); n.has(paymentsKey) ? n.delete(paymentsKey) : n.add(paymentsKey); return n; })}
                                      className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-slate-100/60 text-left"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                                        <span className="text-xs text-slate-700">Payments received</span>
                                        {payments.length > 1 && <span className="text-xs text-slate-400 shrink-0">{payments.length}×</span>}
                                        <ChevronDown size={11} className={`text-slate-400 shrink-0 transition-transform ${paymentsExpanded ? "" : "-rotate-90"}`} />
                                      </div>
                                      <span className="text-xs font-medium text-emerald-600 shrink-0 ml-3">−{fmtAmount(totalPaid)}</span>
                                    </button>
                                    {paymentsExpanded && payments.map((t) => (
                                      <div key={t.id} className="flex items-center justify-between pl-10 pr-5 py-1.5 bg-slate-100/50">
                                        <span className="text-xs text-slate-400">{fmtDate(t.date)} · {t.notes ?? "Payment received"}</span>
                                        <span className="text-xs text-slate-400">−{fmtAmount(Number(t.amount))}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Credit Card Reminders Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <button
            onClick={() => setCcRemindersOpen((o) => !o)}
            className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider hover:text-slate-600 transition-colors"
          >
            <Bell size={16} className="text-indigo-500" />
            Credit Card Reminders
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${ccRemindersOpen ? "" : "-rotate-90"}`} />
          </button>
          <button
            onClick={() => { setEditCcReminder(null); setCcReminderForm(EMPTY_CC_REMINDER); setCcReminderSaveError(null); setShowCcReminderModal(true); }}
            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded-md transition-colors"
            aria-label="Add credit card reminder"
          >
            <Plus size={20} />
          </button>
        </div>

        {ccRemindersOpen && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {ccReminders.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                  <Bell size={24} className="text-slate-300" />
                </div>
                <p className="text-slate-500 text-sm font-medium">No reminders added yet.</p>
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
                              onDelete={() => setDeleteTarget({ type: "cc_reminder", id: reminder.id })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* College Loans Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <button
            onClick={() => setLoansOpen((o) => !o)}
            className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider hover:text-slate-600 transition-colors"
          >
            <GraduationCap size={16} className="text-indigo-500" />
            College Loans
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${loansOpen ? "" : "-rotate-90"}`} />
          </button>
          <button
            onClick={() => { setEditLoan(null); setLoanForm(EMPTY_LOAN); setLoanSaveError(null); setShowLoanModal(true); }}
            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded-md transition-colors"
            aria-label="Add loan"
          >
            <Plus size={20} />
          </button>
        </div>

        {loansOpen && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {loans.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <GraduationCap size={24} className="text-slate-300" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">No loans added yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Loan</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Disbursed</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Orig. Principal</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unpaid Principal</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unpaid Interest</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Interest Paid</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-indigo-50/60">Current Balance</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loans.map((loan) => (
                        <tr key={loan.id} className="group hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                            {loan.name}
                            {loan.notes && (
                              <span className="block text-xs text-slate-400 font-normal mt-0.5 max-w-[180px] truncate">{loan.notes}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(loan.disbursement_date)}</td>
                          <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{fmtAmount(Number(loan.original_principal))}</td>
                          <td className="px-4 py-3 text-right text-slate-800 font-medium whitespace-nowrap">{fmtAmount(Number(loan.unpaid_principal))}</td>
                          <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{Number(loan.interest_rate).toFixed(4).replace(/\.?0+$/, "")}%</td>
                          <td className="px-4 py-3 text-right text-amber-600 font-medium whitespace-nowrap">{fmtAmount(Number(loan.unpaid_interest))}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 whitespace-nowrap">{fmtAmount(Number(loan.total_interest_paid))}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap bg-indigo-50/30">
                            {fmtAmount(Number(loan.unpaid_principal) + Number(loan.unpaid_interest))}
                          </td>
                          <td className="px-4 py-3">
                            <RowMenu
                              onEdit={() => {
                                setEditLoan(loan);
                                setLoanForm({ name: loan.name, disbursement_date: loan.disbursement_date, original_principal: String(loan.original_principal), unpaid_principal: String(loan.unpaid_principal), interest_rate: String(loan.interest_rate), unpaid_interest: String(loan.unpaid_interest), total_interest_paid: String(loan.total_interest_paid), notes: loan.notes ?? "" });
                                setLoanSaveError(null);
                                setShowLoanModal(true);
                              }}
                              onDelete={() => setDeleteTarget({ type: "loan", id: loan.id })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Utilities Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <button onClick={() => setUtilitiesOpen((o) => !o)}
            className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider hover:text-slate-600 transition-colors">
            <Zap size={16} className="text-amber-500" />
            Utilities
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${utilitiesOpen ? "" : "-rotate-90"}`} />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={openAddBill} className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 p-1 rounded-md transition-colors" aria-label="Add utility bill">
              <Plus size={20} />
            </button>
          </div>
        </div>

        {utilitiesOpen && (
          <div className="space-y-4">

            {/* Balance summary */}
            {utilityBalances.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button onClick={() => setUtilBalancesOpen((o) => !o)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-left hover:bg-amber-100/60 transition-colors">
                  <Users size={12} className="text-amber-600 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Who Owes Me</span>
                  <ChevronDown size={11} className={`text-amber-500 ml-auto transition-transform ${utilBalancesOpen ? "" : "-rotate-90"}`} />
                </button>
                {utilBalancesOpen && (
                  <div className="divide-y divide-slate-100">
                    {utilityBalances.map(({ name, owed, outstanding, bills, reimbursements }) => {
                      const settled = outstanding <= 0.005;
                      const isExpanded = expandedUtilPersons.has(name);
                      return (
                        <div key={name}>
                          <div className="flex items-center hover:bg-slate-50 transition-colors">
                            <button
                              onClick={() => setExpandedUtilPersons((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; })}
                              className="flex-1 flex items-center gap-3 px-4 py-3 text-left">
                              <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 text-xs font-bold shrink-0">
                                {name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900">{name}</p>
                                <p className="text-xs text-slate-400">{fmtAmount(owed)}</p>
                              </div>
                              <ChevronDown size={13} className={`text-slate-400 transition-transform mr-2 ${isExpanded ? "" : "-rotate-90"}`} />
                            </button>
                            <button
                              onClick={() => togglePersonPaid(name, settled, owed, reimbursements)}
                              className="pr-4 pl-1 py-3 shrink-0">
                              {settled
                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium border border-emerald-200">Paid ✓</span>
                                : <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium border border-rose-200">Unpaid</span>
                              }
                            </button>
                          </div>
                          {isExpanded && bills.length > 0 && (
                            <div className="bg-slate-50/60 border-t border-slate-100 divide-y divide-slate-100">
                              {bills.map(({ bill, share }) => (
                                <div key={bill.id} className="flex items-center justify-between px-5 py-2">
                                  <div className="min-w-0">
                                    <span className="text-xs text-slate-700">{bill.utility}</span>
                                    <span className="text-xs text-slate-400 ml-2">
                                      {bill.service_period_start ? fmtDate(bill.service_period_start) : "—"} – {bill.service_period_end ? fmtDate(bill.service_period_end) : "—"}
                                    </span>
                                  </div>
                                  <span className="text-xs font-medium text-rose-500 ml-3">+{fmtAmount(share)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Bills list */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button onClick={() => setUtilBillsOpen((o) => !o)}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-left hover:bg-slate-100/60 transition-colors">
                <Zap size={12} className="text-amber-500 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Bills</span>
                <ChevronDown size={11} className={`text-slate-400 ml-auto transition-transform ${utilBillsOpen ? "" : "-rotate-90"}`} />
              </button>
              {utilBillsOpen && (() => {
                const billsToday = new Date();
                const billsTodayMonth = `${billsToday.getFullYear()}-${String(billsToday.getMonth() + 1).padStart(2, "0")}`;
                const billsTodayDay = billsToday.getDate();
                const billsTodayStr = `${billsTodayMonth}-${String(billsTodayDay).padStart(2, "0")}`;
                const visibleBills = utilityBills.filter((b) =>
                  b.is_recurring
                    ? b.billing_start != null && b.billing_start.substring(0, 7) <= selectedMonth
                    : b.charge_date != null && b.charge_date.startsWith(selectedMonth)
                );
                return visibleBills.length === 0
                  ? <p className="px-4 py-6 text-sm text-slate-400 text-center">No utility bills for this month.</p>
                  : <ul className="divide-y divide-slate-100">
                    {visibleBills.map((b) => {
                      const monthAmount = b.is_recurring ? getUtilBillPriceForMonth(b, selectedMonth) : Number(b.amount);
                      const names = b.split_with ? b.split_with.split(",") : [];
                      const share = names.length > 0 ? monthAmount / (names.length + 1) : null;
                      const sinceMo = b.billing_start ? b.billing_start.substring(0, 7) : null;
                      const isUpcoming = b.is_recurring
                        ? selectedMonth > billsTodayMonth || (selectedMonth === billsTodayMonth && b.charge_day != null && billsTodayDay < b.charge_day)
                        : b.charge_date != null && b.charge_date > billsTodayStr;
                      return (
                        <li key={b.id} className="group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-800">{b.utility}</p>
                              {isUpcoming
                                ? <span className="text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">Upcoming</span>
                                : b.is_recurring && <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Recurring</span>
                              }
                            </div>
                            {b.is_recurring ? (
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 block">
                                {b.charge_day ? `${ordinal(b.charge_day)} of each month` : "Monthly"}
                                {sinceMo ? ` · since ${sinceMo}` : ""}
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 block">
                                Service: {b.service_period_start ? fmtDate(b.service_period_start) : "—"} – {b.service_period_end ? fmtDate(b.service_period_end) : "—"} · Charged {b.charge_date ? fmtDate(b.charge_date) : "—"}
                              </span>
                            )}
                            {names.length > 0 && share != null && (
                              <p className="text-xs text-amber-600 font-medium mt-0.5">
                                Split with {names.join(", ")} · {fmtAmount(share)} each
                              </p>
                            )}
                            {b.notes && <p className="text-xs text-slate-400 mt-0.5">{b.notes}</p>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className="font-bold text-slate-800">{fmtAmount(monthAmount)}</span>
                            <RowMenu
                              onEdit={() => openEditBill(b)}
                              onDelete={() => deleteBill(b.id)}
                              onLogPrice={b.is_recurring ? () => { setUtilLogPriceTarget(b); setShowUtilLogPriceModal(true); setUtilLogPriceForm({ amount: "", effectiveMonth: "" }); setUtilLogPriceSaveError(null); } : undefined}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>;
              })()}
            </div>

          </div>
        )}
      </section>

      {/* Recurring Charges Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <button
            onClick={() => setRecurringOpen((o) => !o)}
            className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider hover:text-slate-600 transition-colors"
          >
            <RefreshCw size={16} className="text-violet-500" />
            Recurring Charges
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${recurringOpen ? "" : "-rotate-90"}`} />
          </button>
          <button
            onClick={openAddRecurring}
            className="text-slate-400 hover:text-violet-600 hover:bg-violet-50 p-1 rounded-md transition-colors"
            aria-label="Add recurring charge"
          >
            <Plus size={20} />
          </button>
        </div>

        {recurringOpen && <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {recurringCharges.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                <RefreshCw size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-500 text-sm font-medium">No recurring charges set up yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recurringCharges.map((rc) => {
                const applied = recurringApplied(rc);
                const catName = getCatName(rc.category_id, expenseCategories);
                const canceledThisMonth = isCanceledForMonth(rc, selectedMonth);
                const sortedHistory = [...rc.price_history].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
                const hasHistory = sortedHistory.some((h) => h.effective_from !== "2000-01-01");
                const isExpanded = expandedRecurringIds.has(rc.id);
                return (
                  <li key={rc.id} className={`divide-y divide-slate-50 ${canceledThisMonth ? "opacity-60" : ""}`}>
                    {/* Main row */}
                    <div
                      className={`group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors ${hasHistory ? "cursor-pointer" : ""}`}
                      onClick={hasHistory ? () => toggleRecurring(rc.id) : undefined}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium truncate ${canceledThisMonth ? "text-slate-400 line-through" : "text-slate-800"}`}>{rc.name}</p>
                          {catName && !canceledThisMonth && (
                            <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0">
                              {catName}
                            </span>
                          )}
                          {rc.credit_card_id && !canceledThisMonth && (() => { const cc = creditCards.find((c) => c.id === rc.credit_card_id); return cc ? (
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0">
                              {cc.name}{cc.last_four ? ` ····${cc.last_four}` : ""}
                            </span>
                          ) : null; })()}
                          {canceledThisMonth && (
                            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500 bg-rose-50 px-2 py-0.5 rounded-sm shrink-0">
                              Canceled
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            {ordinal(rc.charge_date)} of each month
                          </span>
                          {!canceledThisMonth && (applied ? (
                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-sm flex items-center gap-1">
                              <CheckCircle2 size={10} /> Charged
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-sm">
                              Upcoming
                            </span>
                          ))}
                          {rc.notes && (
                            <span className="text-xs text-slate-400 truncate">{rc.notes}</span>
                          )}
                          {rc.split_with && !canceledThisMonth && (() => {
                            const names = rc.split_with.split(",");
                            const perPerson = getPriceForMonth(rc, selectedMonth) / (names.length + 1);
                            return (
                              <span className="text-xs text-indigo-400 flex items-center gap-1 shrink-0">
                                <Users size={10} />
                                Split with {names.join(", ")} · {fmtAmount(perPerson)} each
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <span className={`font-bold ${canceledThisMonth ? "text-slate-300" : "text-slate-600"}`}>
                          {fmtAmount(getPriceForMonth(rc, selectedMonth))}
                        </span>
                        <RowMenu
                          onEdit={() => openEditRecurring(rc)}
                          onDelete={() => setDeleteTarget({ type: "recurring", id: rc.id })}
                          onLogPrice={!canceledThisMonth ? () => {
                            setLogPriceTarget(rc);
                            setLogPriceForm({ amount: String(rc.amount), effectiveMonth: currentMonth() });
                            setLogPriceSaveError(null);
                            setShowLogPriceModal(true);
                          } : undefined}
                          onToggleCancel={() => canceledThisMonth ? reactivateRecurring(rc) : cancelRecurring(rc)}
                          isCanceled={canceledThisMonth}
                        />
                      </div>
                    </div>

                    {/* Price history rows */}
                    {hasHistory && isExpanded && sortedHistory.map((entry, i) => {
                      const nextEntry = sortedHistory[i + 1] ?? null;
                      const label = formatPriceRange(entry, nextEntry);
                      return (
                        <div key={entry.id} className="flex items-center justify-between pl-6 pr-4 py-2.5 bg-slate-50/70">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
                          <span className="text-sm font-semibold text-slate-500">{fmtAmount(Number(entry.amount))}</span>
                        </div>
                      );
                    })}
                  </li>
                );
              })}
            </ul>
          )}
        </div>}
      </section>

      {/* Money Transfers Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <button
            onClick={() => setTransfersOpen((o) => !o)}
            className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider hover:text-slate-600 transition-colors"
          >
            <Send size={16} className="text-violet-500" />
            Money Transfers
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${transfersOpen ? "" : "-rotate-90"}`} />
          </button>
          <button
            onClick={openAddTransfer}
            className="text-slate-400 hover:text-violet-600 hover:bg-violet-50 p-1 rounded-md transition-colors"
            aria-label="Add transfer"
          >
            <Plus size={20} />
          </button>
        </div>

        {transfersOpen && <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {moneyTransfers.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-slate-500 text-sm font-medium">No transfers recorded yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {moneyTransfers.map((t) => {
                const isSent = t.direction === "sent";
                return (
                  <li key={t.id} className="group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isSent ? "bg-red-50" : "bg-emerald-50"}`}>
                        {isSent
                          ? <ArrowUpRight size={16} className="text-red-500" />
                          : <ArrowDownLeft size={16} className="text-emerald-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {t.name || (isSent ? "Sent to " + t.person : "Received from " + t.person)}
                          </p>
                          {t.category_id && (() => { const cat = expenseCategories.find((c) => c.id === t.category_id); return cat ? (
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0">
                              {cat.name}
                            </span>
                          ) : null; })()}
                          {t.platform && (
                            <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0">
                              {t.platform}
                            </span>
                          )}
                          {t.bank_id && (() => { const b = banks.find((b) => b.id === t.bank_id); return b ? (
                            <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0">
                              {b.name}
                            </span>
                          ) : null; })()}
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 block">
                          {isSent ? "Sent to" : "Received from"} {t.person} · {fmtDate(t.date)}
                        </span>
                        {t.split_with && (() => {
                          const names = t.split_with.split(",");
                          const perPerson = Number(t.amount) / (names.length + 1);
                          return (
                            <p className="text-xs text-violet-500 font-medium mt-0.5">
                              Split with {names.join(", ")} · {fmtAmount(perPerson)} each
                            </p>
                          );
                        })()}
                        {t.notes && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{t.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className={`font-bold ${isSent ? "text-red-500" : "text-emerald-600"}`}>
                        {isSent ? "−" : "+"}{fmtAmount(Number(t.amount))}
                      </span>
                      <RowMenu
                        onEdit={() => openEditTransfer(t)}
                        onDelete={() => setDeleteTarget({ type: "transfer", id: t.id })}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>}
      </section>

      {/* Expenses Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <button
            onClick={() => setExpensesOpen((o) => !o)}
            className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider hover:text-slate-600 transition-colors"
          >
            <Receipt size={16} className="text-indigo-500" />
            Recent Expenses
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${expensesOpen ? "" : "-rotate-90"}`} />
          </button>
          <div className="flex items-center gap-2">
            {/* Sort selector */}
            <select
              value={expenseSort}
              onChange={(e) => setExpenseSort(e.target.value as typeof expenseSort)}
              className="text-xs border border-slate-200 rounded-md px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
            >
              <option value="date-desc">Newest</option>
              <option value="date-asc">Oldest</option>
              <option value="amount-desc">Highest</option>
              <option value="amount-asc">Lowest</option>
            </select>

            {/* CC filter dropdown */}
            {creditCards.length > 0 && (
              <div className="relative" ref={ccFilterDropRef}>
                <button
                  onClick={() => setCcFilterDropOpen((o) => !o)}
                  className={`flex items-center gap-1 text-xs border rounded-md px-2 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                    cardFilterIds.size > 0
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <CreditCardIcon size={12} />
                  {cardFilterIds.size > 0 ? `${cardFilterIds.size} card${cardFilterIds.size !== 1 ? "s" : ""}` : "All cards"}
                  <ChevronDown size={12} />
                </button>
                {ccFilterDropOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 min-w-[160px] py-1">
                    <button
                      onClick={() => setCardFilterIds(new Set())}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 font-medium"
                    >
                      Clear filter
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    {[{ id: null as null | number, name: "No card" }, ...creditCards].map((card) => {
                      const isSelected = cardFilterIds.has(card.id);
                      return (
                        <button
                          key={card.id ?? "none"}
                          onClick={() => {
                            setCardFilterIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(card.id)) next.delete(card.id); else next.add(card.id);
                              return next;
                            });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${isSelected ? "bg-indigo-500 border-indigo-500" : "border-slate-300"}`}>
                            {isSelected && <span className="text-white text-[9px] font-bold">✓</span>}
                          </span>
                          {card.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowScanModal(true)}
              className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded-md transition-colors"
              aria-label="Scan receipt"
              title="Scan receipt or bill"
            >
              <ScanLine size={20} />
            </button>
            <button
              onClick={openAddExpense}
              className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded-md transition-colors"
              aria-label="Add expense"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {expensesOpen && <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {expenseGroups.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center">
              <p className="text-slate-500 text-sm font-medium">
                {cardFilterIds.size > 0 ? "No expenses match the selected cards." : "No expenses logged for this month."}
              </p>
              {cardFilterIds.size > 0 && (
                <button onClick={() => setCardFilterIds(new Set())} className="mt-2 text-xs text-indigo-500 hover:underline">
                  Clear filter
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {expenseGroups.map((group) => {
                const isGroup = group.items.length > 1;
                const isExpanded = expandedGroups.has(group.key);
                const solo = group.items[0];
                const catName = getCatName(solo.category_id, expenseCategories);
                const cardName = getCardDisplayName(solo.credit_card_id);
                const splitNames = solo.split_with ? solo.split_with.split(",") : [];
                const perPerson = splitNames.length > 0 ? Number(solo.amount) / (splitNames.length + 1) : null;

                return (
                  <li key={group.key} className="divide-y divide-slate-50">
                    {/* Parent / solo row */}
                    <div
                      className={`group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors ${isGroup ? "cursor-pointer" : ""}`}
                      onClick={isGroup ? () => toggleGroup(group.key) : undefined}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800 truncate">{group.name}</p>
                          {isGroup && (
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold shrink-0">
                              {group.items.length}×
                            </span>
                          )}
                          {!isGroup && catName && (
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0">
                              {catName}
                            </span>
                          )}
                          {!isGroup && cardName && (
                            <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 flex items-center gap-1">
                              <CreditCardIcon size={10} />
                              {cardName}
                            </span>
                          )}
                        </div>
                        {isGroup ? (
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 block">
                            {group.items.length} transactions · latest {fmtDate(group.items[0].date)}
                          </span>
                        ) : (
                          <>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 block">
                              {fmtDate(solo.date)}
                            </span>
                            {solo.service_period_start && solo.service_period_end && (
                              <p className="text-xs text-amber-600 font-medium mt-0.5">
                                Service: {fmtDate(solo.service_period_start)} – {fmtDate(solo.service_period_end)}
                              </p>
                            )}
                            {solo.notes && (
                              <p className="text-xs text-slate-400 mt-0.5 truncate">{solo.notes}</p>
                            )}
                            {splitNames.length > 0 && (
                              <p className="text-xs text-indigo-400 mt-0.5 flex items-center gap-1">
                                <Users size={10} />
                                Split with {splitNames.join(", ")}
                                {perPerson != null && <span className="text-slate-300 mx-0.5">·</span>}
                                {perPerson != null && <span>{fmtAmount(perPerson)} each</span>}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <span className={`font-bold ${group.total < 0 ? "text-emerald-600" : "text-slate-600"}`}>
                          {fmtAmount(group.total)}
                        </span>
                        {!isGroup ? (
                          <RowMenu
                            onEdit={() => openEditExpense(solo)}
                            onDelete={() => setDeleteTarget({ type: "expense", id: solo.id })}
                            onReturn={Number(solo.amount) > 0 ? () => returnExpense(solo) : undefined}
                          />
                        ) : (
                          <div className="w-[30px]" />
                        )}
                      </div>
                    </div>

                    {/* Children rows */}
                    {isGroup && isExpanded && group.items.map((expense) => {
                      const expCatName = getCatName(expense.category_id, expenseCategories);
                      const expCardName = getCardDisplayName(expense.credit_card_id);
                      const expSplitNames = expense.split_with ? expense.split_with.split(",") : [];
                      const expPerPerson = expSplitNames.length > 0 ? Number(expense.amount) / (expSplitNames.length + 1) : null;
                      return (
                        <div
                          key={expense.id}
                          className="group flex items-center justify-between pl-9 pr-4 py-3 bg-slate-50/70 hover:bg-slate-100/60 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {expCatName && (
                                <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0">
                                  {expCatName}
                                </span>
                              )}
                              {expCardName && (
                                <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 flex items-center gap-1">
                                  <CreditCardIcon size={10} />
                                  {expCardName}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 block">
                              {fmtDate(expense.date)}
                            </span>
                            {expense.service_period_start && expense.service_period_end && (
                              <p className="text-xs text-amber-600 font-medium mt-0.5">
                                Service: {fmtDate(expense.service_period_start)} – {fmtDate(expense.service_period_end)}
                              </p>
                            )}
                            {expense.notes && (
                              <p className="text-xs text-slate-400 mt-0.5 truncate">{expense.notes}</p>
                            )}
                            {expSplitNames.length > 0 && (
                              <p className="text-xs text-indigo-400 mt-0.5 flex items-center gap-1">
                                <Users size={10} />
                                Split with {expSplitNames.join(", ")}
                                {expPerPerson != null && <span className="text-slate-300 mx-0.5">·</span>}
                                {expPerPerson != null && <span>{fmtAmount(expPerPerson)} each</span>}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className={`font-bold text-sm ${Number(expense.amount) < 0 ? "text-emerald-600" : "text-slate-600"}`}>
                              {fmtAmount(Number(expense.amount))}
                            </span>
                            <RowMenu
                              onEdit={() => openEditExpense(expense)}
                              onDelete={() => setDeleteTarget({ type: "expense", id: expense.id })}
                              onReturn={Number(expense.amount) > 0 ? () => returnExpense(expense) : undefined}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </li>
                );
              })}
            </ul>
          )}
        </div>}
      </section>

      {/* Credit Card Modal */}
      {showCreditCardModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-semibold text-slate-900">
                {editCreditCard ? "Edit Credit Card" : "Add Credit Card"}
              </h2>
              <button onClick={() => { setShowCreditCardModal(false); setEditCreditCard(null); setCreditCardForm(EMPTY_CC_FORM); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveCreditCard} className="flex flex-col gap-4 p-6">
              {ccSaveError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{ccSaveError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Card Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={creditCardForm.name}
                  onChange={(e) => setCreditCardForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Chase Sapphire"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {Object.entries(CARD_COLOR_MAP).map(([key, hex]) => (
                    <button key={key} type="button" onClick={() => setCreditCardForm((f) => ({ ...f, color: key }))}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${creditCardForm.color === key ? "border-slate-700 scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={() => { setShowCreditCardModal(false); setEditCreditCard(null); setCreditCardForm(EMPTY_CC_FORM); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
                  {editCreditCard ? "Save changes" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (() => {
        const total = parseFloat(expenseForm.amount) || 0;
        const splitCount = splitPeople.length + 1;
        const perPerson = total > 0 && splitCount > 1 ? total / splitCount : 0;
        const closeModal = () => {
          setShowExpenseModal(false);
          setEditExpense(null);
          setExpenseForm(EMPTY_EXPENSE);
          setExpenseSaveError(null);
          resetSplit();
          setAddingCat(false); setNewCatName(""); setCatDropOpen(false);
          setCardDropOpen(false);
          resetInlineCard();
        };

        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 pb-0">
                <h2 className="text-lg font-semibold text-slate-900">{editExpense ? "Edit Expense" : "New Expense"}</h2>
                <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={saveExpense} className="flex flex-col gap-4 p-6">
                {expenseSaveError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {expenseSaveError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input type="text" required value={expenseForm.name}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Groceries, Uber"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Amount
                      <span className="text-slate-400 font-normal ml-1 text-xs">(negative = refund)</span>
                    </label>
                    <input type="number" step="0.01" required value={expenseForm.amount}
                      onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <input type="date" required value={expenseForm.date}
                      onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>

                {/* Category with inline add */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">Category</label>
                    {!addingCat && (
                      <button type="button" onClick={() => { setAddingCat(true); setNewCatName(""); setCatDropOpen(false); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 transition-colors">
                        <Plus size={12} /> New
                      </button>
                    )}
                  </div>
                  {addingCat ? (
                    <div className="flex gap-2">
                      <input type="text" autoFocus value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExpenseCategory(); } if (e.key === "Escape") { setAddingCat(false); setNewCatName(""); } }}
                        placeholder="Category name"
                        className="flex-1 border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <button type="button" onClick={addExpenseCategory} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Add</button>
                      <button type="button" onClick={() => { setAddingCat(false); setNewCatName(""); }} className="px-2 py-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="relative" ref={catDropRef}>
                      <button type="button"
                        onClick={() => setCatDropOpen((o) => !o)}
                        className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm text-left bg-white hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <span className={expenseForm.category_id ? "text-slate-800" : "text-slate-400"}>
                          {expenseForm.category_id
                            ? (expenseCategories.find((c) => c.id === parseInt(expenseForm.category_id))?.name ?? "None")
                            : "None"}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${catDropOpen ? "rotate-180" : ""}`} />
                      </button>
                      {catDropOpen && (
                        <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                          <button type="button"
                            onClick={() => { setExpenseForm((f) => ({ ...f, category_id: "" })); setCatDropOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-50">
                            None
                          </button>
                          {expenseCategories.map((c) => (
                            <div key={c.id} className="flex items-center group/opt">
                              <button type="button"
                                onClick={() => { setExpenseForm((f) => ({ ...f, category_id: String(c.id) })); setCatDropOpen(false); }}
                                className="flex-1 text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                {c.name}
                              </button>
                              <button type="button"
                                onClick={() => deleteCategory(c.id)}
                                className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Credit card selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">Credit Card</label>
                    {!addingCard && (
                      <button type="button"
                        onClick={() => { setCardDropOpen(false); setAddingCard(true); setNewCardName(""); setNewCardColor("blue"); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 transition-colors">
                        <Plus size={12} /> New card
                      </button>
                    )}
                  </div>
                  {addingCard ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        autoFocus
                        value={newCardName}
                        onChange={(e) => setNewCardName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); addCardInline(); }
                          if (e.key === "Escape") resetInlineCard();
                        }}
                        placeholder="e.g. Chase Sapphire"
                        className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {Object.entries(CARD_COLOR_MAP).map(([key, hex]) => (
                            <button key={key} type="button" onClick={() => setNewCardColor(key)}
                              className={`w-5 h-5 rounded-full border-2 transition-all ${newCardColor === key ? "border-slate-700 scale-110" : "border-transparent"}`}
                              style={{ backgroundColor: hex }} />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={addCardInline}
                            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                            Add
                          </button>
                          <button type="button" onClick={resetInlineCard}
                            className="px-2 py-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative" ref={cardDropRef}>
                      <button type="button"
                        onClick={() => setCardDropOpen((o) => !o)}
                        className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm text-left bg-white hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <span className={expenseForm.credit_card_id ? "text-slate-800" : "text-slate-400"}>
                          {expenseForm.credit_card_id
                            ? (() => { const c = creditCards.find((c) => c.id === parseInt(expenseForm.credit_card_id)); return c ? `${c.name}${c.last_four ? ` ····${c.last_four}` : ""}` : "None"; })()
                            : "None"}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${cardDropOpen ? "rotate-180" : ""}`} />
                      </button>
                      {cardDropOpen && (
                        <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                          <button type="button"
                            onClick={() => { setExpenseForm((f) => ({ ...f, credit_card_id: "" })); setCardDropOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-50">
                            None
                          </button>
                          {creditCards.map((c) => (
                            <div key={c.id} className="flex items-center group/opt">
                              <button type="button"
                                onClick={() => { setExpenseForm((f) => ({ ...f, credit_card_id: String(c.id) })); setCardDropOpen(false); }}
                                className="flex-1 text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                {c.name}{c.last_four ? ` ····${c.last_four}` : ""}
                              </button>
                              <button type="button"
                                onClick={() => deleteCreditCard(c.id)}
                                className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Split section */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                    <Users size={14} className="text-slate-400" />
                    Split this expense
                  </label>
                  <div className="relative" ref={splitDropRef}>
                    <button type="button"
                      onClick={() => { setSplitDropOpen((o) => !o); setAddingPerson(false); setNewPersonName(""); }}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm text-left bg-white hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <span className={splitPeople.length ? "text-slate-800" : "text-slate-400"}>
                        {splitPeople.length ? splitPeople.join(", ") : "Select people…"}
                      </span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${splitDropOpen ? "rotate-180" : ""}`} />
                    </button>
                    {splitDropOpen && (
                      <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                        {knownPeople.length === 0 && !addingPerson && (
                          <p className="px-3 py-2 text-sm text-slate-400">No people yet — add one below.</p>
                        )}
                        {knownPeople.map((p) => {
                          const selected = splitPeople.includes(p.name);
                          return (
                            <div key={p.id} className="flex items-center group/opt">
                              <button type="button"
                                onClick={() => toggleSplitPerson(p.name)}
                                className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${selected ? "bg-indigo-50/60 text-indigo-600 font-medium hover:bg-indigo-50" : "text-slate-700 hover:bg-slate-50"}`}>
                                <span className="w-3.5 shrink-0 flex items-center">
                                  {selected && <CheckCircle2 size={13} className="text-indigo-500" />}
                                </span>
                                {p.name}
                              </button>
                              <button type="button"
                                onClick={() => removePerson(p.name)}
                                className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                                <X size={13} />
                              </button>
                            </div>
                          );
                        })}
                        <div className={knownPeople.length > 0 ? "border-t border-slate-100 mt-1 pt-1" : ""}>
                          {addingPerson ? (
                            <div className="flex gap-1.5 px-2 py-1.5">
                              <input type="text" autoFocus value={newPersonName}
                                onChange={(e) => setNewPersonName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewPerson(); } if (e.key === "Escape") { setAddingPerson(false); setNewPersonName(""); } }}
                                placeholder="Person name"
                                className="flex-1 border border-indigo-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                              <button type="button" onClick={addNewPerson} className="px-2.5 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Add</button>
                              <button type="button" onClick={() => { setAddingPerson(false); setNewPersonName(""); }} className="px-1.5 text-slate-400 hover:text-slate-600 transition-colors"><X size={14} /></button>
                            </div>
                          ) : (
                            <button type="button"
                              onClick={() => setAddingPerson(true)}
                              className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors">
                              <Plus size={13} /> New person
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {splitPeople.length > 0 && perPerson > 0 && (
                    <p className="text-xs text-indigo-600 font-medium bg-indigo-50 rounded-md px-3 py-2 mt-2">
                      Split with {splitPeople.join(", ")} · {fmtAmount(perPerson)} each
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea value={expenseForm.notes}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="Optional notes"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>

                {/* Service period */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Service period
                    <span className="text-slate-400 font-normal ml-1 text-xs">— for bills charged after the service period (e.g. water)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">From</label>
                      <input type="date" value={expenseForm.service_period_start}
                        onChange={(e) => setExpenseForm((f) => ({ ...f, service_period_start: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">To</label>
                      <input type="date" value={expenseForm.service_period_end}
                        onChange={(e) => setExpenseForm((f) => ({ ...f, service_period_end: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={closeModal}
                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                  {!editExpense && (
                    <button
                      type="button"
                      onClick={saveExpenseAndAddAnother}
                      className="px-4 py-2 text-sm border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Save & add another
                    </button>
                  )}
                  <button type="submit"
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    {editExpense ? "Save changes" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Recurring Charge Modal */}
      {showRecurringModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-semibold text-slate-900">
                {editRecurring ? "Edit Recurring Charge" : "New Recurring Charge"}
              </h2>
              <button
                onClick={() => { setShowRecurringModal(false); setEditRecurring(null); setRecurringForm(EMPTY_RECURRING); setRecurringSaveError(null); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveRecurring} className="flex flex-col gap-4 p-6">
              {recurringSaveError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {recurringSaveError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={recurringForm.name}
                  onChange={(e) => setRecurringForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Netflix, Electric Bill"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={recurringForm.amount}
                    onChange={(e) => setRecurringForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Charge Date
                    <span className="text-slate-400 font-normal ml-1 text-xs">(day of month)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={recurringForm.charge_date}
                    onChange={(e) => setRecurringForm((f) => ({ ...f, charge_date: e.target.value }))}
                    placeholder="1–31"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Recurring category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Category</label>
                  {!addingRecurringCat && (
                    <button type="button" onClick={() => { setAddingRecurringCat(true); setNewRecurringCatName(""); setRecurringCatDropOpen(false); }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 transition-colors">
                      <Plus size={12} /> New
                    </button>
                  )}
                </div>
                {addingRecurringCat ? (
                  <div className="flex gap-2">
                    <input type="text" autoFocus value={newRecurringCatName} onChange={(e) => setNewRecurringCatName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecurringCategory(); } if (e.key === "Escape") { setAddingRecurringCat(false); setNewRecurringCatName(""); } }}
                      placeholder="Category name"
                      className="flex-1 border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button type="button" onClick={addRecurringCategory} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Add</button>
                    <button type="button" onClick={() => { setAddingRecurringCat(false); setNewRecurringCatName(""); }} className="px-2 py-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="relative" ref={recurringCatDropRef}>
                    <button type="button"
                      onClick={() => setRecurringCatDropOpen((o) => !o)}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm text-left bg-white hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <span className={recurringForm.category_id ? "text-slate-800" : "text-slate-400"}>
                        {recurringForm.category_id
                          ? (expenseCategories.find((c) => c.id === parseInt(recurringForm.category_id))?.name ?? "None")
                          : "None"}
                      </span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${recurringCatDropOpen ? "rotate-180" : ""}`} />
                    </button>
                    {recurringCatDropOpen && (
                      <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                        <button type="button"
                          onClick={() => { setRecurringForm((f) => ({ ...f, category_id: "" })); setRecurringCatDropOpen(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-50">
                          None
                        </button>
                        {expenseCategories.map((c) => (
                          <div key={c.id} className="flex items-center group/opt">
                            <button type="button"
                              onClick={() => { setRecurringForm((f) => ({ ...f, category_id: String(c.id) })); setRecurringCatDropOpen(false); }}
                              className="flex-1 text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                              {c.name}
                            </button>
                            <button type="button"
                              onClick={() => deleteRecurringCategory(c.id)}
                              className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Credit card */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Credit Card</label>
                  {!addingCard && (
                    <button type="button"
                      onClick={() => { setRecurringCardDropOpen(false); setAddingCard(true); setNewCardName(""); setNewCardColor("blue"); }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 transition-colors">
                      <Plus size={12} /> New card
                    </button>
                  )}
                </div>
                {addingCard ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={newCardName}
                      onChange={(e) => setNewCardName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addRecurringCardInline(); }
                        if (e.key === "Escape") resetInlineCard();
                      }}
                      placeholder="e.g. Chase Sapphire"
                      className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {Object.entries(CARD_COLOR_MAP).map(([key, hex]) => (
                          <button key={key} type="button" onClick={() => setNewCardColor(key)}
                            className={`w-5 h-5 rounded-full border-2 transition-all ${newCardColor === key ? "border-slate-700 scale-110" : "border-transparent"}`}
                            style={{ backgroundColor: hex }} />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={addRecurringCardInline}
                          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                          Add
                        </button>
                        <button type="button" onClick={resetInlineCard}
                          className="px-2 py-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative" ref={recurringCardDropRef}>
                    <button type="button"
                      onClick={() => setRecurringCardDropOpen((o) => !o)}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm text-left bg-white hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <span className={recurringForm.credit_card_id ? "text-slate-800" : "text-slate-400"}>
                        {recurringForm.credit_card_id
                          ? (() => { const c = creditCards.find((c) => c.id === parseInt(recurringForm.credit_card_id)); return c ? `${c.name}${c.last_four ? ` ····${c.last_four}` : ""}` : "None"; })()
                          : "None"}
                      </span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${recurringCardDropOpen ? "rotate-180" : ""}`} />
                    </button>
                    {recurringCardDropOpen && (
                      <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                        <button type="button"
                          onClick={() => { setRecurringForm((f) => ({ ...f, credit_card_id: "" })); setRecurringCardDropOpen(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-50">
                          None
                        </button>
                        {creditCards.map((c) => (
                          <div key={c.id} className="flex items-center group/opt">
                            <button type="button"
                              onClick={() => { setRecurringForm((f) => ({ ...f, credit_card_id: String(c.id) })); setRecurringCardDropOpen(false); }}
                              className="flex-1 text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                              {c.name}{c.last_four ? ` ····${c.last_four}` : ""}
                            </button>
                            <button type="button"
                              onClick={() => deleteCreditCard(c.id)}
                              className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Split section */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400" />
                  Split this charge
                </label>
                <div className="relative" ref={splitDropRef}>
                  <button type="button"
                    onClick={() => { setSplitDropOpen((o) => !o); setAddingPerson(false); setNewPersonName(""); }}
                    className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm text-left bg-white hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <span className={splitPeople.length ? "text-slate-800" : "text-slate-400"}>
                      {splitPeople.length ? splitPeople.join(", ") : "Select people…"}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${splitDropOpen ? "rotate-180" : ""}`} />
                  </button>
                  {splitDropOpen && (
                    <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                      {knownPeople.length === 0 && !addingPerson && (
                        <p className="px-3 py-2 text-sm text-slate-400">No people yet — add one below.</p>
                      )}
                      {knownPeople.map((p) => {
                        const selected = splitPeople.includes(p.name);
                        return (
                          <div key={p.id} className="flex items-center group/opt">
                            <button type="button"
                              onClick={() => toggleSplitPerson(p.name)}
                              className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${selected ? "bg-indigo-50/60 text-indigo-600 font-medium hover:bg-indigo-50" : "text-slate-700 hover:bg-slate-50"}`}>
                              <span className="w-3.5 shrink-0 flex items-center">
                                {selected && <CheckCircle2 size={13} className="text-indigo-500" />}
                              </span>
                              {p.name}
                            </button>
                            <button type="button" onClick={() => removePerson(p.name)}
                              className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                      <div className={knownPeople.length > 0 ? "border-t border-slate-100 mt-1 pt-1" : ""}>
                        {addingPerson ? (
                          <div className="flex gap-1.5 px-2 py-1.5">
                            <input type="text" autoFocus value={newPersonName}
                              onChange={(e) => setNewPersonName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewPerson(); } if (e.key === "Escape") { setAddingPerson(false); setNewPersonName(""); } }}
                              placeholder="Person name"
                              className="flex-1 border border-indigo-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            <button type="button" onClick={addNewPerson} className="px-2.5 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Add</button>
                            <button type="button" onClick={() => { setAddingPerson(false); setNewPersonName(""); }} className="px-1.5 text-slate-400 hover:text-slate-600 transition-colors"><X size={14} /></button>
                          </div>
                        ) : (
                          <button type="button"
                            onClick={() => setAddingPerson(true)}
                            className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors">
                            <Plus size={13} /> New person
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {splitPeople.length > 0 && (() => {
                  const rcTotal = parseFloat(recurringForm.amount) || 0;
                  const rcCount = splitPeople.length + 1;
                  const rcPer = rcTotal > 0 ? rcTotal / rcCount : 0;
                  return rcPer > 0 ? (
                    <p className="text-xs text-indigo-600 font-medium bg-indigo-50 rounded-md px-3 py-2 mt-2">
                      Split with {splitPeople.join(", ")} · {fmtAmount(rcPer)} each
                    </p>
                  ) : null;
                })()}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={recurringForm.notes}
                  onChange={(e) => setRecurringForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Optional notes"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => { setShowRecurringModal(false); setEditRecurring(null); setRecurringForm(EMPTY_RECURRING); setRecurringSaveError(null); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  {editRecurring ? "Save changes" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log price change modal */}
      {showLogPriceModal && logPriceTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <DollarSign size={18} className="text-violet-500" />
                Log price change
              </h2>
              <button
                onClick={() => { setShowLogPriceModal(false); setLogPriceTarget(null); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Recording a price change for <span className="font-medium text-slate-700">{logPriceTarget.name}</span>.
            </p>
            <form onSubmit={saveLogPrice} className="flex flex-col gap-4">
              {logPriceSaveError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {logPriceSaveError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New price</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  autoFocus
                  value={logPriceForm.amount}
                  onChange={(e) => setLogPriceForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Effective from</label>
                <input
                  type="month"
                  required
                  value={logPriceForm.effectiveMonth}
                  onChange={(e) => setLogPriceForm((f) => ({ ...f, effectiveMonth: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400 mt-1">The month from which this new price takes effect.</p>
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => { setShowLogPriceModal(false); setLogPriceTarget(null); setLogPriceSaveError(null); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Utility log price modal */}
      {showUtilLogPriceModal && utilLogPriceTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <DollarSign size={18} className="text-amber-500" />
                Log price change
              </h2>
              <button
                onClick={() => { setShowUtilLogPriceModal(false); setUtilLogPriceTarget(null); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Recording a price change for <span className="font-medium text-slate-700">{utilLogPriceTarget.utility}</span>.
            </p>
            <form onSubmit={saveUtilLogPrice} className="flex flex-col gap-4">
              {utilLogPriceSaveError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {utilLogPriceSaveError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New price</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  autoFocus
                  value={utilLogPriceForm.amount}
                  onChange={(e) => setUtilLogPriceForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Effective from</label>
                <input
                  type="month"
                  required
                  value={utilLogPriceForm.effectiveMonth}
                  onChange={(e) => setUtilLogPriceForm((f) => ({ ...f, effectiveMonth: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-slate-400 mt-1">The month from which this new price takes effect.</p>
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => { setShowUtilLogPriceModal(false); setUtilLogPriceTarget(null); setUtilLogPriceSaveError(null); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scan modal */}
      {showScanModal && (
        <ScanModal
          onClose={() => setShowScanModal(false)}
          onSave={saveScanResults}
          expenseCategories={expenseCategories}
          creditCards={creditCards}
        />
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-semibold text-slate-900">
                {editTransfer ? "Edit Transfer" : "New Transfer"}
              </h2>
              <button onClick={() => { setShowTransferModal(false); setEditTransfer(null); setTransferForm(EMPTY_TRANSFER); setTransferSplitPeople([]); setAddingBank(false); setNewBankName(""); setBankDropOpen(false); setPersonDropOpen(false); setAddingPerson(false); setNewPersonName(""); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveTransfer} className="flex flex-col gap-4 p-6">
              {transferSaveError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{transferSaveError}</div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  autoFocus
                  value={transferForm.name}
                  onChange={(e) => setTransferForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Rent split, Dinner, Loan repayment"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Direction */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Direction</label>
                <div className="flex gap-2">
                  {[
                    { value: "sent", label: "Sent To", icon: <ArrowUpRight size={14} /> },
                    { value: "received", label: "Received From", icon: <ArrowDownLeft size={14} /> },
                  ].map(({ value, label, icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTransferForm((f) => ({ ...f, direction: value }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        transferForm.direction === value
                          ? value === "sent"
                            ? "bg-red-50 border-red-300 text-red-600"
                            : "bg-emerald-50 border-emerald-300 text-emerald-600"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {icon}{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={transferForm.date}
                  onChange={(e) => setTransferForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Person */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {transferForm.direction === "sent" ? "Sent To" : "Received From"}
                </label>
                <div className="relative" ref={personDropRef}>
                  <button type="button"
                    onClick={() => { setPersonDropOpen((o) => !o); setAddingPerson(false); setNewPersonName(""); }}
                    className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm text-left bg-white hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <span className={transferForm.person ? "text-slate-800" : "text-slate-400"}>
                      {transferForm.person || "Select person…"}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${personDropOpen ? "rotate-180" : ""}`} />
                  </button>
                  {personDropOpen && (
                    <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                      {transferForm.person && (
                        <button type="button"
                          onClick={() => { setTransferForm((f) => ({ ...f, person: "" })); setPersonDropOpen(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-50">
                          None
                        </button>
                      )}
                      {knownPeople.length === 0 && !addingPerson && (
                        <p className="px-3 py-2 text-sm text-slate-400">No people yet — add one below.</p>
                      )}
                      {knownPeople.map((p) => (
                        <div key={p.id} className="flex items-center group/opt">
                          <button type="button"
                            onClick={() => { setTransferForm((f) => ({ ...f, person: p.name })); setPersonDropOpen(false); setAddingPerson(false); setNewPersonName(""); }}
                            className={`flex-1 text-left px-3 py-2 text-sm transition-colors ${transferForm.person === p.name ? "bg-violet-50 text-violet-700 font-medium hover:bg-violet-50" : "text-slate-700 hover:bg-slate-50"}`}>
                            {p.name}
                          </button>
                          <button type="button"
                            onClick={() => { removePerson(p.name); if (transferForm.person === p.name) setTransferForm((f) => ({ ...f, person: "" })); }}
                            className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                      <div className={knownPeople.length > 0 ? "border-t border-slate-100 mt-1 pt-1" : ""}>
                        {addingPerson ? (
                          <div className="flex gap-1.5 px-2 py-1.5">
                            <input type="text" autoFocus value={newPersonName}
                              onChange={(e) => setNewPersonName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const name = newPersonName.trim();
                                  if (name) {
                                    addNewPerson().then(() => {
                                      setTransferForm((f) => ({ ...f, person: name }));
                                      setPersonDropOpen(false);
                                    });
                                  }
                                }
                                if (e.key === "Escape") { setAddingPerson(false); setNewPersonName(""); }
                              }}
                              placeholder="Person name"
                              className="flex-1 border border-violet-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                            <button type="button"
                              onClick={() => {
                                const name = newPersonName.trim();
                                if (name) {
                                  addNewPerson().then(() => {
                                    setTransferForm((f) => ({ ...f, person: name }));
                                    setPersonDropOpen(false);
                                  });
                                }
                              }}
                              className="px-2.5 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">Add</button>
                            <button type="button" onClick={() => { setAddingPerson(false); setNewPersonName(""); }} className="px-1.5 text-slate-400 hover:text-slate-600 transition-colors"><X size={14} /></button>
                          </div>
                        ) : (
                          <button type="button"
                            onClick={() => setAddingPerson(true)}
                            className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-violet-600 hover:bg-violet-50 transition-colors">
                            <Plus size={13} /> New person
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={transferForm.category_id}
                  onChange={(e) => setTransferForm((f) => ({ ...f, category_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">None</option>
                  {expenseCategories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                </select>
              </div>

              {/* Platform */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Platform</label>
                <div className="flex gap-2">
                  <select
                    value={TRANSFER_PLATFORMS.includes(transferForm.platform) ? transferForm.platform : (transferForm.platform ? "custom" : "")}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "custom") setTransferForm((f) => ({ ...f, platform: "" }));
                      else setTransferForm((f) => ({ ...f, platform: v }));
                    }}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">None</option>
                    {TRANSFER_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                    {transferForm.platform && !TRANSFER_PLATFORMS.includes(transferForm.platform) && (
                      <option value="custom">Custom: {transferForm.platform}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Bank */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Bank</label>
                  {!addingBank && (
                    <button type="button" onClick={() => { setBankDropOpen(false); setAddingBank(true); setNewBankName(""); }}
                      className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-0.5 transition-colors">
                      <Plus size={12} /> New bank
                    </button>
                  )}
                </div>
                {addingBank ? (
                  <div className="flex gap-2">
                    <input type="text" autoFocus value={newBankName} onChange={(e) => setNewBankName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBankInline(); } if (e.key === "Escape") { setAddingBank(false); setNewBankName(""); } }}
                      placeholder="e.g. Chase, Bank of America"
                      className="flex-1 border border-violet-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    <button type="button" onClick={addBankInline} className="px-3 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">Add</button>
                    <button type="button" onClick={() => { setAddingBank(false); setNewBankName(""); }} className="px-2 py-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="relative" ref={bankDropRef}>
                    <button type="button"
                      onClick={() => setBankDropOpen((o) => !o)}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm text-left bg-white hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500">
                      <span className={transferForm.bank_id ? "text-slate-800" : "text-slate-400"}>
                        {transferForm.bank_id
                          ? (banks.find((b) => b.id === parseInt(transferForm.bank_id))?.name ?? "None")
                          : "None"}
                      </span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${bankDropOpen ? "rotate-180" : ""}`} />
                    </button>
                    {bankDropOpen && (
                      <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                        <button type="button"
                          onClick={() => { setTransferForm((f) => ({ ...f, bank_id: "" })); setBankDropOpen(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-50">
                          None
                        </button>
                        {banks.map((b) => (
                          <div key={b.id} className="flex items-center group/opt">
                            <button type="button"
                              onClick={() => { setTransferForm((f) => ({ ...f, bank_id: String(b.id) })); setBankDropOpen(false); }}
                              className="flex-1 text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                              {b.name}
                            </button>
                            <button type="button"
                              onClick={() => deleteBank(b.id)}
                              className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Split section */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400" />
                  Split this transfer
                </label>
                <div className="relative" ref={transferSplitDropRef}>
                  <button type="button"
                    onClick={() => { setTransferSplitDropOpen((o) => !o); setAddingPerson(false); setNewPersonName(""); }}
                    className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm text-left bg-white hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <span className={transferSplitPeople.length ? "text-slate-800" : "text-slate-400"}>
                      {transferSplitPeople.length ? transferSplitPeople.join(", ") : "Select people…"}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${transferSplitDropOpen ? "rotate-180" : ""}`} />
                  </button>
                  {transferSplitDropOpen && (
                    <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                      {knownPeople.length === 0 && !addingPerson && (
                        <p className="px-3 py-2 text-sm text-slate-400">No people yet — add one below.</p>
                      )}
                      {knownPeople.map((p) => {
                        const selected = transferSplitPeople.includes(p.name);
                        return (
                          <div key={p.id} className="flex items-center group/opt">
                            <button type="button"
                              onClick={() => setTransferSplitPeople((prev) => selected ? prev.filter((n) => n !== p.name) : [...prev, p.name])}
                              className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${selected ? "bg-violet-50/60 text-violet-600 font-medium hover:bg-violet-50" : "text-slate-700 hover:bg-slate-50"}`}>
                              <span className="w-3.5 shrink-0 flex items-center">
                                {selected && <CheckCircle2 size={13} className="text-violet-500" />}
                              </span>
                              {p.name}
                            </button>
                            <button type="button"
                              onClick={() => { removePerson(p.name); setTransferSplitPeople((prev) => prev.filter((n) => n !== p.name)); }}
                              className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                      <div className={knownPeople.length > 0 ? "border-t border-slate-100 mt-1 pt-1" : ""}>
                        {addingPerson ? (
                          <div className="flex gap-1.5 px-2 py-1.5">
                            <input type="text" autoFocus value={newPersonName}
                              onChange={(e) => setNewPersonName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewPerson(); } if (e.key === "Escape") { setAddingPerson(false); setNewPersonName(""); } }}
                              placeholder="Person name"
                              className="flex-1 border border-violet-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                            <button type="button" onClick={addNewPerson} className="px-2.5 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">Add</button>
                            <button type="button" onClick={() => { setAddingPerson(false); setNewPersonName(""); }} className="px-1.5 text-slate-400 hover:text-slate-600 transition-colors"><X size={14} /></button>
                          </div>
                        ) : (
                          <button type="button"
                            onClick={() => setAddingPerson(true)}
                            className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-violet-600 hover:bg-violet-50 transition-colors">
                            <Plus size={13} /> New person
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {transferSplitPeople.length > 0 && (() => {
                  const total = parseFloat(transferForm.amount) || 0;
                  const count = transferSplitPeople.length + 1;
                  const perPerson = total > 0 ? total / count : 0;
                  return perPerson > 0 ? (
                    <p className="text-xs text-violet-600 font-medium bg-violet-50 rounded-md px-3 py-2 mt-2">
                      Split with {transferSplitPeople.join(", ")} · {fmtAmount(perPerson)} each
                    </p>
                  ) : null;
                })()}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional note…"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => { setShowTransferModal(false); setEditTransfer(null); setTransferForm(EMPTY_TRANSFER); setTransferSplitPeople([]); setAddingBank(false); setNewBankName(""); setBankDropOpen(false); setPersonDropOpen(false); setAddingPerson(false); setNewPersonName(""); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                {!editTransfer && (
                  <button type="button" onClick={saveTransferAndAddAnother}
                    className="px-4 py-2 text-sm border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                    Save & add another
                  </button>
                )}
                <button type="submit" className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
                  {editTransfer ? "Save changes" : "Add transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bill Modal */}
      {showBillModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-semibold text-slate-900">{editBill ? "Edit Utility Bill" : "New Utility Bill"}</h2>
              <button onClick={() => { setShowBillModal(false); setEditBill(null); setBillForm(EMPTY_BILL); setBillSplitPeople([]); }} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={saveBill} className="flex flex-col gap-4 p-6">
              {billSaveError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{billSaveError}</div>}

              {/* Utility name + type toggle */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Utility</label>
                <input list="utility-names" type="text" required autoFocus value={billForm.utility}
                  onChange={(e) => setBillForm((f) => ({ ...f, utility: e.target.value }))}
                  placeholder="Electric, Water, Internet…"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                <datalist id="utility-names">{UTILITY_NAMES.map((n) => <option key={n} value={n} />)}</datalist>
              </div>

              {/* Recurring toggle */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Bill type</label>
                <div className="flex gap-2">
                  {[{ value: false, label: "One-time" }, { value: true, label: "Recurring" }].map(({ value, label }) => (
                    <button key={String(value)} type="button"
                      onClick={() => setBillForm((f) => ({ ...f, is_recurring: value }))}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${billForm.is_recurring === value ? "bg-amber-50 border-amber-400 text-amber-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* One-time: service period + charge date */}
              {!billForm.is_recurring && (<>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Service Period</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">From</label>
                      <input type="date" required={!billForm.is_recurring} value={billForm.service_period_start}
                        onChange={(e) => setBillForm((f) => ({ ...f, service_period_start: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">To</label>
                      <input type="date" required={!billForm.is_recurring} value={billForm.service_period_end}
                        onChange={(e) => setBillForm((f) => ({ ...f, service_period_end: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Charge Date</label>
                    <input type="date" required={!billForm.is_recurring} value={billForm.charge_date}
                      onChange={(e) => setBillForm((f) => ({ ...f, charge_date: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                    <input type="number" required min="0.01" step="0.01" value={billForm.amount}
                      onChange={(e) => setBillForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                </div>
              </>)}

              {/* Recurring: billing start + charge day + amount */}
              {billForm.is_recurring && (<>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Billing start</label>
                    <input type="month" required={billForm.is_recurring} value={billForm.billing_start}
                      onChange={(e) => setBillForm((f) => ({ ...f, billing_start: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Charge day</label>
                    <input type="number" required={billForm.is_recurring} min="1" max="31" value={billForm.charge_day}
                      onChange={(e) => setBillForm((f) => ({ ...f, charge_day: e.target.value }))}
                      placeholder="e.g. 15"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Monthly amount
                    <span className="text-slate-400 font-normal ml-1 text-xs">— use Log price to record increases</span>
                  </label>
                  <input type="number" required min="0.01" step="0.01" value={billForm.amount}
                    onChange={(e) => setBillForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                {/* Price history display when editing */}
                {editBill && editBill.price_history.length > 0 && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2 space-y-1">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Price history</p>
                    {[...editBill.price_history]
                      .filter((h) => h.effective_from !== "2000-01-01")
                      .sort((a, b) => a.effective_from.localeCompare(b.effective_from))
                      .map((h) => (
                        <div key={h.id} className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            {new Date(h.effective_from + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          </span>
                          <span className="text-xs font-medium text-slate-700">{fmtAmount(Number(h.amount))}/mo</span>
                        </div>
                      ))}
                  </div>
                )}
              </>)}

              {/* Split with */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400" />
                  Split with
                </label>
                <div className="relative" ref={billSplitDropRef}>
                  <button type="button"
                    onClick={() => { setBillSplitDropOpen((o) => !o); setAddingPerson(false); setNewPersonName(""); }}
                    className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm text-left bg-white hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500">
                    <span className={billSplitPeople.length ? "text-slate-800" : "text-slate-400"}>
                      {billSplitPeople.length ? billSplitPeople.join(", ") : "Select roommates…"}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${billSplitDropOpen ? "rotate-180" : ""}`} />
                  </button>
                  {billSplitDropOpen && (
                    <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                      {knownPeople.length === 0 && !addingPerson && (
                        <p className="px-3 py-2 text-sm text-slate-400">No people yet — add one below.</p>
                      )}
                      {knownPeople.map((p) => {
                        const selected = billSplitPeople.includes(p.name);
                        return (
                          <div key={p.id} className="flex items-center group/opt">
                            <button type="button"
                              onClick={() => setBillSplitPeople((prev) => selected ? prev.filter((n) => n !== p.name) : [...prev, p.name])}
                              className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${selected ? "bg-amber-50/60 text-amber-700 font-medium hover:bg-amber-50" : "text-slate-700 hover:bg-slate-50"}`}>
                              <span className="w-3.5 shrink-0 flex items-center">
                                {selected && <CheckCircle2 size={13} className="text-amber-500" />}
                              </span>
                              {p.name}
                            </button>
                            <button type="button"
                              onClick={() => { removePerson(p.name); setBillSplitPeople((prev) => prev.filter((n) => n !== p.name)); }}
                              className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                      <div className={knownPeople.length > 0 ? "border-t border-slate-100 mt-1 pt-1" : ""}>
                        {addingPerson ? (
                          <div className="flex gap-1.5 px-2 py-1.5">
                            <input type="text" autoFocus value={newPersonName}
                              onChange={(e) => setNewPersonName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewPerson(); } if (e.key === "Escape") { setAddingPerson(false); setNewPersonName(""); } }}
                              placeholder="Person name"
                              className="flex-1 border border-amber-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                            <button type="button" onClick={addNewPerson} className="px-2.5 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">Add</button>
                            <button type="button" onClick={() => { setAddingPerson(false); setNewPersonName(""); }} className="px-1.5 text-slate-400 hover:text-slate-600 transition-colors"><X size={14} /></button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setAddingPerson(true)}
                            className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors">
                            <Plus size={13} /> New person
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {billSplitPeople.length > 0 && (() => {
                  const total = parseFloat(billForm.amount) || 0;
                  const per = total > 0 ? total / (billSplitPeople.length + 1) : 0;
                  return per > 0 ? (
                    <p className="text-xs text-amber-600 font-medium bg-amber-50 rounded-md px-3 py-2 mt-2">
                      Split with {billSplitPeople.join(", ")} · {fmtAmount(per)} each
                    </p>
                  ) : null;
                })()}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea rows={2} value={billForm.notes}
                  onChange={(e) => setBillForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => { setShowBillModal(false); setEditBill(null); setBillForm(EMPTY_BILL); setBillSplitPeople([]); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
                  {editBill ? "Save changes" : "Add bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Card Reminder Modal */}
      {showCcReminderModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-semibold text-slate-900">
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
        </div>
      )}

      {/* Loan Modal */}
      {showLoanModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-semibold text-slate-900">
                {editLoan ? "Edit Loan" : "Add Loan"}
              </h2>
              <button onClick={() => { setShowLoanModal(false); setEditLoan(null); setLoanForm(EMPTY_LOAN); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveLoan} className="flex flex-col gap-4 p-6">
              {loanSaveError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loanSaveError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Loan Name / Provider</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={loanForm.name}
                  onChange={(e) => setLoanForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Subsidized Loan 1"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Disbursement Date</label>
                <input
                  type="date"
                  required
                  value={loanForm.disbursement_date}
                  onChange={(e) => setLoanForm((f) => ({ ...f, disbursement_date: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Original Principal ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={loanForm.original_principal}
                    onChange={(e) => setLoanForm((f) => ({ ...f, original_principal: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={loanForm.interest_rate}
                    onChange={(e) => setLoanForm((f) => ({ ...f, interest_rate: e.target.value }))}
                    placeholder="e.g. 4.5"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unpaid Principal ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={loanForm.unpaid_principal}
                    onChange={(e) => setLoanForm((f) => ({ ...f, unpaid_principal: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unpaid Interest ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={loanForm.unpaid_interest}
                    onChange={(e) => setLoanForm((f) => ({ ...f, unpaid_interest: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Interest Paid to Date ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={loanForm.total_interest_paid}
                  onChange={(e) => setLoanForm((f) => ({ ...f, total_interest_paid: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={loanForm.notes}
                  onChange={(e) => setLoanForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => { setShowLoanModal(false); setEditLoan(null); setLoanForm(EMPTY_LOAN); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  {editLoan ? "Save changes" : "Add loan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">
              Delete {deleteTarget.type}?
            </h2>
            <p className="text-sm text-slate-500 mb-5">This will permanently remove this entry.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
              <button onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
