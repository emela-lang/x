// The Worker's entry. Calls the `fetch` that the Emela entry module exports once per request.
//
// The Emela side runs per request from start to end, so fibers never span requests (Workers cancels a
// continuation resolved from another request's context).

import * as app from "../target/emela/js/main.mjs";

export default {
  async fetch(request) {
    const incoming = {
      method: request.method,
      url: request.url,
      headers: [...request.headers],
      body: await request.text(),
    };
    const out = await run(app.fetch, incoming);
    return new Response(out.body, { status: out.status, headers: out.headers });
  },
};

// Calls `f(arg)` and drives it with the runtime's `$start` if it suspends (returns a generator).
// A defect that escapes Worker.serve rejects, which Workers answers with a 500.
function run(f, arg) {
  const result = f(arg);
  if (Object.prototype.toString.call(result) !== "[object Generator]") return Promise.resolve(result);
  return new Promise((resolve, reject) => {
    app.$start(result, (ok, value) => (ok ? resolve(value) : reject(value)));
  });
}
