#!/usr/bin/env bash
# Python stages of `npm run verify`: verify-python.sh lint|types|test
#
# The repo has no Python yet, so each stage skips until tracked *.py files exist (outside the
# Spec Kit folders). Tools run through the project's runner: .venv, uv or poetry, else PATH.
set -euo pipefail

stage="${1:?usage: verify-python.sh lint|types|test}"

if [ -z "$(git ls-files -- '*.py' ':(exclude).specify/**' ':(exclude)specs/**')" ]; then
  echo "python $stage: no tracked Python files, skipped"
  exit 0
fi

run() {
  if [ -x ".venv/bin/$1" ]; then ".venv/bin/$1" "${@:2}"
  elif [ -f uv.lock ]; then uv run "$@"
  elif [ -f poetry.lock ]; then poetry run "$@"
  else "$@"
  fi
}
configured() { [ -f "$2" ] || grep -qs "^\[tool\.$1\]" pyproject.toml; }

case "$stage" in
  lint)
    run ruff check .
    run ruff format --check .
    ;;
  types)
    if configured pyright pyrightconfig.json; then run pyright; fi
    if configured mypy mypy.ini; then run mypy .; fi
    ;;
  test)
    status=0
    run pytest || status=$?
    [ "$status" -eq 0 ] || [ "$status" -eq 5 ] # 5: no tests collected
    ;;
  *)
    echo "unknown stage: $stage" >&2
    exit 2
    ;;
esac
