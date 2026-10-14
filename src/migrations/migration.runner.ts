import type { HistoryRecord } from "../entities/historyRecord";
import type { Migration } from "../entities/migration";

export interface MigrationPlanEntry {
  migrationId: string;
  decision: "skip" | "execute" | "retry";
}

type SaveHistory = (records: HistoryRecord[]) => void;

export default class MigrationRunner {
  async executeMigrationPlan(
    plan: MigrationPlanEntry[],
    migrations: Migration[],
    history: HistoryRecord[],
    saveHistory: SaveHistory,
  ): Promise<HistoryRecord[]> {
    const migrationMap = new Map<string, Migration>();

    for (const migration of migrations) {
      if (migrationMap.has(migration.id)) {
        throw new Error(`Duplicate migration: ${migration.id}`);
      }

      migrationMap.set(migration.id, migration);
    }

    // Valida tudo antes da primeira alteração.
    const plannedIds = new Set<string>();

    for (const entry of plan) {
      if (plannedIds.has(entry.migrationId)) {
        throw new Error(
          `Duplicate migration in plan: ${entry.migrationId}`,
        );
      }

      plannedIds.add(entry.migrationId);

      if (!migrationMap.has(entry.migrationId)) {
        throw new Error(
          `Migration implementation not found: ${entry.migrationId}`,
        );
      }
    }

    const records = history.map((record) => ({ ...record }));

    if (
      new Set(records.map((record) => record.migrationId)).size !==
      records.length
    ) {
      throw new Error("Duplicate migrationId in history");
    }

    const persist = (record: HistoryRecord): void => {
      const index = records.findIndex(
        (item) => item.migrationId === record.migrationId,
      );

      if (index === -1) {
        records.push(record);
      } else {
        records[index] = record;
      }

      // Uma falha de persistência interrompe o executor.
      saveHistory(records.map((item) => ({ ...item })));
    };

    for (const entry of plan) {
      if (entry.decision === "skip") {
        console.log(`SKIP ${entry.migrationId}`);
        continue;
      }

      const migration = migrationMap.get(entry.migrationId);

      if (!migration) {
        throw new Error(
          `Migration implementation not found: ${entry.migrationId}`,
        );
      }

      const startedAt = new Date().toISOString();

      // Substitui o estado anterior e limpa erros da tentativa passada.
      persist({
        migrationId: migration.id,
        status: "running",
        startedAt,
      });

      console.log(
        `${entry.decision === "retry" ? "RETRY" : "RUN"} ${migration.id}`,
      );

      try {
        await migration.up();
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);

        try {
          persist({
            migrationId: migration.id,
            status: "failed",
            startedAt,
            finishedAt: new Date().toISOString(),
            failedStep: "up",
            errorMessage: message,
          });
        } catch (historyError: unknown) {
          const historyMessage =
            historyError instanceof Error
              ? historyError.message
              : String(historyError);

          throw new Error(
            `Migration "${migration.id}" failed: ${message}. ` +
              `Saving the failure also failed: ${historyMessage}`,
          );
        }

        throw new Error(
          `Migration "${migration.id}" failed: ${message}`,
        );
      }

      // Fora do catch de up(): erro ao salvar não significa
      // que a operação da migration falhou.
      persist({
        migrationId: migration.id,
        status: "completed",
        startedAt,
        finishedAt: new Date().toISOString(),
      });

      console.log(`COMPLETED ${migration.id}`);
    }

    return records;
  }
}