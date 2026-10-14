import fs = require("node:fs");
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import FileUtil from "../../src/utils/file.util";
import type { HistoryRecord } from "../../src/entities/historyRecord";

describe("FileUtil.saveHistoryFile", () => {
  let folderPath: string;
  let filePath: string;

  const records: HistoryRecord[] = [
    {
      migrationId: "001_create_products",
      status: "completed",
      startedAt: "2026-10-14T17:00:00.000Z",
      finishedAt: "2026-10-14T17:01:00.000Z",
    },
    {
      migrationId: "002_insert_products",
      status: "failed",
      startedAt: "2026-10-14T17:02:00.000Z",
      finishedAt: "2026-10-14T17:03:00.000Z",
      failedStep: "insert",
      errorMessage: "Insert failed",
    },
  ];

  beforeEach(() => {
    folderPath = fs.mkdtempSync(
      join(tmpdir(), "orderflow-save-history-"),
    );

    filePath = join(folderPath, "history.json");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(folderPath, { recursive: true, force: true });
  });

  it("saves records that can be recovered by readHistoryFile", () => {
    FileUtil.saveHistoryFile(filePath, records);

    expect(FileUtil.readHistoryFile(filePath)).toEqual(records);
  });

  it("creates missing destination folders", () => {
    const nestedPath = join(
      folderPath,
      "executions",
      "development",
      "history.json",
    );

    FileUtil.saveHistoryFile(nestedPath, records);

    expect(fs.statSync(dirname(nestedPath)).isDirectory()).toBe(true);
    expect(FileUtil.readHistoryFile(nestedPath)).toEqual(records);
  });

  it("updates an existing history file", () => {
    const initialRecords: HistoryRecord[] = [
      {
        migrationId: "001_create_products",
        status: "pending",
      },
    ];

    FileUtil.saveHistoryFile(filePath, initialRecords);
    FileUtil.saveHistoryFile(filePath, records);

    expect(FileUtil.readHistoryFile(filePath)).toEqual(records);
  });

  it("saves an empty history", () => {
    FileUtil.saveHistoryFile(filePath, []);

    expect(FileUtil.readHistoryFile(filePath)).toEqual([]);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("[]");
  });

  it("serializes the history as readable JSON", () => {
    FileUtil.saveHistoryFile(filePath, records);

    expect(fs.readFileSync(filePath, "utf-8")).toBe(
      JSON.stringify(records, null, 2),
    );
  });

  it("leaves no temporary file after a successful save", () => {
    FileUtil.saveHistoryFile(filePath, records);

    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.existsSync(`${filePath}.tmp`)).toBe(false);
  });

  it("preserves the previous history when temporary writing fails", () => {
    FileUtil.saveHistoryFile(filePath, records);
    const previousContent = fs.readFileSync(filePath, "utf-8");

    jest.spyOn(fs, "writeFileSync").mockImplementationOnce(() => {
      throw new Error("Disk full");
    });

    expect(() => FileUtil.saveHistoryFile(filePath, [])).toThrow(
      `Failed to save history file "${filePath}": Disk full`,
    );

    expect(fs.readFileSync(filePath, "utf-8")).toBe(previousContent);
    expect(FileUtil.readHistoryFile(filePath)).toEqual(records);
  });

  it("does not rename the temporary file when writing fails", () => {
    const renameSpy = jest.spyOn(fs, "renameSync");

    jest.spyOn(fs, "writeFileSync").mockImplementationOnce(() => {
      throw new Error("Write failed");
    });

    expect(() => FileUtil.saveHistoryFile(filePath, records)).toThrow(
      `Failed to save history file "${filePath}": Write failed`,
    );

    expect(renameSpy).not.toHaveBeenCalled();
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("preserves the previous history when renaming fails", () => {
    FileUtil.saveHistoryFile(filePath, records);
    const previousContent = fs.readFileSync(filePath, "utf-8");

    jest.spyOn(fs, "renameSync").mockImplementationOnce(() => {
      throw new Error("Rename denied");
    });

    expect(() => FileUtil.saveHistoryFile(filePath, [])).toThrow(
      `Failed to save history file "${filePath}": Rename denied`,
    );

    expect(fs.readFileSync(filePath, "utf-8")).toBe(previousContent);
    expect(FileUtil.readHistoryFile(filePath)).toEqual(records);

    // A implementação atual mantém o temporário após essa falha.
    expect(fs.readFileSync(`${filePath}.tmp`, "utf-8")).toBe("[]");
  });

  it("reports an error when the destination folder cannot be created", () => {
    const blockingFile = join(folderPath, "blocking-file");
    fs.writeFileSync(blockingFile, "content", "utf-8");

    const invalidPath = join(blockingFile, "history.json");

    expect(() =>
      FileUtil.saveHistoryFile(invalidPath, records),
    ).toThrow(
      `Failed to save history file "${invalidPath}":`,
    );

    expect(fs.readFileSync(blockingFile, "utf-8")).toBe("content");
  });

  it("handles a non-Error value thrown during saving", () => {
    jest.spyOn(fs, "writeFileSync").mockImplementationOnce(() => {
      throw "Unexpected write failure";
    });

    expect(() => FileUtil.saveHistoryFile(filePath, records)).toThrow(
      `Failed to save history file "${filePath}": Unexpected write failure`,
    );
  });

  it("does not mutate the input records", () => {
    const inputRecords: HistoryRecord[] = records.map((record) => ({
      ...record,
    }));

    const originalRecords = inputRecords.map((record) => ({
      ...record,
    }));

    FileUtil.saveHistoryFile(filePath, inputRecords);

    expect(inputRecords).toEqual(originalRecords);
  });
});