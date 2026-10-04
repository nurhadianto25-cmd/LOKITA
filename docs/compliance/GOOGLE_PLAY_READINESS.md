# LOKITA — Google Play Readiness (living checklist)

LOKITA is built as an Expo (React Native) app, so it packages to an Android App Bundle (.aab) and releases through Google Play via the Emergent **Publish** flow (no EAS CLI). Re-verify current Play policies at actual release time.

## Target API / build
- [ ] targetSdk ≥ Google Play requirement at release date (Android 16 / API 36+ for submissions from 31 Aug 2026). Managed by Emergent build; confirm in Publish flow.
- [ ] Release (not debug) build; AAB artifact; Google Play App Signing. (Emergent-managed.)
- [ ] versionCode increments each release; versionName controlled.
- [x] Stable application id present (`com.emergent.structuredorders.kmll9t`) — **PO must confirm/replace final id (e.g. com.lokita.app) before first publish.**
- [x] No secrets in repo (JWT secret, EMERGENT_LLM_KEY in backend/.env only; not in EXPO_PUBLIC_*).
- [ ] ENV=production in backend secrets before release (disables dev_otp).

## Account deletion (mandatory)
- [x] In-app deletion: Akun → Hapus Akun (PIN confirm, anonymize identity, revoke sessions, block when active orders).
- [ ] External public web deletion resource at a real URL (placeholder referenced: https://lokita.app/hapus-akun — PO to host).

## Privacy & Data Safety
- [x] Privacy Policy inside app (Akun → Kebijakan Privasi), consistent with implementation.
- [ ] Publicly accessible Privacy Policy URL linked in Play Console (host the same content).
- [ ] Data Safety form completed from /docs/compliance/DATA_INVENTORY.md.

## Permissions (minimum necessary, contextual)
- [x] CAMERA + photo library — requested only when capturing product/proof photos; graceful denial + Open Settings fallback.
- [x] No background location, no unused permissions declared.
- [ ] POST_NOTIFICATIONS — only when push is added (deferred).

## Content & UGC
- [x] UGC = product/store text & photos, chat, ratings. Reporting endpoint implemented (/api/reports).
- [ ] Moderation action flows (warn/restrict/freeze) + appeal UI for Platform Ops.
- [ ] Content Rating questionnaire in Play Console.

## Store listing
- [ ] App name, short/full description, icon, feature graphic, screenshots, category, support contact. Official master LOGO asset to be supplied by PO (current UI uses an explicit placeholder wordmark).

## Quality
- [x] No crashes/ANR in smoke; error boundary present; offline/error states handled.
- [ ] Device matrix (low/mid/modern Android), permission ALLOW/DENY/revoke tests, Android Vitals monitoring post-launch.

## Release gate reminder
Do not declare "READY FOR GOOGLE PLAY" until every box above + payment/QRIS→COD/titip/account-deletion E2E are green on a release build.
