# M1 Progress

## Tablet Shell Prototype Addendum

- `apps/tablet/prototype/index.html` now provides a large-screen organizer shell for the third terminal form factor.
- The tablet shell reuses `MobileRuntime`, `buildMobileVaultViewState`, `MobileFileVaultStorageAdapter`, and `MobileFileRuntimeStateStorageAdapter` with a tablet device identity.
- `apps/tablet/scripts/dev-server.mjs` exposes local-only `/api/status`, `/api/app-state`, `/api/review/confirm`, and `/api/pairing/trust` endpoints.
- The tablet preview persists its own local vault snapshot and runtime-state file, so reviewed records and trusted desktop state survive runtime reload.
- `tools/smoke-tablet-app-shell.mjs` verifies tablet app-state, review confirmation, trusted-device persistence, and local file-backed reload.

## Multi-Terminal Preview Addendum

- `tools/start-terminal-previews.mjs` starts the desktop, mobile, and tablet preview shells together on local ports.
- The launcher now reuses healthy existing LoginTo preview ports and falls back to alternate ports when an occupied port belongs to another service.
- Root scripts `terminal:previews` and `terminal:previews:open` provide one command for the three terminal preview surfaces.
- `tools/smoke-terminal-shells.mjs` starts all three shells on ephemeral ports and verifies status, app-state, local records, reminders, persistence metadata, sync-facing preview state, and occupied-port reuse.

## Standard Pairing QR Addendum

- `sync-core` now exposes `encodePairingPayloadQr`, `encodePairingPayloadText`, and `decodePairingPayloadText` for the face-to-face pairing payload.
- The standard QR payload remains local-first: it contains the same expiring pairing payload and local endpoint, while trust still requires the six-digit face-to-face verification code.
- Desktop shell app-state now includes QR module cells, QR SVG markup, and the scanned payload text while retaining the legacy pairing matrix fields during migration.
- Mobile pairing client and runtime can scan QR payload text through `scanDesktopPairingQr` and `scanPairingQrAndRequest`, then send the local `/pairing` request through the existing near-field transport.
- `tools/smoke-pairing-matrix.mjs`, `tools/smoke-mobile-pairing-client.mjs`, `tools/smoke-mobile-runtime-state.mjs`, `tools/smoke-desktop-app-shell.mjs`, and `tools/smoke-mobile-app-shell.mjs` now verify the QR path.

## Expo Storage Adapter Addendum

- `apps/mobile/src/expo-storage.ts` now defines platform-facing storage boundaries for React Native/Expo terminals without importing Expo modules directly.
- `ExpoVaultStorageAdapter` persists encrypted vault snapshots through an injected document-file API.
- `ExpoRuntimeStateStorageAdapter` persists reminder notification state and trusted devices through the same injected file API.
- `ExpoSecureMetadataStore` provides a small secure key-value boundary for bootstrap metadata such as local storage URIs and device metadata.
- `createExpoStoragePaths` derives phone/tablet vault and runtime-state file URIs from `documentDirectory`.
- `tools/smoke-mobile-expo-storage.mjs` verifies both phone and tablet runtimes can reload persisted vault/runtime-state data through the Expo-style adapters.

## Native Crypto Adapter Addendum

- `packages/crypto-core/src/native.ts` now defines an injected native crypto provider boundary for production-grade crypto libraries.
- The native adapter requires `deriveArgon2idKey`, `encryptXChaCha20Poly1305`, `decryptXChaCha20Poly1305`, and platform random bytes from the provider.
- The adapter emits `xchacha20-poly1305` payload metadata, enforces 32-byte keys, enforces 24-byte XChaCha nonces, and rejects PBKDF2 fallback KDF params.
- WebCrypto AES-GCM remains available as the platform fallback adapter while native dependencies are not installed.
- `tools/smoke-native-crypto-adapter.mjs` verifies conformance, field encryption/decryption, XChaCha payload metadata, and KDF rejection behavior through an injected provider.

## Runtime Crypto Injection Addendum

