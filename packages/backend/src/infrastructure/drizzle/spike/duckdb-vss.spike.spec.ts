import { describe, it, expect, afterAll } from 'vitest';
import { DuckDBInstance } from '@duckdb/node-api';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

const VECTOR_SIZE = 1536;
const DB_PATH = path.join(os.tmpdir(), `duckdb-vss-spike-${process.pid}.db`);

function buildUniformVector(value: number): number[] {
  return Array.from({ length: VECTOR_SIZE }, () => value);
}

function normalizedVector(value: number): number[] {
  const raw = buildUniformVector(value);
  const magnitude = Math.sqrt(raw.reduce((sum, v) => sum + v * v, 0));
  return raw.map((v) => v / magnitude);
}

afterAll(() => {
  for (const file of fs.readdirSync(os.tmpdir())) {
    if (file.startsWith(`duckdb-vss-spike-${process.pid}`)) {
      fs.rmSync(path.join(os.tmpdir(), file), { force: true });
    }
  }
});

describe('DuckDB VSS spike', () => {
  it('loads vss extension, inserts a FLOAT[1536] row, and returns a numeric cosine similarity score', async () => {
    const instance = await DuckDBInstance.create(DB_PATH);
    const connection = await instance.connect();

    try {
      await connection.run('INSTALL vss');
      await connection.run('LOAD vss');

      await connection.run(
        `CREATE TABLE embeddings (id INTEGER, vec FLOAT[${VECTOR_SIZE}])`,
      );

      const storedVec = normalizedVector(1.0);
      const queryVec = normalizedVector(1.0);

      const vecLiteral = `[${storedVec.join(',')}]::FLOAT[${VECTOR_SIZE}]`;
      await connection.run(
        `INSERT INTO embeddings VALUES (1, ${vecLiteral})`,
      );

      const queryVecLiteral = `[${queryVec.join(',')}]::FLOAT[${VECTOR_SIZE}]`;
      const reader = await connection.runAndReadAll(
        `SELECT array_cosine_similarity(vec, ${queryVecLiteral}) AS score FROM embeddings`,
      );

      const rows = reader.getRowObjects();
      expect(rows).toHaveLength(1);

      const score = rows[0].score as number;
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(-1);
      expect(score).toBeLessThanOrEqual(1);
    } finally {
      connection.disconnectSync();
    }
  });
});
