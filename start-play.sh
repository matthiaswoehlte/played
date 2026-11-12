#!/bin/sh
# Starts Play from this folder. Then open http://127.0.0.1:4327 in your browser.
cd "$(dirname "$0")" && exec node app/server/start.mjs --ohne-browser "$@"
