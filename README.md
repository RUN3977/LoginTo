# LoginTo

LoginTo is a local-first account and private information vault for terminal devices:
mobile phones, tablets, desktop computers, and backup devices.

The project direction is intentionally not a cloud password manager and not a Web/PWA
app. The MVP focuses on encrypted local storage, face-to-face device pairing,
near-field sync, local reminders, encrypted attachments, and local OCR-assisted
record creation.

## Product Baseline

- No public cloud login for the MVP.
- No public cloud storage for vault contents or attachments.
- No cloud OCR by default.
- No Web/PWA delivery target.
- Desktop is a local terminal app, planned with Tauri.
- Mobile and tablet are terminal apps, planned with React Native.
- All sensitive records live in local encrypted vaults.
- Device sync happens through QR pairing, local network, hotspot, or encrypted sync packages.

## Current State

This repository is in M1: local vault foundation and terminal sync core.

Implemented so far:

- Product planning document: `docs/LoginTo_MVP与实施规划.docx`
- M0 threat model: `docs/threat-model.md`
- M0 checklist: `docs/m0-checklist.md`
- Terminal-first architecture notes: `docs/architecture.md`
- Monorepo skeleton for desktop, mobile, and shared packages
- Runnable desktop UI shell preview served by `apps/desktop/scripts/dev-server.mjs`
- Desktop shell local app-state API backed by `DesktopRuntime` for records, reminders, notification state, and sync preview
- Core TypeScript contracts for vault, crypto, sync, and OCR workflows
- Reminder notification center for due popup delivery, dedupe, snooze, dismiss, and completion state
- Desktop local runtime-state persistence for reminder notification delivery memory across restarts
- JSON schemas for record templates and vault manifests
- Local contract validation script

## Repository Layout

```text
apps/
  desktop/        Tauri desktop terminal app, planned
  mobile/         React Native mobile/tablet terminal app, planned
packages/
  vault-core/     Vault records, field contracts, templates, schema metadata
  crypto-core/    Crypto interfaces and sensitivity policy contracts
  sync-core/      Device pairing, sync change, conflict contracts
  ocr-core/       Local OCR draft and extraction contracts
  ui/             Shared UI design tokens and component contracts
docs/
  LoginTo_MVP与实施规划.docx
  architecture.md
  m0-checklist.md
  threat-model.md
tools/
  build_planning_doc.py
  validate-contracts.mjs
```

## Local Validation

The current validation and smoke scripts use only Node.js built-ins.

```powershell
node tools\validate-contracts.mjs
node tools\run-all-smoke.mjs
node tools\demo-current-product.mjs
node tools\smoke-vault-core.mjs
```

If the system `node` command is unavailable, use the bundled runtime from Codex:

```powershell
C:\Users\Zhangrunyao\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tools\validate-contracts.mjs
C:\Users\Zhangrunyao\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tools\run-all-smoke.mjs
C:\Users\Zhangrunyao\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tools\demo-current-product.mjs
C:\Users\Zhangrunyao\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tools\smoke-vault-core.mjs
```

## Local Toolchain

This workspace has a project-local toolchain under `.toolchain/`:

- Node.js `v24.16.0`
- npm `11.13.0`
- pnpm `11.5.2`
- rustc `1.96.0`
- cargo `1.96.0`

Use the command wrapper when running tools from PowerShell:

```powershell
tools\with-toolchain.cmd node tools\run-all-smoke.mjs
tools\with-toolchain.cmd pnpm --version
tools\with-toolchain.cmd cargo --version
```

PowerShell may block `.ps1` scripts by policy, so `tools\with-toolchain.cmd` is the safest default entry point.

## Desktop Shell Preview

Run the local desktop UI shell preview:

```powershell
tools\with-toolchain.cmd pnpm desktop:dev
```

For a fixed local preview port, use:

```powershell
$env:LOGINTO_DESKTOP_PORT='4173'
tools\with-toolchain.cmd pnpm desktop:start
```

The server prints a local `http://127.0.0.1:<port>` URL. The preview is local-only and currently serves the desktop UI prototype plus `/api/status`, `/api/app-state`, `/api/reminders/action`, `/api/records`, `/api/fields/reveal`, `/api/pairing/start`, and `/api/pairing/confirm` endpoints. The app-state endpoint creates or loads a local desktop vault snapshot and runtime-state file under `.tmp/` by default.

