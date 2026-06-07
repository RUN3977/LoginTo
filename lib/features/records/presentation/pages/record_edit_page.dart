import 'package:flutter/material.dart';
import 'package:login_to/core/database/models/record_model.dart';

class RecordEditPage extends StatefulWidget {
  final RecordModel? record; // null 表示新增，非 null 表示编辑

  const RecordEditPage({Key? key, this.record}) : super(key: key);

  @override
  State<RecordEditPage> createState() => _RecordEditPageState();
}

class _RecordEditPageState extends State<RecordEditPage> {
  late TextEditingController _titleController;
  late TextEditingController _usernameController;
  late TextEditingController _passwordController;
  late TextEditingController _notesController;

  String _selectedType = 'login';
  bool _showPassword = false;
  bool _isLoading = false;

  final List<String> _recordTypes = [
    'login',
    'bank_card',
    'identity',
    'membership',
    'custom',
  ];

  final Map<String, String> _typeLabels = {
    'login': '登录账号',
    'bank_card': '银行卡',
    'identity': '证件',
    'membership': '会员信息',
    'custom': '自定义',
  };

  final Map<String, IconData> _typeIcons = {
    'login': Icons.person,
    'bank_card': Icons.credit_card,
    'identity': Icons.badge,
    'membership': Icons.card_membership,
    'custom': Icons.more_horiz,
  };

  @override
  void initState() {
    super.initState();
    _initializeControllers();
  }

  void _initializeControllers() {
    if (widget.record != null) {
      _titleController = TextEditingController(text: widget.record!.title);
      _usernameController =
          TextEditingController(text: widget.record!.username ?? '');
      _passwordController =
          TextEditingController(text: widget.record!.password ?? '');
      _notesController = TextEditingController(text: widget.record!.notes ?? '');
      _selectedType = widget.record!.type;
    } else {
      _titleController = TextEditingController();
      _usernameController = TextEditingController();
      _passwordController = TextEditingController();
      _notesController = TextEditingController();
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _saveRecord() {
    if (_titleController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入标题')),
      );
      return;
    }

    setState(() => _isLoading = true);

    // TODO: 调用 repository 保存记录
    // 这里应该加密敏感字段

    Future.delayed(const Duration(seconds: 1), () {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('记录保存成功')),
      );
      Navigator.of(context).pop();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.record == null ? '新增记录' : '编辑记录'),
        actions: [
          IconButton(
            icon: const Icon(Icons.check),
            onPressed: _isLoading ? null : _saveRecord,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // 记录类型选择
                  _buildTypeSelector(),
                  const SizedBox(height: 24),

                  // 标题
                  _buildTextField(
                    label: '标题',
                    controller: _titleController,
                    hintText: '例如：GitHub、招商银行、身份证',
                    prefixIcon: Icons.label,
                  ),
                  const SizedBox(height: 16),

                  // 用户名/账号
                  _buildTextField(
                    label: '用户名/账号',
                    controller: _usernameController,
                    hintText: '例如：john.doe@gmail.com',
                    prefixIcon: Icons.account_circle,
                  ),
                  const SizedBox(height: 16),

                  // 密码/密钥
                  _buildPasswordField(),
                  const SizedBox(height: 16),

                  // 备注
                  _buildTextField(
                    label: '备注',
                    controller: _notesController,
                    hintText: '添加额外信息（可选）',
                    prefixIcon: Icons.note,
                    maxLines: 3,
                  ),
                  const SizedBox(height: 24),

                  // 自定义字段（展开）
                  _buildCustomFieldsSection(),
                  const SizedBox(height: 32),

                  // 删除按钮（仅编辑时显示）
                  if (widget.record != null) _buildDeleteButton(),
                ],
              ),
            ),
    );
  }

  Widget _buildTypeSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '记录类型',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _recordTypes
                .map((type) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _buildTypeChip(type),
                    ))
                .toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildTypeChip(String type) {
    final isSelected = _selectedType == type;
    return FilterChip(
      selected: isSelected,
      onSelected: (selected) {
        setState(() => _selectedType = type);
      },
      avatar: Icon(
        _typeIcons[type],
        size: 18,
        color: isSelected ? Colors.white : Colors.grey,
      ),
      label: Text(_typeLabels[type]!),
      backgroundColor: Colors.transparent,
      side: BorderSide(
        color: isSelected ? Colors.blue : Colors.grey.shade300,
        width: isSelected ? 2 : 1,
      ),
    );
  }

  Widget _buildTextField({
    required String label,
    required TextEditingController controller,
    required String hintText,
    required IconData prefixIcon,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          maxLines: maxLines,
          decoration: InputDecoration(
            hintText: hintText,
            prefixIcon: Icon(prefixIcon),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 12,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPasswordField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '密码/密钥',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _passwordController,
          obscureText: !_showPassword,
          decoration: InputDecoration(
            hintText: '输入密码或密钥',
            prefixIcon: const Icon(Icons.lock),
            suffixIcon: IconButton(
              icon: Icon(_showPassword ? Icons.visibility : Icons.visibility_off),
              onPressed: () {
                setState(() => _showPassword = !_showPassword);
              },
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 12,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCustomFieldsSection() {
    return ExpansionTile(
      title: const Text('自定义字段'),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            children: [
              _buildCustomFieldRow('字段1', '值1'),
              const SizedBox(height: 12),
              _buildCustomFieldRow('字段2', '值2'),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () {
                  // TODO: 添加自定义字段
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('添加自定义字段功能开发中')),
                  );
                },
                icon: const Icon(Icons.add),
                label: const Text('添加字段'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCustomFieldRow(String key, String value) {
    return Row(
      children: [
        Expanded(
          flex: 1,
          child: TextField(
            decoration: InputDecoration(
              hintText: '字段名',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          flex: 2,
          child: TextField(
            decoration: InputDecoration(
              hintText: '字段值',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDeleteButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: () {
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('删除记录'),
              content: const Text('确定要删除这条记录吗？此操作无法撤销。'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('取消'),
                ),
                TextButton(
                  onPressed: () {
                    // TODO: 调用 repository.deleteRecord()
                    Navigator.pop(context);
                    Navigator.pop(context);
                  },
                  child: const Text('删除', style: TextStyle(color: Colors.red)),
                ),
              ],
            ),
          );
        },
        icon: const Icon(Icons.delete),
        label: const Text('删除记录'),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.red.shade100,
          foregroundColor: Colors.red,
        ),
      ),
    );
  }
}
