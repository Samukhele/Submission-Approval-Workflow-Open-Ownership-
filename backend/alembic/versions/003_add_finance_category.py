"""add finance application category

Revision ID: 003
Revises: 002
Create Date: 2026-06-29
"""

from typing import Sequence, Union

from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE applicationcategory ADD VALUE IF NOT EXISTS 'finance'")


def downgrade() -> None:
    pass
