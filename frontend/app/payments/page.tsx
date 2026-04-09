"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, MoreVertical, Tag, X, Check } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Payment, Category } from "@/lib/types";

type FilterTab = "active" | "all";
type PaymentStatus = "overdue" | "due-soon" | "upcoming" | "paid";

function getStatus(p: Payment): PaymentStatus {
  if (p.is_paid) return "paid";
  if (p.days_until_due < 0) return "overdue";
  if (p.days_until_due <= 7) return "due-soon";
  return "upcoming";
}

const STATUS_STYLE: Record<PaymentStatus, string> = {
  overdue: "bg-red-100 text-red-600",
  "due-soon": "bg-amber-100 text-amber-700",
  upcoming: "bg-slate-100 text-slate-500",
  paid: "bg-emerald-100 text-emerald-600",
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  overdue: "Overdue",
  "due-soon": "Due soon",
  upcoming: "Upcoming",
  paid: "Paid",
};

const RECURRENCE_LABEL: Record<string, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
  "one-time": "One-time",
};

function fmtAmount(amount: number | null): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-36 bg-white border border-slate-100 rounded-xl shadow-lg py-1 text-sm">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pencil size={13} /> Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 ${accent ? "border-red-200" : "border-slate-100"}`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent ? "text-red-600" : "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const EMPTY_FORM = { name: "", amount: "", dueDate: "", recurrence: "monthly", categoryId: "", notes: "" };

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<FilterTab>("active");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [newCatName, setNewCatName] = useState("");

  useEffect(() => {
    fetchPayments();
    fetchCategories();
  }, []);

  async function fetchPayments() {
    const data = await apiFetch("/payments");
    setPayments(data);
  }

  async function fetchCategories() {
    const data = await apiFetch("/categories?type=payment");
    setCategories(data);
  }

  const filtered = payments.filter((p) => filter === "active" ? !p.is_paid : true);

  // Summary stats (computed client-side)
  const activePayments = payments.filter((p) => !p.is_paid);
  const monthlyEst = activePayments.reduce((sum, p) => {
    if (!p.amount) return sum;
    if (p.recurrence === "monthly") return sum + p.amount;
    if (p.recurrence === "yearly") return sum + p.amount / 12;
    return sum;
  }, 0);
  const overdueItems = activePayments.filter((p) => p.days_until_due < 0);
  const overdueTotal = overdueItems.reduce((s, p) => s + (p.amount ?? 0), 0);
  const dueSoonItems = activePayments.filter((p) => p.days_until_due >= 0 && p.days_until_due <= 7);
  const dueSoonTotal = dueSoonItems.reduce((s, p) => s + (p.amount ?? 0), 0);

  async function markPaid(id: number) {
    const updated = await apiFetch(`/payments/${id}/mark-paid`, { method: "POST" });
    setPayments((prev) => prev.map((p) => (p.id === id ? updated : p))
      .sort((a, b) => a.due_date.localeCompare(b.due_date)));
  }

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setShowAddModal(true);
  }

  function openEdit(payment: Payment) {
    setEditPayment(payment);
    setForm({
      name: payment.name,
      amount: payment.amount != null ? String(payment.amount) : "",
      dueDate: payment.due_date,
      recurrence: payment.recurrence ?? "monthly",
      categoryId: payment.category_id != null ? String(payment.category_id) : "",
      notes: payment.notes ?? "",
    });
  }

  function closeForm() {
    setShowAddModal(false);
    setEditPayment(null);
    setForm(EMPTY_FORM);
  }

  async function savePayment(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name,
      amount: form.amount ? parseFloat(form.amount) : null,
      due_date: form.dueDate,
      recurrence: form.recurrence || null,
      category_id: form.categoryId ? parseInt(form.categoryId) : null,
      notes: form.notes || null,
    };

    if (editPayment) {
      const updated = await apiFetch(`/payments/${editPayment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setPayments((prev) => prev.map((p) => (p.id === editPayment.id ? updated : p)));
    } else {
      const created = await apiFetch("/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setPayments((prev) => [...prev, created].sort((a, b) => a.due_date.localeCompare(b.due_date)));
    }
    closeForm();
  }

  async function confirmDelete() {
    if (deleteId === null) return;
    await apiFetch(`/payments/${deleteId}`, { method: "DELETE" });
    setPayments((prev) => prev.filter((p) => p.id !== deleteId));
    setDeleteId(null);
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const created = await apiFetch("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim(), type: "payment" }),
    });
    setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setNewCatName("");
  }

  async function deleteCategory(id: number) {
    await apiFetch(`/categories/${id}`, { method: "DELETE" });
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  const getCatName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? null;

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const formModal = showAddModal || editPayment !== null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="text-sm text-slate-400 mt-0.5">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
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
            Add Payment
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {payments.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Monthly recurring" value={fmtAmount(monthlyEst)} sub="estimated / mo" />
          <StatCard
            label="Overdue"
            value={overdueItems.length > 0 ? fmtAmount(overdueTotal) : "None"}
            sub={overdueItems.length > 0 ? `${overdueItems.length} item${overdueItems.length > 1 ? "s" : ""}` : undefined}
            accent={overdueItems.length > 0}
          />
          <StatCard
            label="Due this week"
            value={dueSoonItems.length > 0 ? fmtAmount(dueSoonTotal) : "All clear"}
            sub={dueSoonItems.length > 0 ? `${dueSoonItems.length} item${dueSoonItems.length > 1 ? "s" : ""}` : undefined}
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {(["active", "all"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              filter === tab
                ? "border-b-2 border-indigo-600 text-indigo-600 -mb-px"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-16 text-sm">
          {filter === "active" ? "No active payments. Add one to get started." : "No payments yet."}
        </p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Name", "Category", "Recurrence", "Amount", "Due Date", "Status", ""].map((h, i) => (
                    <th
                      key={i}
                      className={`text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 ${
                        h === "Amount" ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((payment) => {
                  const status = getStatus(payment);
                  const catName = getCatName(payment.category_id);
                  const isOverdue = status === "overdue";
                  const isPaid = status === "paid";

                  return (
                    <tr
                      key={payment.id}
                      className={`transition-colors ${
                        isOverdue ? "bg-red-50/40 hover:bg-red-50/70" : "hover:bg-slate-50/60"
                      }`}
                    >
                      {/* Name */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className={`text-sm font-medium truncate ${isPaid ? "text-slate-400" : "text-slate-800"}`}>
                          {payment.name}
                        </p>
                        {payment.notes && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{payment.notes}</p>
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

                      {/* Recurrence */}
                      <td className="px-4 py-3">
                        {payment.recurrence ? (
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                            {RECURRENCE_LABEL[payment.recurrence] ?? payment.recurrence}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-semibold ${isPaid ? "text-slate-400" : "text-slate-800"}`}>
                          {fmtAmount(payment.amount)}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-4 py-3">
                        <p className={`text-sm ${isOverdue ? "text-red-500 font-medium" : isPaid ? "text-slate-400" : "text-slate-600"}`}>
                          {fmtDate(payment.due_date)}
                        </p>
                        {!isPaid && payment.days_until_due !== 0 && (
                          <p className="text-xs mt-0.5">
                            {payment.days_until_due < 0 ? (
                              <span className="text-red-400">{Math.abs(payment.days_until_due)}d ago</span>
                            ) : (
                              <span className="text-slate-400">in {payment.days_until_due}d</span>
                            )}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[status]}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!isPaid && (
                            <button
                              onClick={() => markPaid(payment.id)}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors whitespace-nowrap"
                            >
                              <Check size={12} strokeWidth={2.5} />
                              Mark Paid
                            </button>
                          )}
                          <RowMenu
                            onEdit={() => openEdit(payment)}
                            onDelete={() => setDeleteId(payment.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Payment Modal */}
      {formModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {editPayment ? "Edit Payment" : "New Payment"}
            </h2>
            <form onSubmit={savePayment} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  required
                  placeholder="e.g. Netflix, Rent"
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
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setField("dueDate", e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Recurrence</label>
                  <select
                    value={form.recurrence}
                    onChange={(e) => setField("recurrence", e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="one-time">One-time</option>
                  </select>
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
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
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
                <button type="button" onClick={closeForm} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  {editPayment ? "Save changes" : "Save"}
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
              <h2 className="text-lg font-semibold text-slate-900">Payment Categories</h2>
              <button onClick={() => setShowCatModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-0.5 mb-4 max-h-56 overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No categories yet.</p>
              ) : (
                categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 group">
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
              <button type="submit" className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">
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
            <h2 className="text-base font-semibold text-slate-900 mb-1">Delete payment?</h2>
            <p className="text-sm text-slate-500 mb-5">This will permanently remove this payment.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Cancel
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
