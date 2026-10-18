// Host functions for Cloudflare.Worker (worker.emel).
//
// An Incoming is the plain object that worker/entry.mjs builds from the JS Request:
// `{ method, url, headers: [[name, value], ...], body }`. Lists cannot cross the external
// function boundary, so the headers are read one by one by index.

import { env } from "cloudflare:workers";

export const method = (req) => req.method;
export const url = (req) => req.url;
export const body = (req) => req.body;
export const headerCount = (req) => req.headers.length;
export const headerName = (req, index) => req.headers[index][0];
export const headerValue = (req, index) => req.headers[index][1];

/** A response with no headers. entry.mjs turns it into a JS Response. */
export const newResponse = (status, body) => ({ status, body, headers: [] });

/** A copy of `res` with the header added after the others. */
export const withHeader = (res, name, value) => ({ ...res, headers: [...res.headers, [name, value]] });

/** Whether the Worker has a text variable or secret named `name`. */
export const hasVar = (name) => typeof env[name] === "string";

/** The text variable or secret named `name`. Call only when `hasVar` is true. */
export const getVar = (name) => env[name];
