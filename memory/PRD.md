# LOKITA — Product Requirements & Build Log

## Original problem statement
LOKITA v2.0: community-based local marketplace (Indonesia) connecting residents with local sellers via permanent digital stores, product catalog, structured orders, flexible delivery, COD/QRIS, order-linked chat, proof of delivery, trust/reliability, moderation, and community administration. Tagline: "Your Community. Your Market." Must be Android/Google-Play ready. All business rules LOCKED.

> Note: Spec named a PWA/NestJS/PostgreSQL stack. This implementation uses the Emergent-native **Expo (React Native) + FastAPI + MongoDB** stack (purpose-built for Android/Google Play). All LOCKED business rules are preserved; only the underlying tech stack differs.

## Architecture
- **Frontend**: Expo Router, React Query, green/orange theme (`src/theme.ts`), Bahasa Indonesia UI, 4 bottom tabs (Beranda/Pesanan/Chat/Akun).
- **Backend**: FastAPI modular routers (auth, communities, sellers, marketplace, orders, chat, misc/admin) on `core.py` (Motor/MongoDB, JWT, bcrypt PIN, RBAC, object storage). Server-time authority; background sweep auto-cancels unconfirmed orders.
- **Storage**: Emergent Object Storage for product/store/QRIS (readable) and private proof/chat photos (participant-only download).
- **Auth**: phone + mock OTP (dev auto-fill) + 6-digit PIN, device sessions.

## User personas
- Buyer (warga): browse community stores, order, pay COD/QRIS, chat, confirm delivery, rate.
- Seller (one account, is_seller flag): permanent store, catalog/stock, order management, titip proof, payment verify.
- Community Owner/Admin: owns/joins communities (governance deferred to platform gate).
- Platform Super Admin / Ops: metrics dashboard, reports, RBAC.

## Core (static) requirements — LOCKED
One account dual-role · community data isolation · permanent store (visible when closed, no ordering) · product lifecycle (AVAILABLE/LIMITED/SOLD_OUT/INACTIVE) · cart grouped per store · global unique Order ID · 8-state order machine · 5-min seller confirm / 1-min buyer cancel / 5-min auto-cancel (server time) · reject only "Produk Habis" + recommendations · delivery modes A/B · Titip = permission + 2 proof photos · COD + QRIS + QRIS→COD recovery (same order) · order-linked chat view-only on SELESAI · two-way rating + reliability foundation · reports/moderation · RBAC + audit · in-app + external account deletion.

## Implemented (2026-06) — v1 MVP, end-to-end verified (27/27 backend + FE smoke)
- Auth (OTP/PIN/JWT/sessions), community join/switch/isolation, seed pilot community (code LOKITA) + admin + demo seller "Warung Bu Sri".
- Seller store CRUD + open/close + QRIS/logo/cover upload; product CRUD + stock/variants/addons.
- Marketplace browse/search/categories, per-store cart, checkout.
- Order engine with server-time timers, full state machine, seller reject + recommendations, stock reservation/restore, auto-cancel sweep.
- Delivery modes, Titip di Rumah with 2-photo proof capture (camera/gallery + permission handling).
- Payment COD/QRIS statuses, seller verify, QRIS→COD recovery.
- Order-linked chat (text+photo) view-only on complete; two-way ratings; notifications center + badge.
- Account: profile, sessions revoke, privacy policy, terms, in-app account deletion (anonymize + revoke sessions), reports.
- Admin metrics dashboard (RBAC), audit logging on sensitive actions.
- app.json: name LOKITA, camera/photo permissions + usage strings, image-picker plugin.

## Prioritized backlog
- **P1**: real SMS OTP provider; QRIS payment gateway; delivery GPS metadata on proof; reliability score formula (deferred per spec — needs PO approval); community creation governance/review queue; platform ops moderation actions (warn/restrict/freeze) + dispute/appeal flow UI.
- **P2**: notification push (Emergent push, requires build); seller analytics; richer admin (users/sellers/communities management); KYC-ready scaffolding.
- **P3**: performance (pagination/indexes), observability dashboards, backup/restore runbook; full Google Play release gate (AAB, signing, Data Safety, content rating) — see /docs/compliance.
- **P4 (deferred, feature-flagged off)**: Seller Pro, Ads, additional e-wallets, LOKITA Delivery, multi-community expansion.

## Next tasks
1. Wire real OTP + QRIS gateway when PO provides providers.
2. Build moderation/dispute action flows for Platform Ops.
3. Prepare Google Play release artifacts (deploy → build via Publish).