## Next Build Step

M1 has started with the `vault-core` foundation:

1. Vault manifest creation is implemented.
2. Template-based record drafts are implemented.
3. Draft-to-record creation is implemented through an injected field encryptor.
4. Reminder and attachment metadata helpers are implemented.
5. An in-memory repository is available for early smoke tests.
6. Vault snapshot and storage adapter boundaries are implemented.
7. Record field updates, reminder updates, and attachment association are implemented.
8. Vault package export/restore boundaries are implemented.
9. SQLite schema and executor contract are implemented.
10. Category, tag, and local search-index operations are implemented.
11. Desktop-side file storage adapter is implemented.
12. Desktop vault session service is implemented.
13. SQLite storage adapter against the abstract executor is implemented.
14. Crypto adapter conformance fixture is implemented.
15. Desktop UI view-state model is implemented.
16. Local OCR text classification and record-draft extraction are implemented.
17. Reminder scheduling and alert content rules are implemented.
18. Sync-core pairing, verification, change, and summary helpers are implemented.
19. Sync-core conflict detection, merge planning, and conflict resolution helpers are implemented.
20. Mobile OCR capture workflow service is implemented.
21. Mobile vault view-state model is implemented.
22. Sync change log and trusted-device state helpers are implemented.
23. All-smoke runner is implemented.
24. Sync exchange package helpers are implemented.
25. Sync apply-result helpers and import journal bookkeeping are implemented.
26. Desktop/mobile near-field sync session wrappers are implemented.
27. Near-field endpoint descriptors, request/response wrappers, and a platform-neutral endpoint handler are implemented.
28. Desktop/mobile app endpoint boundaries are implemented for future local-network, hotspot, or Bluetooth transport adapters.
29. Async vault field creation/update helpers are implemented for real platform crypto adapters.
30. Desktop vault sessions and mobile OCR commit flows support async field encryption.
31. WebCrypto AES-GCM field encryption is implemented as a platform fallback, with PBKDF2-SHA-256 KDF support.
32. Encrypted attachment blob packaging is implemented with versioned format, AAD, digest, and decrypt verification.
33. Mobile encrypted capture preparation is implemented for camera/import attachments before OCR commit.
34. Near-field transport adapter contracts and an in-memory transport are implemented for platform transport integration.
35. Desktop localhost HTTP near-field endpoint and transport adapter are implemented with Node built-ins.
36. Desktop LAN base URL candidate discovery is implemented for QR-advertised near-field endpoints.
37. Mobile local-network transport adapter is implemented for sending near-field requests through fetch.
38. Face-to-face pairing workflow is implemented with QR payloads, six-digit verification, expiry, and explicit trust confirmation.
39. Current product demo script is available at `tools/demo-current-product.mjs`.
40. Desktop/mobile runtime controllers are implemented to compose vault, crypto, reminders, pairing, and near-field sync for future app shells.
41. Vault security session is implemented for auto-lock, critical-field second unlock, and clipboard clear planning.
42. Async encrypted vault package export/restore is implemented and wired into desktop runtime backup restore.
43. Reminder notification center is implemented and wired into desktop/mobile runtimes for popup delivery, dedupe, snooze, dismiss, and completion state.
44. Desktop runtime-state persistence is implemented so delivered reminder notifications are not repeated after app restart.
45. Runnable desktop UI shell preview is implemented with a local Node server and smoke-tested status endpoint.
46. Desktop shell now loads records, reminder modal state, and sync preview data from a local `/api/app-state` endpoint backed by `DesktopRuntime`.
47. Desktop shell reminder popup actions now call local `/api/reminders/action` and persist completed/snoozed state through `DesktopRuntime`.
48. Desktop shell new-record action now calls local `/api/records` and persists an encrypted membership record through `DesktopRuntime`.
49. Desktop shell sensitive-field reveal/copy actions now call local `/api/fields/reveal`, enforce critical-field second unlock, and return clipboard clear timing.
50. Desktop shell pairing preview now calls local `/api/pairing/start`, renders a standard QR payload, and displays a six-digit face-to-face verification code.
51. Mobile pairing client now sends pairing payloads to a desktop near-field endpoint, verifies the shared six-digit code, and confirms trusted desktop devices.
52. Desktop shell pairing confirmation now calls local `/api/pairing/confirm` and records the simulated phone as trusted after code confirmation.
53. Desktop runtime-state now persists trusted devices alongside reminder notification state, so confirmed pairing survives desktop shell reloads.
54. Mobile runtime-state storage adapter now persists trusted devices and reminder notification state across mobile runtime reloads.
55. Mobile pairing client now scans standard desktop pairing QR payload text, derives the near-field endpoint descriptor, sends `/pairing`, and confirms trust.
56. Mobile runtime now exposes `scanPairingQrAndRequest` alongside the legacy matrix path, so future mobile UI can scan a desktop QR payload and start the face-to-face pairing request through the runtime controller.
57. Mobile shell prototype is available at `apps/mobile/prototype/index.html`, showing the phone vault home, due reminder popup, camera/OCR draft sheet, and scan-pairing sheet.
58. Mobile shell preview now exposes local `/api/status` and `/api/app-state` endpoints backed by `MobileRuntime`, `buildMobileVaultViewState`, OCR draft generation, and standard QR pairing preview state.
59. Mobile shell actions now call local `/api/reminders/action`, `/api/ocr/commit`, and `/api/pairing/scan` endpoints to complete reminders, confirm OCR drafts into the vault, and preflight scanned desktop QR payloads.
60. Mobile runtime now accepts a vault storage adapter, and the mobile shell preview persists its vault snapshot locally so OCR-confirmed records survive runtime reload.
61. Mobile shell preview now persists runtime-state locally, including completed reminder deliveries and trusted desktop devices confirmed through `/api/pairing/trust`.
62. Tablet shell preview is available at `apps/tablet/prototype/index.html`, reusing the mobile/tablet runtime with a large-screen review layout for OCR drafts, encrypted attachments, reminders, and trusted-device sync overview.
63. Tablet shell preview exposes local `/api/status`, `/api/app-state`, `/api/review/confirm`, and `/api/pairing/trust` endpoints with local vault and runtime-state persistence.
64. Unified terminal preview launcher is available through `npm run terminal:previews` / `npm run terminal:previews:open`, starting desktop, mobile, and tablet local previews together.
65. `tools/smoke-terminal-shells.mjs` verifies the three terminal shells as one local product surface, checking status, app-state, records, reminders, persistence, and sync-facing preview state.
66. The unified terminal preview launcher now reuses healthy existing LoginTo preview ports and falls back to alternate ports when a requested port is occupied by another service.
67. Face-to-face pairing now has a standard QR payload boundary: `sync-core` can encode pairing payloads as QR modules/SVG, desktop exposes the QR in app-state, and mobile runtime can scan QR payload text before sending the local `/pairing` request.
68. Mobile/tablet runtime storage now has an Expo/React Native adapter boundary for document-file vault snapshots, runtime-state files, and secure metadata keys, covered by `tools/smoke-mobile-expo-storage.mjs`.
69. `crypto-core` now has an injected native crypto provider boundary for Argon2id and XChaCha20-Poly1305, covered by `tools/smoke-native-crypto-adapter.mjs`, while WebCrypto AES-GCM remains the fallback path.
70. Desktop and mobile/tablet runtimes now accept injected crypto adapters and KDF params, so native Argon2id/XChaCha providers can drive field encryption, OCR writes, and encrypted desktop backups without changing runtime workflows.
71. Mobile/tablet pairing now has a camera scanner boundary: `MobileCameraQrScanner` handles permission and QR scan results, then `scanPairingQrWithCamera` sends the scanned desktop QR payload through the runtime pairing flow.
72. Reminder popups now have a terminal system notification bridge: `vault-core` can build OS-notification payloads, request terminal notification permission through an injected adapter, dispatch due reminders, and model notification click actions.
73. Desktop and mobile/tablet runtimes now expose `deliverDueTerminalReminderNotifications`, so app shells can dispatch due reminders to system notifications and persist delivered state without duplicating reminders after reload.
74. The desktop preview now has a real add-record form for account, membership, bank card, and identity document records; form submissions call the local `/api/records` API and persist typed encrypted records with optional reminders.
75. The desktop preview now supports visible CRUD: edit updates a selected record title/notes through `PATCH /api/records`, delete removes the selected local record through `DELETE /api/records`, and smoke tests verify persisted create/edit/delete behavior.
76. The mobile and tablet previews now show visible local action logs for reminder completion, OCR commit, scan/trust sync, and tablet review confirmation, making the main workflows easier to verify from the UI.
77. The tablet preview now has a cleaner large-screen organizer UI: records are selectable, the side panel renders encrypted field/reminder/attachment detail, and review notes are saved through `PATCH /api/review/notes` into the local encrypted vault snapshot.
78. The mobile preview now exposes real record CRUD through `/api/records`: users can create account/membership/card/document records, edit title/notes, delete records, and verify that changes survive preview runtime reloads.
79. The terminal previews now default to separate local vault snapshots for desktop, phone, and tablet. A record created on one terminal stays local until a sync exchange is explicitly sent over the local preview API.
80. Each terminal preview now persists a local device identity file beside its vault/runtime state, so `deviceId`, device name, public key, and device type are local terminal state rather than shared global constants.
81. The phone preview exposes `/api/sync/push`, which builds a sync exchange package from local records and posts it to the desktop preview's `/api/sync/receive`; the desktop writes a sync receipt to `.tmp/terminal-sync-receipts.json` and exposes the latest receipt in app-state.
82. Desktop-to-terminal preview sync now works in both directions: desktop `/api/sync/push` can send exchange packages to phone and tablet `/api/sync/receive`, and all three previews expose latest sync receipts with applied-change and conflict counts.
83. Sync now requires a fresh confirmation preview before package exchange: `/api/sync/preview` discovers the peer device, fetches `/api/sync/summary`, records device name, request time, transport, expiry, and change counts, and `/api/sync/push` rejects requests without the matching `confirmationId`.
84. Sync preview now includes safe record-level summaries: records to send, records to receive, possible conflicts, record type, title, version, updated time, field counts, and sensitive-field counts. It intentionally omits field values and ciphertext.
85. Desktop and mobile sync previews now collect conflict decisions in formal UI before apply. Desktop uses an in-page conflict modal, mobile uses an in-page conflict panel, choices map to `use-local`, `use-remote`, `keep-both`, and `ignore-remote`, and the receiving terminal passes those decisions through `NearFieldSyncSession.receiveExchangePackage`.
86. Desktop and mobile sync confirmation now uses first-class in-app review surfaces instead of browser confirm dialogs. Each review shows peer device, request time, transport, send/receive/conflict counts, and involved record titles before any encrypted package exchange.
87. Sync exchange packages are now bound to the preview confirmation/session in the MVP model. Packages carry `sessionId`, `confirmationId`, and a deterministic `contentDigest`; receivers reject mismatched expected session/confirmation values in core flows and reject repeated imports of the same `packageId`.
88. Terminal HTTP sync now transmits encrypted sync envelopes instead of plaintext exchange packages. `sync-core` exposes `EncryptedSyncExchangePackage`, AES-GCM-compatible AAD binding, encrypt/decrypt helpers, and metadata consistency checks; desktop, mobile, and tablet preview shells exchange `encryptedPackage` bodies while keeping change lists inside ciphertext.
89. Sync receipts now use a standard terminal receipt shape. Incoming and outgoing receipts persist `peerDeviceId`, `peerName`, `syncedAt`, `sentCount`, `receivedCount`, `conflictCount`, `status`, `direction`, package id, transport, and legacy applied/conflict counters for the existing preview UI.
90. Conflict handling now has an explicit `manual-merge` decision path. Desktop and mobile conflict views let users choose per conflicted field whether to keep the local or remote side, and `sync-core` preserves those field-level choices on resolved conflicts without silently applying the whole remote record.
91. Terminal sync envelopes now carry encrypted record snapshots for applied record changes. Receiving desktop, phone, and tablet shells decrypt locally, apply non-conflicting record payloads into their own vault snapshots, and keep payload contents out of preview summaries.
92. Field-level manual merge decisions now write back into the receiving local vault. Preview conflict IDs map to runtime conflict IDs, selected remote fields are merged into the local record, selected local fields remain local, and `tools/smoke-sync-manual-merge-vault.mjs` verifies the resulting mobile vault field snapshot.
93. Failed outgoing sync attempts now persist failure receipts after the user has confirmed a sync preview but the peer receive step fails. Desktop and phone receipts record `status: "failure"`, peer device, sync time, sent/received/conflict counts, package id, transport, and error message; `tools/smoke-sync-failure-receipts.mjs` verifies both desktop and phone failure paths.
94. Terminal sync package keys are now bound to the paired device identities in addition to session and confirmation metadata. Desktop, phone, and tablet derive the sync package key from the local device, peer device, public keys, `sessionId`, and `confirmationId`; `tools/smoke-sync-paired-device-key.mjs` verifies that tampering with the sender public key causes receive failure while the correct paired identity can decrypt.
95. Record deletion now participates in local sync. Desktop and phone delete actions hard-delete from the local vault for the UI, persist a vault-bound deletion tombstone beside the local vault, include `delete` operations in sync summaries/previews, carry encrypted `record-delete-v1` payloads in sync packages, and remove the matching record on the receiving terminal. `tools/smoke-sync-delete-propagation.mjs` verifies desktop delete preview and desktop-to-phone delete propagation.
96. Terminal sync preview, push, and receive now require the peer device to already be in the local trusted-device list with the same public key. First connection must go through face-to-face QR plus six-digit verification, while later sync still shows peer name, time, transport, and change summary before package exchange. `tools/smoke-sync-trust-gate.mjs` verifies unpaired desktop/phone sync is rejected.
97. Sync receive now checks trusted-device status before decrypting an incoming encrypted package. `tools/smoke-sync-trust-gate.mjs` covers untrusted receive attempts on desktop, phone, and tablet, and contract validation guards the trust-before-decrypt order.
98. Desktop `/api/pairing/start` now advertises the current temporary HTTP endpoint from the live request host when generating the QR payload, so the QR contains the actual local connection address, session id, and expiry for the running preview server.
99. Tablet is now an active sync terminal, not only a passive receiver. The tablet shell exposes `/api/sync/preview` and `/api/sync/push`, shows an in-app sync review panel with peer, time, transport, and change summary, requires a confirmation id before push, and sends encrypted packages to desktop. `tools/smoke-sync-tablet-to-desktop.mjs` verifies tablet -> desktop preview, confirmation gate, encrypted transport, and receipts.
100. Tablet sync conflicts now have a visible decision panel with record/field summaries, choices for local, desktop, keep-both, manual merge, and ignore, plus field-level manual merge selection. `tools/smoke-sync-tablet-to-desktop.mjs` now creates a real tablet/desktop `notes` field conflict and verifies a `manual-merge` decision.
101. Desktop, phone, and tablet now generate a unique local public key when their device identity file is first created, and legacy fixed preview keys are migrated on load while preserving the device id/name/kind. Sync discovery now prefers the peer's `/api/sync/summary` identity instead of guessing keys from app-state, and `tools/smoke-device-identity-unique-keys.mjs` verifies unique persisted keys across all three terminals.
102. Sync confirmations are now single-use on both success and failure. A confirmed preview is marked `confirmed` after a successful package exchange, marked `failed` after a receive failure with a failure receipt, and reused confirmation ids are rejected so every retry requires a fresh preview summary and user confirmation.
103. Phone and tablet desktop trust now follow the same face-to-face QR model in the preview shells. `/api/pairing/trust` accepts a desktop QR payload plus the matching six-digit code, rejects missing or wrong codes, and the tablet prototype requests the desktop `/api/pairing/start` payload before writing the trusted desktop entry.
104. Sync push now revalidates the confirmed preview just before sending. Desktop, phone, and tablet recompute safe local/remote record summaries and reject the push if send/receive/conflict signatures changed after the user confirmed, forcing a fresh `/api/sync/preview`.
105. Terminal `/api/sync/receive` endpoints now reject plaintext sync exchange packages. Desktop, phone, and tablet only accept `encryptedPackage` bodies on product receive paths, while plaintext exchange packages remain limited to lower-level `sync-core` tests.

Next M1 work:

1. Replace the MVP random public-key placeholder and device-pair key derivation with real paired-device ECDH/native key agreement tied to the QR pairing transcript.
2. Continue upgrading desktop, mobile, and tablet preview shells toward the selected native app stacks.
3. Connect the terminal notification bridge to Windows/macOS and Expo/React Native notification APIs.
5. Connect the camera scanner boundary to Expo Camera / native scanner UI in the selected native stack.
6. Wire the Expo storage adapters into the selected native shell once the React Native/Expo app scaffold is introduced.
7. Bind the runtime crypto injection path to concrete platform libraries such as libsodium/argon2 once native dependencies are installed.