- Desktop runtime creation and encrypted backup restore now accept `cryptoAdapter` and `cryptoKdfParams`.
- Mobile/tablet runtime creation now accepts the same crypto adapter injection path for OCR commit, encrypted capture, and local field writes.
- When no adapter is provided, runtimes continue to use WebCrypto AES-GCM with PBKDF2 fallback params.
- When a native adapter is provided, runtimes can use Argon2id KDF params and emit `xchacha20-poly1305` field and package payloads.
- `tools/smoke-runtime-native-crypto.mjs` verifies desktop field encryption, desktop encrypted backup restore, and mobile OCR commit through an injected native adapter.

## Camera Scanner Pairing Addendum

- `apps/mobile/src/camera-scanner.ts` now defines the mobile/tablet camera QR scanner boundary without importing Expo Camera directly.
- `MobileCameraQrScanner` abstracts camera permission and QR scan result collection.
- `scanPairingQrWithCamera` validates permission, reads a scanned QR payload, and sends it through `MobileRuntime.scanPairingQrAndRequest`.
- `createStaticPairingQrScanner` gives smoke tests and prototypes a deterministic scanner implementation.
- `tools/smoke-mobile-camera-scanner.mjs` verifies the camera QR scan path, desktop `/pairing` request, matching verification code, raw scan retention, and denied-permission behavior.

## Mobile Pairing Runtime Addendum

- `apps/mobile/src/runtime.ts` now exposes `scanPairingQrAndRequest` alongside the legacy `scanPairingMatrixAndRequest`.
- The QR method accepts scanned QR payload text from the camera/UI layer, verifies that it describes a desktop target, derives the local near-field endpoint, and sends the mobile pairing request through `MobileLocalNetworkTransportAdapter`.
- Pairing still requires explicit user confirmation of the shared six-digit code before `confirmPairingTrust` writes the desktop into trusted devices.
- `tools/smoke-mobile-runtime-state.mjs` now verifies the runtime-level scan-to-pairing path and confirms trusted-device persistence after mobile runtime reload.

## Mobile Shell Prototype Addendum

- `apps/mobile/prototype/index.html` now provides a phone-sized visual shell for the terminal-device MVP.
- The prototype shows the local vault home, due reminder card, category shortcuts, recent records, camera/OCR draft sheet, and scan-pairing sheet.
- `apps/mobile/scripts/dev-server.mjs` exposes local-only `/api/status` and `/api/app-state` endpoints for preview.
- `apps/mobile/scripts/app-state.mjs` builds app-state from `MobileRuntime`, `buildMobileVaultViewState`, OCR draft generation, and standard QR pairing preview state.
- The mobile shell now exposes `/api/reminders/action`, `/api/ocr/commit`, and `/api/pairing/scan` for local reminder completion, OCR draft confirmation, and QR pairing preflight.
- The phone prototype buttons call those local APIs, keeping UI actions on the same runtime boundary as the future React Native shell.
- `apps/mobile/src/file-vault-storage.ts` now provides a local file-backed vault snapshot adapter for the preview shell.
- `MobileRuntime` accepts a vault storage adapter and can save the repository snapshot after OCR-confirmed writes.
- `apps/mobile/src/runtime-state-storage.ts` now includes a file-backed runtime-state adapter and default path helper for preview/device shells.
- The mobile shell preview now writes runtime-state beside the vault snapshot, preserving reminder delivery state and trusted devices across runtime reload.
- The mobile shell also exposes `/api/pairing/trust`, which marks the scanned desktop preview target as trusted and persists that state through `MobileRuntime.saveRuntimeState`.
- `tools/smoke-mobile-app-shell.mjs` verifies that the prototype keeps the expected mobile flows visible, that the local app-state API is runtime-backed, that the local action APIs mutate or validate the preview runtime, and that OCR-confirmed records, completed reminder state, and trusted devices survive runtime reload from local files.
- The next step is to map the standard QR boundary into the selected React Native/Expo camera scanner shell.

## Reminder Notification Center Addendum

