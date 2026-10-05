# Changelog

## 1.2.0 — repository release
- The single-file app (`asana-logistics-v20`) is now built reproducibly from `app/` with a **UI fingerprint** (`app/UI_SHA256`) that guarantees the interface is byte-identical to the original design.
- The in-app “download server.js / README” buttons now always embed the server from this repository (injected at build time).
- Team server 1.2.0:
  - app delivered with ETag/304 and brotli/gzip compression (≈9 MB → ≈4.5 MB on the wire), computed asynchronously and cached;
  - `trustProxy` option — `X-Forwarded-For` is no longer trusted by default, so the login lock-out cannot be bypassed by spoofing the header;
  - automatic discovery of `dist/index.html`; graceful shutdown on SIGTERM/SIGINT (Docker/systemd); periodic cleanup of the login-failure table;
  - new environment variables: `IFA_APP_FILE`, `IFA_CORS`, `IFA_TRUST_PROXY`, `IFA_TOKEN_HOURS`, `IFA_MAX_UPLOAD_MB`, `IFA_WEBHOOK_URL`, `IFA_WEBHOOK_SECRET`.
- Dockerfile, docker-compose (with optional Caddy HTTPS), nginx and systemd examples.
- Automated tests: API/integration, security, build/delivery, and a browser end-to-end test (real app ↔ real server two-way sync); GitHub Actions CI.

## 1.1.0 (app v20)
- Original release embedded in the app: market-data collectors, roles, audit chain, archive, notifications, portal, DCSA, Moadian.
