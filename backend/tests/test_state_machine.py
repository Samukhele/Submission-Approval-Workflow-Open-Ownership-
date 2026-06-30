import pytest

from app.services.state_machine import (
    CommentRequiredError,
    ForbiddenTransitionError,
    IllegalTransitionError,
    transition,
)


class TestLegalTransitions:
    def test_draft_to_submitted_by_applicant_owner(self):
        assert transition("DRAFT", "submit", "APPLICANT", True) == "SUBMITTED"

    def test_submitted_to_under_review_by_reviewer(self):
        assert transition("SUBMITTED", "start_review", "REVIEWER", False) == "UNDER_REVIEW"

    def test_submitted_to_approved_by_reviewer(self):
        assert transition("SUBMITTED", "approve", "REVIEWER", False) == "APPROVED"

    def test_submitted_to_rejected_by_reviewer_with_comment(self):
        assert (
            transition("SUBMITTED", "reject", "REVIEWER", False, "Incomplete")
            == "REJECTED"
        )

    def test_under_review_to_approved(self):
        assert transition("UNDER_REVIEW", "approve", "REVIEWER", False) == "APPROVED"

    def test_under_review_to_rejected_with_comment(self):
        assert (
            transition("UNDER_REVIEW", "reject", "REVIEWER", False, "Not eligible")
            == "REJECTED"
        )

    def test_submitted_return_to_draft_with_comment(self):
        assert (
            transition("SUBMITTED", "return", "REVIEWER", False, "Please revise")
            == "DRAFT"
        )

    def test_under_review_return_to_draft_with_comment(self):
        assert (
            transition("UNDER_REVIEW", "return", "REVIEWER", False, "Fix amount")
            == "DRAFT"
        )

    def test_resubmit_after_return(self):
        assert transition("DRAFT", "submit", "APPLICANT", True) == "SUBMITTED"


class TestIllegalTransitions:
    def test_applicant_cannot_start_review(self):
        with pytest.raises(ForbiddenTransitionError):
            transition("SUBMITTED", "start_review", "APPLICANT", True)

    def test_applicant_cannot_approve(self):
        with pytest.raises(ForbiddenTransitionError):
            transition("UNDER_REVIEW", "approve", "APPLICANT", True)

    def test_reviewer_cannot_submit(self):
        with pytest.raises(ForbiddenTransitionError):
            transition("DRAFT", "submit", "REVIEWER", False)

    def test_non_owner_cannot_submit(self):
        with pytest.raises(ForbiddenTransitionError):
            transition("DRAFT", "submit", "APPLICANT", False)

    def test_reject_without_comment(self):
        with pytest.raises(CommentRequiredError):
            transition("UNDER_REVIEW", "reject", "REVIEWER", False, None)

    def test_submitted_reject_without_comment(self):
        with pytest.raises(CommentRequiredError):
            transition("SUBMITTED", "reject", "REVIEWER", False, None)

    def test_return_without_comment(self):
        with pytest.raises(CommentRequiredError):
            transition("UNDER_REVIEW", "return", "REVIEWER", False, "  ")

    def test_approved_is_terminal(self):
        with pytest.raises(IllegalTransitionError):
            transition("APPROVED", "approve", "REVIEWER", False)

    def test_rejected_is_terminal(self):
        with pytest.raises(IllegalTransitionError):
            transition("REJECTED", "reject", "REVIEWER", False, "no")

    def test_skip_states_draft_to_approve(self):
        with pytest.raises(IllegalTransitionError):
            transition("DRAFT", "approve", "REVIEWER", False)

    def test_unknown_action(self):
        with pytest.raises(IllegalTransitionError):
            transition("DRAFT", "unknown", "APPLICANT", True)