- `vault-core` now includes `ReminderNotificationCenter` for due reminder popup delivery state.
- Reminder notifications now support stable alert ids, dedupe, delivered, snoozed, completed, and dismissed states.
- `apps/desktop` and `apps/mobile` runtimes expose reminder notification methods for future UI shells.
- Reminder notification collection is allowed while the vault security session is locked so local OS notifications can still appear; sensitive field reveal remains controlled by `VaultSecuritySession`.
- `tools/smoke-reminder-notifications.mjs` and `tools/smoke-runtime-reminder-notifications.mjs` verify pure vault-core behavior and runtime integration.
- Desktop runtime now persists reminder notification state in a local runtime-state file, so delivered notifications are not repeated after app restart.
- Desktop UI shell preview now runs through `apps/desktop/scripts/dev-server.mjs` and is covered by `tools/smoke-desktop-app-shell.mjs`.
- Desktop UI shell now loads record list, reminder modal, and sync preview data from the local `/api/app-state` endpoint backed by `DesktopRuntime`.
- Desktop UI shell reminder actions now write completed/snoozed states through `/api/reminders/action` and persist them in local runtime-state.
- Desktop UI shell new-record action now writes an encrypted local membership record through `/api/records`.
- Desktop UI shell now includes a form-driven add-record modal for account, membership, bank card, and identity document records; submissions persist typed encrypted records and optional reminders through `/api/records`.
- Desktop UI shell now supports visible CRUD: edit updates title/notes through `PATCH /api/records`, delete removes the selected local record through `DELETE /api/records`, and the desktop smoke verifies persisted create/edit/delete behavior.
- Mobile UI shell now includes a visible local action log for reminder completion, OCR commit, scan pairing, and trusting a desktop device.
- Mobile UI shell now exposes real `/api/records` CRUD for local vault records. The phone preview can create account/membership/card/document records, update title/notes, delete records, and survive runtime reload from the local vault snapshot.
- Tablet UI shell now includes a visible review action log for confirming OCR/attachment review work and trusting a desktop device.
- Tablet UI shell now has a cleaner large-screen organizer surface with selectable records, encrypted field detail, attachment/reminder summary, and `PATCH /api/review/notes` for saving local review notes into the encrypted vault snapshot.
- Terminal previews now default to separate local vault snapshots for desktop, phone, and tablet. `tools/smoke-terminal-shells.mjs` creates a record through the phone shell and verifies that desktop/tablet cannot see it through shared storage.
- Desktop, phone, and tablet previews now persist local device identity files beside their vault/runtime-state files. Generated `deviceId`, device name, public key, and device type are local terminal state and are reused across runtime reloads.
- Phone-to-desktop preview sync now has a real exchange-package action: mobile `/api/sync/push` sends local record changes to desktop `/api/sync/receive`, desktop imports through `NearFieldSyncSession.receiveExchangePackage`, writes `.tmp/terminal-sync-receipts.json`, and exposes the latest receipt in app-state.
- Desktop-to-terminal preview sync now runs in the other direction as well: desktop `/api/sync/push` posts exchange packages to phone/tablet `/api/sync/receive`, the receiving terminal writes a local sync receipt, and each preview exposes applied-change and conflict counts in app-state.
- `tools/smoke-terminal-shells.mjs` now verifies phone -> desktop, desktop -> phone, and desktop -> tablet sync over real local HTTP preview APIs. The next sync UX step is a conflict-resolution view with per-record choices instead of receipt counts only.
- Sync now has an explicit confirmation preview step. Desktop/mobile `/api/sync/preview` discovers the peer terminal, fetches `/api/sync/summary`, stores a pending confirmation with device name, request time, transport, expiry, and change counts, and `/api/sync/push` rejects direct package exchange unless the matching `confirmationId` is supplied.
- Desktop and mobile preview UI now show the pending sync request summary and ask for user confirmation before exchanging packages. This models the rule that trusted devices are still not allowed to sync silently.
- Sync preview now carries safe record-level detail. `/api/sync/summary` returns record title, type, version, update time, field count, sensitive-field count, and field keys/update times, while omitting field values and ciphertext. `/api/sync/preview` uses those safe summaries to list records to send, records to receive, and possible conflicts.
- Desktop and mobile preview UI now show the involved record titles in the confirmation flow, and `tools/smoke-terminal-shells.mjs` verifies that preview confirmations do not leak known sensitive values or `valueCipher`.
- Desktop and mobile preview UI now collect conflict decisions before apply through formal in-page controls. Desktop shows a conflict-resolution modal, mobile shows a conflict-resolution panel, both emit `use-local`, `use-remote`, `keep-both`, or `ignore-remote`; the selected decisions are sent with `/api/sync/push` and passed into `NearFieldSyncSession.receiveExchangePackage`.
- Desktop and mobile sync review is now also first-class UI rather than a browser `confirm()` prompt. The review surfaces show peer device, request time, transport, send/receive/conflict counts, and involved record titles before the app exchanges the encrypted sync package.
- Sync exchange packages now carry MVP session binding metadata: `sessionId`, `confirmationId`, and `contentDigest`. `NearFieldSyncSession.receiveExchangePackage` can enforce expected session/confirmation IDs and rejects repeated imports of the same `packageId`; `tools/smoke-sync-exchange.mjs` covers tamper detection and `tools/smoke-sync-session.mjs` covers confirmation mismatch and replay rejection.
- Terminal HTTP sync now sends `EncryptedSyncExchangePackage` envelopes instead of plaintext exchange packages. The envelope exposes only routing/session metadata and AES-GCM AAD-bound ciphertext; desktop, mobile, and tablet preview shells decrypt locally before applying merge plans, and `tools/smoke-terminal-shells.mjs` verifies the transport reports encrypted package use.
- Terminal sync receipts now persist a standard record on both incoming and outgoing sync paths where applicable: peer device id/name, sync time, sent count, received count, conflict count, success status, direction, package id, and transport. Legacy applied/conflict counters remain for the current preview UI.
- Outgoing sync failures after confirmation now persist failure receipts. If the peer `/api/sync/receive` call fails, desktop and phone shells write `status: "failure"` receipts with peer identity, sync time, sent/received/conflict counts, package id, transport, and error details.
- Conflict handling now includes a `manual-merge` resolution. Desktop and mobile conflict views collect per-field local/remote choices without exposing field values; `sync-core` records the selected field choices on resolved conflicts and avoids silently applying the entire remote record for manual merges.
- Terminal sync packages now place record snapshots inside the encrypted envelope, while preview summaries still omit field values and ciphertext.
- Record deletes now produce local vault-bound deletion tombstones instead of disappearing from sync. Desktop and phone delete APIs still remove the record from the visible local vault, but `/api/sync/summary` and `/api/sync/preview` can show `delete` operations, and receiving terminals apply encrypted `record-delete-v1` payloads by removing the matching local record.
- Receiving desktop, phone, and tablet shells now append their current local record state before applying an incoming package, so merge planning can detect real local/remote record conflicts.
- Manual merge decisions from the preview UI now map to runtime conflict IDs and write the selected fields back into the receiving local vault snapshot.
- Terminal sync package key derivation is now bound to the local and peer device identities, public keys, `sessionId`, and `confirmationId` instead of only a fixed MVP seed plus session metadata.
- `tools/smoke-sync-conflicts.mjs` now verifies that a conflict decision resolves a pending sync conflict during merge-plan apply and is retained in the import journal.
- `tools/smoke-sync-manual-merge-vault.mjs` verifies desktop-to-phone conflict preview, field-level manual merge, and resulting local vault field writeback.
- `tools/smoke-sync-failure-receipts.mjs` verifies desktop and phone failure receipts when a confirmed sync push reaches a failing peer receive endpoint.
- `tools/smoke-sync-paired-device-key.mjs` verifies that a sync package encrypted for a paired phone rejects a tampered sender public key and accepts the correct paired desktop identity.
- `tools/smoke-sync-delete-propagation.mjs` verifies that a desktop deletion appears as a sync-preview `delete` operation and removes the copied record from the phone vault after sync.
- Sync preview, push, and receive now enforce the trusted-device gate. A peer discovered on the local network is not trusted automatically; the first connection must complete face-to-face QR pairing plus six-digit verification, and later sync still requires an in-app preview confirmation with peer name, time, transport, and change summary. `tools/smoke-sync-trust-gate.mjs` verifies unpaired desktop/phone sync is rejected before any package exchange.
- Incoming encrypted packages are now gated before decryption. Desktop, phone, and tablet reject untrusted `/api/sync/receive` attempts using sender identity metadata before deriving the device-pair package key or decrypting package contents.
- Desktop pairing QR generation now binds `localEndpoint` to the current temporary HTTP server address derived from the request host instead of a fixed preview port. `tools/smoke-desktop-app-shell.mjs` verifies the decoded QR payload carries the live endpoint plus a future expiry time.
- Tablet sync is now bidirectional with desktop at the preview-shell level. The tablet exposes `/api/sync/preview` and `/api/sync/push`, stores pending confirmations locally, renders a sync review panel in the tablet UI, refuses direct push without `confirmationId`, transmits encrypted packages, and persists outgoing receipts. `tools/smoke-sync-tablet-to-desktop.mjs` verifies tablet -> desktop sync end to end.
- Tablet conflict handling now matches the product rule that conflicts cannot be silently resolved. The tablet UI shows a conflict panel with record titles, changed fields, local/desktop choices, keep-both, ignore, and field-level manual merge; the tablet-to-desktop smoke creates a real `notes` conflict and verifies a `manual-merge` decision.
- Desktop, phone, and tablet device identity files now carry generated local public keys instead of fixed preview constants. Existing legacy constant keys are migrated on load, `/api/sync/summary` is the preferred device-discovery source for real peer public keys, and `tools/smoke-device-identity-unique-keys.mjs` verifies unique persisted keys across the three terminals.
- Sync confirmations are now consumed after the user-approved attempt regardless of outcome. Successful pushes mark the confirmation `confirmed`; failed outgoing pushes mark it `failed` after writing a failure receipt; reusing either confirmation state is rejected and requires a fresh `/api/sync/preview`.
- Phone and tablet trusted-desktop setup now uses QR pairing payloads and six-digit verification codes. Both trust endpoints reject missing/wrong codes, trust the decoded desktop identity only after verification, and the mobile/tablet prototypes pass the scanned verification code before writing the trusted desktop entry.
- Confirmed sync previews are now revalidated immediately before sending encrypted packages. If local or remote safe record summaries change after confirmation, the push is rejected and the user must create a fresh preview so the actual package cannot include unreviewed changes.
- Terminal receive endpoints now enforce encrypted transport at the product boundary. Desktop, phone, and tablet `/api/sync/receive` reject plaintext `exchangePackage` bodies even from trusted senders and only decrypt/apply `encryptedPackage` payloads.

