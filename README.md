# LoginTo 🔐

> **本地优先 · 用户可控 · 多终端近场同步**

LoginTo 是一款专为隐私设计的多终端私密数据管理工具。所有账号、银行卡、证件、密钥等敏感信息完全加密存储在本地，用户拥有绝对控制权，无需中心账号，无公共云上传。

## ✨ 核心特性

### 🔒 本地优先 + 用户可控
- **完全本地加密存储**：所有数据、附件、同步日志默认存于本地加密保险库
- **无中心账号**：MVP 阶段不引入云登录，没有单点故障风险
- **数据所有权**：用户决定数据在哪里、何时、如何同步

### 🤝 智能多终端同步
- **扫码配对**：手机与平板/电脑扫描二维码快速配对
- **局域网同步**：同一 WiFi 下自动发现并传输数据
- **热点共享**：通过手机热点连接其他设备
- **离线同步包**：生成加密同步文件，支持 USB/蓝牙传输

### 📸 智能整理
- **本地 OCR**：拍照或导入图片后自动提取文字信息
- **字段识别**：智能识别账号、密码、卡号等字段
- **人工审核**：生成待确认记录，用户验证后保存

### ⏰ 可靠提醒
- **到期提醒**：银行卡有效期、会员过期、证件失效、合同到期等
- **本地通知**：完全依赖本地系统，无云端依赖
- **灵活规则**：支持单次、每周、每月、每年等重复设置

### 📋 灵活的记录类型
支持以下预设类型及完全自定义：
- 社交账号（微博、微信、QQ、抖音等）
- 网站账号（邮箱、论坛、云盘等）
- 银行卡（储蓄卡、信用卡）
- 会员信息（航空、酒店、购物等）
- 证件（身份证、护照、驾驶证）
- 密钥和令牌（SSH、API Key、2FA）
- 自定义字段（根据需求扩展）

## 🏗 项目结构

```
LoginTo/
├── lib/
│   ├── core/
│   │   ├── crypto/              # 加密模块 (AES-256-GCM, PBKDF2)
│   │   ├── database/            # 数据库层 (SQLite, 模型定义)
│   │   ├── sync/                # 同步引擎 (近场通信, 冲突解决)
│   │   └── extensions/          # 工具函数扩展
│   ├── features/
│   │   ├── vault/               # 保险库主界面
│   │   ├── records/             # 记录增删改查
│   │   ├── smart_import/        # OCR 图片导入
│   │   ├── reminders/           # 提醒系统
│   │   ├── pairing/             # 设备配对
│   │   ├── sync/                # 同步管理界面
│   │   └── settings/            # 设置与备份
│   ├── ui/
│   │   ├── components/          # 可复用 UI 组件
│   │   ├── dialogs/             # 对话框
│   │   └── themes/              # 主题配置
│   └── main.dart
├── test/
│   ├── unit/                    # 单元测试
│   └── integration/             # 集成测试
├── docs/
│   ├── architecture.md          # 架构设计文档
│   ├── data-model.md            # 数据模型与 SQLite Schema
│   ├── encryption.md            # 加密方案详解
│   ├── sync-protocol.md         # 近场同步协议
│   └── dev-guide.md             # 开发指南
├── pubspec.yaml                 # Flutter 依赖配置
├── pubspec.lock
├── .gitignore
└── CONTRIBUTING.md
```

## 🚀 快速开始

### 前置要求
- Flutter 3.0+
- Dart 3.0+
- iOS 12+, Android 6.0+ (或 Web/Desktop)

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/RUN3977/LoginTo.git
cd LoginTo

# 2. 获取依赖
flutter pub get

# 3. 运行应用
flutter run

