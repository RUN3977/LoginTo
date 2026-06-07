# 近场同步协议设计

## 概览

LoginTo 的近场同步采用**完全去中心化**的设计，所有同步操作在设备之间直接进行。

## 同步模式

### 1. 扫码配对（QR Code Pairing）

**流程：**

```
设备 A（二维码生成方）
  ↓
1. 生成一次性密钥对（ECDH）
2. 生成 QR 码：{deviceId, deviceName, publicKey, salt}
3. 显示 QR 码
  ↓
设备 B（扫码方）
  ↓
4. 扫描 QR 码，解析信息
5. 验证 deviceId 和 deviceName
6. 存储设备公钥到 paired_devices 表
7. 发送确认信号
  ↓
设备 A
  ↓
8. 接收确认，配对完成
```

**QR 码内容格式：**

```json
{
  "version": "1.0",
  "type": "pairing",
  "device_id": "uuid-xxx",
  "device_name": "iPhone 13",
  "public_key": "base64_encoded_ecdh_public_key",
  "timestamp": 1234567890
}
```

### 2. 局域网同步（LAN Sync）

**发现机制：**

```
设备 A（mDNS 广播）
  ↓
1. 启动 mDNS 服务：_loginto._tcp.local.
2. 广播：{deviceId, deviceName, ipAddress, port}
3. 监听其他设备的广播
  ↓
设备 B（监听）
  ↓
4. 接收广播，获得设备 A 的地址
5. 连接到 A 的端口
6. 进行握手验证
7. 开始同步数据
```

### 3. 离线同步包（Offline Sync Package）

**生成流程：**

```
设备 A（导出）
  ↓
1. 收集所有数据
2. 序列化为 JSON
3. AES-256-GCM 加密
4. 生成加密包：loginto_sync_YYYYMMDD_HHMMSS.lpkg
  ↓
设备 B（导入）
  ↓
5. 导入 .lpkg 文件
6. 解密并验证数据
7. 冲突检测 → 合并
8. 更新本地数据库
```

## 冲突解决策略

### LWW（Last-Write-Wins）

```
if A.updated_at > B.updated_at:
  use A
elif B.updated_at > A.updated_at:
  use B
else:
  use lexicographically_larger_uuid
```

## 传输安全

### 密钥交换（ECDH）

```
设备 A                          设备 B
生成密钥对 (sk_a, pk_a)  ←→  生成密钥对 (sk_b, pk_b)

通过二维码或信号传输：
  A 发送 pk_a 给 B
  B 发送 pk_b 给 A

共享密钥：
  shared_secret = ECDH(sk_a, pk_b) = ECDH(sk_b, pk_a)
  session_key = KDF(shared_secret)
```

### 消息完整性

所有同步消息都加上 HMAC 签名。

## 性能优化

### 增量同步

仅同步：
- 最近修改的记录
- 新创建的记录
- 已删除的记录

### 压缩

原始数据 → 压缩 → 加密 → 传输

### 批量操作

合并多个小操作为一个同步事务。
