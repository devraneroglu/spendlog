export type TelegramSendType = 'Text' | 'Image' | 'Pdf' | 'ChartAndPdf';
export type TelegramScheduleType = 'Manual' | 'Recurring';
export type TelegramFrequency = 'Daily' | 'Weekly' | 'Interval';

export interface TelegramRule {
  id: number;
  command: string;
  title: string;
  description: string;
  pattern?: string;
  actionType?: string;
  defaultAccountId?: number | null;
  defaultCategoryId?: number | null;
  responseTemplate?: string;
  isActive: boolean;
  sendType: TelegramSendType;
  scheduleType: TelegramScheduleType;
  frequency: TelegramFrequency;
  executionTime?: string;
  intervalMinutes?: number | null;
  daysOfWeek?: string | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
}
