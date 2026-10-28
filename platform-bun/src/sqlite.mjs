// Host functions for BunSqlite (sqlite.emel), on `bun:sqlite`. Statements come as JSON
// (`{"text": ..., "params": [...]}`), and each call gives an outcome: `ok` and the result as JSON,
// or the message of the error SQLite threw.

import { Database } from "bun:sqlite";

export function open(path) {
  // safeIntegers: integers come back as BigInt, so that no digit is lost on the way to Emela.
  return new Database(path, { create: true, strict: true, safeIntegers: true });
}

export function close(db) {
  db.close();
}

// A row as JSON, by hand: JSON.stringify cannot write a BigInt.
function value(v) {
  if (v === null) return "null";
  if (typeof v === "bigint" || typeof v === "number") return String(v);
  if (typeof v === "string") return JSON.stringify(v);
  throw new Error("a BLOB cannot be read yet");
}

function row(r) {
  return "{" + Object.entries(r).map(([k, v]) => JSON.stringify(k) + ":" + value(v)).join(",") + "}";
}

function outcome(run) {
  try {
    return { ok: true, value: run() };
  } catch (e) {
    return { ok: false, value: String(e?.message ?? e) };
  }
}

const prepare = (db, s) => [db.query(s.text), s.params];
const changes = (db, s) => {
  const [statement, params] = prepare(db, s);
  return Number(statement.run(...params).changes);
};

export function query(db, json) {
  return outcome(() => {
    const [statement, params] = prepare(db, JSON.parse(json));
    return "[" + statement.all(...params).map(row).join(",") + "]";
  });
}

export function execute(db, json) {
  return outcome(() => String(changes(db, JSON.parse(json))));
}

export function batch(db, json) {
  return outcome(() => {
    const statements = JSON.parse(json);
    return JSON.stringify(db.transaction(() => statements.map((s) => changes(db, s)))());
  });
}

export const ok = (o) => o.ok;
export const result = (o) => o.value;
