import 'package:sqflite/sqflite.dart';
import 'package:login_to/core/database/models/record_model.dart';

/// 记录数据访问层
class RecordRepository {
  final Database db;
  static const String _tableName = 'records';

  RecordRepository(this.db);

  /// 添加新记录
  Future<int> addRecord(RecordModel record) async {
    return await db.insert(_tableName, record.toMap());
  }

  /// 获取所有未删除的记录
  Future<List<RecordModel>> getAllRecords() async {
    final maps = await db.query(
      _tableName,
      where: 'deleted_at IS NULL',
      orderBy: 'updated_at DESC',
    );
    return maps.map((map) => RecordModel.fromMap(map)).toList();
  }

  /// 按类型获取记录
  Future<List<RecordModel>> getRecordsByType(String type) async {
    final maps = await db.query(
      _tableName,
      where: 'type = ? AND deleted_at IS NULL',
      whereArgs: [type],
      orderBy: 'updated_at DESC',
    );
    return maps.map((map) => RecordModel.fromMap(map)).toList();
  }

  /// 按 UUID 获取单条记录
  Future<RecordModel?> getRecordByUuid(String uuid) async {
    final maps = await db.query(
      _tableName,
      where: 'uuid = ?',
      whereArgs: [uuid],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return RecordModel.fromMap(maps.first);
  }

  /// 搜索记录（标题或用户名）
  Future<List<RecordModel>> searchRecords(String keyword) async {
    final maps = await db.query(
      _tableName,
      where: '(title LIKE ? OR username LIKE ?) AND deleted_at IS NULL',
      whereArgs: ['%$keyword%', '%$keyword%'],
      orderBy: 'updated_at DESC',
    );
    return maps.map((map) => RecordModel.fromMap(map)).toList();
  }

  /// 更新记录
  Future<int> updateRecord(RecordModel record) async {
    return await db.update(
      _tableName,
      record.toMap(),
      where: 'uuid = ?',
      whereArgs: [record.uuid],
    );
  }

  /// 软删除记录
  Future<int> deleteRecord(String uuid) async {
    return await db.update(
      _tableName,
      {'deleted_at': DateTime.now().millisecondsSinceEpoch ~/ 1000},
      where: 'uuid = ?',
      whereArgs: [uuid],
    );
  }

  /// 硬删除记录（不可恢复）
  Future<int> permanentlyDeleteRecord(String uuid) async {
    return await db.delete(
      _tableName,
      where: 'uuid = ?',
      whereArgs: [uuid],
    );
  }

  /// 获取记录统计
  Future<Map<String, int>> getRecordStats() async {
    final result = await db.rawQuery(
      'SELECT type, COUNT(*) as count FROM records WHERE deleted_at IS NULL GROUP BY type',
    );
    
    final stats = <String, int>{};
    for (final row in result) {
      stats[row['type'] as String] = row['count'] as int;
    }
    return stats;
  }

  /// 获取最近更新的记录
  Future<List<RecordModel>> getRecentRecords({int limit = 10}) async {
    final maps = await db.query(
      _tableName,
      where: 'deleted_at IS NULL',
      orderBy: 'updated_at DESC',
      limit: limit,
    );
    return maps.map((map) => RecordModel.fromMap(map)).toList();
  }
}
