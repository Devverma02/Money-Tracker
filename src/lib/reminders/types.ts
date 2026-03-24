export type ReminderItem = {
  id: string;
  title: string;
  linkedPerson: string | null;
  dueAt: string;
  snoozeUntil: string | null;
  effectiveDueAt: string;
  status: "PENDING" | "DONE" | "SNOOZED" | "OVERDUE" | "CANCELLED";
  isOverdue: boolean;
  bucketSlug: string | null;
  linkedEntryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReminderBoard = {
  nextReminder: ReminderItem | null;
  activeReminders: ReminderItem[];
  closedReminders: ReminderItem[];
  counts: {
    active: number;
    overdue: number;
    closed: number;
  };
  helperText: string;
};

export type ReminderDraftSeed = {
  title: string;
  linkedPerson: string;
  dueDate: string;
  dueTime: string;
};
