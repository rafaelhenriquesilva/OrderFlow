import { resolve } from "node:path";
import FileUtil from "../utils/file.util";
import MigrationUtil from "../utils/migration.util";
import MigrationRunner from "./migration.runner";
import type { Migration } from "../entities/migration";
// Adicione aqui os imports das migrations reais quando forem criadas.
import createOrdersTableMigration from "./001_order_table";
const migrations: Migration[] = [createOrdersTableMigration];

async function main(): Promise<void> {
  const historyPath = resolve(
    process.cwd(),
    "var",
    "migrations",
    "development",
    "history.json",
  );

  // O registro explícito é a fonte das implementações.
  // Validamos os IDs e ordenamos pelo prefixo.
  const prefixes = new Set<number>();

  for (const migration of migrations) {
    const match = /^([0-9]{3})_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.exec(
      migration.id,
    );

    const prefixText = match?.[1];

    if (prefixText === undefined) {
      throw new Error(`Invalid migration ID: ${migration.id}`);
    }

    const prefix = Number(prefixText);

    if (prefixes.has(prefix)) {
      throw new Error(`Duplicate migration prefix: ${prefixText}`);
    }

    prefixes.add(prefix);
  }

  const orderedMigrations = [...migrations].sort(
    (a, b) => Number(a.id.slice(0, 3)) - Number(b.id.slice(0, 3)),
  );

  const history = FileUtil.readHistoryFile(historyPath);

  const plan = new MigrationUtil().buildMigrationPlan(
    orderedMigrations.map(
      (migration) => `${migration.id}.migration.ts`,
    ),
    history,
  );

  if (plan.length === 0) {
    console.log("Nenhuma migration registrada.");
    return;
  }

  await new MigrationRunner().executeMigrationPlan(
    plan,
    orderedMigrations,
    history,
    (records) => FileUtil.saveHistoryFile(historyPath, records),
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );

  process.exitCode = 1;
});
