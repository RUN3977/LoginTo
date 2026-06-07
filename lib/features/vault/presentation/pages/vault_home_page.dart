import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class VaultHomePage extends ConsumerWidget {
  const VaultHomePage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('LoginTo 保险库'),
        centerTitle: true,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              // TODO: 搜索功能
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              // TODO: 设置页面
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              // 统计卡片
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: _buildStatsCard(),
              ),
              // 分类标签
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: _buildCategoryTabs(),
              ),
              // 记录列表
              Padding(
                padding: const EdgeInsets.all(16),
                child: _buildRecordsList(),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: 新增记录
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('新增记录功能开发中...')),
          );
        },
        tooltip: '新增记录',
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildStatsCard() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildStatItem('账号', '12', Icons.person),
            _buildStatItem('卡片', '8', Icons.credit_card),
            _buildStatItem('证件', '5', Icons.badge),
            _buildStatItem('其他', '3', Icons.more_horiz),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(String label, String count, IconData icon) {
    return Column(
      children: [
        Icon(icon, size: 32, color: Colors.blue),
        const SizedBox(height: 8),
        Text(
          count,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: Colors.grey,
          ),
        ),
      ],
    );
  }

  Widget _buildCategoryTabs() {
    final categories = ['全部', '账号', '卡片', '证件', '其他'];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: categories
            .map((category) => Padding(
                  padding: const EdgeInsets.only(right: 12.0),
                  child: FilterChip(
                    label: Text(category),
                    selected: category == '全部',
                    onSelected: (selected) {
                      // TODO: 切换分类
                    },
                  ),
                ))
            .toList(),
      ),
    );
  }

  Widget _buildRecordsList() {
    return Column(
      children: [
        _buildRecordTile('WeChat', 'person', '社交账号'),
        _buildRecordTile('Gmail', 'email', '网站账号'),
        _buildRecordTile('招商银行', 'credit_card', '银行卡'),
        _buildRecordTile('身份证', 'badge', '证件'),
      ],
    );
  }

  Widget _buildRecordTile(String title, String icon, String type) {
    final iconMap = {
      'person': Icons.person,
      'email': Icons.email,
      'credit_card': Icons.credit_card,
      'badge': Icons.badge,
    };

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Icon(iconMap[icon] ?? Icons.info),
        title: Text(title),
        subtitle: Text(type),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          // TODO: 打开记录详情
        },
      ),
    );
  }
}
