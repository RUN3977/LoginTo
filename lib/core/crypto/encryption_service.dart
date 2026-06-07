import 'dart:convert';
import 'dart:typed_data';
import 'package:cryptography/cryptography.dart';

/// 加密服务类：处理所有加密/解密操作
class EncryptionService {
  static const int _pbkdf2Iterations = 100000;
  static const int _pbkdf2Bits = 256;
  static const int _saltLength = 16;
  static const int _nonceLength = 12;
  
  final AesGcm _aesGcm = AesGcm.with256bits();
  final Pbkdf2 _pbkdf2 = Pbkdf2(
    macAlgorithm: Hmac.sha256(),
    iterations: _pbkdf2Iterations,
    bits: _pbkdf2Bits,
  );

  /// 从密码派生主加密密钥
  /// 使用 PBKDF2 和随机盐，返回 (密钥, 盐)
  Future<(SecretKey key, Uint8List salt)> deriveKeyFromPassword(
    String password,
  ) async {
    final salt = _generateRandomBytes(_saltLength);
    final key = await _pbkdf2.deriveKey(
      secretKey: SecretKey(utf8.encode(password)),
      nonce: salt,
    );
    return (key, salt);
  }

  /// 使用已知的盐从密码派生密钥
  Future<SecretKey> deriveKeyFromPasswordWithSalt(
    String password,
    Uint8List salt,
  ) async {
    return await _pbkdf2.deriveKey(
      secretKey: SecretKey(utf8.encode(password)),
      nonce: salt,
    );
  }

  /// 加密数据：返回 nonce + 密文 + MAC（用于存储）
  Future<Uint8List> encrypt(SecretKey key, List<int> plainData) async {
    final nonce = _aesGcm.newNonce();
    final secretBox = await _aesGcm.encrypt(
      plainData,
      secretKey: key,
      nonce: nonce,
    );

    // 格式：[nonce(12) + ciphertext + mac(16)]
    final encrypted = Uint8List.fromList(
      nonce + secretBox.cipherText + secretBox.mac.bytes,
    );

    return encrypted;
  }

  /// 加密字符串
  Future<String> encryptString(SecretKey key, String plainText) async {
    final encrypted = await encrypt(key, utf8.encode(plainText));
    return base64.encode(encrypted);
  }

  /// 解密数据
  Future<List<int>> decrypt(SecretKey key, Uint8List encrypted) async {
    if (encrypted.length < _nonceLength + 16) {
      throw Exception('Encrypted data too short');
    }

    final nonce = encrypted.sublist(0, _nonceLength);
    final ciphertext = encrypted.sublist(_nonceLength, encrypted.length - 16);
    final mac = encrypted.sublist(encrypted.length - 16);

    final secretBox = SecretBox(
      ciphertext,
      nonce: nonce,
      mac: Mac(mac),
    );

    try {
      return await _aesGcm.decrypt(secretBox, secretKey: key);
    } catch (e) {
      throw Exception('Decryption failed: $e');
    }
  }

  /// 解密字符串
  Future<String> decryptString(SecretKey key, String encryptedBase64) async {
    final encrypted = base64.decode(encryptedBase64);
    final decrypted = await decrypt(key, encrypted);
    return utf8.decode(decrypted);
  }

  /// 生成随机字节
  Uint8List _generateRandomBytes(int length) {
    final random = SecureRandom('random');
    return random.nextBytes(length);
  }

  /// 验证密码正确性（恒定时间比较）
  bool verifyPassword(String password, String hashedPassword) {
    return _constantTimeEquals(password, hashedPassword);
  }

  /// 恒定时间字符串比较
  bool _constantTimeEquals(String a, String b) {
    final aBytes = utf8.encode(a);
    final bBytes = utf8.encode(b);

    if (aBytes.length != bBytes.length) {
      return false;
    }

    int result = 0;
    for (int i = 0; i < aBytes.length; i++) {
      result |= aBytes[i] ^ bBytes[i];
    }

    return result == 0;
  }

  /// 生成 UUID
  String generateUUID() {
    final bytes = _generateRandomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    return '${_bytesToHex(bytes.sublist(0, 4))}-'
        '${_bytesToHex(bytes.sublist(4, 6))}-'
        '${_bytesToHex(bytes.sublist(6, 8))}-'
        '${_bytesToHex(bytes.sublist(8, 10))}-'
        '${_bytesToHex(bytes.sublist(10, 16))}';
  }

  /// 字节转十六进制字符串
  String _bytesToHex(List<int> bytes) {
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  /// 生成 HMAC 签名
  Future<String> generateHmacSignature(
    SecretKey key,
    List<int> data,
  ) async {
    final hmac = Hmac.sha256();
    final signature = await hmac.calculateMac(
      data,
      secretKey: key,
    );
    return base64.encode(signature.bytes);
  }

  /// 验证 HMAC 签名
  Future<bool> verifyHmacSignature(
    SecretKey key,
    List<int> data,
    String signatureBase64,
  ) async {
    final expectedSignature = await generateHmacSignature(key, data);
    return _constantTimeEquals(expectedSignature, signatureBase64);
  }
}
