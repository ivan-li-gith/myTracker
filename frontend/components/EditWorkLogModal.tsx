"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { WorkLogEntry, Category } from "@/lib/types";

interface Props {
  entry: WorkLogEntry;
  categories: Category[];
  onAddCategory: (name: string) => Promise<Category>;
  onDeleteCategory: (id: number) => void;
  onSaved: (entry: WorkLogEntry) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
}

const inputCls = "w-full px-3 py-2 bg-[#14162e] border border-white/[0.1] rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors text-sm";

export default function EditWorkLogModal({ entry, categories, onAddCategory, onDeleteCategory, onSaved, onDeleted, onClose }: Props) {
  const [startTime, setStartTime] = useState(entry.start_time);
  const [endTime, setEndTime] = useState(entry.end_time);
  const [category, setCategory] = useState(entry.category);
  const [bullets, setBullets] = useState<string[]>(() => {
    const desc = entry.description ?? "";
    if (!desc) return [""];
    return desc.split("\n").map((l) => (l.startsWith("• ") ? l.slice(2) : l));
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const bulletRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleBulletChange(i: number, val: string) {
    setBullets((prev) => prev.map((b, idx) => (idx === i ? val : b)));
  }

  function handleBulletKeyDown(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      setBullets((prev) => [...prev.slice(0, i + 1), "", ...prev.slice(i + 1)]);
      setTimeout(() => bulletRefs.current[i + 1]?.focus(), 0);
    }
    if (e.key === "Backspace" && bullets[i] === "" && bullets.length > 1) {
      e.preventDefault();
      setBullets((prev) => prev.filter((_, idx) => idx !== i));
      setTimeout(() => bulletRefs.current[Math.max(0, i - 1)]?.focus(), 0);
    }
  }

  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);

  async function handleAddCategory() {
    const name = newCategoryInput.trim();
    if (!name) return;
    setCategoryError(null);
    try {
      const created = await onAddCategory(name);
      setCategory(created.name);
      setNewCategoryInput("");
      setAddingCategory(false);
    } catch {
      setCategoryError("Category already exists or could not be saved.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const filled = bullets.filter((b) => b.trim());
      const description = filled.length > 0
        ? filled.map((b) => `• ${b.trim()}`).join("\n")
        : null;
      const updated = await apiFetch(`/work-log/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: startTime,
          end_time: endTime,
          category,
          description,
        }),
      });
      onSaved(updated);
    } catch (error) {
      console.error("Error updating entry:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await apiFetch(`/work-log/${entry.id}`, { method: "DELETE" });
      onDeleted(entry.id);
    } catch (error) {
      console.error("Error deleting entry:", error);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1e2245] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-base font-bold text-white">Edit Entry</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors disabled:opacity-40"
              aria-label="Delete entry"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-200 hover:bg-white/[0.07] p-1.5 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Start Time</label>
              <input
                type="time"
                required
                autoFocus
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-400">Category</label>
              {!addingCategory && (
                <button
                  type="button"
                  onClick={() => setAddingCategory(true)}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  <Plus size={11} /> New
                </button>
              )}
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputCls}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            {addingCategory && (
              <div className="mt-2 bg-[#14162e] border border-white/[0.08] rounded-lg p-2 flex flex-col gap-1">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-2 py-1 rounded hover:bg-white/[0.05] group">
                    <span className="text-sm text-slate-300">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => onDeleteCategory(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-1 mt-1">
                  <input
                    autoFocus
                    className="flex-1 bg-[#1e2245] border border-white/[0.1] rounded-md px-2 py-1 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder="Category name"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); }
                      if (e.key === "Escape") { setAddingCategory(false); setNewCategoryInput(""); }
                    }}
                  />
                  <button type="button" onClick={handleAddCategory} className="px-2.5 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-500 transition-colors">Add</button>
                  <button type="button" onClick={() => { setAddingCategory(false); setNewCategoryInput(""); setCategoryError(null); }} className="p-1 text-slate-500 hover:text-slate-300 transition-colors"><X size={13} /></button>
                </div>
                {categoryError && <p className="text-xs text-red-400 px-2">{categoryError}</p>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">What did you work on?</label>
            <div className="w-full bg-[#14162e] border border-white/[0.1] rounded-lg focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/50 transition-colors px-3 py-2 space-y-1.5">
              {bullets.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm select-none">•</span>
                  <input
                    ref={(el) => { bulletRefs.current[i] = el; }}
                    type="text"
                    value={b}
                    onChange={(e) => handleBulletChange(i, e.target.value)}
                    onKeyDown={(e) => handleBulletKeyDown(e, i)}
                    placeholder={i === 0 ? "What did you work on?" : ""}
                    className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-1 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white/[0.06] border border-white/[0.08] text-slate-300 rounded-lg hover:bg-white/[0.09] transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
