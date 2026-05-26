//! Configurable canned-response client for tests and `wlog daily --dry-run`.

use std::collections::VecDeque;
use std::sync::Mutex;

use async_trait::async_trait;

use super::{CompletionRequest, CompletionResponse, LlmClient, LlmError, StopReason, Usage};

/// A mock that replays a queue of pre-recorded responses. Each call to
/// [`MockLlmClient::complete`] pops the front of the queue.
///
/// When the queue is empty, [`MockLlmClient::default_response`] is
/// returned so test fixtures can run loose loops without setting up
/// every call.
pub struct MockLlmClient {
    queue: Mutex<VecDeque<CompletionResponse>>,
    default: CompletionResponse,
    invocations: Mutex<Vec<CompletionRequest>>,
}

impl std::fmt::Debug for MockLlmClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let queue_len = self.queue.lock().map_or(0, |q| q.len());
        f.debug_struct("MockLlmClient")
            .field("queue_len", &queue_len)
            .finish_non_exhaustive()
    }
}

impl Default for MockLlmClient {
    fn default() -> Self {
        Self::new(default_response())
    }
}

fn default_response() -> CompletionResponse {
    CompletionResponse {
        content: "(mock completion)".to_string(),
        stop_reason: StopReason::EndTurn,
        usage: Usage {
            model: "mock-model".to_string(),
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
        },
    }
}

impl MockLlmClient {
    /// Construct a mock with the given default response.
    pub fn new(default: CompletionResponse) -> Self {
        Self {
            queue: Mutex::new(VecDeque::new()),
            default,
            invocations: Mutex::new(Vec::new()),
        }
    }

    /// Push one response onto the back of the queue.
    pub fn enqueue(&self, response: CompletionResponse) {
        self.queue.lock().expect("poisoned").push_back(response);
    }

    /// Read the requests this mock has received, in order.
    pub fn invocations(&self) -> Vec<CompletionRequest> {
        self.invocations.lock().expect("poisoned").clone()
    }
}

#[async_trait]
impl LlmClient for MockLlmClient {
    fn name(&self) -> &'static str {
        "mock"
    }

    async fn complete(&self, request: CompletionRequest) -> Result<CompletionResponse, LlmError> {
        self.invocations
            .lock()
            .expect("poisoned")
            .push(request.clone());
        Ok(self
            .queue
            .lock()
            .expect("poisoned")
            .pop_front()
            .unwrap_or_else(|| self.default.clone()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::{Message, Role};

    fn req() -> CompletionRequest {
        CompletionRequest {
            model: "mock".to_string(),
            system: None,
            cache_system: false,
            messages: vec![Message {
                role: Role::User,
                content: "ping".into(),
                cache: false,
            }],
            max_tokens: 10,
            temperature: None,
        }
    }

    #[tokio::test]
    async fn default_response_is_returned_when_queue_empty() {
        let client = MockLlmClient::default();
        let resp = client.complete(req()).await.unwrap();
        assert_eq!(resp.content, "(mock completion)");
        assert_eq!(client.invocations().len(), 1);
    }

    #[tokio::test]
    async fn queued_response_is_consumed_in_order() {
        let client = MockLlmClient::default();
        client.enqueue(CompletionResponse {
            content: "first".into(),
            stop_reason: StopReason::EndTurn,
            usage: Usage::default(),
        });
        client.enqueue(CompletionResponse {
            content: "second".into(),
            stop_reason: StopReason::EndTurn,
            usage: Usage::default(),
        });
        assert_eq!(client.complete(req()).await.unwrap().content, "first");
        assert_eq!(client.complete(req()).await.unwrap().content, "second");
        // Third call falls through to default.
        assert_eq!(
            client.complete(req()).await.unwrap().content,
            "(mock completion)"
        );
    }
}
