// Host functions for WorkerKv (kv.emel). Uses the KV namespace bound as `KV`.

import { env } from "cloudflare:workers";

function namespace() {
  const kv = env.KV;
  if (kv == null) throw new Error("no KV namespace is bound as `KV` (add [[kv_namespaces]] to wrangler.toml)");
  return kv;
}

/** `{ found, value }`; Option cannot cross the external function boundary. */
export async function get(key) {
  const value = await namespace().get(key);
  return value === null ? { found: false, value: "" } : { found: true, value };
}

export const found = (v) => v.found;
export const value = (v) => v.value;

export async function put(key, value) {
  await namespace().put(key, value);
}

export async function remove(key) {
  await namespace().delete(key);
}
