import { get } from "node:http";
import { HistoryRecord } from "../entities/historyRecord";
import { readdirSync, readFileSync } from "node:fs";
export default class FileUtil {
  static readHistoryFile(filePath: string): HistoryRecord[] {
    let fileContent: string;

    try {
      fileContent = readFileSync(filePath, "utf-8");
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to read history file "${filePath}": ${message}`);
    }

    try {
      const parsed: unknown = JSON.parse(fileContent);

      if (!Array.isArray(parsed)) {
        throw new Error("Expected an array of history records");
      }

      const records: HistoryRecord[] = [];

      for (const [index, value] of parsed.entries()) {
        const candidate: unknown = value;

        if (
          typeof candidate !== "object" ||
          candidate === null ||
          Array.isArray(candidate)
        ) {
          throw new Error(
            `Invalid history record at index ${index}: expected an object`,
          );
        }

        const record = candidate as Record<string, unknown>;

        const invalid = (message: string): never => {
          throw new Error(
            `Invalid history record at index ${index}: ${message}`,
          );
        };

        const migrationId = record.migrationId;
        const status = record.status;
        if (typeof migrationId !== "string") {
          throw new Error(
            `Invalid history record at index ${index}: migrationId must be a string`,
          );
        }

        if (
          status !== "pending" &&
          status !== "running" &&
          status !== "completed" &&
          status !== "failed"
        ) {
          throw new Error(
            `Invalid history record at index ${index}: invalid status`,
          );
        }

        const optionalString = (field: string): string | undefined => {
          const fieldValue = record[field];

          if (fieldValue === undefined) {
            return undefined;
          }

          if (typeof fieldValue !== "string") {
            return invalid(`${field} must be a string`);
          }

          return fieldValue;
        };

        const startedAt = optionalString("startedAt");
        const finishedAt = optionalString("finishedAt");
        const failedStep = optionalString("failedStep");
        const errorMessage = optionalString("errorMessage");

        if (status === "running" && startedAt === undefined) {
          invalid("running status requires startedAt");
        }

        if (
          status === "completed" &&
          (startedAt === undefined || finishedAt === undefined)
        ) {
          invalid("completed status requires startedAt and finishedAt");
        }

        if (
          status === "failed" &&
          (startedAt === undefined ||
            finishedAt === undefined ||
            errorMessage === undefined)
        ) {
          invalid(
            "failed status requires startedAt, finishedAt, and errorMessage",
          );
        }

        const validatedRecord: HistoryRecord = {
          migrationId,
          status,
        };

        if (startedAt !== undefined) {
          validatedRecord.startedAt = startedAt;
        }

        if (finishedAt !== undefined) {
          validatedRecord.finishedAt = finishedAt;
        }

        if (failedStep !== undefined) {
          validatedRecord.failedStep = failedStep;
        }

        if (errorMessage !== undefined) {
          validatedRecord.errorMessage = errorMessage;
        }

        records.push(validatedRecord);
      }

      return records;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(
        `Failed to parse or validate history file "${filePath}": ${message}`,
      );
    }
  }

  // Dentro da classe FileUtil:
  static getEligibleMigrationFiles(folderPath: string): string[] {
    let entries: ReturnType<typeof readdirSync>;

    // A opção withFileTypes tem um retorno específico; usamos
    // o bloco abaixo para preservar a inferência do TypeScript.
    try {
      const files = readdirSync(folderPath, { withFileTypes: true });
      const migrations: { prefix: number; name: string }[] = [];
      const prefixes = new Set<number>();

      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".migration.ts")) {
          continue;
        }

        const match = file.name.match(
          /^([0-9]{3})_([a-z][a-z0-9]*(?:_[a-z0-9]+)*)\.migration\.ts$/,
        );

        const prefixText = match?.[1];

        if (prefixText === undefined) {
          throw new Error(`Invalid migration file name: "${file.name}"`);
        }

        const prefix = Number(prefixText);

        if (prefixes.has(prefix)) {
          throw new Error(
            `Duplicate migration prefix: "${prefix}" in file "${file.name}"`,
          );
        }

        prefixes.add(prefix);
        migrations.push({ prefix, name: file.name });
      }

      migrations.sort((a, b) => a.prefix - b.prefix);

      return migrations.map((migration) => migration.name);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(
        `Failed to list migration files in "${folderPath}": ${message}`,
      );
    }
  }
}
