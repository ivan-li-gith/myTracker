"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2, Circle, MoreHorizontal, SlidersHorizontal,
  Flame, Calendar, Trash2,
} from "lucide-react";
import AddTaskModal from "@/components/AddTaskModal";
import AddHabitModal from "@/components/AddHabitModal";
import { apiFetch } from "@/lib/api";
import { Task, HabitWithStreak } from "@/lib/types";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---- Habit Card ----

function HabitCard({
  habit,
  onLog,
  onDelete,
}: {
  habit: HabitWithStreak;
  onLog: () => void;
  onDelete: () => void;
}) {
  const today = todayStr();
  const loggedToday = habit.logged_dates?.includes(today);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className={`bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between group transition-colors ${
      loggedToday ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 hover:border-indigo-300"
    }`}>
      <div className="flex items-start justify-between mb-4">
        <span className={`font-medium line-clamp-2 transition-colors ${
          loggedToday ? "text-emerald-700" : "text-slate-800 group-hover:text-indigo-700"
        }`}>
          {habit.name}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
            habit.streak > 0 ? "bg-orange-50 text-orange-600" : "bg-slate-50 text-slate-400"
          }`}>
            <Flame size={14} className={habit.streak > 0 ? "text-orange-500" : "text-slate-300"} />
            <span className="text-xs font-bold">{habit.streak ?? 0}</span>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-slate-600 rounded-md transition-all"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-10 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-32 text-sm">
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={onLog}
        disabled={loggedToday}
        className={`w-full py-2 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-2 ${
          loggedToday
            ? "bg-emerald-50 text-emerald-600 border-emerald-100 cursor-default"
            : "bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 border-slate-100 hover:border-emerald-100"
        }`}
      >
        <CheckCircle2 size={16} />
        {loggedToday ? "Done today!" : "Complete"}
      </button>
    </div>
  );
}

// ---- Task List Item ----

function TaskListItem({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
      <div className="flex items-start gap-4 flex-1">
        <button
          onClick={onToggle}
          className={`flex-shrink-0 mt-0.5 transition-colors ${
            task.completed ? "text-emerald-500" : "text-slate-300 hover:text-emerald-500"
          }`}
        >
          {task.completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
        </button>
        <div className="flex-1">
          <p className={`text-sm font-medium transition-colors ${
            task.completed ? "text-slate-400 line-through" : "text-slate-800 group-hover:text-slate-900"
          }`}>
            {task.name}
          </p>
          {!task.completed && task.due_date && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm">
              <Calendar size={10} />
              {task.due_date}
            </span>
          )}
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pl-4">
        <button
          onClick={onDelete}
          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
          aria-label="Delete task"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
}

// ---- Page ----

export default function TasksAndHabitsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);

  useEffect(() => {
    apiFetch("/tasks").then(setTasks).catch(console.error);
    apiFetch("/habits").then(setHabits).catch(console.error);
  }, []);

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  async function toggleTask(task: Task) {
    const updated = await apiFetch(`/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  }

  async function deleteTask(id: number) {
    await apiFetch(`/tasks/${id}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function logHabit(habit: HabitWithStreak) {
    const updated = await apiFetch(`/habits/${habit.id}/log`, { method: "POST" });
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? updated : h)));
  }

  async function deleteHabit(id: number) {
    await apiFetch(`/habits/${id}`, { method: "DELETE" });
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-[calc(100vh-2rem)] relative pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Habits & Tasks</h1>
          <p className="text-slate-500 mt-1">Focus on what needs to be done today.</p>
        </div>
        <button className="self-start p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 shadow-sm transition-colors" aria-label="Filter">
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {/* Habits Section */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Daily Habits</h2>
            <span className="bg-orange-100 text-orange-700 py-0.5 px-2 rounded-full text-xs font-bold">
              {habits.length} Active
            </span>
          </div>
          <AddHabitModal onCreated={(h) => setHabits((prev) => [h, ...prev])} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {habits.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl border border-slate-200 border-dashed p-6 text-center">
              <p className="text-sm text-slate-500 font-medium">No active habits tracked.</p>
            </div>
          ) : (
            habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onLog={() => logHabit(habit)}
                onDelete={() => deleteHabit(habit.id)}
              />
            ))
          )}
        </div>
      </section>

      {/* Tasks */}
      <div className="space-y-10">
        {/* Pending */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Pending Tasks</h2>
              <span className="bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded-full text-xs font-bold">
                {pendingTasks.length}
              </span>
            </div>
            <AddTaskModal onCreated={(t) => setTasks((prev) => [t, ...prev])} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {pendingTasks.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                  <CheckCircle2 size={24} className="text-slate-300" />
                </div>
                <p className="text-slate-500 text-sm font-medium">You are all caught up!</p>
                <p className="text-slate-400 text-xs mt-1">Enjoy your free time.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingTasks.map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    onToggle={() => toggleTask(task)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Completed */}
        {completedTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Completed</h2>
              <span className="bg-slate-100 text-slate-500 py-0.5 px-2 rounded-full text-xs font-bold">
                {completedTasks.length}
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden opacity-80">
              <ul className="divide-y divide-slate-200/60">
                {completedTasks.map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    onToggle={() => toggleTask(task)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
