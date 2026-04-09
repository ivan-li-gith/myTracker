"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";

type FilterTab = "active" | "completed" | "all";

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatGroupLabel(dateKey: string): string {
  if (dateKey === "no-date") return "No Due Date";

  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todayStr = toLocalDateStr(today);
  const tomorrowStr = toLocalDateStr(tomorrow);

  if (dateKey === todayStr) return "Today";
  if (dateKey === tomorrowStr) return "Tomorrow";

  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function isOverdue(dateKey: string): boolean {
  const today = toLocalDateStr(new Date());
  return dateKey < today;
}

function groupTasks(tasks: Task[]): { key: string; label: string; tasks: Task[] }[] {
  const map = new Map<string, Task[]>();

  for (const task of tasks) {
    const key = task.due_date ?? "no-date";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(task);
  }

  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === "no-date") return 1;
      if (b === "no-date") return -1;
      return a.localeCompare(b);
    })
    .map(([key, tasks]) => ({ key, label: formatGroupLabel(key), tasks }));
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<FilterTab>("active");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    const data = await apiFetch("/tasks");
    setTasks(data);
  }

  const filtered = tasks.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  const groups = groupTasks(filtered);

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function toggleComplete(task: Task) {
    await apiFetch(`/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
    fetchTasks();
  }

  async function deleteTask(id: number) {
    await apiFetch(`/tasks/${id}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || undefined,
        due_date: dueDate || undefined,
      }),
    });
    setShowModal(false);
    setName("");
    setDescription("");
    setDueDate("");
    fetchTasks();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Add Task
        </button>
      </div>

      {/* Filter tabs — Active first, All at end */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["active", "completed", "all"] as FilterTab[]).map((tab) => (
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

      {/* Grouped task list */}
      <div className="flex flex-col gap-3">
        {groups.length === 0 ? (
          <p className="text-center text-slate-400 py-16 text-sm">
            No tasks here. Add one to get started.
          </p>
        ) : (
          groups.map(({ key, label, tasks: groupTasks }) => (
            <div key={key}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(key)}
                className="flex items-center gap-2 w-full text-left mb-1.5 group"
              >
                <span className="text-slate-400 transition-transform">
                  {collapsed.has(key) ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                </span>
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    key !== "no-date" && isOverdue(key) && filter !== "completed"
                      ? "text-red-500"
                      : "text-slate-500"
                  }`}
                >
                  {label}
                </span>
                <span className="text-xs text-slate-400">({groupTasks.length})</span>
              </button>

              {/* Group rows */}
              {!collapsed.has(key) && (
                <div className="flex flex-col gap-2 pl-4">
                  {groupTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 bg-white border border-slate-100 rounded-lg px-4 py-3 shadow-sm group"
                    >
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleComplete(task)}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm ${
                            task.completed ? "line-through text-slate-400" : "text-slate-900"
                          }`}
                        >
                          {task.name}
                        </span>
                        {task.due_date && (
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                              isOverdue(task.due_date) && !task.completed
                                ? "bg-red-50 text-red-500"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <Calendar size={10} />
                            {task.due_date}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                        aria-label="Delete task"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Task modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">New Task</h2>
            <form onSubmit={createTask} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Task name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
