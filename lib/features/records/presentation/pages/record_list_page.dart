import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:login_to/features/records/presentation/pages/record_edit_page.dart';

class RecordListPage extends ConsumerWidget {
  const RecordListPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('记录列表'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              _showSearchDialog(context);
            },
          ),
        ],
      ),
      body: _buildRecordsList(),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (context) => const RecordEditPage(),
            ),
          );
        },
        tooltip: '新增记录',
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildRecordsList() {
    // TODO: 连接 recordsProvider 获取数据
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildRecordCard(
          type: 'login',
          title: 'GitHub',
          username: 'john_doe',
          icon: Icons.person,
        ),
        const SizedBox(height: 12),
        _buildRecordCard(
          type: 'bank_card',
          title: '招商银行',
          username: '****1234',
          icon: Icons.credit_card,
        ),
        const SizedBox(height: 12),
        _buildRecordCard(
          type: 'identity',
          title: '身份证',
          username: '****5678',
          icon: Icons.badge,
        ),
      ],
    );
  }

  Widget _buildRecordCard({
    required String type,
    required String title,
    required String username,
    required IconData icon,
  }) {
    return Card(
      child: ListTile(
        leading: Icon(icon, color: Colors.blue),
        title: Text(title),
        subtitle: Text(username),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          // TODO: 打开编辑页面
        },
        onLongPress: () {
          // TODO: 显示更多选项菜单
        },
      ),
    );
  }

  void _showSearchDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('搜索记录'),
        content: TextField(
          decoration: const InputDecoration(
            hintText: '输入标题或用户名',
            prefixIcon: Icon(Icons.search),
          ),
          onChanged: (value) {
            // TODO: 调用 searchRecordsProvider
          },
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
        ],
      ),
    );
  }
}
