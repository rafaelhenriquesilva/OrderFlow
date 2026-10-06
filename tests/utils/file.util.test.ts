import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import FileUtil from "../../src/utils/file.util";

jest.mock("node:fs", () => {
  const actualFs = jest.requireActual<typeof import("node:fs")>("node:fs");

  return {
    ...actualFs,
    readFileSync: jest.fn(),
  };
});

const mockedReadFileSync = jest.mocked(readFileSync);

describe("FileUtil", () => {
  beforeEach(() => {
    mockedReadFileSync.mockReset();
  });

  function mockContent(content: unknown): void {
    mockedReadFileSync.mockReturnValue(JSON.stringify(content));
  }

  it("returns an empty array when the file does not exist", () => {
    mockedReadFileSync.mockImplementation(() => {
      throw Object.assign(new Error("File not found"), {
        code: "ENOENT",
      });
    });

    expect(FileUtil.readHistoryFile("nonexistent.json")).toEqual([]);
    expect(mockedReadFileSync).toHaveBeenCalledWith(
      "nonexistent.json",
      "utf-8",
    );
  });

  it("throws when reading fails for another reason", () => {
    mockedReadFileSync.mockImplementation(() => {
      throw Object.assign(new Error("Permission denied"), {
        code: "EACCES",
      });
    });

    expect(() => FileUtil.readHistoryFile("somefile.json")).toThrow(
      'Failed to read history file "somefile.json": Permission denied',
    );
  });

  it("handles a non-Error value thrown during reading", () => {
    mockedReadFileSync.mockImplementation(() => {
      throw "Read failure";
    });

    expect(() => FileUtil.readHistoryFile("somefile.json")).toThrow(
      'Failed to read history file "somefile.json": Read failure',
    );
  });

  it("throws when the content is invalid JSON", () => {
    mockedReadFileSync.mockReturnValue("invalid json");

    expect(() => FileUtil.readHistoryFile("invalid.json")).toThrow(
      'Failed to parse or validate history file "invalid.json":',
    );
  });

  it.each([
    ["object", {}],
    ["null", null],
    ["string", "history"],
    ["number", 123],
  ])("rejects a root value of type %s", (_label, content) => {
    mockContent(content);

    expect(() => FileUtil.readHistoryFile("history.json")).toThrow(
      "Expected an array of history records",
    );
  });

  it("accepts an empty array", () => {
    mockContent([]);

    expect(FileUtil.readHistoryFile("empty.json")).toEqual([]);
  });

  it.each([
    ["null", null],
    ["array", []],
    ["string", "record"],
    ["number", 123],
  ])("rejects a record of type %s", (_label, record) => {
    mockContent([record]);

    expect(() => FileUtil.readHistoryFile("history.json")).toThrow(
      "Invalid history record at index 0: expected an object",
    );
  });

  it.each([undefined, null, 123, false])(
    "rejects migrationId equal to %p",
    (migrationId) => {
      mockContent([{ migrationId, status: "pending" }]);

      expect(() => FileUtil.readHistoryFile("history.json")).toThrow(
        "Invalid history record at index 0: migrationId must be a string",
      );
    },
  );

  it.each([undefined, null, "invalid", 123, false])(
    "rejects status equal to %p",
    (status) => {
      mockContent([{ migrationId: "001", status }]);

      expect(() => FileUtil.readHistoryFile("history.json")).toThrow(
        "Invalid history record at index 0: invalid status",
      );
    },
  );

  it.each(["startedAt", "finishedAt", "failedStep", "errorMessage"])(
    "rejects an invalid type for %s",
    (field) => {
      mockContent([
        {
          migrationId: "001",
          status: "pending",
          [field]: false,
        },
      ]);

      expect(() => FileUtil.readHistoryFile("history.json")).toThrow(
        `Invalid history record at index 0: ${field} must be a string`,
      );
    },
  );

  it("requires startedAt for running records", () => {
    mockContent([{ migrationId: "001", status: "running" }]);

    expect(() => FileUtil.readHistoryFile("history.json")).toThrow(
      "running status requires startedAt",
    );
  });

  it.each([
    { finishedAt: "2026-10-05T20:05:00.000Z" },
    { startedAt: "2026-10-05T20:00:00.000Z" },
    {},
  ])("requires both dates for completed records: %p", (dates) => {
    mockContent([{ migrationId: "001", status: "completed", ...dates }]);

    expect(() => FileUtil.readHistoryFile("history.json")).toThrow(
      "completed status requires startedAt and finishedAt",
    );
  });

  it.each(["startedAt", "finishedAt", "errorMessage"])(
    "requires %s for failed records",
    (missingField) => {
      const record: Record<string, unknown> = {
        migrationId: "001",
        status: "failed",
        startedAt: "2026-10-05T20:00:00.000Z",
        finishedAt: "2026-10-05T20:05:00.000Z",
        errorMessage: "Insert failed",
      };

      delete record[missingField];
      mockContent([record]);

      expect(() => FileUtil.readHistoryFile("history.json")).toThrow(
        "failed status requires startedAt, finishedAt, and errorMessage",
      );
    },
  );

  it("includes the correct index when a later record is invalid", () => {
    mockContent([
      { migrationId: "001", status: "pending" },
      { migrationId: 123, status: "pending" },
    ]);

    expect(() => FileUtil.readHistoryFile("history.json")).toThrow(
      "Invalid history record at index 1: migrationId must be a string",
    );
  });

  it("returns valid records for every status", () => {
    const validRecords = [
      {
        migrationId: "001",
        status: "pending",
      },
      {
        migrationId: "002",
        status: "running",
        startedAt: "2026-10-05T20:00:00.000Z",
      },
      {
        migrationId: "003",
        status: "completed",
        startedAt: "2026-10-05T20:00:00.000Z",
        finishedAt: "2026-10-05T20:05:00.000Z",
      },
      {
        migrationId: "004",
        status: "failed",
        startedAt: "2026-10-05T20:00:00.000Z",
        finishedAt: "2026-10-05T20:05:00.000Z",
        failedStep: "insert",
        errorMessage: "Insert failed",
      },
    ];

    mockContent(validRecords);

    expect(FileUtil.readHistoryFile("valid.json")).toEqual(validRecords);
  });
});

