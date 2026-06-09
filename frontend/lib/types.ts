export interface Task {
  id: number;
  name: string;
  description?: string;
  due_date?: string;
  completed: boolean;
  completed_at?: string;
  created_at: string;
  position?: number | null;
}

export interface Habit {
  id: number;
  name: string;
  target_freq?: number;
  archived: boolean;
  created_at: string;
  deleted_at?: string | null;
  category: string; // "morning" | "night" | "standard"
  position?: number | null;
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
  split_with: string | null; // comma-separated names, e.g. "April,Jess"
  service_period_start: string | null; // YYYY-MM-DD
  service_period_end: string | null;   // YYYY-MM-DD
}

export interface CreditCard {
  id: number;
  name: string;
  last_four: string | null;
  color: string | null;
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
  credit_card_id: number | null;
  notes: string | null;
  split_with: string | null; // comma-separated names
  price_history: PriceHistoryEntry[];
  cancellation_periods: CancellationPeriod[];
}

export interface Bank {
  id: number;
  name: string;
  account_type: string | null;
  starting_balance: number | null;
  starting_balance_as_of: string | null; // YYYY-MM-DD
}

export interface Person {
  id: number;
  name: string;
}

export interface MoneyTransfer {
  id: number;
  name: string | null;
  date: string; // YYYY-MM-DD
  direction: string; // 'sent' | 'received'
  person: string;
  platform: string | null;
  bank_id: number | null;
  from_bank_id: number | null;
  to_bank_id: number | null;
  category_id: number | null;
  credit_card_id: number | null;
  amount: number;
  notes: string | null;
  split_with: string | null;
  created_at: string;
}

export interface UtilityBillPriceHistoryEntry {
  id: number;
  utility_bill_id: number;
  amount: number;
  effective_from: string; // YYYY-MM-DD
}

export interface UtilityBill {
  id: number;
  utility: string;
  is_recurring: boolean;
  service_period_start: string | null;
  service_period_end: string | null;
  charge_date: string | null;
  charge_day: number | null;
  billing_start: string | null; // YYYY-MM-DD (first of month)
  amount: number;
  split_with: string | null;
  notes: string | null;
  price_history: UtilityBillPriceHistoryEntry[];
  created_at: string;
}

export interface UtilityReimbursement {
  id: number;
  person: string;
  amount: number;
  date: string; // YYYY-MM-DD
  notes: string | null;
  created_at: string;
}

export interface Loan {
  id: number;
  name: string;
  disbursement_date: string; // YYYY-MM-DD
  original_principal: number;
  unpaid_principal: number;
  interest_rate: number; // stored as percentage, e.g. 4.5 = 4.5%
  unpaid_interest: number;
  total_interest_paid: number;
  notes: string | null;
  created_at: string;
}

export interface CreditCardReminder {
  id: number;
  card_name: string;
  owner: string | null;
  due_day: number;
  days_before: number | null;
  created_at: string;
  position?: number | null;
}

export interface ReminderOwner {
  id: number;
  name: string;
  created_at: string;
}

export interface StockLot {
  id: number;
  stock_holding_id: number;
  shares: number;
  buy_price: number;
  purchased_at: string | null;
  sold_price: number | null;
  sold_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface StockDividend {
  id: number;
  stock_holding_id: number;
  paid_at: string;
  dividend_per_share: number;
  shares_held: number;
  total_received: number;
  reinvested: boolean;
  notes: string | null;
  created_at: string;
}

export interface StockHolding {
  id: number;
  ticker: string;
  company_name: string | null;
  shares: number;
  buy_price: number;
  current_price: number;
  realized_gain: number;
  total_dividends: number;
  notes: string | null;
  created_at: string;
  lots: StockLot[];
  dividends: StockDividend[];
}

export interface Company {
  id: number;
  name: string;
  created_at: string;
}

export interface WorkLogEntry {
  id: number;
  company_id: number;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  category: string;
  description: string | null;
  created_at: string;
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
