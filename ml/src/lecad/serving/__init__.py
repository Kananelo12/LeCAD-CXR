"""FastAPI service.

Deliberately inside the same package as training so that

    from lecad.transforms import build_transform

is literally the same code path in both. Do not copy preprocessing here.

Not built yet — see docs/decisions/0001-architecture.md for the plan
(auth, hash-chained audit log, /predict).
"""
