"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { WorkLogEntry, Category } from "@/lib/types";
import AddWorkLogModal from "@/components/AddWorkLogModal";
import EditWorkLogModal from "@/components/EditWorkLogModal";

function dateToStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = dateToStr(new Date());
  const yesterday = dateToStr(new Date(Date.now() - 86_400_000));
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatDuration(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function WorkLogPage() {
  const [currentDate, setCurrentDate] = useState(dateToStr(new Date()));
  const [entries, setEntries] = useState<WorkLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkLogEntry | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    apiFetch("/categories?type=work_log")
      .then((data) => setCategories(data ?? []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/work-log?date=${currentDate}`)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentDate]);

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

  function stepDate(direction: -1 | 1) {
    const d = new Date(currentDate + "T00:00:00");
    d.setDate(d.getDate() + direction);
    setCurrentDate(dateToStr(d));
  }

  const isToday = currentDate === dateToStr(new Date());

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Work Log</h1>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between mb-6 bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] px-5 py-4">
        <button
          onClick={() => stepDate(-1)}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-base font-semibold text-slate-900">{formatDisplayDate(currentDate)}</p>
          {currentDate !== dateToStr(new Date()) && (
            <p className="text-xs text-slate-400 mt-0.5">{currentDate}</p>
          )}
        </div>
        <button
          onClick={() => stepDate(1)}
          disabled={isToday}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next day"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Entries list */}
      <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">Entries</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={15} />
            Add Entry
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-400">Loading...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Clock size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No entries for this day.</p>
            <p className="text-xs text-slate-300 mt-1">Click &quot;Add Entry&quot; to log your first block.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const duration = formatDuration(entry.start_time, entry.end_time);
              return (
                <li
                  key={entry.id}
                  onClick={() => setEditingEntry(entry)}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="shrink-0 pt-0.5 text-right w-24">
                    <p className="text-sm font-semibold text-slate-700 tabular-nums">
                      {entry.start_time} – {entry.end_time}
                    </p>
                    {duration && (
                      <p className="text-xs text-slate-400 mt-0.5">{duration}</p>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5 bg-indigo-100 text-indigo-700">
                      {entry.category}
                    </span>
                    {entry.description && (
                      <p className="text-sm text-slate-700 leading-relaxed">{entry.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showAddModal && (
        <AddWorkLogModal
          date={currentDate}
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
