"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Calendar } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";

type FilterTab = "all" | "active" | "completed";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
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

  function isOverdue(dueDate: string) {
    return new Date(dueDate) < new Date(new Date().toDateString());
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

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["all", "active", "completed"] as FilterTab[]).map((tab) => (
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

      {/* Task list */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <p className="text-center text-slate-400 py-16 text-sm">
            No tasks yet. Add one to get started.
          </p>
        ) : (
          filtered.map((task) => (
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
                    task.completed
                      ? "line-through text-slate-400"
                      : "text-slate-900"
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Due Date
                </label>
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
