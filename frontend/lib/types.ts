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
  salary_type: string | null; // 'hourly' | 'weekly' | 'monthly' | 'yearly'
  notes: string | null;
  resume_id: number | null;
  cover_letter_id: number | null;
  created_at: string;
}

export interface Resume {
  id: number;
  name: string;
  file_type: string; // 'resume' | 'cover_letter'
  filename: string;
  content_type: string;
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
  credit_card_id: number | null;
  notes: string | null;
}

export interface CreditCard {
  id: number;
  name: string;
  last_four: string | null;
  color: string | null;
  billing_start_day: number | null;
  billing_end_day: number | null;
  due_date_day: number | null;
  category_id: number | null;
}

export interface CardStatement {
  statement_id: number | null;
  credit_card_id: number;
  month: string; // YYYY-MM
  billing_start: string; // YYYY-MM-DD
  billing_end: string;   // YYYY-MM-DD
  due_date: string;      // YYYY-MM-DD
  amount: number;
  is_paid: boolean;
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

export interface PriceHistoryEntry {
  id: number;
  recurring_charge_id: number;
  amount: number;
  effective_from: string; // YYYY-MM-DD, always the 1st of a month
}

export interface CancellationPeriod {
  id: number;
  recurring_charge_id: number;
  canceled_from: string;       // YYYY-MM-DD, always 1st of month
  reactivated_from: string | null; // YYYY-MM-DD, or null if still canceled
}

export interface RecurringCharge {
  id: number;
  name: string;
  amount: number;
  charge_date: number; // 1-31, day of month
  category_id: number | null;
  notes: string | null;
  price_history: PriceHistoryEntry[];
  cancellation_periods: CancellationPeriod[];
}

export interface Payment {
  id: number;
  name: string;
  amount: number | null;
  due_date: string; // YYYY-MM-DD
  recurrence: string | null; // 'monthly' | 'yearly' | 'one-time'
  category_id: number | null;
  credit_card_id: number | null;
  billing_start_date: string | null; // YYYY-MM-DD
  billing_end_date: string | null;   // YYYY-MM-DD
  is_paid: boolean;
  notes: string | null;
  days_until_due: number;
}
