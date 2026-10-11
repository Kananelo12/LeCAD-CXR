"""Stop the Lightning AI Studio this runs in, so an idle GPU stops billing.

    python ml/scripts/stop_studio.py --check   # report the Studio found; stop nothing
    python ml/scripts/stop_studio.py           # stop it (the terminal disconnects)

Called by run_on_lightning.sh when a training job ends. Outside a Lightning
Studio (e.g. on the laptop) it reports that and does nothing.
"""
from __future__ import annotations

import argparse
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="find the Studio but do not stop it")
    args = ap.parse_args()

    try:
        from lightning_sdk import Studio
    except ImportError:
        print("lightning_sdk is not installed: not a Lightning Studio, nothing to stop.")
        return 0

    try:
        studio = Studio()  # inside a Studio, finds the current one by itself
    except Exception as e:
        print(f"Could not identify the current Studio ({e}). Stop it by hand.")
        return 1

    print(f"studio  : {studio.name}\nstatus  : {studio.status}")
    if args.check:
        print("--check: not stopping.")
        return 0

    print("stopping the Studio now; this terminal will disconnect.", flush=True)
    studio.stop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
