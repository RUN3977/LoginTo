import 'package:flutter_test/flutter_test.dart';
import 'package:login_to/core/crypto/encryption_service.dart';
import 'package:login_to/core/database/database_service.dart';
import 'package:login_to/core/database/models/record_model.dart';
import 'package:login_to/core/database/repositories/record_repository.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  group('RecordRepository', () {
    late RecordRepository recordRepository;
    late EncryptionService encryptionService;
    late DatabaseService dbService;

    setUp(() async {
      // 初始化 sqflite for testing
      sqfliteFfiInit();
      databaseFactory = databaseFactoryFfi;

      dbService = DatabaseService();
      await dbService.initialize();

      final db = await dbService.database;
      recordRepository = RecordRepository(db);
      encryptionService = EncryptionService();
    });

    tearDown(() async {
      await dbService.close();
    });

    group('addRecord', () {
      test('should add a single record successfully', () async {
        final record = RecordModel(
          uuid: encryptionService.generateUUID(),
          type: 'login',
          title: 'GitHub',
          username: 'john_doe',
          password: 'encrypted_pwd',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        );

        final id = await recordRepository.addRecord(record);

        expect(id, greaterThan(0));
      });

      test('should add multiple records with different UUIDs', () async {
        final record1 = RecordModel(
          uuid: encryptionService.generateUUID(),
          type: 'login',
          title: 'GitHub',
          username: 'user1',
          password: 'pwd1',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        );

        final record2 = RecordModel(
          uuid: encryptionService.generateUUID(),
          type: 'bank_card',
          title: 'ICBC',
          username: 'card_number',
          password: 'pin',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        );

        final id1 = await recordRepository.addRecord(record1);
        final id2 = await recordRepository.addRecord(record2);

        expect(id1, greaterThan(0));
        expect(id2, greaterThan(id1));
      });
    });

    group('getAllRecords', () {
      test('should return empty list when no records exist', () async {
        final records = await recordRepository.getAllRecords();
        expect(records, isEmpty);
      });

      test('should return all non-deleted records', () async {
        // Add 3 records
        for (int i = 0; i < 3; i++) {
          await recordRepository.addRecord(RecordModel(
            uuid: encryptionService.generateUUID(),
            type: 'login',
            title: 'Account $i',
            username: 'user$i',
            password: 'pwd$i',
            createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
            updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          ));
        }

        final records = await recordRepository.getAllRecords();

        expect(records.length, equals(3));
      });

      test('should return records in descending order of updated_at', () async {
        final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;

        // Add records with different timestamps
        for (int i = 0; i < 3; i++) {
          await recordRepository.addRecord(RecordModel(
            uuid: encryptionService.generateUUID(),
            type: 'login',
            title: 'Account $i',
            username: 'user$i',
            password: 'pwd$i',
            createdAt: now + i,
            updatedAt: now + i,
          ));
        }

        final records = await recordRepository.getAllRecords();

        // Should be in descending order
        for (int i = 0; i < records.length - 1; i++) {
          expect(
            records[i].updatedAt,
            greaterThanOrEqualTo(records[i + 1].updatedAt),
          );
        }
      });

      test('should not return soft-deleted records', () async {
        final record = RecordModel(
          uuid: encryptionService.generateUUID(),
          type: 'login',
          title: 'GitHub',
          username: 'john_doe',
          password: 'pwd',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        );

        await recordRepository.addRecord(record);
        await recordRepository.deleteRecord(record.uuid);

        final records = await recordRepository.getAllRecords();

        expect(records, isEmpty);
      });
    });

    group('getRecordsByType', () {
      test('should return records of specified type only', () async {
        // Add records of different types
        await recordRepository.addRecord(RecordModel(
          uuid: encryptionService.generateUUID(),
          type: 'login',
          title: 'GitHub',
          username: 'user1',
          password: 'pwd1',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        ));

        await recordRepository.addRecord(RecordModel(
          uuid: encryptionService.generateUUID(),
          type: 'bank_card',
          title: 'ICBC',
          username: 'card',
          password: 'pin',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        ));

        final loginRecords = await recordRepository.getRecordsByType('login');
        final bankRecords = await recordRepository.getRecordsByType('bank_card');

        expect(loginRecords.length, equals(1));
        expect(loginRecords[0].type, equals('login'));

        expect(bankRecords.length, equals(1));
        expect(bankRecords[0].type, equals('bank_card'));
      });

      test('should return empty list for non-existent type', () async {
        await recordRepository.addRecord(RecordModel(
          uuid: encryptionService.generateUUID(),
          type: 'login',
          title: 'GitHub',
          username: 'user1',
          password: 'pwd1',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        ));

        final records = await recordRepository.getRecordsByType('nonexistent');

        expect(records, isEmpty);
      });
    });

    group('getRecordByUuid', () {
      test('should return record by UUID', () async {
        final uuid = encryptionService.generateUUID();
        final record = RecordModel(
          uuid: uuid,
          type: 'login',
          title: 'GitHub',
          username: 'john_doe',
          password: 'pwd',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        );

        await recordRepository.addRecord(record);
        final retrieved = await recordRepository.getRecordByUuid(uuid);

        expect(retrieved, isNotNull);
        expect(retrieved!.uuid, equals(uuid));
        expect(retrieved.title, equals('GitHub'));
      });

      test('should return null for non-existent UUID', () async {
        final record = await recordRepository.getRecordByUuid('non-existent-uuid');
        expect(record, isNull);
      });
    });

    group('searchRecords', () {
      test('should find records by title', () async {
        await recordRepository.addRecord(RecordModel(
          uuid: encryptionService.generateUUID(),
          type: 'login',
          title: 'GitHub Account',
          username: 'john_doe',
          password: 'pwd',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        ));

        final results = await recordRepository.searchRecords('GitHub');

        expect(results.length, equals(1));
        expect(results[0].title, contains('GitHub'));
      });

      test('should find records by username', () async {
        await recordRepository.addRecord(RecordModel(
          uuid: encryptionService.generateUUID(),
          type: 'login',
          title: 'Gmail',
          username: 'john.doe@gmail.com',
          password: 'pwd',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        ));

        final results = await recordRepository.searchRecords('john');

        expect(results.length, equals(1));
        expect(results[0].username, contains('john'));
      });

      test('should be case-insensitive', () async {
        await recordRepository.addRecord(RecordModel(
          uuid: encryptionService.generateUUID(),
          type: 'login',
          title: 'GitHub',
          username: 'user',
          password: 'pwd',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        ));

        final results1 = await recordRepository.searchRecords('github');
        final results2 = await recordRepository.searchRecords('GITHUB');

        expect(results1.length, equals(1));
        expect(results2.length, equals(1));
      });

      test('should return empty list for no matches', () async {
        final results = await recordRepository.searchRecords('nonexistent');
        expect(results, isEmpty);
      });
    });

    group('updateRecord', () {
      test('should update record successfully', () async {
        final uuid = encryptionService.generateUUID();
        var record = RecordModel(
          uuid: uuid,
          type: 'login',
          title: 'GitHub',
          username: 'john_doe',
          password: 'old_pwd',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        );

        await recordRepository.addRecord(record);

        // Update the record
        record = record.copyWith(
          password: 'new_pwd',
          updatedAt: (DateTime.now().millisecondsSinceEpoch ~/ 1000) + 100,
        );

        await recordRepository.updateRecord(record);

        final updated = await recordRepository.getRecordByUuid(uuid);

        expect(updated!.password, equals('new_pwd'));
      });

      test('should update multiple fields', () async {
        final uuid = encryptionService.generateUUID();
        var record = RecordModel(
          uuid: uuid,
          type: 'login',
          title: 'GitHub',
          username: 'john_doe',
          password: 'pwd',
          notes: 'old notes',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        );

        await recordRepository.addRecord(record);

        // Update multiple fields
        record = record.copyWith(
          title: 'New Title',
          username: 'new_user',
          notes: 'new notes',
          updatedAt: (DateTime.now().millisecondsSinceEpoch ~/ 1000) + 100,
        );

        await recordRepository.updateRecord(record);

        final updated = await recordRepository.getRecordByUuid(uuid);

        expect(updated!.title, equals('New Title'));
        expect(updated.username, equals('new_user'));
        expect(updated.notes, equals('new notes'));
      });
    });

    group('deleteRecord (soft delete)', () {
      test('should soft delete record', () async {
        final uuid = encryptionService.generateUUID();
        await recordRepository.addRecord(RecordModel(
          uuid: uuid,
          type: 'login',
          title: 'GitHub',
          username: 'john_doe',
          password: 'pwd',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        ));

        await recordRepository.deleteRecord(uuid);

        final records = await recordRepository.getAllRecords();

        expect(records, isEmpty);
      });

      test('should still retrieve soft-deleted record by UUID', () async {
        final uuid = encryptionService.generateUUID();
        await recordRepository.addRecord(RecordModel(
          uuid: uuid,
          type: 'login',
          title: 'GitHub',
          username: 'john_doe',
          password: 'pwd',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        ));

        await recordRepository.deleteRecord(uuid);

        final record = await recordRepository.getRecordByUuid(uuid);

        expect(record, isNotNull);
        expect(record!.isDeleted, isTrue);
      });
    });

    group('permanentlyDeleteRecord', () {
      test('should permanently delete record', () async {
        final uuid = encryptionService.generateUUID();
        await recordRepository.addRecord(RecordModel(
          uuid: uuid,
          type: 'login',
          title: 'GitHub',
          username: 'john_doe',
          password: 'pwd',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        ));

        await recordRepository.permanentlyDeleteRecord(uuid);

        final record = await recordRepository.getRecordByUuid(uuid);

        expect(record, isNull);
      });
    });

    group('getRecordStats', () {
      test('should return correct statistics', () async {
        // Add records of different types
        for (int i = 0; i < 3; i++) {
          await recordRepository.addRecord(RecordModel(
            uuid: encryptionService.generateUUID(),
            type: 'login',
            title: 'Account $i',
            username: 'user$i',
            password: 'pwd$i',
            createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
            updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          ));
        }

        for (int i = 0; i < 2; i++) {
          await recordRepository.addRecord(RecordModel(
            uuid: encryptionService.generateUUID(),
            type: 'bank_card',
            title: 'Bank $i',
            username: 'card$i',
            password: 'pin$i',
            createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
            updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          ));
        }

        final stats = await recordRepository.getRecordStats();

        expect(stats['login'], equals(3));
        expect(stats['bank_card'], equals(2));
      });

      test('should not count soft-deleted records in stats', () async {
        final uuid = encryptionService.generateUUID();
        await recordRepository.addRecord(RecordModel(
          uuid: uuid,
          type: 'login',
          title: 'GitHub',
          username: 'user',
          password: 'pwd',
          createdAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          updatedAt: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        ));

        await recordRepository.deleteRecord(uuid);

        final stats = await recordRepository.getRecordStats();

        expect(stats['login'] ?? 0, equals(0));
      });
    });

    group('getRecentRecords', () {
      test('should return recent records in order', () async {
        final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;

        // Add 5 records
        for (int i = 0; i < 5; i++) {
          await recordRepository.addRecord(RecordModel(
            uuid: encryptionService.generateUUID(),
            type: 'login',
            title: 'Account $i',
            username: 'user$i',
            password: 'pwd$i',
            createdAt: now + i,
            updatedAt: now + i,
          ));
        }

        final recent = await recordRepository.getRecentRecords(limit: 3);

        expect(recent.length, equals(3));
        // Should be in descending order
        expect(recent[0].title, contains('Account'));
      });
    });
  });
}
