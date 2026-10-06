import { readFileSync } from "node:fs";
import { readHistoryFile } from "../src/index";

jest.mock("node:fs", () => ({
  readFileSync: jest.fn(),
}));

const mockedReadFileSync = jest.mocked(readFileSync);

describe("readHistoryFile", () => {
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

    expect(readHistoryFile("nonexistent.json")).toEqual([]);
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

    expect(() => readHistoryFile("somefile.json")).toThrow(
      'Failed to read history file "somefile.json": Permission denied',
    );
  });

  it("handles a non-Error value thrown during reading", () => {
    mockedReadFileSync.mockImplementation(() => {
      throw "Read failure";
    });

    expect(() => readHistoryFile("somefile.json")).toThrow(
      'Failed to read history file "somefile.json": Read failure',
    );
  });

  it("throws when the content is invalid JSON", () => {
    mockedReadFileSync.mockReturnValue("invalid json");

    expect(() => readHistoryFile("invalid.json")).toThrow(
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

    expect(() => readHistoryFile("history.json")).toThrow(
      "Expected an array of history records",
    );
  });

  it("accepts an empty array", () => {
    mockContent([]);

    expect(readHistoryFile("empty.json")).toEqual([]);
  });

  it.each([
    ["null", null],
    ["array", []],
    ["string", "record"],
    ["number", 123],
  ])("rejects a record of type %s", (_label, record) => {
    mockContent([record]);

    expect(() => readHistoryFile("history.json")).toThrow(
      "Invalid history record at index 0: expected an object",
    );
  });

  it.each([undefined, null, 123, false])(
    "rejects migrationId equal to %p",
    (migrationId) => {
      mockContent([{ migrationId, status: "pending" }]);

      expect(() => readHistoryFile("history.json")).toThrow(
        "Invalid history record at index 0: migrationId must be a string",
      );
    },
  );

  it.each([undefined, null, "invalid", 123, false])(
    "rejects status equal to %p",
    (status) => {
      mockContent([{ migrationId: "001", status }]);

      expect(() => readHistoryFile("history.json")).toThrow(
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

      expect(() => readHistoryFile("history.json")).toThrow(
        `Invalid history record at index 0: ${field} must be a string`,
      );
    },
  );

  it("requires startedAt for running records", () => {
    mockContent([{ migrationId: "001", status: "running" }]);

    expect(() => readHistoryFile("history.json")).toThrow(
      "running status requires startedAt",
    );
  });

  it.each([
    { finishedAt: "2026-10-05T20:05:00.000Z" },
    { startedAt: "2026-10-05T20:00:00.000Z" },
    {},
  ])("requires both dates for completed records: %p", (dates) => {
    mockContent([
      { migrationId: "001", status: "completed", ...dates },
    ]);

    expect(() => readHistoryFile("history.json")).toThrow(
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

      expect(() => readHistoryFile("history.json")).toThrow(
        "failed status requires startedAt, finishedAt, and errorMessage",
      );
    },
  );

  it("includes the correct index when a later record is invalid", () => {
    mockContent([
      { migrationId: "001", status: "pending" },
      { migrationId: 123, status: "pending" },
    ]);

    expect(() => readHistoryFile("history.json")).toThrow(
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

    expect(readHistoryFile("valid.json")).toEqual(validRecords);
  });
});