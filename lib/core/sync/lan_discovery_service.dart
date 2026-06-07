import 'dart:async';
import 'package:network_info_plus/network_info_plus.dart';

/// LAN 设备发现模型
class DiscoveredDevice {
  final String deviceId;
  final String deviceName;
  final String ipAddress;
  final int port;
  final String publicKey;
  final DateTime discoveredAt;

  DiscoveredDevice({
    required this.deviceId,
    required this.deviceName,
    required this.ipAddress,
    required this.port,
    required this.publicKey,
    required this.discoveredAt,
  });

  /// 设备是否仍然活跃（5秒内发现过）
  bool get isActive {
    return DateTime.now().difference(discoveredAt).inSeconds < 5;
  }
}

/// LAN 设备发现服务
class LanDiscoveryService {
  static const int defaultPort = 12345;
  static const String serviceType = '_loginto._tcp';

  final NetworkInfo _networkInfo = NetworkInfo();
  
  Timer? _discoveryTimer;
  final List<DiscoveredDevice> _discoveredDevices = [];
  
  // 发现设备回调
  void Function(DiscoveredDevice)? onDeviceDiscovered;
  void Function(DiscoveredDevice)? onDeviceLost;

  /// 开始设备发现
  Future<void> startDiscovery() async {
    try {
      print('[LAN Discovery] 启动设备发现');
      
      // 获取当前网络信息
      final wifiName = await _networkInfo.getWifiName();
      final wifiGateway = await _networkInfo.getWifiGatewayIP();
      
      print('[LAN Discovery] WiFi: $wifiName, Gateway: $wifiGateway');

      // 定期扫描网络
      _discoveryTimer = Timer.periodic(
        const Duration(seconds: 2),
        (_) => _scanNetwork(wifiGateway),
      );
    } catch (e) {
      print('[LAN Discovery] 启动失败: $e');
    }
  }

  /// 停止设备发现
  void stopDiscovery() {
    _discoveryTimer?.cancel();
    _discoveredDevices.clear();
    print('[LAN Discovery] 设备发现已停止');
  }

  /// 扫描网络中的 LoginTo 设备
  Future<void> _scanNetwork(String? gateway) async {
    if (gateway == null) return;

    try {
      // 获取网络前缀（例如 192.168.1.）
      final parts = gateway.split('.');
      if (parts.length < 3) return;
      
      final networkPrefix = '${parts[0]}.${parts[1]}.${parts[2]}';
      print('[LAN Discovery] 扫描网络: $networkPrefix.*');

      // 并发扫描网络中的所有 IP（1-254）
      final futures = <Future>[]
        ..addAll([
          for (int i = 1; i <= 254; i += 10)
            ...(List.generate(10, (index) => i + index).map(
              (ip) => _checkDevice('$networkPrefix.$ip', defaultPort),
            )),
        ]);

      await Future.wait(futures, eagerError: false);

      // 清理不活跃的设备
      _cleanupInactiveDevices();
    } catch (e) {
      print('[LAN Discovery] 扫描失败: $e');
    }
  }

  /// 检查单个设备
  Future<void> _checkDevice(String ipAddress, int port) async {
    try {
      // 模拟检查设备（实际应该通过 Socket 连接）
      print('[LAN Discovery] 检查设备: $ipAddress:$port');

      // 这里应该进行实际的 TCP 连接测试
      // 使用 InternetAddress 和 Socket 来测试连接
      // Socket.connect(ipAddress, port, timeout: Duration(seconds: 1))
      // 如果连接成功，调用 _addDevice()
    } catch (e) {
      // 连接失败，该设备不可用
    }
  }

  /// 添加发现的设备
  void _addDevice({
    required String deviceId,
    required String deviceName,
    required String ipAddress,
    required int port,
    required String publicKey,
  }) {
    // 检查是否已存在
    final existingIndex =
        _discoveredDevices.indexWhere((d) => d.deviceId == deviceId);

    if (existingIndex >= 0) {
      // 更新现有设备
      _discoveredDevices[existingIndex] = DiscoveredDevice(
        deviceId: deviceId,
        deviceName: deviceName,
        ipAddress: ipAddress,
        port: port,
        publicKey: publicKey,
        discoveredAt: DateTime.now(),
      );
    } else {
      // 新增设备
      final device = DiscoveredDevice(
        deviceId: deviceId,
        deviceName: deviceName,
        ipAddress: ipAddress,
        port: port,
        publicKey: publicKey,
        discoveredAt: DateTime.now(),
      );
      _discoveredDevices.add(device);
      onDeviceDiscovered?.call(device);
      print('[LAN Discovery] 发现新设备: $deviceName ($ipAddress)');
    }
  }

  /// 清理不活跃的设备
  void _cleanupInactiveDevices() {
    final inactiveDevices = _discoveredDevices
        .where((device) => !device.isActive)
        .toList();

    for (final device in inactiveDevices) {
      _discoveredDevices.remove(device);
      onDeviceLost?.call(device);
      print('[LAN Discovery] 设备离线: ${device.deviceName}');
    }
  }

  /// 获取所有发现的设备
  List<DiscoveredDevice> getDiscoveredDevices() {
    return _discoveredDevices.where((d) => d.isActive).toList();
  }

  /// 连接到设备
  Future<bool> connectToDevice(DiscoveredDevice device) async {
    try {
      print('[LAN Discovery] 连接到设备: ${device.deviceName}');
      // TODO: 实现实际连接逻辑
      // 包括密钥交换、握手等
      return true;
    } catch (e) {
      print('[LAN Discovery] 连接失败: $e');
      return false;
    }
  }
}
