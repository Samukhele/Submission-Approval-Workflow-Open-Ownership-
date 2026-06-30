class StateMachineError(Exception):
    def __init__(self, message: str, code: str, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}


class ForbiddenTransitionError(StateMachineError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, "FORBIDDEN_TRANSITION", details)


class IllegalTransitionError(StateMachineError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, "ILLEGAL_TRANSITION", details)


class CommentRequiredError(StateMachineError):
    def __init__(self, message: str = "Comment is required for this action"):
        super().__init__(message, "COMMENT_REQUIRED")


TRANSITIONS: dict[tuple[str, str], str] = {
    ("DRAFT", "submit"): "SUBMITTED",
    ("SUBMITTED", "start_review"): "UNDER_REVIEW",
    ("SUBMITTED", "approve"): "APPROVED",
    ("SUBMITTED", "reject"): "REJECTED",
    ("SUBMITTED", "return"): "DRAFT",
    ("UNDER_REVIEW", "approve"): "APPROVED",
    ("UNDER_REVIEW", "reject"): "REJECTED",
    ("UNDER_REVIEW", "return"): "DRAFT",
}

REVIEWER_ACTIONS = {"start_review", "approve", "reject", "return"}
APPLICANT_ACTIONS = {"submit"}
COMMENT_REQUIRED_ACTIONS = {"reject", "return"}
TERMINAL_STATUSES = {"APPROVED", "REJECTED"}


def transition(
    current_status: str,
    action: str,
    role: str,
    is_owner: bool,
    comment: str | None = None,
) -> str:
    if current_status in TERMINAL_STATUSES:
        raise IllegalTransitionError(
            f"Cannot transition from terminal status {current_status}",
            details={"from": current_status, "action": action},
        )

    if action in APPLICANT_ACTIONS:
        if role != "APPLICANT":
            raise ForbiddenTransitionError(
                "Only applicants can submit applications",
                details={"action": action, "role": role},
            )
        if not is_owner:
            raise ForbiddenTransitionError(
                "Only the application owner can submit",
                details={"action": action},
            )
    elif action in REVIEWER_ACTIONS:
        if role != "REVIEWER":
            raise ForbiddenTransitionError(
                "Only reviewers can perform review actions",
                details={"action": action, "role": role},
            )
    else:
        raise IllegalTransitionError(
            f"Unknown action: {action}",
            details={"action": action},
        )

    if action in COMMENT_REQUIRED_ACTIONS and not (comment and comment.strip()):
        raise CommentRequiredError()

    key = (current_status, action)
    new_status = TRANSITIONS.get(key)
    if not new_status:
        raise IllegalTransitionError(
            f"Transition {current_status} -> ({action}) is not allowed",
            details={"from": current_status, "action": action},
        )

    return new_status
