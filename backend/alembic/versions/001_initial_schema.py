"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

user_role = postgresql.ENUM(
    "APPLICANT", "REVIEWER", name="userrole", create_type=False
)
app_status = postgresql.ENUM(
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
    name="applicationstatus",
    create_type=False,
)
app_category = postgresql.ENUM(
    "operations", "marketing", "it", "hr", name="applicationcategory", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    user_role.create(bind, checkfirst=True)
    app_status.create(bind, checkfirst=True)
    app_category.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("category", app_category, nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("requested_date", sa.Date(), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=True),
        sa.Column("file_path", sa.String(length=512), nullable=True),
        sa.Column("status", app_status, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_status", app_status, nullable=False),
        sa.Column("to_status", app_status, nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"]),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("applications")
    op.drop_table("users")
    bind = op.get_bind()
    app_category.drop(bind, checkfirst=True)
    app_status.drop(bind, checkfirst=True)
    user_role.drop(bind, checkfirst=True)