# 4. 运行测试
flutter test
```

## 📚 文档

| 文档 | 内容 |
|-----|------|
| [architecture.md](docs/architecture.md) | 整体架构、分层设计、模块职责 |
| [data-model.md](docs/data-model.md) | SQLite 表结构、字段设计、数据流 |
| [encryption.md](docs/encryption.md) | 密钥派生、加密算法、安全实现 |
| [sync-protocol.md](docs/sync-protocol.md) | 近场通信、冲突解决、同步流程 |
| [dev-guide.md](docs/dev-guide.md) | 开发环境配置、编码规范、贡献流程 |

## 🔑 核心模块

### 加密模块（lib/core/crypto）
- **PBKDF2 密钥派生**：使用 100,000 次迭代 + 随机盐
- **AES-256-GCM**：认证加密，防止篡改
- **安全的密码验证**：使用恒定时间比较

### 存储模块（lib/core/database）
- **SQLite 数据库**：轻量、可靠、跨平台
- **加密字段**：敏感数据自动加密存储
- **事务支持**：确保数据一致性
- **附件管理**：支持图片、文档等二进制附件

### 同步模块（lib/core/sync）
- **设备发现**：mDNS / 局域网广播
- **配对管理**：QR 码交换公钥
- **数据传输**：分块加密传输，支持断点续传
- **冲突解决**：基于最后修改时间戳的 LWW 算法
- **同步日志**：完整的操作记录用于审计

### 智能整理模块（lib/features/smart_import）
- **本地 OCR**：Google ML Kit / iOS CoreML / Android ML Kit
- **字段提取**：正则表达式识别常见字段
- **人工审核界面**：预览并修正识别结果

### 提醒系统（lib/features/reminders）
- **本地通知**：Flutter Local Notifications
- **精确触发**：基于系统时间，无服务端依赖
- **重复规则**：支持灵活的重复设置

## 🔄 开发路线图

### Phase 1: 核心基础 (Week 1-2)
- [ ] 项目初始化、依赖配置
- [ ] 加密模块实现（PBKDF2、AES-GCM）
- [ ] SQLite 数据库初始化、迁移框架
- [ ] 基础 UI 框架、主题定义

### Phase 2: 本地功能 (Week 3-4)
- [ ] 完整记录类型（账号、卡、证件等）
- [ ] CRUD 操作界面
- [ ] 附件存储与预览
- [ ] 搜索、过滤、标签分类
- [ ] 本地备份导出

### Phase 3: 智能整理 (Week 5)
- [ ] 本地 OCR 集成
- [ ] 字段自动提取与映射
- [ ] 人工审核与修正界面

### Phase 4: 近场同步 (Week 6-8)
- [ ] QR 码配对（密钥交换）
- [ ] LAN 设备发现（mDNS）
- [ ] 加密数据传输
- [ ] 冲突检测与合并算法
- [ ] 同步日志与状态管理

### Phase 5: 提醒系统 (Week 9)
- [ ] 到期日期管理
- [ ] 本地系统通知
- [ ] 重复规则引擎

### Phase 6: 测试 & 优化 (Week 10+)
- [ ] 单元测试覆盖
- [ ] 集成测试
- [ ] 性能优化
- [ ] 安全审计

## 🛠 技术栈

| 组件 | 选择 | 说明 |
|-----|------|------|
| **UI 框架** | Flutter | 一套代码支持 iOS/Android/Web |
| **数据库** | SQLite + sqflite | 轻量跨平台，支持加密 |
| **加密** | pointycastle / cryptography | PBKDF2, AES-GCM |
| **近场通信** | mdns_sd + socket | mDNS 发现、LAN 通信 |
| **OCR** | ml_kit (Google) | 本地离线识别 |
| **通知** | flutter_local_notifications | 本地系统通知 |
| **状态管理** | Riverpod / Provider | 响应式状态管理 |
| **JSON 序列化** | json_serializable | 类型安全的序列化 |

## 🔐 安全设计原则

1. **数据从不上云**：所有敏感数据仅存储于本地加密数据库
2. **端到端加密**：同步时使用独立的加密通道，无中间人
3. **用户掌控密钥**：主密钥从用户密码派生，服务端无备份
4. **开源透明**：所有加密逻辑开源可审，接受安全研究员审计
5. **最小权限**：仅请求必要权限（存储、网络、通知）

## 📝 贡献指南

我们欢迎所有形式的贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

### 常见贡献类型
- 🐛 **报告 Bug**：提交 Issue 时请包含复现步骤
- ✨ **功能建议**：讨论区或 Issue 分享你的想法
- 📖 **改进文档**：修复错别字或补充说明
- 🔧 **代码贡献**：提交 PR 实现新功能或修复
- 🔍 **安全审计**：报告安全问题请邮件至 `security@loginto.app`

## 📄 许可证

LoginTo 采用 **MIT License**。详见 [LICENSE](LICENSE) 文件。

## 📞 联系方式

- **GitHub Issues**：功能讨论、Bug 报告
- **Discussions**：一般问题、经验分享
- **Email**：`hello@loginto.app`
- **微信群/QQ 群**：（待建立）

---

**LoginTo** 致力于让每个人都能安全、自主地管理自己的私密数据。

🌟 如果觉得有帮助，请给个 Star！