## Terminal Notification Bridge Addendum

- `packages/vault-core/src/terminal-notifications.ts` defines the platform-neutral bridge between due reminder deliveries and terminal system notifications.
- The bridge models OS notification permission through an injected `TerminalNotificationAdapter`, so desktop, phone, and tablet shells can connect Windows/macOS/Android/iOS notification APIs later without changing reminder state rules.
- `createTerminalReminderNotificationPayload` preserves alert, record, reminder, due-date, title, body, and action metadata for system notifications.
- `deliverTerminalReminderNotifications` filters pending reminders, handles denied/prompt/unsupported permissions, dispatches granted reminders, and lets runtimes mark successful deliveries.
- `createTerminalReminderNotificationActionRequest` converts terminal notification clicks into local actions such as open, snooze, complete, and dismiss.
- `tools/smoke-terminal-notification-bridge.mjs` verifies granted delivery, denied permission handling, action metadata, and runtime delivery marking through an in-memory adapter.
- Desktop and mobile/tablet runtimes now expose `deliverDueTerminalReminderNotifications`, which collects due reminders, dispatches them through the terminal notification adapter, marks successful deliveries, and persists dedupe state.
- `tools/smoke-runtime-terminal-notifications.mjs` verifies desktop reload dedupe, phone denied-permission handling, and granted phone dispatch through runtime-level APIs.

