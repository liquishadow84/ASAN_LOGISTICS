# Changelog

## 1.3.0 — import cost to the Iranian border (USD only) · phase 1
- Market estimator «برآورد نرخ ایران» now covers **only costs up to the Iranian border/port and only in USD**:
  the rial destination-THC line, the rial inputs and the IRR exchange-rate selector were removed from this module.
- War Risk Surcharge is modelled **per container** (20' 1,000 · 40' 2,000 · reefer 3,000 USD) after the cap notice of the
  Shipping Association of Iran / Iranian Shipowners Union (16 Mar 2026); a value above the cap is flagged «بیش از سقف ابلاغی».
  Calibration from real quotes subtracts the same per-container WRS.
- Optional cargo FOB value + cargo/war insurance rates → insurance on 110 % CIF and the **CIF value at the border** (customs basis).
- Every breakdown line carries a source tag: [شاخص] index · [ابلاغیه] notice · [تخمین] estimate · [محاسبه] calculated.
  `IFA.market.estimate()` now returns `currency`, `scope`, `freight`, `cif`, `wrsCap` and a `source` per line (the old `fxRate` is gone).
- Benchmarks against forwarder quotes use the freight-only total (insurance excluded).
- Design guard: `app/DESIGN_SHA256` (template markup + stylesheet) — logic may evolve, the visual design may not.
  `app/UI_SHA256` was intentionally updated for the logic change.

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
