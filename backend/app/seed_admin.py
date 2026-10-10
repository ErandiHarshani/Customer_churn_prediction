"""Seeds (or resets) the single admin login stored in the admin_users table.

Run with: python -m app.seed_admin --username ADMIN@CHURAN --password Curan4059
"""

import argparse

from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models.admin_user import AdminUser
from app.security import hash_password


def seed_admin(db: Session, username: str, password: str) -> AdminUser:
    Base.metadata.create_all(bind=engine)

    existing = db.query(AdminUser).filter(AdminUser.username == username).first()
    if existing:
        existing.password_hash = hash_password(password)
        db.commit()
        db.refresh(existing)
        print(f"Updated password for existing admin user '{username}'.")
        return existing

    admin = AdminUser(username=username, password_hash=hash_password(password))
    db.add(admin)
    db.commit()
    db.refresh(admin)
    print(f"Created admin user '{username}'.")
    return admin


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    session = SessionLocal()
    try:
        seed_admin(session, args.username, args.password)
    finally:
        session.close()
