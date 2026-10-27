// Host functions for Cloudflare.Platform (platform.emel).
//
// The bindings are read from `cloudflare:workers`, so they need not be passed along with each
// request (`Std.Http.serve` hands the Emela side only the request).

import { env } from "cloudflare:workers";

/** Whether the Worker has a text variable or secret named `name`. */
export const hasVar = (name) => typeof env[name] === "string";

/** The text variable or secret named `name`. Call only when `hasVar` is true. */
export const getVar = (name) => env[name];
