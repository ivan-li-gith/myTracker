"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  CreditCard as CreditCardIcon, Receipt, Calendar, MoreHorizontal,
  CheckCircle2, Plus, X, ChevronLeft, ChevronRight, Pencil, Trash2,
  ScanLine, Upload, Loader2, Users, ChevronDown,
  TrendingDown, Wallet, AlertCircle, Tag, RefreshCw, DollarSign,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { CardStatement, Expense, Category, CreditCard, ExpenseSplit, RecurringCharge, PriceHistoryEntry, CancellationPeriod } from "@/lib/types";

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

function RowMenu({ onEdit, onDelete, onLogPrice, onToggleCancel, isCanceled }: {
  onEdit: () => void;
  onDelete: () => void;
  onLogPrice?: () => void;
  onToggleCancel?: () => void;
  isCanceled?: boolean;
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
  cardStatements,
  month,
  recurringCharges,
}: {
  expenses: Expense[];
  categories: Category[];
  creditCards: CreditCard[];
  cardStatements: CardStatement[];
  month: string;
  recurringCharges: RecurringCharge[];
}) {
  const grossSpend = expenses.reduce((s, e) => Number(e.amount) > 0 ? s + Number(e.amount) : s, 0);
  const refunds = expenses.reduce((s, e) => Number(e.amount) < 0 ? s + Math.abs(Number(e.amount)) : s, 0);
  const netSpend = grossSpend - refunds;

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

  const pendingTotal = cardStatements
    .filter((s) => !s.is_paid)
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const catTotals = new Map<number | null, number>();
  for (const e of expenses) {
    const amt = Number(e.amount);
    if (amt > 0) catTotals.set(e.category_id, (catTotals.get(e.category_id) ?? 0) + amt);
  }
  const catBreakdown = Array.from(catTotals.entries())
    .map(([id, total], i) => ({
      name: id != null ? (categories.find((c) => c.id === id)?.name ?? "Unknown") : "Uncategorized",
      total,
      pct: grossSpend > 0 ? (total / grossSpend) * 100 : 0,
      color: BAR_COLORS[i % BAR_COLORS.length],
    }))
    .sort((a, b) => b.total - a.total);

  const cardTotals = new Map<number | null, number>();
  for (const e of expenses) {
    const amt = Number(e.amount);
    if (amt > 0) cardTotals.set(e.credit_card_id, (cardTotals.get(e.credit_card_id) ?? 0) + amt);
  }
  const cardBreakdown = Array.from(cardTotals.entries())
    .map(([id, total], i) => {
      const card = creditCards.find((c) => c.id === id);
      return {
        name: card ? `${card.name}${card.last_four ? ` ····${card.last_four}` : ""}` : "No card",
        total,
        pct: grossSpend > 0 ? (total / grossSpend) * 100 : 0,
        color: resolveCardColor(card?.color ?? null, i),
      };
    })
    .sort((a, b) => b.total - a.total);

  const [y, m] = month.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long" });

  const showBreakdowns = catBreakdown.length > 0 || cardBreakdown.length > 0;
  const totalSpend = netSpend + recurringTotal;

  return (
    <div className="mb-8 flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={14} className="text-indigo-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Spent in {label}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmtAmount(totalSpend)}</p>
          {refunds > 0 && (
            <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <TrendingDown size={11} /> {fmtAmount(refunds)} in refunds
            </p>
          )}
          {recurringTotal > 0 && (
            <p className="text-xs text-violet-600 font-medium mt-0.5 flex items-center gap-1">
              <RefreshCw size={10} /> {fmtAmount(recurringTotal)} recurring
            </p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={14} className="text-indigo-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transactions</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{expenses.length}</p>
          {expenses.filter((e) => Number(e.amount) > 0).length > 0 && (
            <p className="text-xs text-slate-400 font-medium mt-1">
              avg {fmtAmount(grossSpend / expenses.filter((e) => Number(e.amount) > 0).length)} / transaction
            </p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={14} className="text-amber-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Bills</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmtAmount(pendingTotal)}</p>
          <p className="text-xs text-slate-400 font-medium mt-1">{cardStatements.filter((s) => !s.is_paid).length} unpaid</p>
        </div>
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
                {catBreakdown.map((cat) => (
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
            </div>
          )}

          {cardBreakdown.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <CreditCardIcon size={14} className="text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">By Credit Card</h3>
              </div>
              <div className="flex flex-col gap-3">
                {cardBreakdown.map((card) => (
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Receipt Scanner ----

type ScannedRow = { name: string; amount: string; date: string };

function ScanModal({
  onClose,
  onSave,
  expenseCategories,
}: {
  onClose: () => void;
  onSave: (rows: ScannedRow[], categoryId: string) => Promise<void>;
  expenseCategories: Category[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<ScannedRow[] | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  async function scan() {
    if (!file) return;
    setScanning(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiFetch("/scan/receipt", { method: "POST", body: form });
      if (!result.transactions.length) {
        setError("No transactions found in this file. Try a clearer image.");
      } else {
        setRows(result.transactions.map((t: { name: string; amount: number; date: string }) => ({
          name: t.name,
          amount: String(t.amount),
          date: t.date,
        })));
      }
    } catch {
      setError("Scan failed. Check your ANTHROPIC_API_KEY and try again.");
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
      await onSave(rows, categoryId);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
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
                  <p className="text-sm font-medium text-slate-700">
                    {file ? file.name : "Drop a file here or click to browse"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">JPEG, PNG, or PDF</p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                />
              </div>

              {error && <p className="text-sm text-red-500 text-center">{error}</p>}

              <button
                onClick={scan}
                disabled={!file || scanning}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {scanning ? <><Loader2 size={16} className="animate-spin" /> Scanning…</> : <><ScanLine size={16} /> Scan with Claude</>}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-500">
                Review and edit the extracted transactions before saving.
              </p>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700 shrink-0">Category for all</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">None</option>
                  {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-2.5">Description</th>
                      <th className="text-left px-4 py-2.5 w-28">Amount</th>
                      <th className="text-left px-4 py-2.5 w-36">Date</th>
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
                onClick={() => { setRows(null); setFile(null); setError(null); }}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors self-start"
              >
                ← Scan a different file
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

const EMPTY_EXPENSE = { name: "", amount: "", date: "", category_id: "", credit_card_id: "", notes: "" };
const EMPTY_RECURRING = { name: "", amount: "", charge_date: "", category_id: "", notes: "" };
const EMPTY_CC_FORM = { sourceCardId: "", name: "", last_four: "", color: "blue", billing_start_day: "", billing_end_day: "", due_date_day: "", category_id: "" };

// ---- Page ----

export default function PaymentsAndExpensesPage() {
  const [cardStatements, setCardStatements] = useState<CardStatement[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [creditCardCategories, setCreditCardCategories] = useState<Category[]>([]);
  const [recurringCategories, setRecurringCategories] = useState<Category[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [recurringCharges, setRecurringCharges] = useState<RecurringCharge[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "credit_card" | "expense" | "recurring"; id: number } | null>(null);

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
  const [expenseSplits, setExpenseSplits] = useState<ExpenseSplit[]>([]);
  const [knownPeople, setKnownPeople] = useState<string[]>([]);
  const [splitPeople, setSplitPeople] = useState<string[]>([]);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [splitDropOpen, setSplitDropOpen] = useState(false);
  const splitDropRef = useRef<HTMLDivElement>(null);
  const [catDropOpen, setCatDropOpen] = useState(false);
  const catDropRef = useRef<HTMLDivElement>(null);
  const [cardDropOpen, setCardDropOpen] = useState(false);
  const cardDropRef = useRef<HTMLDivElement>(null);

  // Inline category creation (expense modal)
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Credit card modal
  const [showCreditCardModal, setShowCreditCardModal] = useState(false);
  const [editCreditCard, setEditCreditCard] = useState<CreditCard | null>(null);
  const [creditCardForm, setCreditCardForm] = useState(EMPTY_CC_FORM);
  const [addingCCCat, setAddingCCCat] = useState(false);
  const [newCCCatName, setNewCCCatName] = useState("");
  const [ccCatDropOpen, setCCCatDropOpen] = useState(false);
  const ccCatDropRef = useRef<HTMLDivElement>(null);
  const [ccSaveError, setCCSaveError] = useState<string | null>(null);

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
  const [recurringSaveError, setRecurringSaveError] = useState<string | null>(null);

  // Log price change modal
  const [showLogPriceModal, setShowLogPriceModal] = useState(false);
  const [logPriceTarget, setLogPriceTarget] = useState<RecurringCharge | null>(null);
  const [logPriceForm, setLogPriceForm] = useState({ amount: "", effectiveMonth: "" });
  const [logPriceSaveError, setLogPriceSaveError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/categories?type=expense").then(setExpenseCategories).catch(console.error);
    apiFetch("/categories?type=credit_card").then(setCreditCardCategories).catch(console.error);
    apiFetch("/categories?type=recurring").then(setRecurringCategories).catch(console.error);
    apiFetch("/credit-cards").then(setCreditCards).catch(console.error);
    apiFetch("/recurring-charges").then(setRecurringCharges).catch(console.error);
    apiFetch("/expense-splits").then((splits: ExpenseSplit[]) => {
      setExpenseSplits(splits);
      const names = new Set<string>();
      splits.forEach((s) => s.participants?.forEach((p) => { if (p.name !== "Me") names.add(p.name); }));
      setKnownPeople([...names].sort());
    }).catch(console.error);
  }, []);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (splitDropRef.current && !splitDropRef.current.contains(e.target as Node)) setSplitDropOpen(false);
      if (catDropRef.current && !catDropRef.current.contains(e.target as Node)) setCatDropOpen(false);
      if (cardDropRef.current && !cardDropRef.current.contains(e.target as Node)) setCardDropOpen(false);
      if (ccCatDropRef.current && !ccCatDropRef.current.contains(e.target as Node)) setCCCatDropOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    apiFetch(`/expenses?month=${selectedMonth}`).then(setExpenses).catch(console.error);
    apiFetch(`/expenses/summary?month=${selectedMonth}`)
      .then((s) => setMonthTotal(Number(s.total)))
      .catch(console.error);
    apiFetch(`/credit-cards/statements?month=${selectedMonth}`).then(setCardStatements).catch(console.error);
  }, [selectedMonth]);

  const getCatName = (id: number | null, cats: Category[]) =>
    id != null ? (cats.find((c) => c.id === id)?.name ?? null) : null;

  const getCardDisplayName = (id: number | null) => {
    if (id == null) return null;
    const card = creditCards.find((c) => c.id === id);
    if (!card) return null;
    return card.last_four ? `${card.name} ····${card.last_four}` : card.name;
  };

  // Group expenses by name
  type ExpenseGroup = { key: string; name: string; items: Expense[]; total: number };
  const expenseGroups: ExpenseGroup[] = [];
  for (const expense of expenses) {
    const key = expense.name.toLowerCase().trim();
    const existing = expenseGroups.find((g) => g.key === key);
    if (existing) {
      existing.items.push(expense);
      existing.total += Number(expense.amount);
    } else {
      expenseGroups.push({ key, name: expense.name, items: [expense], total: Number(expense.amount) });
    }
  }
  expenseGroups.forEach((g) => g.items.sort((a, b) => b.date.localeCompare(a.date)));
  expenseGroups.sort((a, b) => (b.items[0]?.date ?? "").localeCompare(a.items[0]?.date ?? ""));

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // ---- Credit Cards ----

  function openAddCreditCard() {
    setEditCreditCard(null);
    setCreditCardForm(EMPTY_CC_FORM);
    setCCSaveError(null);
    setAddingCCCat(false);
    setNewCCCatName("");
    setCCCatDropOpen(false);
    setShowCreditCardModal(true);
  }

  function openEditCreditCard(card: CreditCard) {
    setEditCreditCard(card);
    setCreditCardForm({
      sourceCardId: "",
      name: card.name,
      last_four: card.last_four ?? "",
      color: card.color ?? "blue",
      billing_start_day: card.billing_start_day != null ? String(card.billing_start_day) : "",
      billing_end_day: card.billing_end_day != null ? String(card.billing_end_day) : "",
      due_date_day: card.due_date_day != null ? String(card.due_date_day) : "",
      category_id: card.category_id != null ? String(card.category_id) : "",
    });
    setCCSaveError(null);
    setAddingCCCat(false);
    setNewCCCatName("");
    setCCCatDropOpen(false);
    setShowCreditCardModal(true);
  }

  function handleSourceCardChange(cardId: string) {
    if (!cardId) {
      setCreditCardForm((f) => ({ ...f, sourceCardId: "", name: "", last_four: "", color: "blue" }));
      return;
    }
    const card = creditCards.find((c) => c.id === parseInt(cardId));
    if (card) {
      setCreditCardForm((f) => ({
        ...f,
        sourceCardId: cardId,
        name: card.name,
        last_four: card.last_four ?? "",
        color: card.color ?? "blue",
        billing_start_day: card.billing_start_day != null ? String(card.billing_start_day) : f.billing_start_day,
        billing_end_day: card.billing_end_day != null ? String(card.billing_end_day) : f.billing_end_day,
        due_date_day: card.due_date_day != null ? String(card.due_date_day) : f.due_date_day,
        category_id: card.category_id != null ? String(card.category_id) : f.category_id,
      }));
    }
  }

  async function addCCCategory() {
    const name = newCCCatName.trim();
    if (!name) return;
    const created: Category = await apiFetch("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: "credit_card" }),
    });
    setCreditCardCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setCreditCardForm((f) => ({ ...f, category_id: String(created.id) }));
    setNewCCCatName("");
    setAddingCCCat(false);
  }

  async function deleteCCCategory(id: number) {
    await apiFetch(`/categories/${id}`, { method: "DELETE" });
    setCreditCardCategories((prev) => prev.filter((c) => c.id !== id));
    if (creditCardForm.category_id === String(id)) setCreditCardForm((f) => ({ ...f, category_id: "" }));
  }

  async function saveCreditCard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCCSaveError(null);
    const startDay = parseInt(creditCardForm.billing_start_day);
    const endDay = parseInt(creditCardForm.billing_end_day);
    const dueDay = parseInt(creditCardForm.due_date_day);
    if ([startDay, endDay, dueDay].some((d) => isNaN(d) || d < 1 || d > 31)) {
      setCCSaveError("All billing cycle days must be between 1 and 31");
      return;
    }
    const body = {
      name: creditCardForm.name,
      last_four: creditCardForm.last_four || null,
      color: creditCardForm.color || null,
      billing_start_day: startDay,
      billing_end_day: endDay,
      due_date_day: dueDay,
      category_id: creditCardForm.category_id ? parseInt(creditCardForm.category_id) : null,
    };
    try {
      if (editCreditCard) {
        const updated = await apiFetch(`/credit-cards/${editCreditCard.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        setCreditCards((prev) => prev.map((c) => c.id === editCreditCard.id ? updated : c));
      } else if (creditCardForm.sourceCardId) {
        const updated = await apiFetch(`/credit-cards/${creditCardForm.sourceCardId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        setCreditCards((prev) => prev.map((c) => c.id === parseInt(creditCardForm.sourceCardId) ? updated : c));
      } else {
        const created = await apiFetch("/credit-cards", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        setCreditCards((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      const stmts = await apiFetch(`/credit-cards/statements?month=${selectedMonth}`);
      setCardStatements(stmts);
      setShowCreditCardModal(false);
      setEditCreditCard(null);
      setCreditCardForm(EMPTY_CC_FORM);
    } catch (err) {
      setCCSaveError(err instanceof Error ? err.message : "Failed to save credit card");
    }
  }

  async function toggleCardStatementPaid(stmt: CardStatement) {
    const updated = await apiFetch(
      `/credit-cards/${stmt.credit_card_id}/statements/${stmt.month}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_paid: !stmt.is_paid }) }
    );
    setCardStatements((prev) =>
      prev.map((s) => s.credit_card_id === stmt.credit_card_id && s.month === stmt.month ? updated : s)
    );
  }

  async function deleteCreditCard(id: number) {
    await apiFetch(`/credit-cards/${id}`, { method: "DELETE" });
    setCreditCards((prev) => prev.filter((c) => c.id !== id));
    setCardStatements((prev) => prev.filter((s) => s.credit_card_id !== id));
    if (expenseForm.credit_card_id === String(id)) setExpenseForm((f) => ({ ...f, credit_card_id: "" }));
  }

  // ---- Expenses ----

  async function addExpenseCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const created: Category = await apiFetch("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: "expense" }),
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

  function addNewPerson() {
    const name = newPersonName.trim();
    if (!name) return;
    if (!knownPeople.includes(name)) setKnownPeople((prev) => [...prev, name].sort());
    if (!splitPeople.includes(name)) setSplitPeople((prev) => [...prev, name]);
    setNewPersonName("");
    setAddingPerson(false);
  }

  async function deleteCategory(id: number) {
    await apiFetch(`/categories/${id}`, { method: "DELETE" });
    setExpenseCategories((prev) => prev.filter((c) => c.id !== id));
    if (expenseForm.category_id === String(id)) setExpenseForm((f) => ({ ...f, category_id: "" }));
  }

  function removePerson(name: string) {
    setKnownPeople((prev) => prev.filter((n) => n !== name));
    setSplitPeople((prev) => prev.filter((n) => n !== name));
  }

  function openAddExpense() {
    setEditExpense(null);
    setExpenseForm({ ...EMPTY_EXPENSE, date: toLocalDate(new Date()) });
    setExpenseSaveError(null);
    resetSplit();
    setAddingCat(false); setNewCatName(""); setCatDropOpen(false);
    setCardDropOpen(false);
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
    });
    setExpenseSaveError(null);
    const matchingSplit = expenseSplits.find((s) => s.title === ex.name);
    const preSelected = matchingSplit?.participants?.filter((p) => p.name !== "Me").map((p) => p.name) ?? [];
    setSplitPeople(preSelected);
    setAddingPerson(false); setNewPersonName(""); setSplitDropOpen(false);
    setAddingCat(false); setNewCatName(""); setCatDropOpen(false);
    setCardDropOpen(false);
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
    };
    if (editExpense) {
      const updated = await apiFetch(`/expenses/${editExpense.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setExpenses((prev) => prev.map((ex) => (ex.id === editExpense.id ? updated : ex)));
      return updated;
    } else {
      const created = await apiFetch("/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (created.date.startsWith(selectedMonth)) {
        setExpenses((prev) => [created, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
        setMonthTotal((prev) => (prev ?? 0) + Number(created.amount));
      }
      return created;
    }
  }

  async function doSaveSplit(expenseName: string, total: number) {
    if (!splitPeople.length) return;
    const count = splitPeople.length + 1;
    const share = Number((total / count).toFixed(2));
    const participants = [
      { name: "Me", owes: share },
      ...splitPeople.map((name) => ({ name, owes: share })),
    ];
    const created: ExpenseSplit = await apiFetch("/expense-splits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: expenseName, total, participants }),
    });
    setExpenseSplits((prev) => [created, ...prev]);
  }

  async function saveExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setExpenseSaveError(null);
    try {
      const expense = await doSaveExpense();
      if (splitPeople.length > 0 && expense && !editExpense) {
        await doSaveSplit(expenseForm.name, parseFloat(expenseForm.amount));
      }
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
      const expense = await doSaveExpense();
      if (splitPeople.length > 0 && expense && !editExpense) {
        await doSaveSplit(expenseForm.name, parseFloat(expenseForm.amount));
      }
      setExpenseForm({ ...EMPTY_EXPENSE, date: expenseForm.date });
      resetSplit();
    } catch (err) {
      setExpenseSaveError(err instanceof Error ? err.message : "Failed to save expense");
    }
  }

  async function deleteExpense(id: number) {
    await apiFetch(`/expenses/${id}`, { method: "DELETE" });
    setExpenses((prev) => prev.filter((ex) => ex.id !== id));
  }

  // ---- Recurring charges ----

  async function addRecurringCategory() {
    const name = newRecurringCatName.trim();
    if (!name) return;
    const created: Category = await apiFetch("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: "recurring" }),
    });
    setRecurringCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
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
    setShowRecurringModal(true);
  }

  function openEditRecurring(rc: RecurringCharge) {
    setEditRecurring(rc);
    setRecurringForm({
      name: rc.name,
      amount: String(rc.amount),
      charge_date: String(rc.charge_date),
      category_id: rc.category_id != null ? String(rc.category_id) : "",
      notes: rc.notes ?? "",
    });
    setRecurringSaveError(null);
    setAddingRecurringCat(false);
    setNewRecurringCatName("");
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
      notes: recurringForm.notes || null,
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

  // ---- Misc ----

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "credit_card") await deleteCreditCard(deleteTarget.id);
    else if (deleteTarget.type === "expense") await deleteExpense(deleteTarget.id);
    else await deleteRecurring(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function saveScanResults(rows: ScannedRow[], categoryId: string) {
    const created = await Promise.all(
      rows.map((row) =>
        apiFetch("/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.name,
            amount: parseFloat(row.amount),
            date: row.date,
            category_id: categoryId ? parseInt(categoryId) : null,
            notes: null,
          }),
        })
      )
    );
    const inMonth = created.filter((ex: Expense) => ex.date.startsWith(selectedMonth));
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
            className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 transition-colors"
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

      {/* Finance Summary */}
      <FinanceSummary
        expenses={expenses}
        categories={expenseCategories}
        creditCards={creditCards}
        cardStatements={cardStatements}
        month={selectedMonth}
        recurringCharges={recurringCharges}
      />

      {/* Credit Card Section */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CreditCardIcon size={16} className="text-amber-500" />
              Credit Card
            </h2>
            {cardStatements.filter((s) => !s.is_paid).length > 0 && (
              <span className="bg-amber-100 text-amber-700 py-0.5 px-2 rounded-full text-xs font-bold">
                {cardStatements.filter((s) => !s.is_paid).length} Unpaid
              </span>
            )}
          </div>
          <button
            onClick={openAddCreditCard}
            className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 p-1 rounded-md transition-colors"
            aria-label="Add credit card"
          >
            <Plus size={20} />
          </button>
        </div>

        {(() => {
          const unpaid = cardStatements.filter((s) => !s.is_paid).sort((a, b) => a.due_date.localeCompare(b.due_date));
          const paid = cardStatements.filter((s) => s.is_paid).sort((a, b) => b.due_date.localeCompare(a.due_date));

          function CCStatementRow({ stmt }: { stmt: CardStatement }) {
            const card = creditCards.find((c) => c.id === stmt.credit_card_id);
            const catName = card?.category_id != null
              ? (creditCardCategories.find((c) => c.id === card.category_id)?.name ?? null)
              : null;
            const [dy, dm, dd] = stmt.due_date.split("-").map(Number);
            const dueMs = new Date(dy, dm - 1, dd).setHours(0, 0, 0, 0);
            const todayMs = new Date().setHours(0, 0, 0, 0);
            const days = Math.round((dueMs - todayMs) / 86400000);
            const isOverdue = !stmt.is_paid && days < 0;
            const isDueSoon = !stmt.is_paid && days >= 0 && days <= 7;
            return (
              <li className="group flex items-center gap-4 p-4 hover:bg-slate-50/80 transition-colors">
                <button
                  onClick={() => toggleCardStatementPaid(stmt)}
                  title={stmt.is_paid ? "Mark as unpaid" : "Mark as paid"}
                  className={`flex-shrink-0 transition-colors ${stmt.is_paid ? "text-emerald-500 hover:text-slate-300" : "text-slate-300 hover:text-emerald-500"}`}
                >
                  <CheckCircle2 size={22} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {card && (
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                        {card.color && (
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 inline-block" style={{ backgroundColor: resolveCardColor(card.color, 0) }} />
                        )}
                        <CreditCardIcon size={14} className="text-slate-400" />
                        {card.name}{card.last_four ? ` ····${card.last_four}` : ""}
                      </span>
                    )}
                    {stmt.is_paid && (
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-sm">Paid</span>
                    )}
                    {isOverdue && (
                      <span className="text-[11px] font-bold uppercase tracking-wider text-red-500 bg-red-50 px-2 py-0.5 rounded-sm">Overdue</span>
                    )}
                    {isDueSoon && (
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-sm">Due soon</span>
                    )}
                    {catName && (
                      <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0">{catName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-violet-600 bg-violet-50 px-2 py-0.5 rounded-sm">
                      <Calendar size={10} />
                      {fmtDate(stmt.billing_start)} – {fmtDate(stmt.billing_end)}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm">
                      Due {fmtDate(stmt.due_date)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-bold text-base tabular-nums ${stmt.is_paid ? "text-slate-400 line-through" : "text-slate-900"}`}>
                    {fmtAmount(stmt.amount)}
                  </span>
                  <RowMenu
                    onEdit={() => card && openEditCreditCard(card)}
                    onDelete={() => card && setDeleteTarget({ type: "credit_card", id: card.id })}
                  />
                </div>
              </li>
            );
          }

          if (cardStatements.length === 0) {
            return (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                  <CreditCardIcon size={24} className="text-slate-300" />
                </div>
                <p className="text-slate-500 text-sm font-medium">No credit cards configured. Add one to get started.</p>
              </div>
            );
          }

          return (
            <div className="flex flex-col gap-3">
              {unpaid.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <ul className="divide-y divide-slate-100">
                    {unpaid.map((s) => <CCStatementRow key={s.credit_card_id} stmt={s} />)}
                  </ul>
                </div>
              )}
              {paid.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden opacity-70">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Paid</span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {paid.map((s) => <CCStatementRow key={s.credit_card_id} stmt={s} />)}
                  </ul>
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {/* Recurring Charges Section */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <RefreshCw size={16} className="text-violet-500" />
            Recurring Charges
          </h2>
          <button
            onClick={openAddRecurring}
            className="text-slate-400 hover:text-violet-600 hover:bg-violet-50 p-1 rounded-md transition-colors"
            aria-label="Add recurring charge"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                const catName = getCatName(rc.category_id, recurringCategories);
                const canceledThisMonth = isCanceledForMonth(rc, selectedMonth);
                const sortedHistory = [...rc.price_history].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
                const hasHistory = sortedHistory.some((h) => h.effective_from !== "2000-01-01");
                const isExpanded = expandedRecurringIds.has(rc.id);
                return (
                  <li key={rc.id} className={`divide-y divide-slate-50 ${canceledThisMonth ? "opacity-60" : ""}`}>
                    {/* Main row */}
                    <div className="group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                      <div
                        className={`flex-1 min-w-0 flex items-start gap-2 ${hasHistory ? "cursor-pointer" : ""}`}
                        onClick={hasHistory ? () => toggleRecurring(rc.id) : undefined}
                      >
                        {hasHistory && (
                          <ChevronDown
                            size={14}
                            className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium truncate ${canceledThisMonth ? "text-slate-400 line-through" : "text-slate-800"}`}>{rc.name}</p>
                            {catName && !canceledThisMonth && (
                              <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0">
                                {catName}
                              </span>
                            )}
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
                          </div>
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
                        <div key={entry.id} className="flex items-center justify-between pl-10 pr-4 py-2.5 bg-slate-50/70">
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
        </div>
      </section>

      {/* Expenses Section */}
      <section>
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Receipt size={16} className="text-indigo-500" />
            Recent Expenses
          </h2>
          <div className="flex items-center gap-2">
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

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {expenseGroups.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center">
              <p className="text-slate-500 text-sm font-medium">No expenses logged for this month.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {expenseGroups.map((group) => {
                const isGroup = group.items.length > 1;
                const isExpanded = expandedGroups.has(group.key);
                const solo = group.items[0];
                const catName = getCatName(solo.category_id, expenseCategories);
                const cardName = getCardDisplayName(solo.credit_card_id);
                const split = expenseSplits.find((s) => s.title === solo.name);
                const splitNames = split?.participants?.filter((p) => p.name !== "Me").map((p) => p.name) ?? [];
                const perPerson = split?.participants?.[0]?.owes ?? null;

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
                            {expense.notes && (
                              <p className="text-xs text-slate-400 mt-0.5 truncate">{expense.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className={`font-bold text-sm ${Number(expense.amount) < 0 ? "text-emerald-600" : "text-slate-600"}`}>
                              {fmtAmount(Number(expense.amount))}
                            </span>
                            <RowMenu
                              onEdit={() => openEditExpense(expense)}
                              onDelete={() => setDeleteTarget({ type: "expense", id: expense.id })}
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
        </div>
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

              {/* Select existing or create new (only when not editing) */}
              {!editCreditCard && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Card</label>
                  <select
                    value={creditCardForm.sourceCardId}
                    onChange={(e) => handleSourceCardChange(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="">— Create new card —</option>
                    {creditCards.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.last_four ? ` ····${c.last_four}` : ""}</option>
                    ))}
                  </select>
                  {creditCardForm.sourceCardId && (
                    <p className="text-xs text-amber-600 mt-1">Editing billing cycle for selected card.</p>
                  )}
                </div>
              )}

              {/* Name + Color */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Card Name</label>
                  <input
                    type="text"
                    required
                    value={creditCardForm.name}
                    onChange={(e) => setCreditCardForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Chase Sapphire"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Four</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={creditCardForm.last_four}
                    onChange={(e) => setCreditCardForm((f) => ({ ...f, last_four: e.target.value }))}
                    placeholder="1234"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Color picker */}
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

              {/* Billing cycle days */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Billing Cycle <span className="text-slate-400 font-normal text-xs">(day of month, 1–31)</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <input
                      type="number" min="1" max="31" required
                      value={creditCardForm.billing_start_day}
                      onChange={(e) => setCreditCardForm((f) => ({ ...f, billing_start_day: e.target.value }))}
                      placeholder="25"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block text-center">Start day</span>
                  </div>
                  <div>
                    <input
                      type="number" min="1" max="31" required
                      value={creditCardForm.billing_end_day}
                      onChange={(e) => setCreditCardForm((f) => ({ ...f, billing_end_day: e.target.value }))}
                      placeholder="24"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block text-center">End day</span>
                  </div>
                  <div>
                    <input
                      type="number" min="1" max="31" required
                      value={creditCardForm.due_date_day}
                      onChange={(e) => setCreditCardForm((f) => ({ ...f, due_date_day: e.target.value }))}
                      placeholder="15"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block text-center">Due day</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Viewing Feb with Start 25, End 26, Due 23 → queries Jan 25–Feb 26, due Mar 23.
                </p>
              </div>

              {/* Category with inline add/delete */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Category</label>
                  {!addingCCCat && (
                    <button type="button" onClick={() => { setAddingCCCat(true); setNewCCCatName(""); setCCCatDropOpen(false); }}
                      className="text-xs text-amber-600 hover:text-amber-800 font-medium flex items-center gap-0.5 transition-colors">
                      <Plus size={12} /> New
                    </button>
                  )}
                </div>
                {addingCCCat ? (
                  <div className="flex gap-2">
                    <input type="text" autoFocus value={newCCCatName} onChange={(e) => setNewCCCatName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCCCategory(); } if (e.key === "Escape") { setAddingCCCat(false); setNewCCCatName(""); } }}
                      placeholder="Category name"
                      className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    <button type="button" onClick={addCCCategory} className="px-3 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">Add</button>
                    <button type="button" onClick={() => { setAddingCCCat(false); setNewCCCatName(""); }} className="px-2 py-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="relative" ref={ccCatDropRef}>
                    <button type="button"
                      onClick={() => setCCCatDropOpen((o) => !o)}
                      className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm text-left bg-white hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500">
                      <span className={creditCardForm.category_id ? "text-slate-800" : "text-slate-400"}>
                        {creditCardForm.category_id
                          ? (creditCardCategories.find((c) => c.id === parseInt(creditCardForm.category_id))?.name ?? "None")
                          : "None"}
                      </span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${ccCatDropOpen ? "rotate-180" : ""}`} />
                    </button>
                    {ccCatDropOpen && (
                      <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 py-1 max-h-48 overflow-y-auto">
                        <button type="button"
                          onClick={() => { setCreditCardForm((f) => ({ ...f, category_id: "" })); setCCCatDropOpen(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-50">None</button>
                        {creditCardCategories.map((c) => (
                          <div key={c.id} className="flex items-center group/opt">
                            <button type="button"
                              onClick={() => { setCreditCardForm((f) => ({ ...f, category_id: String(c.id) })); setCCCatDropOpen(false); }}
                              className="flex-1 text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">{c.name}</button>
                            <button type="button" onClick={() => deleteCCCategory(c.id)}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Credit Card</label>
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
                          <button key={c.id} type="button"
                            onClick={() => { setExpenseForm((f) => ({ ...f, credit_card_id: String(c.id) })); setCardDropOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            {c.name}{c.last_four ? ` ····${c.last_four}` : ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Split section */}
                {(() => {
                  const splitRef = splitDropRef;
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-slate-700 flex items-center gap-1.5">
                          <Users size={14} className="text-slate-400" />
                          Split this expense
                        </label>
                        {!addingPerson && (
                          <button type="button" onClick={() => setAddingPerson(true)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 transition-colors">
                            <Plus size={12} /> New person
                          </button>
                        )}
                      </div>

                      {addingPerson && (
                        <div className="flex gap-2 mb-2">
                          <input type="text" autoFocus value={newPersonName}
                            onChange={(e) => setNewPersonName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewPerson(); } if (e.key === "Escape") { setAddingPerson(false); setNewPersonName(""); } }}
                            placeholder="Person name"
                            className="flex-1 border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          <button type="button" onClick={addNewPerson} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Add</button>
                          <button type="button" onClick={() => { setAddingPerson(false); setNewPersonName(""); }} className="px-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
                        </div>
                      )}

                      {knownPeople.length > 0 && (
                        <div className="relative" ref={splitRef}>
                          <button type="button"
                            onClick={() => setSplitDropOpen((o) => !o)}
                            className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm text-left bg-white hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <span className={splitPeople.length ? "text-slate-800" : "text-slate-400"}>
                              {splitPeople.length ? splitPeople.join(", ") : "Select people…"}
                            </span>
                            <ChevronDown size={14} className={`text-slate-400 transition-transform ${splitDropOpen ? "rotate-180" : ""}`} />
                          </button>
                          {splitDropOpen && (
                            <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 py-1 max-h-40 overflow-y-auto">
                              {knownPeople.map((name) => (
                                <div key={name} className="flex items-center group/opt">
                                  <label className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                                    <input type="checkbox" checked={splitPeople.includes(name)}
                                      onChange={() => toggleSplitPerson(name)}
                                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-sm text-slate-700">{name}</span>
                                  </label>
                                  <button type="button"
                                    onClick={() => removePerson(name)}
                                    className="opacity-0 group-hover/opt:opacity-100 px-2 py-2 text-slate-300 hover:text-red-400 transition-colors">
                                    <X size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {splitPeople.length > 0 && perPerson > 0 && (
                        <p className="text-xs text-indigo-600 font-medium bg-indigo-50 rounded-md px-3 py-2 mt-2">
                          {splitCount} people · {fmtAmount(perPerson)} each
                        </p>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea value={expenseForm.notes}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="Optional notes"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
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
                    <button
                      type="button"
                      onClick={() => { setAddingRecurringCat(true); setNewRecurringCatName(""); }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 transition-colors"
                    >
                      <Plus size={12} /> New
                    </button>
                  )}
                </div>
                {addingRecurringCat ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={newRecurringCatName}
                      onChange={(e) => setNewRecurringCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addRecurringCategory(); }
                        if (e.key === "Escape") { setAddingRecurringCat(false); setNewRecurringCatName(""); }
                      }}
                      placeholder="Category name"
                      className="flex-1 border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="button" onClick={addRecurringCategory} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Add</button>
                    <button type="button" onClick={() => { setAddingRecurringCat(false); setNewRecurringCatName(""); }} className="px-2 py-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
                  </div>
                ) : (
                  <select
                    value={recurringForm.category_id}
                    onChange={(e) => setRecurringForm((f) => ({ ...f, category_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">None</option>
                    {recurringCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
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

      {/* Scan modal */}
      {showScanModal && (
        <ScanModal
          onClose={() => setShowScanModal(false)}
          onSave={saveScanResults}
          expenseCategories={expenseCategories}
        />
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
