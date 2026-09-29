"""Generate the patient-level train/validation split. Run this ONCE.

    python ml/scripts/make_splits.py

Writes ml/splits/{train_patients.txt,val_patients.txt,split_manifest.json}.
Commit all three. Regenerating with the same seed reproduces them exactly;
regenerating with a different seed invalidates every result you have.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from lecad.splits import write_splits  # noqa: E402


def main() -> None:
    manifest = write_splits()
    print(json.dumps(manifest, indent=2))
    print("\nWrote ml/splits/. Commit these files.")


if __name__ == "__main__":
    main()
