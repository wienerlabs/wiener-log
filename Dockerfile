FROM rust:1.95-bookworm AS builder
WORKDIR /work
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY rust-toolchain.toml rustfmt.toml clippy.toml Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY migrations ./migrations
RUN cargo build --release --bin wlog --bin wlog-web --locked

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        tini \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /work/target/release/wlog /usr/local/bin/wlog
COPY --from=builder /work/target/release/wlog-web /usr/local/bin/wlog-web
COPY infra/railway/entrypoint.sh /usr/local/bin/wlog-entrypoint
RUN chmod +x /usr/local/bin/wlog-entrypoint
WORKDIR /opt/wlog
ENV PATH=/usr/local/bin:$PATH
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/usr/local/bin/wlog-entrypoint"]
