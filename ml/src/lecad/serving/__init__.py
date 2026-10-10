"""FastAPI service: sign-in, prediction with Grad-CAM, hash-chained audit log.

Deliberately inside the same package as training so that

    from lecad.transforms import build_transform, prepare_image

is literally the same code path in both. Do not copy preprocessing here.

    app.py        routes (docs/api-contract.md)
    inference.py  image decoding, model, Grad-CAM, fake model
    audit.py      append-only hash chain
    security.py   argon2id passwords, session tokens, sign-in throttle
    db.py         tables
    settings.py   configuration from the environment
    admin.py      account and audit commands (python -m lecad.serving.admin)

How to run it: docs/serving-guide.md.
"""
