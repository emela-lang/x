#!/bin/sh
# Builds the Emela app for the Worker. The output imports external function files by absolute
# `file://` URLs (spec 12.1), which esbuild (wrangler's bundler) cannot resolve; plain absolute
# paths can be, so the scheme is dropped.
set -eu
cd "$(dirname "$0")/.."
emela build .
sed -i.bak 's#"file://#"#g' target/emela/js/main.mjs
rm target/emela/js/main.mjs.bak
