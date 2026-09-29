#!/bin/sh
# Formatting/modernization commands may exit successfully while reporting changes.
set -eu
report=$(mktemp)
trap 'rm -f "$report"' EXIT HUP INT TERM
if "$@" >"$report"; then
  if [ -s "$report" ]; then
    cat "$report"
    exit 1
  fi
else
  status=$?
  cat "$report"
  exit "$status"
fi
