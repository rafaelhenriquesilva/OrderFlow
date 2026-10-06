import { readFileSync } from "node:fs";
import type { HistoryRecord } from "./entities/historyRecord";

export function readHistoryFile(filePath: string): HistoryRecord[] {
  let fileContent: string;

  try {
    fileContent = readFileSync(filePath, "utf-8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
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
        throw new Error(`Invalid history record at index ${index}: ${message}`);
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

module.exports = { readHistoryFile };