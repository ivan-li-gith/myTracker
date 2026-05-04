"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CreditCard as CreditCardIcon, Receipt, Calendar, Repeat, MoreHorizontal,
  CheckCircle2, Plus, X, ChevronLeft, ChevronRight, Pencil, Trash2,
  ScanLine, Upload, Loader2, Users, ChevronDown,
  TrendingDown, Wallet, AlertCircle, Tag,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Payment, Expense, Category, CreditCard, ExpenseSplit } from "@/lib/types";

// ---- Helpers ----

function fmtAmount(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-32 text-sm">
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
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
  payments,
  month,
}: {
  expenses: Expense[];
  categories: Category[];
  creditCards: CreditCard[];
  payments: Payment[];
  month: string;
}) {
  const grossSpend = expenses.reduce((s, e) => Number(e.amount) > 0 ? s + Number(e.amount) : s, 0);
  const refunds = expenses.reduce((s, e) => Number(e.amount) < 0 ? s + Math.abs(Number(e.amount)) : s, 0);
  const netSpend = grossSpend - refunds;

  const pendingTotal = payments
    .filter((p) => !p.is_paid)
    .reduce((s, p) => s + (p.amount ?? 0), 0);

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

  return (
    <div className="mb-8 flex flex-col gap-4">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={14} className="text-indigo-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Spent in {label}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmtAmount(netSpend)}</p>
          {refunds > 0 && (
            <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <TrendingDown size={11} /> {fmtAmount(refunds)} in refunds
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
          <p className="text-xs text-slate-400 font-medium mt-1">{payments.filter((p) => !p.is_paid).length} unpaid</p>
        </div>
      </div>

      {/* Breakdowns — side by side when both present */}
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
              {/* Drop zone */}
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

              {/* Category picker for all rows */}
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

              {/* Editable rows */}
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

// ---- Payment form ----

const EMPTY_PAYMENT = { name: "", amount: "", due_date: "", recurrence: "", category_id: "", notes: "" };
const EMPTY_EXPENSE = { name: "", amount: "", date: "", category_id: "", credit_card_id: "", notes: "" };

// ---- Page ----

export default function PaymentsAndExpensesPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "payment" | "expense"; id: number } | null>(null);

  const [showScanModal, setShowScanModal] = useState(false);
  const [monthTotal, setMonthTotal] = useState<number | null>(null);

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

  // Inline category creation
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Inline credit card creation
  const [addingCard, setAddingCard] = useState(false);
  const [newCardName, setNewCardName] = useState("");
  const [newCardColor, setNewCardColor] = useState("blue");

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE);

  useEffect(() => {
    apiFetch("/payments").then(setPayments).catch(console.error);
    apiFetch("/categories?type=payment").then(setCategories).catch(console.error);
    apiFetch("/categories?type=expense").then(setExpenseCategories).catch(console.error);
    apiFetch("/credit-cards").then(setCreditCards).catch(console.error);
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
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    apiFetch(`/expenses?month=${selectedMonth}`).then(setExpenses).catch(console.error);
    apiFetch(`/expenses/summary?month=${selectedMonth}`)
      .then((s) => setMonthTotal(Number(s.total)))
      .catch(console.error);
  }, [selectedMonth]);

  const pendingPayments = payments.filter((p) => !p.is_paid);

  const getCatName = (id: number | null, cats: Category[]) =>
    id != null ? (cats.find((c) => c.id === id)?.name ?? null) : null;

  // ---- Payments ----

  function openAddPayment() {
    setEditPayment(null);
    setPaymentForm({ ...EMPTY_PAYMENT, due_date: toLocalDate(new Date()) });
    setShowPaymentModal(true);
  }

  function openEditPayment(p: Payment) {
    setEditPayment(p);
    setPaymentForm({
      name: p.name,
      amount: p.amount != null ? String(p.amount) : "",
      due_date: p.due_date,
      recurrence: p.recurrence ?? "",
      category_id: p.category_id != null ? String(p.category_id) : "",
      notes: p.notes ?? "",
    });
    setShowPaymentModal(true);
  }

  async function savePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = {
      name: paymentForm.name,
      amount: paymentForm.amount ? parseFloat(paymentForm.amount) : null,
      due_date: paymentForm.due_date,
      recurrence: paymentForm.recurrence || null,
      category_id: paymentForm.category_id ? parseInt(paymentForm.category_id) : null,
      notes: paymentForm.notes || null,
    };
    if (editPayment) {
      const updated = await apiFetch(`/payments/${editPayment.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setPayments((prev) => prev.map((p) => (p.id === editPayment.id ? updated : p)));
    } else {
      const created = await apiFetch("/payments", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setPayments((prev) => [created, ...prev]);
    }
    setShowPaymentModal(false);
    setEditPayment(null);
    setPaymentForm(EMPTY_PAYMENT);
  }

  async function markPaid(id: number) {
    const updated = await apiFetch(`/payments/${id}/mark-paid`, { method: "POST" });
    if (updated === null) {
      // recurring: due date bumped, stays in list
      const refreshed = await apiFetch("/payments");
      setPayments(refreshed);
    } else {
      setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)));
    }
  }

  async function deletePayment(id: number) {
    await apiFetch(`/payments/${id}`, { method: "DELETE" });
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }

  // ---- Expenses ----

  async function addCreditCard() {
    const name = newCardName.trim();
    if (!name) return;
    const created: CreditCard = await apiFetch("/credit-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: newCardColor }),
    });
    setCreditCards((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setExpenseForm((f) => ({ ...f, credit_card_id: String(created.id) }));
    setNewCardName(""); setNewCardColor("blue");
    setAddingCard(false);
  }

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

  async function deleteCreditCard(id: number) {
    await apiFetch(`/credit-cards/${id}`, { method: "DELETE" });
    setCreditCards((prev) => prev.filter((c) => c.id !== id));
    if (expenseForm.credit_card_id === String(id)) setExpenseForm((f) => ({ ...f, credit_card_id: "" }));
  }

  function removePerson(name: string) {
    setKnownPeople((prev) => prev.filter((n) => n !== name));
    setSplitPeople((prev) => prev.filter((n) => n !== name));
  }

  function resetCardAdd() {
    setAddingCard(false); setNewCardName(""); setNewCardColor("blue");
  }

  function openAddExpense() {
    setEditExpense(null);
    setExpenseForm({ ...EMPTY_EXPENSE, date: toLocalDate(new Date()) });
    resetSplit();
    setAddingCat(false); setNewCatName(""); setCatDropOpen(false);
    setAddingCard(false); setNewCardName(""); setNewCardColor("blue"); setCardDropOpen(false);
    setShowExpenseModal(true);
  }

  function openEditExpense(ex: Expense) {
    setEditExpense(ex);
    setExpenseForm({
      name: ex.name,
      amount: String(ex.amount),
      date: ex.date,
      category_id: ex.category_id != null ? String(ex.category_id) : "",
      credit_card_id: ex.credit_card_id != null ? String(ex.credit_card_id) : "",
      notes: ex.notes ?? "",
    });
    const matchingSplit = expenseSplits.find((s) => s.title === ex.name);
    const preSelected = matchingSplit?.participants?.filter((p) => p.name !== "Me").map((p) => p.name) ?? [];
    setSplitPeople(preSelected);
    setAddingPerson(false); setNewPersonName(""); setSplitDropOpen(false);
    setAddingCat(false); setNewCatName(""); setCatDropOpen(false);
    setAddingCard(false); setNewCardName(""); setNewCardColor("blue"); setCardDropOpen(false);
    setShowExpenseModal(true);
  }

  async function doSaveExpense(): Promise<Expense | null> {
    const body = {
      name: expenseForm.name,
      amount: parseFloat(expenseForm.amount),
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
    const expense = await doSaveExpense();
    if (splitPeople.length > 0 && expense && !editExpense) {
      await doSaveSplit(expenseForm.name, parseFloat(expenseForm.amount));
    }
    setShowExpenseModal(false);
    setEditExpense(null);
    setExpenseForm(EMPTY_EXPENSE);
    resetSplit();
  }

  async function saveExpenseAndAddAnother() {
    const expense = await doSaveExpense();
    if (splitPeople.length > 0 && expense && !editExpense) {
      await doSaveSplit(expenseForm.name, parseFloat(expenseForm.amount));
    }
    setExpenseForm({ ...EMPTY_EXPENSE, date: expenseForm.date });
    resetSplit();
  }

  async function deleteExpense(id: number) {
    await apiFetch(`/expenses/${id}`, { method: "DELETE" });
    setExpenses((prev) => prev.filter((ex) => ex.id !== id));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "payment") await deletePayment(deleteTarget.id);
    else await deleteExpense(deleteTarget.id);
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

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-[calc(100vh-2rem)] relative pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Finances</h1>
          <p className="text-slate-500 mt-1">Track your upcoming bills and recent spending.</p>
        </div>
      </div>

      {/* Finance Summary */}
      <FinanceSummary
        expenses={expenses}
        categories={expenseCategories}
        creditCards={creditCards}
        payments={payments}
        month={selectedMonth}
      />

      {/* Payments Section */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CreditCardIcon size={16} className="text-amber-500" />
              Upcoming Payments
            </h2>
            <span className="bg-amber-100 text-amber-700 py-0.5 px-2 rounded-full text-xs font-bold">
              {pendingPayments.length} Pending
            </span>
          </div>
          <button
            onClick={openAddPayment}
            className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 p-1 rounded-md transition-colors"
            aria-label="Add payment"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {pendingPayments.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-500 text-sm font-medium">All bills are paid!</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingPayments.map((payment) => (
                <li key={payment.id} className="group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <button
                      onClick={() => markPaid(payment.id)}
                      className="flex-shrink-0 text-slate-300 hover:text-emerald-500 transition-colors"
                      title="Mark as paid"
                    >
                      <CheckCircle2 size={22} />
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{payment.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm">
                          <Calendar size={10} />
                          Due {fmtDate(payment.due_date)}
                        </span>
                        {payment.recurrence && (
                          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm">
                            <Repeat size={10} />
                            {payment.recurrence}
                          </span>
                        )}
                        {payment.days_until_due < 0 && (
                          <span className="text-[11px] font-bold uppercase tracking-wider text-red-500 bg-red-50 px-2 py-0.5 rounded-sm">
                            Overdue
                          </span>
                        )}
                        {payment.days_until_due >= 0 && payment.days_until_due <= 7 && (
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-sm">
                            Due soon
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="font-bold text-slate-900">{fmtAmount(payment.amount)}</span>
                    <RowMenu
                      onEdit={() => openEditPayment(payment)}
                      onDelete={() => setDeleteTarget({ type: "payment", id: payment.id })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Expenses Section */}
      <section>
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Receipt size={16} className="text-indigo-500" />
              Recent Expenses
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Month nav */}
            <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-1 py-1">
              <button onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-medium text-slate-700 min-w-[100px] text-center">
                {formatMonthLabel(selectedMonth)}
              </span>
              <button onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
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
          {expenses.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center">
              <p className="text-slate-500 text-sm font-medium">No expenses logged for this month.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {expenses.map((expense) => {
                const catName = getCatName(expense.category_id, expenseCategories);
                const split = expenseSplits.find((s) => s.title === expense.name);
                const splitNames = split?.participants?.filter((p) => p.name !== "Me").map((p) => p.name) ?? [];
                const perPerson = split?.participants?.[0]?.owes ?? null;
                return (
                  <li key={expense.id} className="group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800 truncate">{expense.name}</p>
                        {catName && (
                          <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0">
                            {catName}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 block">
                        {fmtDate(expense.date)}
                      </span>
                      {expense.notes && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{expense.notes}</p>
                      )}
                      {splitNames.length > 0 && (
                        <p className="text-xs text-indigo-400 mt-0.5 flex items-center gap-1">
                          <Users size={10} />
                          Split with {splitNames.join(", ")}
                          {perPerson != null && <span className="text-slate-300 mx-0.5">·</span>}
                          {perPerson != null && <span>{fmtAmount(perPerson)} each</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className={`font-bold ${Number(expense.amount) < 0 ? "text-emerald-600" : "text-slate-600"}`}>
                        {fmtAmount(Number(expense.amount))}
                      </span>
                      <RowMenu
                        onEdit={() => openEditExpense(expense)}
                        onDelete={() => setDeleteTarget({ type: "expense", id: expense.id })}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">{editPayment ? "Edit Payment" : "New Payment"}</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={savePayment} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input type="text" required value={paymentForm.name}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Netflix, Rent"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                  <input type="number" min="0" step="0.01" value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input type="date" required value={paymentForm.due_date}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, due_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Recurrence</label>
                  <select value={paymentForm.recurrence}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, recurrence: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="">One-time</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select value={paymentForm.category_id}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, category_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="">None</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Optional notes"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  {editPayment ? "Save changes" : "Save"}
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
          resetSplit();
          setAddingCat(false); setNewCatName(""); setCatDropOpen(false);
          setAddingCard(false); setNewCardName(""); setNewCardColor("blue"); setCardDropOpen(false);
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

                {/* Credit card with inline add */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">Credit Card</label>
                    {!addingCard && (
                      <button type="button" onClick={() => { setAddingCard(true); setNewCardName(""); setNewCardColor("blue"); setCardDropOpen(false); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 transition-colors">
                        <Plus size={12} /> New
                      </button>
                    )}
                  </div>
                  {addingCard ? (
                    <div className="flex flex-col gap-2">
                      <input type="text" autoFocus value={newCardName} onChange={(e) => setNewCardName(e.target.value)}
                        placeholder="Card name (e.g. Chase Sapphire)"
                        className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Color:</span>
                        {Object.entries(CARD_COLOR_MAP).map(([key, hex]) => (
                          <button key={key} type="button" onClick={() => setNewCardColor(key)}
                            className={`w-5 h-5 rounded-full border-2 transition-all ${newCardColor === key ? "border-slate-700 scale-110" : "border-transparent"}`}
                            style={{ backgroundColor: hex }} />
                        ))}
                        <div className="flex-1" />
                        <button type="button" onClick={addCreditCard} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Add</button>
                        <button type="button" onClick={resetCardAdd} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
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

                {/* Notes — always last before buttons */}
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
