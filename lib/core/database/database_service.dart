import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';

/// SQLite 数据库管理服务
class DatabaseService {
  static Database? _database;
  static const String _databaseName = 'loginto.db';
  static const int _databaseVersion = 1;
  
  Future<Database> get database async {
    _database ??= await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final documentsDirectory = await getApplicationDocumentsDirectory();
    final path = join(documentsDirectory.path, _databaseName);

    return openDatabase(
      path,
      version: _databaseVersion,
      onCreate: _createTables,
      onUpgrade: _upgradeTables,
    );
  }

  Future<void> initialize() async {
    await database;
  }

  Future<void> _createTables(Database db, int version) async {
    // 私密记录表
    await db.execute('''
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
      )
    ''');

    // 附件表
    await db.execute('''
      CREATE TABLE attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        record_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        filetype TEXT NOT NULL,
        data BLOB NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(record_id) REFERENCES records(id)
      )
    ''');

    // 提醒表
    await db.execute('''
      CREATE TABLE reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        record_id INTEGER NOT NULL,
        due_at INTEGER NOT NULL,
        repeat_rule TEXT,
        is_triggered INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(record_id) REFERENCES records(id)
      )
    ''');

    // 同步日志表
    await db.execute('''
      CREATE TABLE sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        action TEXT NOT NULL,
        device_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        details TEXT,
        status TEXT
      )
    ''');

    // 设备配对表
    await db.execute('''
      CREATE TABLE paired_devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT UNIQUE NOT NULL,
        device_name TEXT NOT NULL,
        public_key TEXT NOT NULL,
        paired_at INTEGER NOT NULL,
        last_synced_at INTEGER,
        is_active INTEGER DEFAULT 1
      )
    ''');

    // 创建索引
    await db.execute('CREATE INDEX idx_records_type ON records(type)');
    await db.execute('CREATE INDEX idx_records_updated_at ON records(updated_at)');
    await db.execute('CREATE INDEX idx_reminders_due_at ON reminders(due_at)');
    await db.execute('CREATE INDEX idx_sync_logs_timestamp ON sync_logs(timestamp)');
  }

  Future<void> _upgradeTables(Database db, int oldVersion, int newVersion) async {
    // 未来的数据库迁移逻辑
  }

  Future<void> close() async {
    _database?.close();
    _database = null;
  }
}
