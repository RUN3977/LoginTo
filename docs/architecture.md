# LoginTo Architecture Notes

## Reminder Notification Runtime Boundary

- `vault-core` owns reminder alert calculation and the `ReminderNotificationCenter` delivery log.
- Desktop/mobile runtimes own platform-facing methods: collect due notifications, mark delivered, snooze, complete, and dismiss.
- Notification collection can run while the vault is locked because due popup content must reach the local terminal device on time.
- Sensitive record field reveal, copy actions, pairing, sync, and writes remain gated by `VaultSecuritySession`.
- Future UI shells should bind OS/local popup components to runtime notification methods instead of recomputing alert state directly.
- Desktop runtime stores reminder notification delivery memory in a local runtime-state file beside the vault file.
- Reminder notification delivery memory is local terminal state and must not be included in near-field sync exchange packages.

## Mobile Pairing Runtime Boundary

- Mobile UI should pass camera-scanned pairing matrices to `MobileRuntime.scanPairingMatrixAndRequest` instead of constructing near-field descriptors directly.
- The runtime validates the scanned target, derives the local endpoint descriptor, and sends `/pairing` through the mobile transport adapter.
- Trust is still a separate action: UI must show the shared six-digit verification code and call `confirmPairingTrust` only after the user confirms both devices match.
- The current pairing matrix is a dependency-light payload carrier, not standard QR error-correction encoding; platform UI work should replace the visual carrier with standard QR while keeping the runtime boundary.

## Tablet Shell Boundary

- `apps/tablet/scripts/dev-server.mjs` is the current runnable tablet preview entry point.
- The tablet shell is a terminal-device app, not a web/PWA target; it uses local-only preview APIs in the same style as desktop and mobile.
- Tablet app-state reuses the mobile/tablet runtime controller with `kind: "tablet"` and file-backed vault/runtime-state adapters.
- The tablet layout focuses on large-screen workflows: OCR draft review, encrypted attachment checking, reminder overview, and trusted-device sync preparation.
- `/api/review/confirm` models confirming a tablet review queue item into the local vault, and `/api/pairing/trust` models trusting a nearby desktop before sync.

## Desktop Shell Boundary

- `apps/desktop/scripts/dev-server.mjs` is the current runnable desktop shell preview entry point.
- The preview serves local UI files from `apps/desktop/prototype` and exposes local-only `/api/status` and `/api/app-state` endpoints.
- `apps/desktop/scripts/app-state.mjs` creates or loads `DesktopRuntime`, seeds a local preview vault when empty, and maps runtime records/reminders into UI state.
- The shell preview writes a local vault snapshot and local runtime-state file under `.tmp/` by default; both paths can be overridden with environment variables for tests.
- `/api/reminders/action` writes reminder completion, snooze, dismiss, or delivered state through `DesktopRuntime` and persists it in the local runtime-state file.
- `/api/records` writes new local records through `DesktopRuntime.addRecord`, which keeps UI creation on the same encrypted vault path as the app runtime.
- This shell is a temporary dependency-light bridge toward a Tauri/native desktop app; the product target remains terminal devices, not a public web app.

版本：M0 / 终端设备版

## 目标

LoginTo 的架构目标是让每台终端都能独立持有一个本地加密保险库，并在用户面对面授权时与其他终端同步。

MVP 不包含网页端、公共云账号、云端保险库存储或云端 OCR。

## 终端边界

| 终端 | 角色 | 必备能力 |
|---|---|---|
| 移动终端 | 快速查询、拍照录入、提醒触达 | 生物识别、本地通知、相机、本地 OCR、扫码配对 |
| 平板终端 | 大屏整理、附件校对、家庭备用设备 | 移动端能力 + 更好的列表/详情布局 |
| 桌面终端 | 批量整理、稳定同步中枢、本地管理 | 本地文件、托盘、通知、局域网服务、加密备份 |
| 新/备用设备 | 换机、恢复、离线灾备 | 导入加密备份、旧设备扫码授权、恢复提醒与附件 |

## 包结构

| 包 | 职责 |
|---|---|
| `vault-core` | 记录类型、字段模板、保险库元数据、提醒和附件契约 |
| `crypto-core` | 密钥派生、加密封装、敏感字段策略的接口契约 |
| `sync-core` | 设备身份、二维码配对、变更日志、冲突合并契约 |
| `ocr-core` | 本地 OCR 草稿、字段提取和分类建议契约 |
| `ui` | 跨终端设计 token 和组件状态契约 |

## 应用 Runtime 边界

