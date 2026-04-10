import { 
  CreditCard, 
  Receipt, 
  Calendar, 
  Repeat,
  MoreHorizontal,
  CheckCircle2,
  Circle
} from "lucide-react";
import BillSplitterModal from "@/components/BillSplitterModal";

export default async function PaymentsAndExpensesPage() {
  let payments = [];
  let expenses = [];
  
  try {
    const [paymentsRes, expensesRes] = await Promise.all([
      fetch('http://localhost:8000/payments', { cache: 'no-store' }),
      fetch('http://localhost:8000/expenses', { cache: 'no-store' })
    ]);

    if (paymentsRes.ok) payments = await paymentsRes.json();
    if (expensesRes.ok) expenses = await expensesRes.json();
  } catch (error) {
    console.error("Failed to fetch data:", error);
  }

  // Filter payments to only show pending ones, prioritizing recurring ones
  const pendingPayments = payments.filter((p: any) => !p.is_paid);
  
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-[calc(100vh-2rem)] relative animate-in fade-in duration-500 pb-12">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Finances</h1>
          <p className="text-slate-500 mt-1">Track your upcoming bills and recent spending.</p>
        </div>
      </div>

      {/* Recurring & Upcoming Payments Section (Top) */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <CreditCard size={16} className="text-amber-500" />
            Upcoming Payments
          </h2>
          <span className="bg-amber-100 text-amber-700 py-0.5 px-2 rounded-full text-xs font-bold">
            {pendingPayments.length} Pending
          </span>
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
              {pendingPayments.map((payment: any) => (
                <li key={payment.id} className="group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4 flex-1">
                    <button className="flex-shrink-0 text-slate-300 hover:text-emerald-500 transition-colors">
                      <Circle size={22} />
                    </button>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{payment.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm">
                          <Calendar size={10} />
                          Due {payment.due_date}
                        </span>
                        {payment.recurrence && (
                          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm">
                            <Repeat size={10} />
                            {payment.recurrence}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-slate-900">${payment.amount}</span>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md">
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Expenses Section (Bottom) */}
      <section>
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Receipt size={16} className="text-indigo-500" />
              Recent Expenses
            </h2>
          </div>
          
          {/* Bill Splitter Button Injected Here */}
          <BillSplitterModal />
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {expenses.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center">
              <p className="text-slate-500 text-sm font-medium">No recent expenses logged.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {expenses.map((expense: any) => (
                <li key={expense.id} className="group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{expense.name}</p>
                    <span className="flex items-center gap-1 mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {expense.date}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-slate-600">${expense.amount}</span>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md">
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

    </div>
  );
}