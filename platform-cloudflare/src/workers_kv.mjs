// Host functions for CloudflareKv (workers_kv.emel). Each takes the name of the KV namespace's binding first.

import { env } from "cloudflare:workers";

function namespace(binding) {
  const kv = env[binding];
  if (kv == null) throw new Error(`no KV namespace is bound as \`${binding}\` (add [[kv_namespaces]] to wrangler.toml)`);
  return kv;
}

/** `{ found, value }`; Option cannot cross the external function boundary. */
export async function get(binding, key) {
  const value = await namespace(binding).get(key);
  return value === null ? { found: false, value: "" } : { found: true, value };
}

export const found = (v) => v.found;
export const value = (v) => v.value;

export async function put(binding, key, value) {
  await namespace(binding).put(key, value);
}

export async function remove(binding, key) {
  await namespace(binding).delete(key);
}