版本：M1 / 本地保险库基础

## 已完成

- `vault-core` 可创建保险库 manifest。
- `vault-core` 可按内置模板创建记录草稿。
- `vault-core` 可校验必填字段和未知字段。
- `vault-core` 可通过注入的字段加密函数把草稿落成正式记录。
- `vault-core` 可创建本地提醒规则。
- `vault-core` 可创建附件元数据。
- `vault-core` 已有内存仓库，用于早期流程烟测。
- `vault-core` 已定义 `VaultStorageAdapter` 和 `VaultSnapshot` 存储边界。
- `vault-core` 已提供内存存储适配器，用于保存/恢复烟测。
- `vault-core` 已支持字段更新、提醒更新和附件关联操作。
- `vault-core` 已定义加密保险库包格式，用于备份包和同步包。
- `vault-core` 已定义 SQLite schema 和 executor 契约。
- `vault-core` 已支持内置分类、自定义分类、标签和本地搜索索引。
- `apps/desktop` 已实现本地文件 storage adapter，可写入和恢复 snapshot。
- `apps/desktop` 已实现 VaultSession 应用服务，可创建/加载保险库、添加记录、搜索、保存和导出备份包。
- `vault-core` 已实现基于抽象 executor 的 SQLite storage adapter 第一版。
- `apps/desktop` 已实现第一版 UI view-state 模型，用于侧栏、记录列表、选中详情和提醒列表。
- `crypto-core` 提供 unsafe development field encryptor，仅用于测试流程。
- `crypto-core` 提供 unsafe development package encryptor/decryptor，仅用于测试导出/恢复流程。
- `crypto-core` 已提供正式 adapter conformance 夹具，供后续 libsodium/platform adapter 接入时复用。
- `ocr-core` 已实现本地 OCR 文本分类、字段提取和确认后转记录草稿。
- `vault-core` 已实现提醒调度、到期弹窗内容和 upcoming/due alert 计算。
- `sync-core` 已实现设备身份、配对 payload、6 位验证码、变更创建和同步摘要。
- `sync-core` 已实现冲突检测、merge plan 和冲突解决状态辅助。
- `apps/mobile` 已实现 OCR 拍照录入 workflow service，可从 OCR 文本生成待确认草稿并在确认后写入记录、原图附件和提醒。
- `apps/mobile` 已实现首页/搜索/提醒 view-state 模型，用于移动端记录卡片、收藏、最近、分类和到期提醒展示。
- `sync-core` 已实现变更日志和可信设备状态，用于后续近场同步状态管理。
- `tools/run-all-smoke.mjs` 已实现，可一键运行当前全部核心烟测。
- `sync-core` 已实现同步交换包创建、序列化/解析和从交换包生成 merge plan。
- `sync-core` 已实现 merge plan 应用、同步结果统计和导入流水记账。
- `apps/desktop` 和 `apps/mobile` 已提供近场同步 session 包装层，可生成/接收同步交换包并记录导入结果。
- `tools/smoke-vault-core.mjs` 可验证“manifest -> draft -> record -> repository -> storage -> package -> restore”流程。