- `apps/desktop/src/runtime.ts` 是桌面应用壳的组合入口，负责保险库文件、WebCrypto 字段加密、提醒查询、面对面配对和 local-network endpoint。
- `apps/mobile/src/runtime.ts` 是移动应用壳的组合入口，负责加密拍照准备、OCR 确认入库、提醒查询、面对面配对和 local-network 发送侧同步。
- Runtime 层持有 VaultSecuritySession，UI 显示敏感字段、复制字段、配对和同步前必须经过锁定状态与二次解锁判断。
- UI 层应优先调用 runtime controller，不直接散调用底层 vault/crypto/sync/OCR 模块。
- 桌面预览壳通过 `/api/fields/reveal` 承接敏感字段显示与复制请求；普通 secret 字段要求保险箱已解锁，critical 字段还要求二次解锁，复制动作返回剪贴板清除计划。

## 离线备份边界

- 保险库备份包使用 `loginto-vault-package-v1`，快照内容必须通过 package encryptor 加密。
- WebCrypto package encryptor/decryptor 使用同一 AAD 绑定 packageId、vaultId、sourceDeviceId 和 createdAt。
- 桌面 runtime 的备份恢复必须先解密并解析 snapshot，再写入本地 storage；错误密码或错误 key material 必须拒绝恢复。

## 数据流

```text
用户输入/拍照
  -> OCR 草稿或手动表单
  -> 用户确认
  -> vault-core 标准记录
  -> crypto-core 加密字段与附件
  -> 本地保险库文件
```

## 同步流

```text
终端 A 显示二维码
  -> 终端 B 扫码
  -> 双方核对验证码
  -> 建立加密通道
  -> 交换变更摘要
  -> 传输缺失变更和附件块
  -> 本地合并
  -> 冲突进入待处理列表
```

## 同步端点边界

- `sync-core` 只定义近场同步协议、端点描述、请求/响应、可信设备校验、交换包导入和冲突返回。
- `apps/desktop` 与 `apps/mobile` 只包装应用边界和端点描述，不在边界内实现具体网络栈。
- `NearFieldTransportAdapter` 是真实传输层的接入点；局域网、热点、蓝牙、离线包都必须返回同一类 request/response。
- 桌面端当前可运行传输雏形为 Node HTTP/fetch localhost endpoint；后续扩展为 QR 公布局域网地址。
- 移动端当前可运行传输雏形为 fetch 发送侧 adapter，可访问桌面公布的 endpoint。
- QR 配对 payload 中的 localEndpoint 应来自桌面/移动端当前可达的 base URL 候选，而不是硬编码。
- 桌面预览壳的 `/api/pairing/start` 生成本机 pairing payload、过期时间、验证码和可解码 pairing matrix；收到远端 payload 并核对 6 位验证码后，才能进入信任确认。
- `sync-core` 的 pairing matrix 是无依赖的临时扫码载体，可还原 payload；标准 QR 纠错编码属于后续平台 UI 层实现。
- 移动端 pairing client 负责扫描桌面 pairing matrix、还原桌面 payload、生成 near-field endpoint descriptor、向桌面 `/pairing` 发送移动端 payload，校验桌面返回的 verification，并在用户确认同一 6 位验证码后写入可信桌面设备。
- 桌面预览壳的 `/api/pairing/confirm` 必须收到远端配对 payload 和正确 6 位校验码，才会把对方写入可信设备列表。
- 桌面 runtime-state 与保险库 snapshot 分离保存：runtime-state 可保存提醒投递状态和 trusted devices，保险库 snapshot 只保存用户保险库数据。
- 移动 runtime-state 通过平台无关 adapter 保存提醒投递状态和 trusted devices；React Native/Expo 阶段应映射到本地文件、Keychain/Keystore 或安全存储组合。
- 桌面端和移动端的局域网、热点、蓝牙或离线包传输层必须调用 `handleNearFieldRequest`，不能绕过信任校验直接写入本地变更日志。
- `/pairing` 仅返回配对校验信息，不自动信任设备；用户确认 6 位验证码后才写入可信设备列表。
- `/sync/summary` 返回本机摘要，用于计算对端缺失变更；摘要只包含记录标题、类型、版本、更新时间和字段元数据，不包含字段值或密文。
- `/sync/preview` 必须先创建用户可见的确认请求，展示对方设备名、时间、传输方式和变更摘要。
- `/sync/receive` 接收确认绑定的加密变更交换包；记录快照只存在于加密 envelope 内，接收端本地解密后写入自己的 vault snapshot。
- 删除记录时，UI 主 vault 可以硬删，但同步层必须在本机保存与当前 vaultId 绑定的删除 tombstone。同步摘要和预览用 tombstone 显示 `delete` 操作，真正同步时通过加密 `record-delete-v1` payload 让接收端删除对应记录。
- 同步包密钥必须绑定本机设备、对端设备、公钥、`sessionId` 和 `confirmationId`。当前 MVP 使用设备对材料派生会话密钥；正式版本应替换为基于配对 transcript 的 ECDH/原生安全密钥协商。
- 冲突不能静默覆盖。用户在预览 UI 中选择的字段级手动合并决策会映射到底层运行时冲突，并把所选字段写回接收端本地 vault。
- 同步执行失败也必须写入本地回执。已确认后发起的 outgoing sync 若对端接收失败，发送端保存 `status: "failure"`、对端设备、时间、发送/接收/冲突数量、package id、传输方式和错误信息。

