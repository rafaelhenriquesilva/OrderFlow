import type { Migration } from "../entities/migration";
import {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import client from "../database/dynamo-adapter";

const TABLE_NAME = "orderflow-dev-orders";

const createOrdersTableMigration: Migration = {
  id: "001_order_table",
  name: "Criar a tabela de pedidos do OrderFlow",

  up: async (): Promise<void> => {
    const existingTable = await client
      .send(new DescribeTableCommand({ TableName: TABLE_NAME }))
      .catch((error: unknown) => {
        if (error instanceof ResourceNotFoundException) {
          return null;
        }

        throw error;
      });

    if (existingTable) {
      const table = existingTable.Table;

      if (!table) {
        throw new Error(
          `Falha ao obter informações da tabela "${TABLE_NAME}".`,
        );
      }

      const pkDefinition = table.KeySchema?.find(
        (key) =>
          key.KeyType === "HASH" &&
          key.AttributeName === "PK",
      );

      const skDefinition = table.KeySchema?.find(
        (key) =>
          key.KeyType === "RANGE" &&
          key.AttributeName === "SK",
      );

      const pkAttribute = table.AttributeDefinitions?.find(
        (attribute) =>
          attribute.AttributeName === "PK" &&
          attribute.AttributeType === "S",
      );

      const skAttribute = table.AttributeDefinitions?.find(
        (attribute) =>
          attribute.AttributeName === "SK" &&
          attribute.AttributeType === "S",
      );

      if (
        !pkDefinition ||
        !skDefinition ||
        !pkAttribute ||
        !skAttribute
      ) {
        throw new Error(
          `A tabela "${TABLE_NAME}" possui chaves incompatíveis. ` +
            "Esperado: PK como HASH e SK como RANGE, ambas strings.",
        );
      }

      console.log(`Tabela "${TABLE_NAME}" existente e validada.`);
    } else {
      await client.send(
        new CreateTableCommand({
          TableName: TABLE_NAME,
          KeySchema: [
            { AttributeName: "PK", KeyType: "HASH" },
            { AttributeName: "SK", KeyType: "RANGE" },
          ],
          AttributeDefinitions: [
            { AttributeName: "PK", AttributeType: "S" },
            { AttributeName: "SK", AttributeType: "S" },
          ],
          BillingMode: "PAY_PER_REQUEST",
        }),
      );

      console.log(`Criação da tabela "${TABLE_NAME}" solicitada.`);
    }

    // Aguarda a tabela ficar pronta, exista ela previamente ou não.
    await waitUntilTableExists(
      {
        client,
        maxWaitTime: 60,
      },
      {
        TableName: TABLE_NAME,
      },
    );

    console.log(`Tabela "${TABLE_NAME}" está ACTIVE.`);
  },
};

export default createOrdersTableMigration;