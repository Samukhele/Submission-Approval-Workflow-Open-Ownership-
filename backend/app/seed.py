from app.auth.password import hash_password
from app.database import SessionLocal
from app.models import User, UserRole

SEED_USERS = [
    {
        "email": "applicant@demo.com",
        "password": "password123",
        "role": UserRole.APPLICANT,
    },
    {
        "email": "reviewer@demo.com",
        "password": "password123",
        "role": UserRole.REVIEWER,
    },
]


def seed() -> None:
    db = SessionLocal()
    try:
        for user_data in SEED_USERS:
            existing = db.query(User).filter(User.email == user_data["email"]).first()
            if existing:
                continue
            db.add(
                User(
                    email=user_data["email"],
                    password_hash=hash_password(user_data["password"]),
                    role=user_data["role"],
                )
            )
        db.commit()
        print("Seed users created.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
