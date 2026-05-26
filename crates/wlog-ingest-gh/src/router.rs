//! Axum router for the webhook receiver.
//!
//! The router has one route, `POST /webhook`, which:
//!
//! - Verifies the HMAC signature against the workspace secret.
//! - Drops duplicate deliveries via the replay cache.
//! - Parses the well-known event kinds.
//! - Hands the parsed [`GhEvent`] to the configured [`EventSink`].
//!
//! The sink is an async trait so the wlog daemon can plug its own
//! `PayloadSink::accept_gh` in without dragging async-nats into this
//! crate.

use std::sync::Arc;

use async_trait::async_trait;
use axum::Router;
use axum::body::{Body, Bytes};
use axum::extract::{Request, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::post;
use tokio::net::TcpListener;

use crate::event::{GhEvent, GhEventKind};
use crate::hmac::verify_signature;
use crate::replay::ReplayCache;

/// Anything the router can hand a parsed event to.
#[async_trait]
pub trait EventSink: Send + Sync {
    /// Accept one verified, parsed event. Returning `Err` causes a 500
    /// response; the daemon then logs the failure and waits for GitHub
    /// to retry (most webhook senders honour at-least-once).
    async fn accept_gh(&self, event: GhEvent) -> Result<(), String>;
}

/// State shared across requests.
pub struct RouterState {
    /// HMAC secret. Loaded from `WLOG_GH_WEBHOOK_SECRET` (or a
    /// per-workspace env var) at daemon startup.
    pub secret: Vec<u8>,
    /// In-memory replay-protection cache.
    pub replay: ReplayCache,
    /// Sink the router publishes accepted events into.
    pub sink: Arc<dyn EventSink>,
}

impl std::fmt::Debug for RouterState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RouterState")
            .field("secret_len", &self.secret.len())
            .field("replay", &self.replay)
            .finish_non_exhaustive()
    }
}

/// Build the Axum router with `/webhook` registered.
pub fn build_router(state: Arc<RouterState>) -> Router {
    Router::new()
        .route("/webhook", post(handle_webhook))
        .with_state(state)
}

/// Bind a TCP listener and serve the router until `shutdown` resolves.
pub async fn serve(
    listener: TcpListener,
    state: Arc<RouterState>,
    shutdown: impl std::future::Future<Output = ()> + Send + 'static,
) -> Result<(), std::io::Error> {
    let app = build_router(state);
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown)
        .await
}

async fn handle_webhook(
    State(state): State<Arc<RouterState>>,
    request: Request<Body>,
) -> impl IntoResponse {
    let (parts, body) = request.into_parts();
    let bytes = match read_body(body).await {
        Ok(b) => b,
        Err(e) => {
            tracing::warn!(error = %e, "failed to buffer webhook body");
            return StatusCode::BAD_REQUEST.into_response();
        }
    };

    // Verify signature.
    let sig_header = parts
        .headers
        .get("x-hub-signature-256")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if let Err(e) = verify_signature(&state.secret, sig_header, &bytes) {
        tracing::warn!(error = %e, "webhook signature verification failed");
        return StatusCode::UNAUTHORIZED.into_response();
    }

    // Required headers.
    let Some(event_header) = str_header(&parts.headers, "x-github-event") else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    let Some(delivery_id) = str_header(&parts.headers, "x-github-delivery") else {
        return StatusCode::BAD_REQUEST.into_response();
    };

    // Replay protection.
    if state.replay.check_and_insert(&delivery_id) {
        tracing::info!(%delivery_id, "duplicate delivery dropped");
        return StatusCode::OK.into_response();
    }

    // Only process the mandate-fixed kinds; other kinds get 202 so the
    // sender does not retry.
    let Some(kind) = GhEventKind::parse(&event_header) else {
        tracing::debug!(event = %event_header, "ignoring unsupported event kind");
        return StatusCode::ACCEPTED.into_response();
    };

    let payload: serde_json::Value = match serde_json::from_slice(&bytes) {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!(error = %e, "webhook body is not valid JSON");
            return StatusCode::BAD_REQUEST.into_response();
        }
    };

    let action = payload
        .get("action")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let repository = payload
        .get("repository")
        .and_then(|v| v.get("full_name"))
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let sender = payload
        .get("sender")
        .and_then(|v| v.get("login"))
        .and_then(|v| v.as_str())
        .map(str::to_string);

    let event = GhEvent {
        kind,
        action,
        repository,
        sender,
        delivery_id,
        body: payload,
    };

    match state.sink.accept_gh(event).await {
        Ok(()) => StatusCode::OK.into_response(),
        Err(e) => {
            tracing::warn!(error = %e, "sink rejected gh event");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

fn str_header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string)
}

