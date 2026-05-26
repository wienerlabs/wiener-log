//! HMAC verification for the `X-Hub-Signature-256` header.
//!
//! GitHub sends `sha256=<hex>`. We compute HMAC-SHA256(secret, body)
//! and compare in constant time. The verifier owns no state; callers
//! supply the workspace secret per-request.

use hmac::digest::KeyInit;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use thiserror::Error;

type HmacSha256 = Hmac<Sha256>;

/// Errors raised by the verifier.
#[derive(Debug, Error)]
pub enum VerifyError {
    /// Signature header missing or malformed.
    #[error("bad signature header")]
    BadHeader,
    /// Signature did not match the expected HMAC.
    #[error("signature mismatch")]
    Mismatch,
}

/// Verify `signature_header` (`sha256=<hex>`) against `body` using
/// `secret`. Constant-time comparison.
pub fn verify_signature(
    secret: &[u8],
    signature_header: &str,
    body: &[u8],
) -> Result<(), VerifyError> {
    let hex_part = signature_header
        .strip_prefix("sha256=")
        .ok_or(VerifyError::BadHeader)?;
    let provided = hex::decode(hex_part).map_err(|_| VerifyError::BadHeader)?;
    let mut mac = HmacSha256::new_from_slice(secret).map_err(|_| VerifyError::BadHeader)?;
    mac.update(body);
    mac.verify_slice(&provided)
        .map_err(|_| VerifyError::Mismatch)
}

/// Convenience: render the `sha256=<hex>` header for a given body.
/// Used by integration tests that need to sign their own payloads.
pub fn sign(secret: &[u8], body: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(secret).expect("hmac key");
    mac.update(body);
    let sig = mac.finalize().into_bytes();
    format!("sha256={}", hex::encode(sig))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_matches() {
        let secret = b"topsecret";
        let body = b"{\"hello\":\"world\"}";
        let header = sign(secret, body);
        verify_signature(secret, &header, body).expect("verify");
    }

    #[test]
    fn wrong_body_fails() {
        let secret = b"topsecret";
        let header = sign(secret, b"original");
        let err = verify_signature(secret, &header, b"tampered").unwrap_err();
        assert!(matches!(err, VerifyError::Mismatch));
    }

    #[test]
    fn wrong_secret_fails() {
        let header = sign(b"a", b"body");
        let err = verify_signature(b"b", &header, b"body").unwrap_err();
        assert!(matches!(err, VerifyError::Mismatch));
    }

    #[test]
    fn missing_prefix_fails() {
        let err = verify_signature(b"k", "deadbeef", b"body").unwrap_err();
        assert!(matches!(err, VerifyError::BadHeader));
    }
}
