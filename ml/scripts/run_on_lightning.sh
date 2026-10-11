#!/usr/bin/env bash
# Train, evaluate the best epoch, then STOP this Lightning Studio, whatever
# happens, so a GPU is never left running idle.
#
#   nohup bash ml/scripts/run_on_lightning.sh ml/configs/resnet50.yaml > train-resnet50.log 2>&1 &
#
# The Studio stops when training finishes, fails, or runs past MAX_HOURS
# (default 4; a stuck job cannot bill all night). Extra arguments go to
# train.py, e.g. --resume ml/artifacts/runs/<run-folder>. EVAL_ARGS passes
# extra arguments to evaluate.py.
set -u
cd "$(dirname "$0")/../.." || exit 1

CONFIG="${1:?usage: run_on_lightning.sh <config.yaml> [train.py args]}"
shift
MAX_HOURS="${MAX_HOURS:-4}"

stamp() { date '+%F %T'; }
stop_studio() { echo "[$(stamp)] job over; stopping the Studio"; python ml/scripts/stop_studio.py; }
trap stop_studio EXIT
trap 'exit 130' INT TERM  # a kill still runs the EXIT trap, so the Studio still stops

echo "[$(stamp)] training $CONFIG (time limit ${MAX_HOURS}h)"
timeout "${MAX_HOURS}h" python ml/scripts/train.py --config "$CONFIG" "$@"
status=$?

if [ "$status" -eq 0 ]; then
    run=$(ls -td ml/artifacts/runs/*/ | head -1)
    echo "[$(stamp)] evaluating ${run}"
    # shellcheck disable=SC2086  # EVAL_ARGS is deliberately word-split
    python ml/scripts/evaluate.py --run "$run" ${EVAL_ARGS:-}
elif [ "$status" -eq 124 ]; then
    echo "[$(stamp)] training passed ${MAX_HOURS}h and was stopped; continue with --resume"
else
    echo "[$(stamp)] training failed (exit $status); see the messages above"
fi
