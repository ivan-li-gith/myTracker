"use client";

import { useState, useEffect, useRef } from "react";
import {
  CreditCard, Receipt, Calendar, Repeat, MoreHorizontal,
  CheckCircle2, Plus, X, ChevronLeft, ChevronRight, Pencil, Trash2, Calculator, Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Payment, Expense, Category } from "@/lib/types";

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

// ---- Bill Splitter ----

type Person = { id: number; name: string; amount: string };

function BillSplitter() {
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [people, setPeople] = useState<Person[]>([
    { id: 1, name: "", amount: "" },
    { id: 2, name: "", amount: "" },
  ]);
  const [nextId, setNextId] = useState(3);
  const [saved, setSaved] = useState(false);

  const totalNum = parseFloat(total) || 0;
  const equalShare = people.length > 0 && totalNum > 0 ? totalNum / people.length : 0;
  const customSum = people.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const remaining = totalNum - customSum;
  const isBalanced = totalNum > 0 && Math.abs(remaining) < 0.01;

  function addPerson() {
    setPeople((prev) => [...prev, { id: nextId, name: "", amount: "" }]);
    setNextId((n) => n + 1);
  }

  function removePerson(id: number) {
    if (people.length <= 2) return;
    setPeople((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePerson(id: number, field: "name" | "amount", value: string) {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  async function saveSplit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const namedPeople = people.filter((p) => p.name.trim());
    if (!namedPeople.length || !totalNum) return;

    const participants = namedPeople.map((p) => ({
      name: p.name.trim(),
      owes: mode === "equal" ? Number(equalShare.toFixed(2)) : parseFloat(p.amount) || 0,
    }));

    await apiFetch("/expense-splits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title || null, total: totalNum, participants }),
    });

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setTitle(""); setTotal(""); setMode("equal");
      const id = nextId;
      setPeople([{ id, name: "", amount: "" }, { id: id + 1, name: "", amount: "" }]);
      setNextId(id + 2);
    }, 1500);
  }

  return (
    <section className="mt-10 pt-8 border-t border-slate-200">
      <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Calculator size={16} className="text-slate-500" />
          Bill Splitter
        </h2>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-lg">
        <form onSubmit={saveSplit}>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Dinner, Trip..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Bill</label>
              <input type="number" min="0" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)}
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div className="flex gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
            {(["equal", "custom"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  mode === m ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}>
                {m === "equal" ? "Equal split" : "Custom amounts"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 mb-4">
            {people.map((person, idx) => (
              <div key={person.id} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-4 text-right shrink-0">{idx + 1}</span>
                <input type="text" value={person.name} onChange={(e) => updatePerson(person.id, "name", e.target.value)}
                  placeholder={`Person ${idx + 1}`}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                {mode === "equal" ? (
                  <span className="w-20 text-right text-sm font-semibold text-slate-700 shrink-0">
                    {equalShare > 0 ? fmtAmount(equalShare) : <span className="text-slate-300">—</span>}
                  </span>
                ) : (
                  <input type="number" min="0" step="0.01" value={person.amount}
                    onChange={(e) => updatePerson(person.id, "amount", e.target.value)}
                    placeholder="0.00"
                    className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0" />
                )}
                <button type="button" onClick={() => removePerson(person.id)}
                  className={`text-slate-300 hover:text-red-400 transition-colors shrink-0 ${people.length <= 2 ? "invisible" : ""}`}>
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>

          {mode === "custom" && totalNum > 0 && (
            <div className={`flex items-center gap-1.5 text-xs font-medium mb-4 ${isBalanced ? "text-emerald-600" : "text-amber-600"}`}>
              {isBalanced ? (
                <><Check size={13} strokeWidth={2.5} /> Balanced</>
              ) : (
                <>{fmtAmount(Math.abs(remaining))} {remaining > 0 ? "unassigned" : "over budget"}</>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={addPerson}
              className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
              <Plus size={15} /> Add person
            </button>
            <button type="submit" disabled={!saved && (!totalNum || people.every((p) => !p.name.trim()))}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                saved
                  ? "bg-emerald-500 text-white"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              }`}>
              {saved ? <><Check size={14} /> Saved!</> : "Save Split"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

// ---- Payment form ----

const EMPTY_PAYMENT = { name: "", amount: "", due_date: "", recurrence: "", category_id: "", notes: "" };
const EMPTY_EXPENSE = { name: "", amount: "", date: "", category_id: "", notes: "" };

// ---- Page ----

export default function PaymentsAndExpensesPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "payment" | "expense"; id: number } | null>(null);

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
  }, []);

  useEffect(() => {
    apiFetch(`/expenses?month=${selectedMonth}`).then(setExpenses).catch(console.error);
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

  function openAddExpense() {
    setEditExpense(null);
    setExpenseForm({ ...EMPTY_EXPENSE, date: toLocalDate(new Date()) });
    setShowExpenseModal(true);
  }

  function openEditExpense(ex: Expense) {
    setEditExpense(ex);
    setExpenseForm({
      name: ex.name,
      amount: String(ex.amount),
      date: ex.date,
      category_id: ex.category_id != null ? String(ex.category_id) : "",
      notes: ex.notes ?? "",
    });
    setShowExpenseModal(true);
  }

  async function saveExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = {
      name: expenseForm.name,
      amount: parseFloat(expenseForm.amount),
      date: expenseForm.date,
      category_id: expenseForm.category_id ? parseInt(expenseForm.category_id) : null,
      notes: expenseForm.notes || null,
    };
    if (editExpense) {
      const updated = await apiFetch(`/expenses/${editExpense.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setExpenses((prev) => prev.map((ex) => (ex.id === editExpense.id ? updated : ex)));
    } else {
      const created = await apiFetch("/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (created.date.startsWith(selectedMonth)) {
        setExpenses((prev) => [created, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      }
    }
    setShowExpenseModal(false);
    setEditExpense(null);
    setExpenseForm(EMPTY_EXPENSE);
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

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-[calc(100vh-2rem)] relative pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Finances</h1>
          <p className="text-slate-500 mt-1">Track your upcoming bills and recent spending.</p>
        </div>
      </div>

      {/* Payments Section */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CreditCard size={16} className="text-amber-500" />
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
          <div className="flex items-center gap-2">
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
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="font-bold text-slate-600">{fmtAmount(Number(expense.amount))}</span>
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

      {/* Bill Splitter */}
      <BillSplitter />

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
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">{editExpense ? "Edit Expense" : "New Expense"}</h2>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveExpense} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input type="text" required value={expenseForm.name}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Groceries, Uber"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                  <input type="number" min="0" step="0.01" required value={expenseForm.amount}
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select value={expenseForm.category_id}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, category_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                  <option value="">None</option>
                  {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={expenseForm.notes}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Optional notes"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  {editExpense ? "Save changes" : "Save"}
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
