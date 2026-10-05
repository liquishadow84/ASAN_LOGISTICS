#!/usr/bin/env sh
# Linux / macOS: build the app and start the team server (Node.js >= 22.5)
set -e
cd "$(dirname "$0")"
node scripts/build.mjs
exec node --experimental-sqlite --no-warnings server/server.js "$@"
