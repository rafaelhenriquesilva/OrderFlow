export interface HistoryRecord {
  migrationId: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  finishedAt?: string;
  failedStep?: string;
  errorMessage?: string;
}