async fn read_body(body: Body) -> Result<Bytes, axum::Error> {
    axum::body::to_bytes(body, 5 * 1024 * 1024).await
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use axum::body::Body;
    use axum::http::{Request, header};
    use tower::ServiceExt;

    use super::*;
    use crate::hmac::sign;

    #[derive(Default)]
    struct CollectingSink {
        events: Mutex<Vec<GhEvent>>,
    }

    #[async_trait]
    impl EventSink for CollectingSink {
        async fn accept_gh(&self, event: GhEvent) -> Result<(), String> {
            self.events.lock().unwrap().push(event);
            Ok(())
        }
    }

    fn router_with_sink(secret: &[u8]) -> (Router, Arc<CollectingSink>) {
        let sink: Arc<CollectingSink> = Arc::new(CollectingSink::default());
        let state = Arc::new(RouterState {
            secret: secret.to_vec(),
            replay: ReplayCache::new(64),
            sink: sink.clone(),
        });
        (build_router(state), sink)
    }

    fn build_post(
        secret: &[u8],
        delivery: &str,
        event: &str,
        body: &serde_json::Value,
    ) -> Request<Body> {
        let bytes = serde_json::to_vec(body).unwrap();
        let signature = sign(secret, &bytes);
        Request::post("/webhook")
            .header("x-github-event", event)
            .header("x-github-delivery", delivery)
            .header("x-hub-signature-256", signature)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(bytes))
            .unwrap()
    }

    #[tokio::test]
    async fn well_formed_pr_event_is_published() {
        let secret = b"shh";
        let (router, sink) = router_with_sink(secret);
        let body = serde_json::json!({
            "action": "opened",
            "repository": { "full_name": "wienerlabs/test" },
            "sender": { "login": "kh0ra" }
        });
        let resp = router
            .oneshot(build_post(secret, "d1", "pull_request", &body))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let events = sink.events.lock().unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].subject_suffix(), "pr.opened");
        assert_eq!(events[0].repository.as_deref(), Some("wienerlabs/test"));
    }

    #[tokio::test]
    async fn duplicate_delivery_is_dropped() {
        let secret = b"shh";
        let (router, sink) = router_with_sink(secret);
        let body = serde_json::json!({"action":"opened"});
        let r1 = router
            .clone()
            .oneshot(build_post(secret, "dup", "pull_request", &body))
            .await
            .unwrap();
        assert_eq!(r1.status(), StatusCode::OK);
        let r2 = router
            .oneshot(build_post(secret, "dup", "pull_request", &body))
            .await
            .unwrap();
        assert_eq!(r2.status(), StatusCode::OK);
        // Only the first one made it to the sink.
        assert_eq!(sink.events.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn unsupported_event_kind_returns_202() {
        let secret = b"shh";
        let (router, sink) = router_with_sink(secret);
        let resp = router
            .oneshot(build_post(secret, "d2", "ping", &serde_json::json!({})))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::ACCEPTED);
        assert!(sink.events.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn bad_signature_returns_401() {
        let (router, _sink) = router_with_sink(b"correct");
        // Sign with a wrong secret.
        let req = build_post(
            b"wrong",
            "d3",
            "issues",
            &serde_json::json!({"action":"opened"}),
        );
        let resp = router.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }
}
