# 开发指南

## 环境配置

### 安装 Flutter

```bash
# 下载 Flutter SDK (https://flutter.dev/docs/get-started/install)
flutter --version
flutter doctor
```

### 项目初始化

```bash
git clone https://github.com/RUN3977/LoginTo.git
cd LoginTo
flutter pub get
flutter pub run build_runner build  # 生成 JSON 序列化代码
```

## 编码规范

### Dart 风格指南

- 遵循 [Effective Dart](https://dart.dev/guides/language/effective-dart)
- 使用 `flutter analyze` 进行代码分析
- 使用 `dart format` 格式化代码

### 命名约定

```dart
// 类名：PascalCase
class RecordRepository { }

// 变量/函数：camelCase
Final recordList = [];
Future<void> addRecord() { }

// 常量：camelCase（如果是 compile-time constant，使用 const）
const int maxRetries = 3;

// 私有变量/函数：以下划线开头
int _internalCounter = 0;
void _privateMethod() { }
```

### 文件结构

```
features/
  └── records/
      ├── data/
      │   ├── datasources/
      │   ├── models/
      │   └── repositories/
      ├── domain/
      │   ├── entities/
      │   ├── repositories/
      │   └── usecases/
      └── presentation/
          ├── pages/
          ├── providers/
          └── widgets/
```

## 添加新功能

### 1. 添加新的记录类型

```dart
// 1. 在 RecordModel 中定义类型常量
class RecordType {
  static const String login = 'login';
  static const String bankCard = 'bank_card';
  static const String custom = 'custom_type';  // 新增
}

// 2. 创建对应的 UI 表单
class CustomTypeForm extends StatefulWidget { }

// 3. 在 smart_import 中添加 OCR 识别规则
class CustomTypeExtractor implements FieldExtractor { }
```

### 2. 添加新的 Provider

```dart
// lib/features/records/presentation/providers/

final recordsProvider = FutureProvider((ref) async {
  final repository = ref.watch(recordRepositoryProvider);
  return repository.getAllRecords();
});

final recordDetailProvider = FutureProvider.family(
  (ref, String uuid) async {
    final repository = ref.watch(recordRepositoryProvider);
    return repository.getRecordByUuid(uuid);
  },
);
```

### 3. 添加单元测试

```dart
// test/unit/core/crypto/encryption_service_test.dart

import 'package:test/test.dart';
import 'package:login_to/core/crypto/encryption_service.dart';

void main() {
  group('EncryptionService', () {
    late EncryptionService encryptionService;

    setUp(() {
      encryptionService = EncryptionService();
    });

    test('should encrypt and decrypt data correctly', () async {
      const password = 'test_password';
      const plaintext = 'Hello, World!';

      final (key, salt) = await encryptionService.deriveKeyFromPassword(password);
      final encrypted = await encryptionService.encryptString(key, plaintext);
      final decrypted = await encryptionService.decryptString(key, encrypted);

      expect(decrypted, plaintext);
    });
  });
}
```

## 调试

### 打印日志

```dart
import 'package:flutter/foundation.dart';

debugPrint('Debug message: $data');
```

### 使用 DevTools

```bash
flutter pub global activate devtools
devtools
```

### 数据库调试

```bash
# 导出数据库
adb pull /data/data/com.loginto.app/databases/loginto.db

# 使用 SQLite Browser 打开
```

## 提交代码

### Commit 消息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type:**
- `feat`: 新功能
- `fix`: 修复 Bug
- `docs`: 文档
- `style`: 代码风格
- `refactor`: 重构
- `test`: 测试
- `chore`: 工具、依赖

**示例：**

```
feat(sync): add LAN device discovery

Implement mDNS-based device discovery for local network
synchronization. Devices can now automatically discover
each other without manual configuration.

Closes #123
```

### Pull Request

1. 创建新分支：`git checkout -b feature/xxx`
2. 提交代码
3. 推送到 GitHub：`git push origin feature/xxx`
4. 创建 PR，填写详细描述
5. 等待代码审查

## 发布流程

### 版本号

遵循 [Semantic Versioning](https://semver.org/)：
- MAJOR：不兼容的 API 改变
- MINOR：向下兼容的功能新增
- PATCH：向下兼容的 Bug 修复

### 发布检查清单

- [ ] 所有测试通过
- [ ] 代码审查完成
- [ ] 文档已更新
- [ ] 版本号已更新
- [ ] CHANGELOG 已更新
- [ ] Tag 已创建

## 常见问题

### Q: 如何重置数据库？

```dart
final dbService = DatabaseService();
await dbService.close();
await File('${(await getApplicationDocumentsDirectory()).path}/loginto.db').delete();
```

### Q: 如何清除加密密钥缓存？

```dart
// 应用关闭时自动清除，或手动清除：
_encryptionService = null;
```

### Q: 如何调试同步问题？

1. 检查 `sync_logs` 表中的日志
2. 查看冲突解决的详情
3. 使用 DevTools 检查网络请求

## 资源链接

- [Flutter 文档](https://flutter.dev/docs)
- [Dart 文档](https://dart.dev/guides)
- [Riverpod 文档](https://riverpod.dev)
- [SQLite 文档](https://www.sqlite.org/docs.html)
