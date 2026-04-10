import { 
  CheckCircle2, 
  Activity, 
  CreditCard, 
  AlertCircle, 
  Flame,
  ArrowRight
} from "lucide-react";
// Note: You can also move these fetch calls into your frontend/lib/api.ts file 
// to keep this file cleaner as your app grows!

export default async function HomePage() {
  // 1. Define fallback arrays to hold our data
  let tasks = [];
  let habits = [];
  let payments = [];

  // 2. Fetch the data from your Python backend
  // We use a try/catch block so the page doesn't completely crash if the backend is turned off.
  try {
    // Replace 'http://localhost:8000' with your actual backend URL if it's different.
    // Promise.all allows us to fetch all three at the exact same time to speed up loading.
    const [tasksRes, habitsRes, paymentsRes] = await Promise.all([
      fetch('http://localhost:8000/tasks', { cache: 'no-store' }),
      fetch('http://localhost:8000/habits', { cache: 'no-store' }),
      fetch('http://localhost:8000/payments', { cache: 'no-store' })
    ]);

    // If the request was successful, convert the JSON string into a JavaScript object/array
    if (tasksRes.ok) tasks = await tasksRes.json();
    if (habitsRes.ok) habits = await habitsRes.json();
    if (paymentsRes.ok) payments = await paymentsRes.json();
  } catch (error) {
    console.error("Failed to fetch dashboard data from the backend:", error);
  }

  // Calculate some quick stats based on the fetched data
  const pendingTasksCount = tasks.filter((t: any) => !t.is_completed).length;
  const activeHabitsCount = habits.length; 
  // You would ideally sum up payment amounts here based on your data structure
  const totalPayments = payments.length > 0 ? "$..." : "$0.00"; 

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back. Here is your overview for today.</p>
        </div>
        <div className="text-sm font-medium text-slate-600 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Pending Tasks"
          value={pendingTasksCount.toString()}
          subtitle="Keep it up!"
          icon={<CheckCircle2 size={24} className="text-emerald-600" />}
          bgAccent="bg-emerald-100"
          borderColor="border-emerald-200"
        />
        <StatCard
          title="Active Habits"
          value={activeHabitsCount.toString()}
          subtitle="Consistency is key"
          icon={<Activity size={24} className="text-indigo-600" />}
          bgAccent="bg-indigo-100"
          borderColor="border-indigo-200"
        />
        <StatCard
          title="Upcoming Payments"
          value={totalPayments}
          subtitle="Due in next 7 days"
          icon={<CreditCard size={24} className="text-amber-600" />}
          bgAccent="bg-amber-100"
          borderColor="border-amber-200"
        />
      </div>

      {/* Main Dashboard Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Widget 1: Tasks */}
        <DashboardWidget 
          title="Tasks" 
          actionLabel="View all" 
          icon={<CheckCircle2 size={18} className="text-emerald-500" />}
        >
          <ul className="divide-y divide-slate-100">
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No tasks found.</p>
            ) : (
              // 3. Map over the real array of tasks and render a component for each one
              tasks.slice(0, 5).map((task: any) => (
                <TaskItem 
                  key={task.id} 
                  title={task.title} 
                  category={task.category || "General"} 
                  isUrgent={task.is_urgent} 
                />
              ))
            )}
          </ul>
        </DashboardWidget>

        {/* Widget 2: Habit Streaks */}
        <DashboardWidget 
          title="Habit Streaks" 
          actionLabel="Manage"
          icon={<Flame size={18} className="text-indigo-500" />}
        >
           <ul className="space-y-5 mt-2">
            {habits.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No active habits.</p>
              ) : (
                habits.slice(0, 3).map((habit: any) => (
                  <HabitItem 
                    key={habit.id}
                    title={habit.name} 
                    streak={habit.current_streak || 0} 
                    color="bg-indigo-500" 
                    progress="w-[50%]" // You'd calculate this based on your habit logic
                  />
                ))
            )}
           </ul>
        </DashboardWidget>

        {/* Widget 3: Payment Reminders */}
        <DashboardWidget 
          title="Payment Reminders" 
          actionLabel="Add new"
          icon={<AlertCircle size={18} className="text-amber-500" />}
        >
          <ul className="divide-y divide-slate-100">
             {payments.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No upcoming payments.</p>
              ) : (
                payments.slice(0, 4).map((payment: any) => (
                  <PaymentItem 
                    key={payment.id}
                    title={payment.description} 
                    amount={`$${payment.amount}`} 
                    due={payment.due_date} 
                    isAlert={false} 
                  />
                ))
             )}
          </ul>
        </DashboardWidget>

      </div>
    </div>
  );
}

// --- Reusable UI Components ---

function StatCard({ title, value, subtitle, icon, bgAccent, borderColor }: { 
  title: string, value: string, subtitle: string, icon: React.ReactNode, bgAccent: string, borderColor: string 
}) {
  return (
    <div className={`bg-white p-6 rounded-2xl border ${borderColor} shadow-sm flex flex-col relative overflow-hidden group`}>
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${bgAccent} opacity-50 group-hover:scale-110 transition-transform duration-500 blur-2xl`}></div>
      <div className="flex items-center justify-between mb-4 relative z-10">
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`${bgAccent} p-2 rounded-xl`}>{icon}</div>
      </div>
      <div className="mt-auto relative z-10">
        <span className="text-3xl font-extrabold text-slate-900">{value}</span>
        <p className="text-sm font-medium text-slate-500 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

function DashboardWidget({ title, actionLabel, icon, children }: { 
  title: string, actionLabel: string, icon: React.ReactNode, children: React.ReactNode 
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
        </div>
        <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
          {actionLabel}
          <ArrowRight size={12} />
        </button>
      </div>
      <div className="p-5 flex-1">
        {children}
      </div>
    </div>
  );
}

function TaskItem({ title, category, isUrgent }: { title: string, category: string, isUrgent: boolean }) {
  return (
    <li className="py-3 flex items-start gap-3 first:pt-0 last:pb-0 group cursor-pointer">
      <button className="mt-0.5 flex-shrink-0 text-slate-300 group-hover:text-emerald-500 transition-colors">
        <CheckCircle2 size={18} />
      </button>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-800 group-hover:text-slate-900 transition-colors">{title}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{category}</span>
          {isUrgent && (
             <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-sm">Urgent</span>
          )}
        </div>
      </div>
    </li>
  );
}

function HabitItem({ title, streak, color, progress }: { title: string, streak: number, color: string, progress: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-slate-800">{title}</span>
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
          <Flame size={12} className={streak > 5 ? "text-orange-500" : "text-slate-400"} />
          {streak} days
        </span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} ${progress} rounded-full`}></div>
      </div>
    </div>
  );
}

function PaymentItem({ title, amount, due, isAlert }: { title: string, amount: string, due: string, isAlert: boolean }) {
  return (
    <li className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${isAlert ? 'bg-rose-500' : 'bg-slate-300'}`}></div>
        <div>
          <p className="text-sm font-medium text-slate-800">{title}</p>
          <p className={`text-xs mt-0.5 font-medium ${isAlert ? 'text-rose-500' : 'text-slate-500'}`}>{due}</p>
        </div>
      </div>
      <span className="text-sm font-bold text-slate-900">{amount}</span>
    </li>
  );
}