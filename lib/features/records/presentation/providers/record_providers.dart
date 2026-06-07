import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:login_to/core/crypto/encryption_service.dart';
import 'package:login_to/core/database/models/record_model.dart';
import 'package:login_to/core/database/repositories/record_repository.dart';

// 记录库提供者
final recordRepositoryProvider = Provider((ref) {
  // TODO: 从 DatabaseService 获取数据库实例
  return RecordRepository(null);
});

// 加密服务提供者
final encryptionServiceProvider = Provider((ref) {
  return EncryptionService();
});

// 所有记录提供者
final recordsProvider = FutureProvider((ref) async {
  final repository = ref.watch(recordRepositoryProvider);
  return repository.getAllRecords();
});

// 按类型过滤的记录提供者
final recordsByTypeProvider = FutureProvider.family<List<RecordModel>, String>(
  (ref, type) async {
    final repository = ref.watch(recordRepositoryProvider);
    return repository.getRecordsByType(type);
  },
);

// 搜索提供者
final searchRecordsProvider = FutureProvider.family<List<RecordModel>, String>(
  (ref, keyword) async {
    final repository = ref.watch(recordRepositoryProvider);
    if (keyword.isEmpty) {
      return repository.getAllRecords();
    }
    return repository.searchRecords(keyword);
  },
);

// 记录统计提供者
final recordStatsProvider = FutureProvider((ref) async {
  final repository = ref.watch(recordRepositoryProvider);
  return repository.getRecordStats();
});
