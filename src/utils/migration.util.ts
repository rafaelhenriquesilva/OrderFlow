import type { HistoryRecord } from "../entities/historyRecord";

export interface MigrationPlanEntry {
  migrationId: string;
  decision: "skip" | "execute" | "retry";
}

export default class MigrationUtil {
  buildMigrationPlan(
    migrationFiles: string[],
    historyRecords: HistoryRecord[],
  ): MigrationPlanEntry[] {
    const plan: MigrationPlanEntry[] = [];
    const historyMap = new Map<string, HistoryRecord>();

    for (const record of historyRecords) {
      if (historyMap.has(record.migrationId)) {
        throw new Error(
          `Duplicate migrationId in history: ${record.migrationId}`,
        );
      }

      historyMap.set(record.migrationId, record);
    }

    for (const file of migrationFiles) {
      const migrationId = file.replace(/\.migration\.ts$/, "");
      const historyRecord = historyMap.get(migrationId);

      if (!historyRecord) {
        plan.push({ migrationId, decision: "execute" });
        continue;
      }

      switch (historyRecord.status) {
        case "completed":
          plan.push({ migrationId, decision: "skip" });
          break;

        case "pending":
          plan.push({ migrationId, decision: "execute" });
          break;

        case "failed":
          plan.push({ migrationId, decision: "retry" });
          break;

        case "running":
          throw new Error(
            `Migration ${migrationId} is currently running. Execution needs to be investigated.`,
          );

        default:
          throw new Error(
            `Invalid history status for migration: ${migrationId}`,
          );
      }
    }

    return plan;
  }
}