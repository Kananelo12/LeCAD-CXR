"""Account administration and audit checks. Accounts are created here, by
an administrator; the API has no sign-up (ADR 0002).

    python -m lecad.serving.admin create-user --username mokoena --display-name "Dr T. Mokoena"
    python -m lecad.serving.admin set-password --username mokoena
    python -m lecad.serving.admin deactivate --username mokoena
    python -m lecad.serving.admin list-users
    python -m lecad.serving.admin verify-audit

Reads DATABASE_URL from the environment (.env). Passwords are typed at a
prompt, never passed as arguments, so they stay out of shell history.
"""
from __future__ import annotations

import argparse
import getpass
import os
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

try:  # read DATABASE_URL from .env, as the API does (settings.py)
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from . import audit
from .db import User, init_db, make_engine, make_sessionmaker
from .security import hash_password

MIN_PASSWORD_LENGTH = 12


def _prompt_password() -> str:
    while True:
        first = getpass.getpass("Password: ")
        if len(first) < MIN_PASSWORD_LENGTH:
            print(f"Use at least {MIN_PASSWORD_LENGTH} characters.")
            continue
        if getpass.getpass("Repeat password: ") != first:
            print("The passwords did not match.")
            continue
        return first


def _find(session: Session, username: str) -> User:
    user = session.scalars(select(User).where(User.username == username)).first()
    if user is None:
        sys.exit(f"No user named {username!r}.")
    return user


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="python -m lecad.serving.admin")
    sub = ap.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create-user")
    create.add_argument("--username", required=True)
    create.add_argument("--display-name", required=True)
    create.add_argument("--role", choices=("clinician", "admin"), default="clinician")

    for name in ("set-password", "deactivate", "activate"):
        sub.add_parser(name).add_argument("--username", required=True)
    sub.add_parser("list-users")
    sub.add_parser("verify-audit")

    args = ap.parse_args(argv)
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL is not set.")
    engine = make_engine(url)
    init_db(engine)

    with make_sessionmaker(engine)() as session:
        if args.command == "create-user":
            if session.scalars(select(User).where(User.username == args.username)).first():
                sys.exit(f"User {args.username!r} already exists.")
            session.add(User(username=args.username, display_name=args.display_name,
                             role=args.role, password_hash=hash_password(_prompt_password())))
            session.commit()
            print(f"Created {args.role} {args.username!r}.")

        elif args.command == "set-password":
            user = _find(session, args.username)
            user.password_hash = hash_password(_prompt_password())
            session.commit()
            print(f"Password changed for {args.username!r}.")

        elif args.command in ("deactivate", "activate"):
            user = _find(session, args.username)
            user.is_active = args.command == "activate"
            session.commit()
            print(f"{args.username!r} is now {'active' if user.is_active else 'deactivated'}.")

        elif args.command == "list-users":
            for u in session.scalars(select(User).order_by(User.username)):
                state = "" if u.is_active else "  (deactivated)"
                print(f"{u.username:<20} {u.role:<10} {u.display_name}{state}")

        elif args.command == "verify-audit":
            report = audit.verify_chain(session)
            if report.ok:
                print(f"Audit log intact: {report.rows} row{'' if report.rows == 1 else 's'}.")
                print(f"Head hash: {report.head_hash}")
                print("Record the head hash outside the database (a dated note) so a later "
                      "deletion of the newest rows can be detected.")
            else:
                print(f"AUDIT LOG BROKEN at row id {report.first_bad_id}: {report.reason}")
                sys.exit(1)


if __name__ == "__main__":
    main()
