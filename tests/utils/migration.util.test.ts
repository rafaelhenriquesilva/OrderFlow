import MigrationUtil from "../../src/utils/migration.util";
import type { HistoryRecord } from "../../src/entities/historyRecord";

describe("MigrationUtil.buildMigrationPlan", () => {
  const migrationUtil = new MigrationUtil();

  const files = [
    "001_create_products.migration.ts",
    "002_insert_products.migration.ts",
    "003_create_inventory.migration.ts",
  ];

  const startedAt = "2026-10-06T20:00:00.000Z";
  const finishedAt = "2026-10-06T20:05:00.000Z";

  it("returns an empty plan when no files or history exist", () => {
    expect(migrationUtil.buildMigrationPlan([], [])).toEqual([]);
  });

  it("returns an empty plan when there are no migration files", () => {
    const history: HistoryRecord[] = [
      {
        migrationId: "001_create_products",
        status: "completed",
        startedAt,
        finishedAt,
      },
    ];

    expect(migrationUtil.buildMigrationPlan([], history)).toEqual([]);
  });

  it("marks every migration for execution when history is empty", () => {
    expect(migrationUtil.buildMigrationPlan(files, [])).toEqual([
      { migrationId: "001_create_products", decision: "execute" },
      { migrationId: "002_insert_products", decision: "execute" },
      { migrationId: "003_create_inventory", decision: "execute" },
    ]);
  });

  it("skips a completed migration", () => {
    const history: HistoryRecord[] = [
      {
        migrationId: "001_create_products",
        status: "completed",
        startedAt,
        finishedAt,
      },
    ];

    expect(
      migrationUtil.buildMigrationPlan([files[0]!], history),
    ).toEqual([
      { migrationId: "001_create_products", decision: "skip" },
    ]);
  });

  it("executes a pending migration", () => {
    const history: HistoryRecord[] = [
      {
        migrationId: "001_create_products",
        status: "pending",
      },
    ];

    expect(
      migrationUtil.buildMigrationPlan([files[0]!], history),
    ).toEqual([
      { migrationId: "001_create_products", decision: "execute" },
    ]);
  });

  it("retries a failed migration", () => {
    const history: HistoryRecord[] = [
      {
        migrationId: "002_insert_products",
        status: "failed",
        startedAt,
        finishedAt,
        failedStep: "insert",
        errorMessage: "Insert failed",
      },
    ];

    expect(
      migrationUtil.buildMigrationPlan([files[1]!], history),
    ).toEqual([
      { migrationId: "002_insert_products", decision: "retry" },
    ]);
  });

  it("rejects a migration marked as running", () => {
    const history: HistoryRecord[] = [
      {
        migrationId: "002_insert_products",
        status: "running",
        startedAt,
      },
    ];

    expect(() =>
      migrationUtil.buildMigrationPlan(files, history),
    ).toThrow(
      "Migration 002_insert_products is currently running. Execution needs to be investigated.",
    );
  });

  it("rejects duplicate migration IDs in history", () => {
    const history: HistoryRecord[] = [
      {
        migrationId: "001_create_products",
        status: "pending",
      },
      {
        migrationId: "001_create_products",
        status: "completed",
        startedAt,
        finishedAt,
      },
    ];

    expect(() =>
      migrationUtil.buildMigrationPlan(files, history),
    ).toThrow(
      "Duplicate migrationId in history: 001_create_products",
    );
  });

  it("rejects duplicate history IDs even when no files exist", () => {
    const history: HistoryRecord[] = [
      { migrationId: "001_create_products", status: "pending" },
      { migrationId: "001_create_products", status: "pending" },
    ];

    expect(() =>
      migrationUtil.buildMigrationPlan([], history),
    ).toThrow(
      "Duplicate migrationId in history: 001_create_products",
    );
  });

  it("builds a mixed plan independently of history order", () => {
    const history: HistoryRecord[] = [
      {
        migrationId: "003_create_inventory",
        status: "pending",
      },
      {
        migrationId: "002_insert_products",
        status: "failed",
        startedAt,
        finishedAt,
        errorMessage: "Insert failed",
      },
      {
        migrationId: "001_create_products",
        status: "completed",
        startedAt,
        finishedAt,
      },
    ];

    expect(migrationUtil.buildMigrationPlan(files, history)).toEqual([
      { migrationId: "001_create_products", decision: "skip" },
      { migrationId: "002_insert_products", decision: "retry" },
      { migrationId: "003_create_inventory", decision: "execute" },
    ]);
  });

  it("preserves the input file order", () => {
    const input = [
      "003_create_inventory.migration.ts",
      "001_create_products.migration.ts",
      "002_insert_products.migration.ts",
    ];

    expect(migrationUtil.buildMigrationPlan(input, [])).toEqual([
      { migrationId: "003_create_inventory", decision: "execute" },
      { migrationId: "001_create_products", decision: "execute" },
      { migrationId: "002_insert_products", decision: "execute" },
    ]);
  });

  it("removes only the migration suffix from the ID", () => {
    expect(
      migrationUtil.buildMigrationPlan(
        ["001_create_products.migration.ts"],
        [],
      ),
    ).toEqual([
      { migrationId: "001_create_products", decision: "execute" },
    ]);
  });

  it("does not mutate the input arrays or history records", () => {
    const inputFiles = [...files];
    const history: HistoryRecord[] = [
      {
        migrationId: "001_create_products",
        status: "completed",
        startedAt,
        finishedAt,
      },
    ];

    const originalFiles = [...inputFiles];
    const originalHistory = history.map((record) => ({ ...record }));

    migrationUtil.buildMigrationPlan(inputFiles, history);

    expect(inputFiles).toEqual(originalFiles);
    expect(history).toEqual(originalHistory);
  });
});