## Sync Trust Gate

- Discovery is not trust. A desktop, phone, or tablet discovered through localhost, LAN, hotspot, Bluetooth, or an offline package cannot preview, push, or receive sync data until it is already in the local trusted-device list.
- First trust must come from face-to-face QR pairing plus the six-digit verification code. The trusted entry stores the peer device id, name, kind, and public key; later sync rejects a peer whose public key no longer matches that trusted entry.
- Each terminal owns a local device identity file with device id, display name, kind, and a generated local public key. Legacy fixed preview public keys are migrated on load, and sync peer discovery should use `/api/sync/summary` to read the actual peer identity instead of inferring keys from generic app-state.
- Phone and tablet trust flows both consume desktop QR payload text and a matching six-digit code before writing a trusted desktop. Direct trusted-device writes are reserved for explicit test setup and internal fixtures, not the product path. During the MVP transition, terminals accept both historical six-digit derivations for the same QR payload so older preview surfaces and newer QR scans can interoperate.
- Every later sync still requires an in-app preview confirmation. The confirmation must show peer device name, request time, transport, and create/update/delete/conflict summary before an encrypted package is exchanged.
- A sync confirmation is single-use. After the approved package exchange succeeds it becomes `confirmed`; after an outgoing receive failure it becomes `failed` and the failure receipt is persisted. Retrying must start with a fresh summary/preview so the user confirms the current change set again.
- Before sending, each active terminal recomputes the safe preview signature from current local records and the peer's current `/api/sync/summary`. If the send/receive/conflict signature differs from the stored confirmation, the package exchange is rejected and the user must review a fresh preview.
- Receive endpoints must check the trusted-device list before decrypting package ciphertext. Encrypted package metadata can identify the claimed sender/session, but record payloads remain unavailable until the sender identity matches a trusted device.
- Product terminal receive endpoints must not accept plaintext exchange packages. `exchangePackage` remains useful inside `sync-core` and pure protocol tests, but desktop, phone, and tablet HTTP receive APIs require `encryptedPackage` so record payloads are always transported under the session-bound envelope.
- Pairing QR payloads must advertise the current temporary local endpoint, session id, and expiry. Preview HTTP servers derive the endpoint from the active request host unless an explicit endpoint override is supplied for tests.
- Desktop, phone, and tablet are all sync-capable terminal roles. Tablet can now initiate a preview-confirmed encrypted sync push to desktop, while desktop can still push to phone/tablet and phone can push to desktop.
- Conflict UI is required on active sync senders. Desktop, phone, and tablet must surface conflict records and changed fields before apply; tablet now exposes the same decision families as the other terminals, including field-level manual merge.

## 安全边界

- 主密码不上传、不保存明文。
- OCR 默认本地执行。
- 附件作为加密 blob 保存。
- 拍照或导入附件先生成版本化加密 blob，再把 digest、密文大小、MIME 和加密路径写入记录元数据。
- 字段密文使用版本化封装；当前可运行 fallback 为 WebCrypto AES-GCM + PBKDF2-SHA-256，最终优先接入 Argon2id/XChaCha20-Poly1305。
- 敏感字段默认隐藏。
- 高敏字段可要求二次验证。
- 复制到剪贴板后需要自动清除。
- UI 不直接持有可绕过策略的明文字段；字段显示和复制必须通过本地 runtime/API 的 reveal 决策。
- 同步冲突不能静默覆盖。

## MVP 技术建议

- 桌面终端：Tauri + React + TypeScript。
- 移动/平板终端：React Native / Expo Dev Client。
- 本地数据库：SQLite + 应用层字段加密。
- 加密：优先 libsodium/XChaCha20-Poly1305，按平台封装统一接口。
- OCR：移动端优先系统 OCR 或 ML Kit 本地能力；桌面端先验证 Tesseract 或系统 OCR。

## 非目标

- 不做网页/PWA。
- 不做公共云账号。
- 不做云端保险库存储。
- 不做云端自动备份。
- 不做云端 OCR。
- 不做浏览器自动填充插件。
