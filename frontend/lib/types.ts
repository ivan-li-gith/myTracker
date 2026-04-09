export interface Task {
  id: number;
  name: string;
  description?: string;
  due_date?: string;
  completed: boolean;
  completed_at?: string;
  created_at: string;
}

export interface Habit {
  id: number;
  name: string;
  target_freq?: number;
  archived: boolean;
  created_at: string;
}

export interface HabitWithStreak extends Habit {
  streak: number;
  logged_dates: string[]; // YYYY-MM-DD strings
}

export interface HabitLog {
  id: number;
  habit_id: number;
  logged_at: string;
}

export interface Doc {
  id: number;
  title: string;
  category: string | null;
  content: string | null;
  is_favorite: boolean;
  created_at: string;
}

export interface Recipe {
  id: number;
  title: string;
  source_url: string | null;
  ingredients: string | null;
  steps: string | null;
  cook_time: string | null;
  category: string | null;
  is_favorite: boolean;
  created_at: string;
}

export interface JobApplication {
  id: number;
  company: string;
  role: string;
  url: string | null;
  status: string | null; // 'applied' | 'phone_screen' | 'interview' | 'offer' | 'rejected'
  date_applied: string | null; // YYYY-MM-DD
  salary_range: string | null;
  location: string | null;
  job_type: string | null; // 'remote' | 'hybrid' | 'onsite'
  notes: string | null;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  type: string | null;
}

export interface Expense {
  id: number;
  name: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category_id: number | null;
  notes: string | null;
}

export interface ExpenseSummary {
  month: string;
  total: number;
  count: number;
  by_category: { category_id: number | null; total: number }[];
}

export interface ExpenseSplit {
  id: number;
  title: string | null;
  total: number | null;
  participants: { name: string; owes: number }[] | null;
  created_at: string;
}

export interface Payment {
  id: number;
  name: string;
  amount: number | null;
  due_date: string; // YYYY-MM-DD
  recurrence: string | null; // 'monthly' | 'yearly' | 'one-time'
  category_id: number | null;
  is_paid: boolean;
  notes: string | null;
  days_until_due: number;
}
