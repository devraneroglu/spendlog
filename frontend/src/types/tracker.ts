export enum TrackerType {
  Counter = 1,
  Note = 2,
  Custom = 3,
}

export interface TrackerItem {
  id: number;
  trackerId: number;
  orderIndex: number;
  jsonData: string;
  createdAt: string;
}

export interface Tracker {
  id: number;
  type: TrackerType;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  targetAmount?: number | null;
  currentAmount?: number | null;
  dueDate?: string | null;
  isCompleted: boolean;
  schemaDefinition?: string | null;
  items: TrackerItem[];
}
