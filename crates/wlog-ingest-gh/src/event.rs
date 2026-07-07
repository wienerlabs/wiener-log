//! GitHub event types we accept on the webhook route.
//!
//! The core set is the mandate-fixed list: `pull_request`,
//! `pull_request_review`, `issues`, `issue_comment`, `workflow_run`,
//! `push`. Org integration adds the lifecycle kinds: `member`,
//! `organization`, `repository`, `release`. Anything else returns
//! HTTP 202 without publishing so GitHub does not retry; tracking the
//! discarded kind in logs is enough.

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
    /// `member` (collaborator added / removed / permission edited)
    Member,
    /// `organization` (member_added, member_removed, member_invited)
    Organization,
    /// `repository` (created, deleted, archived, renamed, ...)
    Repository,
    /// `release` (published, edited, ...)
    Release,
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
            "member" => Self::Member,
            "organization" => Self::Organization,
            "repository" => Self::Repository,
            "release" => Self::Release,
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
            Self::Member => "member",
            Self::Organization => "org",
            Self::Repository => "repo",
            Self::Release => "release",
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

    /// True when the delivery was produced by Dependabot. The engine
    /// uses this to route dependency-bump PRs into the automated-PR
    /// lane instead of the human task synthesis lane.
    pub fn is_dependabot(&self) -> bool {
        matches!(
            self.sender.as_deref(),
            Some("dependabot[bot]") | Some("dependabot-preview[bot]")
        )
    }

    /// True when the delivery was produced by any `[bot]` account
    /// (Dependabot, GitHub Actions, Renovate, ...).
    pub fn is_bot(&self) -> bool {
        self.sender.as_deref().is_some_and(|s| s.ends_with("[bot]"))
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
        assert_eq!(GhEventKind::parse("member"), Some(GhEventKind::Member));
        assert_eq!(
            GhEventKind::parse("organization"),
            Some(GhEventKind::Organization)
        );
        assert_eq!(
            GhEventKind::parse("repository"),
            Some(GhEventKind::Repository)
        );
        assert_eq!(GhEventKind::parse("release"), Some(GhEventKind::Release));
        assert_eq!(GhEventKind::parse("ping"), None);
    }

    #[test]
    fn org_lifecycle_subject_suffixes() {
        let event = GhEvent {
            kind: GhEventKind::Organization,
            action: Some("member_added".to_string()),
            repository: None,
            sender: None,
            delivery_id: "1".into(),
            body: serde_json::json!({}),
        };
        assert_eq!(event.subject_suffix(), "org.member_added");

        let event = GhEvent {
            kind: GhEventKind::Repository,
            action: Some("created".to_string()),
            repository: Some("wienerlabs/new-repo".into()),
            sender: None,
            delivery_id: "2".into(),
            body: serde_json::json!({}),
        };
        assert_eq!(event.subject_suffix(), "repo.created");
    }

    #[test]
    fn dependabot_detection() {
        let mut event = GhEvent {
            kind: GhEventKind::PullRequest,
            action: Some("opened".to_string()),
            repository: Some("wienerlabs/wienerlog".into()),
            sender: Some("dependabot[bot]".into()),
            delivery_id: "3".into(),
            body: serde_json::json!({}),
        };
        assert!(event.is_dependabot());
        assert!(event.is_bot());

        event.sender = Some("kh0ra".into());
        assert!(!event.is_dependabot());
        assert!(!event.is_bot());

        event.sender = Some("github-actions[bot]".into());
        assert!(!event.is_dependabot());
        assert!(event.is_bot());
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
