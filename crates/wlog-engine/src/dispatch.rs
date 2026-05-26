use wlog_proto::{NodeType, TaskNode};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DispatchClass {
    AgentEligible,
    HumanOnly,
    Ambiguous,
}

pub fn classify(task: &TaskNode) -> DispatchClass {
    let title_lc = task.title.to_lowercase();
    let body_lc = task.body.as_deref().unwrap_or("").to_lowercase();
    let combined = format!("{title_lc} {body_lc}");
    let agent_signals = [
        "rename", "format", "lint", "typo", "comment", "doc", "bump", "upgrade", "fix lint",
        "fix fmt", "import",
    ];
    let human_signals = [
        "decision",
        "design",
        "architecture",
        "discuss",
        "pricing",
        "negotiate",
        "incident",
        "outage",
        "security",
        "vulnerab",
    ];
    let agent_hit = agent_signals.iter().any(|s| combined.contains(*s));
    let human_hit = human_signals.iter().any(|s| combined.contains(*s));
    if human_hit {
        return DispatchClass::HumanOnly;
    }
    if !agent_hit {
        return DispatchClass::HumanOnly;
    }
    match task.node_type {
        NodeType::Decomposition | NodeType::Execution => DispatchClass::AgentEligible,
        _ => DispatchClass::Ambiguous,
    }
}

pub struct DispatchPlan {
    pub task: wlog_proto::TaskId,
    pub class: DispatchClass,
    pub estimated_hours: Option<f64>,
}

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use uuid::Uuid;
    use wlog_proto::{NodeType, TaskId, TaskStatus, WorkspaceId};

    use super::*;

    fn task(title: &str, body: Option<&str>, nt: NodeType) -> TaskNode {
        TaskNode {
            id: TaskId(Uuid::nil()),
            workspace_id: WorkspaceId(Uuid::nil()),
            node_type: nt,
            title: title.into(),
            body: body.map(str::to_string),
            repo: None,
            owner: None,
            status: TaskStatus::Acked,
            embedding_present: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn lint_fix_is_agent_eligible() {
        let t = task("fix lint warnings in cli", None, NodeType::Execution);
        assert_eq!(classify(&t), DispatchClass::AgentEligible);
    }

    #[test]
    fn security_decision_is_human_only() {
        let t = task("decide security policy", None, NodeType::Intent);
        assert_eq!(classify(&t), DispatchClass::HumanOnly);
    }

    #[test]
    fn intent_with_agent_signal_is_ambiguous() {
        let t = task("rename module", None, NodeType::Intent);
        assert_eq!(classify(&t), DispatchClass::Ambiguous);
    }
}
