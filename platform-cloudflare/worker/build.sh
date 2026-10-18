#!/bin/sh
# Builds the Emela app for the Worker. The output imports the host files of `@external` by
# relative paths (copied into target/emela/js, spec 12.1), so wrangler bundles it as it is.
set -eu
cd "$(dirname "$0")/.."
emela build .
