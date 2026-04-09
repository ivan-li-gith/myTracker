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
