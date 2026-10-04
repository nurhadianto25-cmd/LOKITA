# LOKITA — Data Inventory (keep in sync with code & Data Safety form)

| Data | Source | Purpose | Required? | Stored? | Shared? | Third party | Retention | Deletion | Encryption | Access role |
|------|--------|---------|-----------|---------|---------|-------------|-----------|----------|------------|-------------|
| Phone number | User input | Auth / account identity | Required | Yes (users) | No | No | While account active | Anonymized on delete | TLS in transit | self; platform ops |
| PIN | User input | Auth | Required | Hash only (bcrypt) | No | No | While active | Cleared on delete | bcrypt hash | self (verify only) |
| OTP challenge | Generated | Verify phone | Required | Hashed, TTL | No | No | 5 min TTL | Auto-expire | sha256 | system |
| Name | User input | Display | Required | Yes | To order counterparties | No | While active | Anonymized | TLS | self; counterparties |
| Address | User input | Delivery | Optional | Yes | To seller on order | No | While active | Removed on delete | TLS | self; order seller |
| Session/device | Auto | Session mgmt/security | Required | Yes | No | No | 30 days / until revoke | Revoked on delete | TLS | self; platform ops |
| Product/store photos | Upload | Catalog | Optional | Object storage | Public within community | Emergent Object Storage | While product active | Soft-delete | TLS | authed users |
| QRIS image | Seller upload | Payment | Optional | Object storage | To buyers on order | Emergent Object Storage | While active | Soft-delete | TLS | buyers of store |
| Proof-of-delivery photos | Seller capture | Delivery evidence (titip) | Conditional | Object storage (private) | Order participants only | Emergent Object Storage | With order record | Per retention | TLS, access-controlled | order participants; platform ops |
| Chat messages/photos | User | Order comms | Optional | Yes / object storage | Order participants only | Emergent Object Storage | With order | Per retention | TLS | order participants |
| Order & payment data | System | Transaction core | Required | Yes | Between buyer & seller | No | Retained (legal) after delete, de-identified | De-identified | TLS | participants; platform ops |
| Ratings | User | Trust | Optional | Yes | Aggregated to store | No | Retained | With account anon | TLS | public aggregate |
| Reports | User | Moderation | Optional | Yes | Platform ops | No | Retained | — | TLS | platform ops |
| Audit logs | System | Security/governance | Required | Yes | No | No | Retained | Protected | TLS | platform ops |
| Notifications | System | Alerts | Required | Yes | No | No | Rolling | With account | TLS | self |

**Camera/Location permissions:** Camera used only on explicit photo capture. Location is **not** collected in this version (no GPS metadata yet — planned for proof-of-delivery; update this table and Data Safety when added).

**No advertising / analytics SDKs** integrated in this version. Add rows before introducing any.
