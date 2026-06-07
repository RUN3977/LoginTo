# 架构设计文档

## 整体架构

LoginTo 采用分层架构设计，清晰划分各模块职责。

```
┌─────────────────────────────────────────┐
│        Presentation Layer               │
│  (UI Components, Pages, Dialogs)        │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│      Application Layer                  │
│  (State Management, Use Cases)          │
│  (Riverpod Providers)                   │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│        Domain Layer                     │
│  (Entities, Repositories Interface)     │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│        Data Layer                       │
│  (Repository Impl, Data Sources)        │
│  ├─ Local: SQLite + Encryption          │
│  ├─ Sync: mDNS + LAN/BLE                │
│  └─ Cache: In-memory                    │
└─────────────────────────────────────────┘
```

## 模块划分

### Core 模块

#### 1. **crypto/** - 加密服务
- `encryption_service.dart` - 核心加密/解密逻辑
- PBKDF2 密钥派生
- AES-256-GCM 对称加密
- HMAC-SHA256 签名验证

#### 2. **database/** - 数据库层
- `database_service.dart` - SQLite 初始化和迁移
- `models/` - 数据模型
  - `record_model.dart` - 私密记录模型
  - `attachment_model.dart` - 附件模型
  - `reminder_model.dart` - 提醒模型
  - `sync_log_model.dart` - 同步日志模型
- `repositories/` - 数据访问层
  - `record_repository.dart` - 记录 CRUD
  - `attachment_repository.dart` - 附件管理
  - `reminder_repository.dart` - 提醒管理
  - `sync_log_repository.dart` - 日志记录

#### 3. **sync/** - 同步引擎
- `sync_protocol.dart` - 同步协议定义
- `sync_service.dart` - 同步业务逻辑
- `lan_sync_service.dart` - 局域网同步
- `qr_sync_service.dart` - 二维码配对
- `conflict_resolver.dart` - 冲突解决算法

#### 4. **extensions/** - 工具函数
- `date_extensions.dart` - 日期时间工具
- `string_extensions.dart` - 字符串工具
- `list_extensions.dart` - 集合工具

### Features 模块

#### 1. **vault/** - 保险库主界面
- `presentation/pages/` - 页面
- `presentation/providers/` - 状态管理
- `presentation/widgets/` - 组件
- `data/` - 数据操作

#### 2. **records/** - 记录管理
- 新增记录
- 编辑记录
- 删除记录
- 搜索记录

#### 3. **smart_import/** - 智能整理
- OCR 文字识别
- 字段自动提取
- 人工审核界面

#### 4. **reminders/** - 提醒系统
- 设置到期提醒
- 本地通知推送
- 重复规则管理

#### 5. **pairing/** - 设备配对
- 二维码生成/扫描
- 公钥交换
- 配对验证

#### 6. **sync/** - 同步管理
- 手动触发同步
- 自动发现设备
- 同步状态显示
- 冲突处理

#### 7. **settings/** - 设置
- 账户设置
- 安全设置
- 导出备份
- 关于应用

### UI 模块

#### 1. **components/** - 可复用组件
- 输入框
- 按钮
- 卡片
- 对话框

#### 2. **dialogs/** - 对话框
- 确认对话框
- 输入对话框
- 加载对话框

#### 3. **themes/** - 主题配置
- 颜色方案
- 字体样式
- 尺寸规范

## 数据流

### 添加新记录的流程

```
UI (输入表单)
  ↓
Provider (状态管理)
  ↓
RecordRepository (数据访问)
  ↓
EncryptionService (加密敏感字段)
  ↓
DatabaseService (存储到 SQLite)
  ↓
SyncService (生成同步日志)
```

### 同步的流程

```
用户触发同步
  ↓
SyncService.startSync()
  ├─ 设备发现 (mDNS)
  ├─ 连接验证 (握手)
  ├─ 差异检测 (比较时间戳)
  ├─ 数据打包 (加密)
  ├─ 冲突解决 (LWW 算法)
  └─ 数据合并 (更新数据库)
```

## 加密策略

### 密钥管理

```
用户密码
  ↓
PBKDF2 (100,000 迭代)
  ↓
主密钥 (AES-256 密钥)
  ├─ 保存在内存中
  └─ 应用关闭时清除
```

### 数据加密

所有敏感字段使用 AES-256-GCM 加密：
- `records.password`
- `records.fields`
- `attachments.data`
- `sync_logs.details`

加密格式：
```
Base64(nonce(12) + ciphertext + mac(16))
```

## 状态管理

使用 **Riverpod** 作为状态管理方案：

```dart
// 示例：记录列表 Provider
final recordsProvider = FutureProvider((ref) async {
  final repository = ref.watch(recordRepositoryProvider);
  return repository.getAllRecords();
});

// 使用 Provider
class RecordListWidget extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final records = ref.watch(recordsProvider);
    // UI 逻辑
  }
}
```

## 性能优化

### 数据库
- 使用索引加速查询
- 分页加载大数据集
- 事务处理确保一致性

### 加密
- 异步执行密钥派生
- 使用流式加密处理大文件
- 内存中缓存派生密钥

### 同步
- 增量同步只传输变化
- 使用压缩减少传输量
- 批量操作合并事务

## 安全设计

### 最小权限
- 应用只申请必要权限
- 敏感操作需要用户确认

### 输入验证
- 所有用户输入都要验证
- SQL 参数化防止注入

### 日志管理
- 不记录敏感信息到日志
- 日志仅存储操作类型和时间

## 扩展性

### 添加新的记录类型

1. 在 `RecordModel` 中定义新类型常量
2. 在 UI 中添加对应表单
3. 在 `smart_import` 中添加识别规则

### 添加新的同步通道

1. 实现 `SyncChannelInterface`
2. 在 `SyncService` 中注册新通道
3. 编写对应的 UI 交互

## 依赖注入

使用 GetIt 管理依赖：

```dart
// 注册依赖
getIt.registerSingleton<DatabaseService>(DatabaseService());
getIt.registerSingleton<EncryptionService>(EncryptionService());
getIt.registerSingleton<RecordRepository>(
  RecordRepository(getIt<DatabaseService>().database),
);

// 使用依赖
final repo = getIt<RecordRepository>();
```

## 测试策略

### 单元测试
- 加密/解密逻辑
- 冲突解决算法
- 数据模型验证

### 集成测试
- 数据库操作
- 完整的同步流程
- UI 交互

### 测试覆盖率
目标：>80% 代码覆盖率