- `sync-core` 已实现近场同步 endpoint descriptor、request/response 包装、路由断言和平台无关 handler。
- `sync-core` 的 near-field handler 已支持配对响应、可信设备摘要、交换包导入和未信任设备拒绝。
- `tools/smoke-near-field-handler.mjs` 可验证“移动端请求 -> 桌面端处理 -> 导入流水/信任校验”的核心路径。
- `apps/desktop` 和 `apps/mobile` 已提供 near-field endpoint 应用边界，可承接后续局域网、热点或蓝牙传输适配器。
- `tools/smoke-app-near-field-endpoints.mjs` 可验证桌面端/移动端 endpoint 边界之间的请求处理路径。
- `vault-core` 已提供 async 记录创建和字段更新 helper，后续可接入 WebCrypto、Keychain 或 libsodium 等异步加密适配器。
- `tools/smoke-async-field-encryption.mjs` 可验证异步字段加密、字段更新和保存/恢复流程。
- `apps/desktop` 的 VaultSession 已支持 async 新增记录和 async 字段更新。
- `apps/mobile` 的 OCR commit workflow 已支持 async 字段加密落库。
- `tools/smoke-async-app-workflows.mjs` 可验证桌面会话和移动 OCR 的 async 写入路径。
- `crypto-core` 已提供 WebCrypto AES-GCM 适配器、PBKDF2-SHA-256 fallback KDF 参数和字段密文封装。
- `tools/smoke-webcrypto-adapter.mjs` 可验证 WebCrypto conformance、字段加密和按 AAD 解密。
- `tools/smoke-async-app-workflows.mjs` 现已使用 WebCrypto 字段加密验证桌面/移动 async 写入。
- `crypto-core` 已提供附件 blob 加密封装，包含版本号、AAD、SHA-256 digest、密文大小和解密校验。
- `tools/smoke-attachment-encryption.mjs` 可验证拍照/导入附件字节加密、解析、解密和附件元数据生成。
- `apps/mobile` 已提供 encrypted capture 准备流程，可先加密相机/导入图片，再把 digest、密文大小和附件 ID 交给 OCR commit。
- `tools/smoke-mobile-encrypted-capture.mjs` 可验证“图片字节 -> 加密 blob -> OCR capture -> async 落库并保留原图附件”。
- `sync-core` 已定义 NearFieldTransportAdapter、发送 helper 和内存传输实现，用于承接后续真实局域网、热点或蓝牙传输。
- `tools/smoke-near-field-transport.mjs` 可验证通过传输适配器访问桌面 endpoint、完成摘要/交换包同步和未注册端点错误。
- `apps/desktop` 已提供基于 Node 内置 HTTP/fetch 的 localhost near-field endpoint 和 transport adapter 雏形。
- `tools/smoke-desktop-local-network-transport.mjs` 可验证桌面端启动本地 HTTP endpoint 并通过真实 HTTP POST 完成摘要/交换包同步。
- `apps/desktop` 已提供局域网 base URL 候选地址生成 helper，可供后续二维码公布 endpoint 使用。
- `tools/smoke-desktop-network-candidates.mjs` 可验证 IPv4 LAN 地址、loopback fallback 和 MVP 阶段 IPv6 排除规则。
- `apps/mobile` 已提供基于 fetch 的 local-network transport 发送侧 adapter。
- `tools/smoke-mobile-local-network-transport.mjs` 可验证移动端 transport 通过真实 HTTP POST 向桌面 endpoint 发送交换包。
- `sync-core` 已提供面对面配对 workflow：本机 payload、远端 payload、6 位核验码、过期状态、取消状态和确认后写入可信设备。
- `apps/desktop` 与 `apps/mobile` 已提供 pairing workflow wrapper，限制各自设备类型。
- `tools/smoke-pairing-workflow.mjs` 和 `tools/smoke-app-pairing-workflow.mjs` 可验证核心配对与桌面/移动互信流程。
- `tools/demo-current-product.mjs` 可演示当前产品能力：本地保险库、WebCrypto 字段加密、加密附件、OCR 入库、提醒、面对面配对和本地 HTTP 同步。
- `apps/desktop` 和 `apps/mobile` 已提供 runtime controller，把保险库、WebCrypto、提醒、配对、加密拍照/OCR 和近场同步组合成未来应用壳可直接调用的入口。
- `tools/smoke-app-runtimes.mjs` 可验证桌面 runtime 与移动 runtime 跨端配对、提醒、加密附件和本地 endpoint 同步。
- `crypto-core` 已提供 VaultSecuritySession，支持自动锁定、critical 字段二次解锁、复制后清除计划和字段 reveal 决策。
- `apps/desktop` 与 `apps/mobile` runtime 已接入安全 session，锁定后拒绝写入、配对和同步等受保护操作。
- `tools/smoke-vault-security.mjs` 与 `tools/smoke-runtime-security.mjs` 可验证安全 session 和 runtime 锁定行为。
- `vault-core` 已提供 async 加密保险库包导出/恢复 helper。
- `crypto-core` 已提供 WebCrypto package encryptor/decryptor，可用于 backup-package 与 sync-session 包。
- `apps/desktop` runtime 已接入加密备份导出和恢复流程。
- `tools/smoke-desktop-backup-restore.mjs` 可验证正确密码恢复、错误密码拒绝和提醒恢复。
- `apps/desktop` 预览壳已提供 `/api/fields/reveal`，敏感字段显示/复制会经过 VaultSecuritySession 决策。
- 桌面 UI 的“解锁”和“复制”按钮已接入本地字段 reveal API，critical 字段未二次解锁时返回 `second-unlock-required`。
- `tools/smoke-desktop-app-shell.mjs` 已覆盖 critical 字段二次解锁拒绝、二次解锁后显示和复制后 30 秒清除计划。
- `apps/desktop` 预览壳已提供 `/api/pairing/start`，从 DesktopRuntime 生成面对面配对 payload、过期时间、6 位校验码和标准 QR 载体。
- 桌面 UI 的同步面板已接入本地配对 API，可刷新配对窗口并展示本机端点与验证码。
- `sync-core` 已提供标准 QR 编码和扫描 payload 文本解码 helper，可将 pairing payload 转成可扫码、可还原的本地载体。
- `apps/mobile` 已提供 pairing client，可通过 MobileLocalNetworkTransportAdapter 向桌面 `/pairing` 发送移动端 payload，校验返回的 6 位验证码并确认可信桌面设备。
- `apps/mobile` pairing client 已支持扫描/解析桌面 pairing QR payload，生成 near-field endpoint descriptor 后发起 `/pairing`。
- `apps/desktop` 预览壳已提供 `/api/pairing/confirm`，可模拟收到手机 payload、核对验证码并将手机写入可信设备列表。
- `tools/smoke-mobile-pairing-client.mjs` 可验证“移动端请求桌面 pairing endpoint -> 双端验证码一致 -> 移动端信任桌面”的流程。
- `apps/desktop` runtime-state 已持久化 trusted devices，配对确认后的可信手机会随 runtime-state 文件保存并在重新加载 app-state 时恢复。
- `apps/mobile` 已提供平台无关 runtime-state storage adapter，可保存 trusted devices 和提醒投递状态。
- `tools/smoke-mobile-runtime-state.mjs` 可验证移动端确认可信桌面后重建 runtime 仍能恢复 trusted devices，并保留提醒投递状态。

