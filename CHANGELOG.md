# Changelog

## 1.4.0 — forwarder quotes: validation, lane median, like-for-like benchmark · phase 2 (part A)
- Quote form «ثبت پیشنهاد برای مقایسه» adds: valid-until date, WRS stated in the quote, transit days and «شامل THC مبدأ».
  Rate-bank sea rates bring their own `to` (validity) and `tt` (transit time).
- Like-for-like benchmark: the Iran market estimate excludes origin THC unless the quote includes it.
- Automatic checks per quote (column «کنترل‌ها»): expired validity · older than 14 days without validity · WRS above the
  Iranian cap notice · 40'/20' ratio outside 1.2–2.0 for the same vendor and lane · reefer cheaper than dry · below market (< −15 %).
- New card «میانهٔ پیشنهادهای معتبر به تفکیک مسیر»: count, min, median, max, spread and today's market benchmark per
  UN/LOCODE lane and container; flagged when fewer than 3 live quotes. KPI «نیازمند بررسی» replaces «زیر بازار».
- CSV export adds lane, validity, transit, THC scope, WRS and checks.
- `IFA.market.quotes()` and `IFA.market.laneStats()`; `benchmark()` returns `lane` and `checks`.
- e2e test for the checks, lane median and THC scope.

## 1.3.1 — Incoterms, UN/LOCODE lanes, per-port origin THC · phase 1 (part B)
- New selector «شرط تحویل خرید (Incoterms 2020)»: EXW · FCA · FOB · CFR · CIF. Every line is grouped (origin / freight / insurance)
  and marked buyer or seller; seller-paid lines stay visible with «در قیمت فروشنده». New KPI «سهم خریدار تا مرز».
- CIF at the border follows the invoice term: CIF invoice → value is CIF (no insurance line); otherwise value + buyer-paid lines, grossed up for 110 % insurance.
- Lane shown as UN/LOCODE path, e.g. `CNSHA→AEJEA→IRBND` (transhipment) or `CNNGB→IRBND` (direct).
- Origin THC is stored **per origin port** (`thcPol`), the form labels it with the port name.
- `IFA.market.estimate()` adds `lane`, `incoterm`, `buyerShare` and per-line `group` / `payer`; `params.inc` and `params.thcPol` accepted.
- e2e test for Incoterm splits, lanes and per-port THC.

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
