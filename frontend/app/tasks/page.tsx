import { 
  CheckCircle2, 
  Circle, 
  MoreHorizontal,
  SlidersHorizontal,
  Flame,
  Calendar
} from "lucide-react";
import AddTaskModal from "@/components/AddTaskModal";
import AddHabitModal from "@/components/AddHabitModal";

export default async function TasksAndHabitsPage() {
  let tasks = [];
  let habits = [];
  
  try {
    const [tasksRes, habitsRes] = await Promise.all([
      fetch('http://localhost:8000/tasks', { cache: 'no-store' }),
      fetch('http://localhost:8000/habits', { cache: 'no-store' })
    ]);

    if (tasksRes.ok) tasks = await tasksRes.json();
    if (habitsRes.ok) habits = await habitsRes.json();
  } catch (error) {
    console.error("Failed to fetch data:", error);
  }

  // CORRECTED: filter by `task.completed` based on your backend schema
  const pendingTasks = tasks.filter((task: any) => !task.completed);
  const completedTasks = tasks.filter((task: any) => task.completed);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-[calc(100vh-2rem)] relative animate-in fade-in duration-500 pb-12">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Habits & Tasks</h1>
          <p className="text-slate-500 mt-1">Focus on what needs to be done today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 shadow-sm transition-colors" aria-label="Filter tasks">
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* Habits Section (Top) */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Daily Habits</h2>
            <span className="bg-orange-100 text-orange-700 py-0.5 px-2 rounded-full text-xs font-bold">
              {habits.length} Active
            </span>
          </div>
          <AddHabitModal />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {habits.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl border border-slate-200 border-dashed p-6 text-center">
              <p className="text-sm text-slate-500 font-medium">No active habits tracked.</p>
            </div>
          ) : (
            habits.map((habit: any) => (
              <HabitCard key={habit.id} habit={habit} />
            ))
          )}
        </div>
      </section>

      {/* Tasks Section (Bottom) */}
      <div className="space-y-10">
        
        {/* Pending Tasks */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Pending Tasks</h2>
              <span className="bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded-full text-xs font-bold">
                {pendingTasks.length}
              </span>
            </div>
            <AddTaskModal />
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
                {pendingTasks.map((task: any) => (
                  <TaskListItem 
                    key={task.id} 
                    title={task.name} // CORRECTED: backend uses task.name
                    dueDate={task.due_date} 
                    isCompleted={task.completed} // CORRECTED: backend uses task.completed
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Completed Tasks */}
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
                {completedTasks.map((task: any) => (
                  <TaskListItem 
                    key={task.id} 
                    title={task.name} // CORRECTED
                    dueDate={task.due_date} 
                    isCompleted={task.completed} // CORRECTED
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

// --- Reusable Components ---

function HabitCard({ habit }: { habit: any }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-indigo-300 transition-colors cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <span className="font-medium text-slate-800 group-hover:text-indigo-700 transition-colors line-clamp-2">
          {habit.name}
        </span>
        <div className="flex items-center gap-1.5 bg-orange-50 text-orange-600 px-2 py-1 rounded-md shrink-0">
          {/* CORRECTED: backend uses habit.streak */}
          <Flame size={14} className={habit.streak > 0 ? "text-orange-500" : "text-orange-300"} />
          <span className="text-xs font-bold">{habit.streak || 0}</span>
        </div>
      </div>
      
      <button className="w-full py-2 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 rounded-lg text-sm font-medium transition-colors border border-slate-100 group-hover:border-emerald-100 flex items-center justify-center gap-2">
        <CheckCircle2 size={16} />
        Complete
      </button>
    </div>
  );
}

function TaskListItem({ title, dueDate, isCompleted }: { 
  title: string, dueDate: string, isCompleted: boolean 
}) {
  return (
    <li className={`group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer ${isCompleted ? 'bg-transparent' : 'bg-white'}`}>
      <div className="flex items-start gap-4 flex-1">
        <button className={`flex-shrink-0 mt-0.5 transition-colors ${isCompleted ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-500'}`}>
          {isCompleted ? <CheckCircle2 size={22} /> : <Circle size={22} />}
        </button>
        <div className="flex-1">
          <p className={`text-sm font-medium transition-colors ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-800 group-hover:text-slate-900'}`}>
            {title}
          </p>
          {!isCompleted && dueDate && (
            <div className="flex items-center gap-3 mt-1.5">
               <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm">
                  <Calendar size={10} />
                  {dueDate}
                </span>
            </div>
          )}
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 pl-4">
        <button className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200 transition-colors focus:opacity-100" aria-label="Task options">
          <MoreHorizontal size={18} />
        </button>
      </div>
    </li>
  );
}