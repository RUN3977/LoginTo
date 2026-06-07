import 'dart:convert';
import 'dart:typed_data';

/// 同步协议定义与数据包管理
class SyncProtocol {
  static const String protocolVersion = '1.0.0';
  static const int packageHeaderVersion = 1;

  /// 同步数据包类型
  static const Map<String, int> packetTypes = {
    'handshake': 1,        // 握手
    'data_sync': 2,        // 数据同步
    'conflict_resolve': 3, // 冲突解决
    'ack': 4,              // 确认
    'error': 5,            // 错误
  };

  /// 生成握手包：交换设备信息和公钥
  static Map<String, dynamic> generateHandshakePacket({
    required String deviceId,
    required String deviceName,
    required String publicKey,
  }) {
    return {
      'type': 'handshake',
      'version': protocolVersion,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'device_id': deviceId,
      'device_name': deviceName,
      'public_key': publicKey,
    };
  }

  /// 生成数据同步包
  static Map<String, dynamic> generateDataSyncPacket({
    required String deviceId,
    required List<Map<String, dynamic>> records,
    required List<Map<String, dynamic>> attachments,
    required List<Map<String, dynamic>> syncLogs,
  }) {
    return {
      'type': 'data_sync',
      'version': protocolVersion,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'device_id': deviceId,
      'records': records,
      'attachments': attachments,
      'sync_logs': syncLogs,
    };
  }

  /// 冲突解决：LWW（Last-Write-Wins）算法
  static Map<String, dynamic> resolveConflict(
    Map<String, dynamic> local,
    Map<String, dynamic> remote,
  ) {
    final localTimestamp = local['updated_at'] as int;
    final remoteTimestamp = remote['updated_at'] as int;

    if (localTimestamp > remoteTimestamp) {
      return {...local, 'conflict_source': 'local'};
    } else if (remoteTimestamp > localTimestamp) {
      return {...remote, 'conflict_source': 'remote'};
    } else {
      // 时间戳相同，使用 UUID 字典序作为 tiebreaker
      final localUuid = local['uuid'] as String;
      final remoteUuid = remote['uuid'] as String;
      return localUuid.compareTo(remoteUuid) > 0 ? local : remote;
    }
  }

  /// 序列化数据包为字节
  static Uint8List serializePacket(Map<String, dynamic> packet) {
    final json = jsonEncode(packet);
    return Uint8List.fromList(utf8.encode(json));
  }

  /// 反序列化字节为数据包
  static Map<String, dynamic> deserializePacket(Uint8List data) {
    final json = utf8.decode(data);
    return jsonDecode(json) as Map<String, dynamic>;
  }

  /// 生成同步日志条目
  static Map<String, dynamic> generateSyncLogEntry({
    required String uuid,
    required String action, // create, update, delete, push, pull
    required String deviceId,
    required Map<String, dynamic>? details,
  }) {
    return {
      'uuid': uuid,
      'action': action,
      'device_id': deviceId,
      'timestamp': DateTime.now().millisecondsSinceEpoch ~/ 1000,
      'details': details,
    };
  }
}
