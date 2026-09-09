export interface GoalLog {
  id: number;
  date: string;
  completed: boolean;
  note?: string;
}

export interface Goal {
  id: number;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  displayOrder: number;
  totalCompletions: number;
  currentStreak: number;
  recentLogs: GoalLog[];
}