describe("FileUtil.getEligibleMigrationFiles", () => {
  let folderPath: string;

  beforeEach(() => {
    folderPath = mkdtempSync(join(tmpdir(), "orderflow-migrations-"));
  });

  afterEach(() => {
    rmSync(folderPath, { recursive: true, force: true });
  });

  function createFile(name: string): void {
    writeFileSync(join(folderPath, name), "", "utf-8");
  }

  it("returns migration filenames in numeric order", () => {
    createFile("003_create_inventory.migration.ts");
    createFile("001_create_products.migration.ts");
    createFile("002_insert_products.migration.ts");

    expect(FileUtil.getEligibleMigrationFiles(folderPath)).toEqual([
      "001_create_products.migration.ts",
      "002_insert_products.migration.ts",
      "003_create_inventory.migration.ts",
    ]);
  });

  it("returns an empty array for an empty folder", () => {
    expect(FileUtil.getEligibleMigrationFiles(folderPath)).toEqual([]);
  });

  it("ignores files with other extensions or suffixes", () => {
    createFile("README.md");
    createFile("file.util.ts");
    createFile("001_create_products.migration.js");
    createFile("002_insert_products.migration.ts.bak");
    createFile("003_create_inventory.migration.ts");

    expect(FileUtil.getEligibleMigrationFiles(folderPath)).toEqual([
      "003_create_inventory.migration.ts",
    ]);
  });

  it("ignores subfolders, even with migration filenames", () => {
    mkdirSync(join(folderPath, "001_create_products.migration.ts"));
    mkdirSync(join(folderPath, "nested"));
    writeFileSync(
      join(folderPath, "nested", "002_insert_products.migration.ts"),
      "",
      "utf-8",
    );

    expect(FileUtil.getEligibleMigrationFiles(folderPath)).toEqual([]);
  });

  it.each([
    "create_products.migration.ts",
    "01_create_products.migration.ts",
    "0001_create_products.migration.ts",
    "abc_create_products.migration.ts",
    "001_.migration.ts",
    "001_Create_products.migration.ts",
    "001_create-products.migration.ts",
    "001_create__products.migration.ts",
  ])("rejects an invalid migration filename: %s", (name) => {
    createFile(name);

    expect(() => FileUtil.getEligibleMigrationFiles(folderPath)).toThrow(
      `Invalid migration file name: "${name}"`,
    );
  });

  it("rejects repeated numeric prefixes", () => {
    createFile("001_create_products.migration.ts");
    createFile("001_insert_products.migration.ts");

    expect(() => FileUtil.getEligibleMigrationFiles(folderPath)).toThrow(
      'Duplicate migration prefix: "1"',
    );
  });

  it("includes the folder path in validation errors", () => {
    createFile("invalid.migration.ts");

    expect(() => FileUtil.getEligibleMigrationFiles(folderPath)).toThrow(
      `Failed to list migration files in "${folderPath}":`,
    );
  });

  it("throws when the folder does not exist", () => {
    const missingFolder = join(folderPath, "missing");

    expect(() => FileUtil.getEligibleMigrationFiles(missingFolder)).toThrow(
      `Failed to list migration files in "${missingFolder}":`,
    );
  });

  it("throws when the provided path points to a file", () => {
    const filePath = join(folderPath, "not-a-folder.txt");
    writeFileSync(filePath, "", "utf-8");

    expect(() => FileUtil.getEligibleMigrationFiles(filePath)).toThrow(
      `Failed to list migration files in "${filePath}":`,
    );
  });
});
