# 加密设计方案

## 概览

LoginTo 使用业界标准的密码学算法，确保数据的机密性、完整性和真实性。

## 算法选择

### 密钥派生：PBKDF2

**参数：**
- 哈希函数：SHA-256
- 迭代次数：100,000
- 输出长度：256 位（32 字节）
- 盐长度：16 字节

**为什么选择 PBKDF2？**
- 专为密码派生设计
- 抵抗字典攻击和彩虹表
- 迭代次数可调，应对硬件加速
- 广泛支持

### 对称加密：AES-256-GCM

**参数：**
- 密钥大小：256 位
- 模式：GCM（Galois/Counter Mode）
- Nonce 长度：96 位（12 字节）
- Tag 长度：128 位（16 字节）

**为什么选择 AES-256-GCM？**
- 认证加密（AEAD），防止篡改
- 并发友好，高性能
- NIST 推荐标准
- 硬件加速支持

### 消息认证：HMAC-SHA256

用于签名同步数据包，防止中间人攻击。

## 密钥管理流程

### 初始化阶段

```
用户设置密码
  ↓
生成随机盐（16 字节）
  ↓
PBKDF2 派生主密钥
  ↓
在内存中保持主密钥
  ↓
盐存储在数据库中
```

### 运行时加解密

```
用户输入密码
  ↓
从数据库读取盐
  ↓
PBKDF2 派生密钥
  ↓
加载或清除内存中的密钥
```

## 数据加密实现

### 加密过程

```dart
Uint8List encrypt(SecretKey key, List<int> plaintext) {
  // 1. 生成随机 nonce
  nonce = random.nextBytes(12);
  
  // 2. AES-256-GCM 加密
  (ciphertext, tag) = AES256GCM.encrypt(plaintext, key, nonce);
  
  // 3. 返回 nonce || ciphertext || tag
  return nonce + ciphertext + tag;
}
```

### 解密过程

```dart
List<int> decrypt(SecretKey key, Uint8List encrypted) {
  // 1. 分离 nonce、密文、tag
  nonce = encrypted[0:12];
  ciphertext = encrypted[12:-16];
  tag = encrypted[-16:];
  
  // 2. 验证 MAC 并解密
  plaintext = AES256GCM.decrypt(ciphertext, key, nonce, tag);
  
  // 返回明文
  return plaintext;
}
```

## 同步安全设计

### 端到端加密

1. **配对阶段**：交换公钥（QR 码）
2. **密钥协商**：ECDH 生成对称密钥
3. **数据传输**：使用派生的对称密钥加密数据
4. **验证**：HMAC 签名验证完整性

### 传输格式

```
[Header]
  - protocol_version: 1
  - packet_type: data_sync
  - device_id: uuid
  - timestamp: unix_timestamp

[Encrypted Payload]
  - nonce (12 bytes)
  - encrypted_data
  - hmac_signature
```

## 安全最佳实践

### ✅ 实施的措施

1. **恒定时间比较** - 防止时序攻击
2. **内存清理** - 敏感数据使用后立即清除
3. **随机数生成** - 使用加密安全的 RNG
4. **密钥派生参数** - 高迭代次数和足够长的盐

### ⚠️ 已知限制

1. **离线密钥破解** - 需要使用足够强的密码
2. **设备物理攻击** - 应用锁定和定期密码更改
3. **同步信道安全** - 依赖 WiFi 或蓝牙安全

## 参考资源

- [NIST SP 800-132: PBKDF](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf)
- [OWASP: Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
