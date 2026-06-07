# 数据模型设计

## 概览

LoginTo 的所有用户数据存储在本地 SQLite 数据库中，敏感字段通过 AES-256-GCM 加密。

## 表结构

### 1. records（私密记录）

存储各类账号、卡片、证件等主记录。

```sql
CREATE TABLE records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  username TEXT,
  password TEXT,
  fields TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `uuid` | TEXT | UUID v4，全局唯一，用于同步 |
| `type` | TEXT | `login`, `bank_card`, `identity`, `membership`, `custom` 等 |
| `password` | TEXT | 加密存储的密码 |
| `fields` | TEXT | JSON 序列化的自定义字段 |
| `deleted_at` | INTEGER | 软删除标记 |

**记录类型示例：**

```json
{
  "type": "login",
  "title": "GitHub",
  "username": "john_doe",
  "password": "encrypted_pwd_hash",
  "fields": {
    "email": "john@example.com",
    "2fa_enabled": true,
    "recovery_codes": "encrypted_codes"
  },
  "created_at": 1234567890,
  "updated_at": 1234567890
}
```

### 2. attachments（附件）

```sql
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  record_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  filetype TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(record_id) REFERENCES records(id)
);
```

### 3. reminders（提醒）

```sql
CREATE TABLE reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  record_id INTEGER NOT NULL,
  due_at INTEGER NOT NULL,
  repeat_rule TEXT,
  is_triggered INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(record_id) REFERENCES records(id)
);
```

**repeat_rule 示例：**

```json
{
  "frequency": "monthly",
  "interval": 1,
  "end_date": null,
  "on_day": 15
}
```

### 4. sync_logs（同步日志）

```sql
CREATE TABLE sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  action TEXT NOT NULL,
  device_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  details TEXT,
  status TEXT
);
```

### 5. paired_devices（配对设备）

```sql
CREATE TABLE paired_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT UNIQUE NOT NULL,
  device_name TEXT NOT NULL,
  public_key TEXT NOT NULL,
  paired_at INTEGER NOT NULL,
  last_synced_at INTEGER,
  is_active INTEGER DEFAULT 1
);
```

## 数据加密策略

### 加密字段

以下字段在数据库中加密存储：

1. **password** — 完整加密
2. **fields** — 完整加密（JSON 序列化后加密）
3. **attachments.data** — 完整加密
4. **sync_logs.details** — 完整加密

### 加密格式

```
Base64(nonce(12 bytes) + ciphertext + mac(16 bytes))
```

- **Nonce**：随机生成，12 字节
- **Ciphertext**：AES-256-GCM 加密的数据
- **MAC**：16 字节认证码

## 主密钥管理

### 密钥派生

```
主密钥 = PBKDF2(密码, 盐, 100000次迭代, SHA-256, 256位)
```

- **盐**：16 字节随机值，与密钥一起存储
- **迭代次数**：100,000
- **哈希函数**：SHA-256

### 密钥存储

- 主密钥**不持久化存储**
- 用户每次启动应用时需要输入密码
- 密钥派生后存储在内存中，应用关闭后清除

## 软删除策略

记录不会直接删除，而是通过设置 `deleted_at` 标记为已删除。

**优点：**
- 同步时能检测到删除操作
- 可以恢复已删除的记录
- 完整的操作审计轨迹

**查询活跃记录：**

```sql
SELECT * FROM records WHERE deleted_at IS NULL;
```

## 索引优化

```sql
CREATE INDEX idx_records_type ON records(type);
CREATE INDEX idx_records_updated_at ON records(updated_at);
CREATE INDEX idx_reminders_due_at ON reminders(due_at);
CREATE INDEX idx_sync_logs_timestamp ON sync_logs(timestamp);
```

## 数据一致性

### 事务管理

```dart
await db.transaction((txn) async {
  // 同时插入记录和同步日志
  await txn.insert('records', recordData);
  await txn.insert('sync_logs', logData);
});
```

### 外键约束

所有外键关系都需要满足引用完整性。

## 备份与恢复

### 导出

```
本地数据库 → 加密 → 文件导出
```

### 导入

```
导入文件 → 验证 → 解密 → 合并到数据库
```