## 重要约束

- unsafe development field encryptor 不是正式加密实现。
- 正式保险库写入磁盘前必须接入真实加密适配器。
- CVV 仍不属于银行卡默认模板字段。
- OCR 草稿仍不能直接写入保险库，必须用户确认。
- 近场同步已具备协议、会话、交换包、设备对绑定密钥派生、平台无关 handler 和局域网 HTTP/fetch 雏形；热点/蓝牙传输层尚未接入。
- 当前桌面预览壳中的字段 reveal API 已通过本地 runtime 解密 `loginto-field-cipher-v1` 字段；`/api/app-state` 不携带 `secretValue` 明文。
- 当前标准 QR 可还原 pairing payload；同步包密钥已绑定设备对身份和会话确认信息，但正式终端应用仍应升级为基于配对 transcript 的 ECDH/原生安全密钥协商，并接入移动端/平板端相机扫描 UI。
- 移动端 runtime-state 已有平台无关 adapter；正式应用还需要接入 React Native/Expo 的持久化实现。

## 下一步

1. 将标准 QR pairing payload 接入移动端/平板端相机扫码 UI。
2. 补 React Native/Expo 平台 storage adapter，实现移动端 runtime-state 真实磁盘/安全存储落地。
3. 将 Argon2id/XChaCha20-Poly1305 原生适配器边界绑定到具体 libsodium/argon2 依赖或平台 API。
4. 继续把桌面预览壳升级为可安装终端应用壳，并选择 Tauri/React 或其他原生技术栈。

## 当前环境限制

- 项目本地 `.toolchain` 已提供 Node、npm、pnpm、rustc 和 cargo。
- PowerShell 执行策略可能阻止 `.ps1`，默认使用 `tools\with-toolchain.cmd` 运行项目命令。
- Tauri/React 等外部依赖尚未安装；当前桌面壳使用 Node 内置 HTTP 服务和静态原型继续验证产品交互。
