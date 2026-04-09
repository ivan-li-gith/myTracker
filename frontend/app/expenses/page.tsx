"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Tag, X, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Expense, Category, ExpenseSummary } from "@/lib/types";

// ---- Helpers ----

type CategoryFilter = "all" | "uncategorized" | number;

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: -1 | 1): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fmtAmount(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const EMPTY_FORM = { name: "", amount: "", date: "", categoryId: "", notes: "" };

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

  async function saveSplit(e: React.FormEvent) {
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
      setTitle("");
      setTotal("");
      setMode("equal");
      const newId = nextId;
      setPeople([
        { id: newId, name: "", amount: "" },
        { id: newId + 1, name: "", amount: "" },
      ]);
      setNextId(newId + 2);
    }, 1500);
  }

  return (
    <div className="mt-10 pt-8 border-t border-slate-100">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900">Bill Splitter</h2>
        <p className="text-sm text-slate-400 mt-0.5">Calculate how to split a shared bill</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-lg">
        <form onSubmit={saveSplit}>
          {/* Title + Total */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Dinner, Trip..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Bill</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
            {(["equal", "custom"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  mode === m
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "equal" ? "Equal split" : "Custom amounts"}
              </button>
            ))}
          </div>

          {/* People */}
          <div className="flex flex-col gap-2 mb-4">
            {people.map((person, idx) => (
              <div key={person.id} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-4 text-right shrink-0">{idx + 1}</span>
                <input
                  type="text"
                  value={person.name}
                  onChange={(e) => updatePerson(person.id, "name", e.target.value)}
                  placeholder={`Person ${idx + 1}`}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {mode === "equal" ? (
                  <span className="w-20 text-right text-sm font-semibold text-slate-700 shrink-0">
                    {equalShare > 0 ? fmtAmount(equalShare) : <span className="text-slate-300">—</span>}
                  </span>
                ) : (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={person.amount}
                    onChange={(e) => updatePerson(person.id, "amount", e.target.value)}
                    placeholder="0.00"
                    className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removePerson(person.id)}
                  className={`text-slate-300 hover:text-red-400 transition-colors shrink-0 ${
                    people.length <= 2 ? "invisible" : ""
                  }`}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Balance indicator (custom mode) */}
          {mode === "custom" && totalNum > 0 && (
            <div
              className={`flex items-center gap-1.5 text-xs font-medium mb-4 ${
                isBalanced ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {isBalanced ? (
                <>
                  <Check size={13} strokeWidth={2.5} /> Balanced
                </>
              ) : (
                <>
                  {fmtAmount(Math.abs(remaining))}{" "}
                  {remaining > 0 ? "unassigned" : "over budget"}
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={addPerson}
              className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <Plus size={15} /> Add person
            </button>
            <button
              type="submit"
              disabled={!saved && (!totalNum || people.every((p) => !p.name.trim()))}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                saved
                  ? "bg-emerald-500 text-white"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
            >
              {saved ? (
                <>
                  <Check size={14} /> Saved!
                </>
              ) : (
                "Save Split"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [catFilter, setCatFilter] = useState<CategoryFilter>("all");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);

  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [newCatName, setNewCatName] = useState("");

  useEffect(() => {
    fetchExpenses();
    fetchSummary();
  }, [selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchExpenses() {
    const data = await apiFetch(`/expenses?month=${selectedMonth}`);
    setExpenses(data);
  }

  async function fetchSummary() {
    const data = await apiFetch(`/expenses/summary?month=${selectedMonth}`);
    setSummary(data);
  }

  async function fetchCategories() {
    const data = await apiFetch("/categories?type=expense");
    setCategories(data);
  }

  const filtered =
    catFilter === "all"
      ? expenses
      : catFilter === "uncategorized"
      ? expenses.filter((e) => e.category_id === null)
      : expenses.filter((e) => e.category_id === catFilter);

  const usedCatIds = new Set(expenses.map((e) => e.category_id));
  const usedCategories = categories.filter((c) => usedCatIds.has(c.id));
  const hasUncategorized = expenses.some((e) => e.category_id === null);

  const avg = summary && summary.count > 0 ? Number(summary.total) / summary.count : 0;

  const getCatName = (id: number | null) =>
    id != null ? (categories.find((c) => c.id === id)?.name ?? null) : null;

  const getCatTotal = (id: number | null): number => {
    if (!summary) return 0;
    const row = summary.by_category.find((r) => r.category_id === id);
    return row ? Number(row.total) : 0;
  };

  // ---- Inline name edit ----
  async function commitNameEdit(id: number) {
    if (!editingNameValue.trim()) {
      cancelNameEdit();
      return;
    }
    const updated = await apiFetch(`/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingNameValue.trim() }),
    });
    setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
    setEditingNameId(null);
    setEditingNameValue("");
  }

  function cancelNameEdit() {
    setEditingNameId(null);
    setEditingNameValue("");
  }

  // ---- CRUD ----
  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM, date: toLocalDate(new Date()) });
    setShowAddModal(true);
  }

  function openEdit(expense: Expense) {
    setEditExpense(expense);
    setForm({
      name: expense.name,
      amount: String(expense.amount),
      date: expense.date,
      categoryId: expense.category_id != null ? String(expense.category_id) : "",
      notes: expense.notes ?? "",
    });
  }

  function closeForm() {
    setShowAddModal(false);
    setEditExpense(null);
    setForm(EMPTY_FORM);
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name,
      amount: parseFloat(form.amount),
      date: form.date,
      category_id: form.categoryId ? parseInt(form.categoryId) : null,
      notes: form.notes || null,
    };

    if (editExpense) {
      const updated = await apiFetch(`/expenses/${editExpense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setExpenses((prev) => prev.map((ex) => (ex.id === editExpense.id ? updated : ex)));
    } else {
      const created = await apiFetch("/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (created.date.startsWith(selectedMonth)) {
        setExpenses((prev) => [created, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      }
    }
    await fetchSummary();
    closeForm();
  }

  async function confirmDelete() {
    if (deleteId === null) return;
    await apiFetch(`/expenses/${deleteId}`, { method: "DELETE" });
    setExpenses((prev) => prev.filter((e) => e.id !== deleteId));
    setDeleteId(null);
    await fetchSummary();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const created = await apiFetch("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim(), type: "expense" }),
    });
    setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setNewCatName("");
  }

  async function deleteCategory(id: number) {
    await apiFetch(`/categories/${id}`, { method: "DELETE" });
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-400 mt-0.5">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month nav */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-1 py-1">
            <button
              onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[116px] text-center">
              {formatMonthLabel(selectedMonth)}
            </span>
            <button
              onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowCatModal(true)}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Tag size={15} />
            Categories
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Add Expense
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total spent</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{fmtAmount(Number(summary.total))}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {summary.count} expense{summary.count !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Avg per expense</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{summary.count > 0 ? fmtAmount(avg) : "—"}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Top category</p>
            {summary.by_category.length > 0 ? (
              <>
                <p className="text-xl font-bold text-slate-900 mt-1 truncate">
                  {getCatName(summary.by_category[0].category_id) ?? "Uncategorized"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {fmtAmount(Number(summary.by_category[0].total))}
                </p>
              </>
            ) : (
              <p className="text-xl font-bold text-slate-300 mt-1">—</p>
            )}
          </div>
        </div>
      )}

      {/* Category filter pills */}
      {(usedCategories.length > 0 || hasUncategorized) && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setCatFilter("all")}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              catFilter === "all"
                ? "bg-indigo-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          {usedCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCatFilter(catFilter === cat.id ? "all" : cat.id)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1.5 ${
                catFilter === cat.id
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {cat.name}
              <span className="opacity-60">{fmtAmount(getCatTotal(cat.id))}</span>
            </button>
          ))}
          {hasUncategorized && (
            <button
              onClick={() => setCatFilter(catFilter === "uncategorized" ? "all" : "uncategorized")}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                catFilter === "uncategorized"
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              Uncategorized
            </button>
          )}
        </div>
      )}

      {/* Expense table */}
      {filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-16 text-sm">
          {expenses.length === 0
            ? "No expenses this month. Add one to get started."
            : "No expenses in this category."}
        </p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                  Date
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                  Category
                </th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                  Amount
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((expense) => {
                const catName = getCatName(expense.category_id);
                const isEditingName = editingNameId === expense.id;

                return (
                  <tr key={expense.id} className="hover:bg-slate-50/60 group transition-colors">
                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-slate-500">{fmtDate(expense.date)}</span>
                    </td>

                    {/* Name (inline editable) */}
                    <td className="px-4 py-3 max-w-[220px]">
                      {isEditingName ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          onBlur={() => commitNameEdit(expense.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitNameEdit(expense.id);
                            }
                            if (e.key === "Escape") cancelNameEdit();
                          }}
                          className="w-full border border-indigo-300 rounded px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      ) : (
                        <span
                          onClick={() => {
                            setEditingNameId(expense.id);
                            setEditingNameValue(expense.name);
                          }}
                          className="text-sm font-medium text-slate-800 cursor-text hover:text-indigo-600 transition-colors truncate block"
                          title="Click to edit name"
                        >
                          {expense.name}
                        </span>
                      )}
                      {expense.notes && !isEditingName && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{expense.notes}</p>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      {catName ? (
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                          {catName}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-slate-800">
                        {fmtAmount(Number(expense.amount))}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(expense)}
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(expense.id)}
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bill Splitter */}
      <BillSplitter />

      {/* Add / Edit Modal */}
      {(showAddModal || editExpense !== null) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {editExpense ? "Edit Expense" : "New Expense"}
            </h2>
            <form onSubmit={saveExpense} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  required
                  placeholder="e.g. Groceries, Uber"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setField("amount", e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setField("date", e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setField("categoryId", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  rows={2}
                  placeholder="Optional notes"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {editExpense ? "Save changes" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Expense Categories</h2>
              <button
                onClick={() => setShowCatModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-0.5 mb-4 max-h-56 overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No categories yet.</p>
              ) : (
                categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 group"
                  >
                    <span className="text-sm text-slate-700">{cat.name}</span>
                    <button
                      onClick={() => deleteCategory(cat.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={addCategory} className="flex gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New category name"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
              >
                Add
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Delete expense?</h2>
            <p className="text-sm text-slate-500 mb-5">This will permanently remove this expense.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
