//! GitHub event types we accept on the webhook route.
//!
//! The set is the mandate-fixed list: `pull_request`,
//! `pull_request_review`, `issues`, `issue_comment`, `workflow_run`,
//! `push`. Anything else returns HTTP 202 without publishing so GitHub
//! does not retry; tracking the discarded kind in logs is enough.

use serde::{Deserialize, Serialize};

/// Wire-format kind used in the NATS subject suffix.
///
/// Values map to the `X-GitHub-Event` header. The `action` inside the
/// payload further qualifies the kind (e.g. `pull_request.opened`); see
/// [`GhEvent::subject_kind`] for how the daemon assembles the leaf.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GhEventKind {
    /// `pull_request`
    PullRequest,
    /// `pull_request_review`
    PullRequestReview,
    /// `issues`
    Issue,
    /// `issue_comment`
    IssueComment,
    /// `workflow_run`
    WorkflowRun,
    /// `push`
    Push,
}

impl GhEventKind {
    /// Parse the `X-GitHub-Event` header value.
    pub fn parse(header: &str) -> Option<Self> {
        Some(match header {
            "pull_request" => Self::PullRequest,
            "pull_request_review" => Self::PullRequestReview,
            "issues" => Self::Issue,
            "issue_comment" => Self::IssueComment,
            "workflow_run" => Self::WorkflowRun,
            "push" => Self::Push,
            _ => return None,
        })
    }

    /// Top-level wire string ahead of the action discriminator.
    pub const fn wire(self) -> &'static str {
        match self {
            Self::PullRequest => "pr",
            Self::PullRequestReview => "pr_review",
            Self::Issue => "issue",
            Self::IssueComment => "issue_comment",
            Self::WorkflowRun => "workflow",
            Self::Push => "push",
        }
    }
}

/// One accepted webhook delivery; the body field is the parsed JSON
/// kept verbatim so the engine can re-extract whatever fields it wants
/// later. The `subject_suffix` is the canonical leaf for ADR-0007
/// subjects (e.g. `pr.opened`, `workflow.completed`, `push`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GhEvent {
    /// Top-level kind.
    pub kind: GhEventKind,
    /// Action discriminator extracted from the payload (`opened`,
    /// `closed`, `completed`, ...). `None` for `push` events.
    pub action: Option<String>,
    /// Repository full name (`owner/repo`).
    pub repository: Option<String>,
    /// Sender login.
    pub sender: Option<String>,
    /// GitHub delivery UUID (`X-GitHub-Delivery`).
    pub delivery_id: String,
    /// Raw event body.
    pub body: serde_json::Value,
}

impl GhEvent {
    /// Subject leaf used downstream: `pr.opened`, `push`, ...
    pub fn subject_suffix(&self) -> String {
        match (&self.kind, self.action.as_deref()) {
            (kind, None) => kind.wire().to_string(),
            (kind, Some(action)) => format!("{}.{action}", kind.wire()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_known_kinds() {
        assert_eq!(
            GhEventKind::parse("pull_request"),
            Some(GhEventKind::PullRequest)
        );
        assert_eq!(GhEventKind::parse("issues"), Some(GhEventKind::Issue));
        assert_eq!(
            GhEventKind::parse("workflow_run"),
            Some(GhEventKind::WorkflowRun)
        );
        assert_eq!(GhEventKind::parse("ping"), None);
    }

    #[test]
    fn subject_leaf_includes_action_when_present() {
        let event = GhEvent {
            kind: GhEventKind::PullRequest,
            action: Some("opened".to_string()),
            repository: None,
            sender: None,
            delivery_id: "1".into(),
            body: serde_json::json!({}),
        };
        assert_eq!(event.subject_suffix(), "pr.opened");

        let event = GhEvent {
            kind: GhEventKind::Push,
            action: None,
            repository: None,
            sender: None,
            delivery_id: "1".into(),
            body: serde_json::json!({}),
        };
        assert_eq!(event.subject_suffix(), "push");
    }
}
