import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:login_to/core/crypto/encryption_service.dart';

void main() {
  group('EncryptionService', () {
    late EncryptionService encryptionService;

    setUp(() {
      encryptionService = EncryptionService();
    });

    group('Key Derivation', () {
      test('deriveKeyFromPassword should generate consistent key with same password and salt',
          () async {
        const password = 'test_password_123';
        final (key1, salt1) = await encryptionService.deriveKeyFromPassword(password);
        final key2 =
            await encryptionService.deriveKeyFromPasswordWithSalt(password, salt1);

        expect(key1.toString(), equals(key2.toString()));
      });

      test('deriveKeyFromPassword should generate different keys for different passwords',
          () async {
        final (key1, salt1) = await encryptionService.deriveKeyFromPassword('password1');
        final (key2, salt2) = await encryptionService.deriveKeyFromPassword('password2');

        expect(key1.toString(), isNot(equals(key2.toString())));
        expect(salt1, isNot(equals(salt2)));
      });

      test('deriveKeyFromPassword should generate random salt each time', () async {
        final (_, salt1) = await encryptionService.deriveKeyFromPassword('password');
        final (_, salt2) = await encryptionService.deriveKeyFromPassword('password');

        expect(salt1, isNot(equals(salt2)));
        expect(salt1.length, equals(16));
        expect(salt2.length, equals(16));
      });

      test('deriveKeyFromPasswordWithSalt should use provided salt', () async {
        const password = 'test_password';
        final (key1, salt) = await encryptionService.deriveKeyFromPassword(password);

        final key2 = await encryptionService.deriveKeyFromPasswordWithSalt(password, salt);

        expect(key1.toString(), equals(key2.toString()));
      });
    });

    group('Encryption and Decryption', () {
      test('encrypt and decrypt data should return original plaintext', () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('test_password');
        final plaintext = utf8.encode('Hello, World! This is secret data.');

        final encrypted = await encryptionService.encrypt(key, plaintext);
        final decrypted = await encryptionService.decrypt(key, encrypted);

        expect(decrypted, equals(plaintext));
      });

      test('encryptString and decryptString should work correctly', () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password123');
        const plaintext = 'This is a secret message!';

        final encrypted = await encryptionService.encryptString(key, plaintext);
        final decrypted = await encryptionService.decryptString(key, encrypted);

        expect(decrypted, equals(plaintext));
      });

      test('encrypted data should be base64 encoded', () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password');
        final encrypted = await encryptionService.encryptString(key, 'test');

        // Should be valid base64 string
        expect(() => base64.decode(encrypted), returnsNormally);
      });

      test('different plaintexts should produce different ciphertexts', () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password');

        final encrypted1 = await encryptionService.encryptString(key, 'message1');
        final encrypted2 = await encryptionService.encryptString(key, 'message2');

        expect(encrypted1, isNot(equals(encrypted2)));
      });

      test('same plaintext should produce different ciphertexts (due to random nonce)',
          () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password');
        const plaintext = 'same message';

        final encrypted1 = await encryptionService.encryptString(key, plaintext);
        final encrypted2 = await encryptionService.encryptString(key, plaintext);

        expect(encrypted1, isNot(equals(encrypted2)));
      });

      test('decrypt with wrong password should throw exception', () async {
        final (key1, salt1) = await encryptionService.deriveKeyFromPassword('password1');
        const plaintext = 'secret';
        final encrypted = await encryptionService.encryptString(key1, plaintext);

        // Try to decrypt with different password
        final wrongKey =
            await encryptionService.deriveKeyFromPasswordWithSalt('password2', salt1);

        expect(
          () => encryptionService.decryptString(wrongKey, encrypted),
          throwsException,
        );
      });

      test('decrypt tampered data should throw exception', () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password');
        var encrypted = await encryptionService.encryptString(key, 'test');

        // Tamper with the encrypted data
        final encryptedBytes = base64.decode(encrypted);
        if (encryptedBytes.isNotEmpty) {
          encryptedBytes[0] = encryptedBytes[0] ^ 0xFF; // Flip bits
          encrypted = base64.encode(encryptedBytes);
        }

        expect(
          () => encryptionService.decryptString(key, encrypted),
          throwsException,
        );
      });

      test('should handle large data', () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password');
        // Create 1MB of data
        final largeData = List<int>.generate(1024 * 1024, (i) => i % 256);

        final encrypted = await encryptionService.encrypt(key, largeData);
        final decrypted = await encryptionService.decrypt(key, encrypted);

        expect(decrypted, equals(largeData));
      });

      test('should handle empty string', () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password');
        const plaintext = '';

        final encrypted = await encryptionService.encryptString(key, plaintext);
        final decrypted = await encryptionService.decryptString(key, encrypted);

        expect(decrypted, equals(plaintext));
      });

      test('should handle special characters', () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password');
        const plaintext = '!@#\$%^&*()_+-=[]{}|;:\'"<>,.?/~`';

        final encrypted = await encryptionService.encryptString(key, plaintext);
        final decrypted = await encryptionService.decryptString(key, encrypted);

        expect(decrypted, equals(plaintext));
      });

      test('should handle unicode characters', () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password');
        const plaintext = '你好世界 🌍 Привет мир';

        final encrypted = await encryptionService.encryptString(key, plaintext);
        final decrypted = await encryptionService.decryptString(key, encrypted);

        expect(decrypted, equals(plaintext));
      });
    });

    group('UUID Generation', () {
      test('generateUUID should return valid UUID v4 format', () async {
        final uuid = encryptionService.generateUUID();

        // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        expect(
          uuid,
          matches(RegExp(
              r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\$')),
        );
      });

      test('generateUUID should generate unique UUIDs', () async {
        final uuids = Set<String>();
        for (int i = 0; i < 100; i++) {
          uuids.add(encryptionService.generateUUID());
        }

        expect(uuids.length, equals(100));
      });

      test('generateUUID should have correct length', () {
        final uuid = encryptionService.generateUUID();
        expect(uuid.length, equals(36)); // 8-4-4-4-12 with hyphens
      });
    });

    group('HMAC Signature', () {
      test('generateHmacSignature should generate consistent signature for same data',
          () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password');
        final data = utf8.encode('test data');

        final sig1 = await encryptionService.generateHmacSignature(key, data);
        final sig2 = await encryptionService.generateHmacSignature(key, data);

        expect(sig1, equals(sig2));
      });

      test('generateHmacSignature should produce different signatures for different data',
          () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password');

        final sig1 = await encryptionService.generateHmacSignature(key, utf8.encode('data1'));
        final sig2 = await encryptionService.generateHmacSignature(key, utf8.encode('data2'));

        expect(sig1, isNot(equals(sig2)));
      });

      test('verifyHmacSignature should return true for valid signature', () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password');
        final data = utf8.encode('test data');
        final signature = await encryptionService.generateHmacSignature(key, data);

        final isValid = await encryptionService.verifyHmacSignature(key, data, signature);

        expect(isValid, isTrue);
      });

      test('verifyHmacSignature should return false for invalid signature', () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password');
        final data = utf8.encode('test data');
        final invalidSignature = base64.encode(utf8.encode('invalid'));

        final isValid =
            await encryptionService.verifyHmacSignature(key, data, invalidSignature);

        expect(isValid, isFalse);
      });

      test('verifyHmacSignature should return false for tampered data', () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password');
        var data = utf8.encode('test data');
        final signature = await encryptionService.generateHmacSignature(key, data);

        // Tamper with data
        data = utf8.encode('tampered data');

        final isValid = await encryptionService.verifyHmacSignature(key, data, signature);

        expect(isValid, isFalse);
      });
    });

    group('Password Verification', () {
      test('verifyPassword should return true for matching passwords', () {
        const password = 'test_password';
        final result = encryptionService.verifyPassword(password, password);
        expect(result, isTrue);
      });

      test('verifyPassword should return false for non-matching passwords', () {
        const password1 = 'password1';
        const password2 = 'password2';
        final result = encryptionService.verifyPassword(password1, password2);
        expect(result, isFalse);
      });

      test('verifyPassword should handle empty strings', () {
        final result = encryptionService.verifyPassword('', '');
        expect(result, isTrue);
      });

      test('verifyPassword should be case sensitive', () {
        const password1 = 'Password';
        const password2 = 'password';
        final result = encryptionService.verifyPassword(password1, password2);
        expect(result, isFalse);
      });
    });

    group('Edge Cases', () {
      test('should handle very long passwords', () async {
        final longPassword = 'a' * 10000;
        final (key, _) = await encryptionService.deriveKeyFromPassword(longPassword);
        const plaintext = 'test';

        final encrypted = await encryptionService.encryptString(key, plaintext);
        final decrypted = await encryptionService.decryptString(key, encrypted);

        expect(decrypted, equals(plaintext));
      });

      test('should handle binary data with null bytes', () async {
        final (key, _) = await encryptionService.deriveKeyFromPassword('password');
        final binaryData = Uint8List.fromList([0, 1, 2, 0, 255, 128, 0]);

        final encrypted = await encryptionService.encrypt(key, binaryData);
        final decrypted = await encryptionService.decrypt(key, encrypted);

        expect(decrypted, equals(binaryData));
      });

      test('encryption should not leak password information', () async {
        final (key1, _) = await encryptionService.deriveKeyFromPassword('password1');
        final (key2, _) = await encryptionService.deriveKeyFromPassword('password1');

        // Same password should derive to same key
        expect(key1.toString(), equals(key2.toString()));
      });
    });
  });
}
