import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:login_to/core/ocr/ocr_service.dart';

class SmartImportPage extends StatefulWidget {
  const SmartImportPage({Key? key}) : super(key: key);

  @override
  State<SmartImportPage> createState() => _SmartImportPageState();
}

class _SmartImportPageState extends State<SmartImportPage> {
  final ImagePicker _picker = ImagePicker();
  final OcrService _ocrService = OcrService();

  String? _selectedImagePath;
  String _recognizedText = '';
  Map<String, String> _extractedFields = {};
  bool _isProcessing = false;
  double _processProgress = 0.0;

  @override
  void dispose() {
    _ocrService.close();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final pickedFile = await _picker.pickImage(source: source);
      if (pickedFile != null) {
        setState(() => _selectedImagePath = pickedFile.path);
        await _recognizeText();
      }
    } catch (e) {
      _showError('选择图片失败: $e');
    }
  }

  Future<void> _recognizeText() async {
    if (_selectedImagePath == null) return;

    setState(() {
      _isProcessing = true;
      _processProgress = 0.0;
    });

    try {
      // 模拟OCR处理进度
      _simulateProgress();

      print('[SmartImport] 开始OCR识别: $_selectedImagePath');
      final text = await _ocrService.recognizeText(_selectedImagePath!);

      setState(() {
        _recognizedText = text;
        _extractedFields = _ocrService.extractFields(text);
        _isProcessing = false;
        _processProgress = 1.0;
      });

      print('[SmartImport] 识别完成');
    } catch (e) {
      setState(() => _isProcessing = false);
      _showError('OCR识别失败: $e');
    }
  }

  void _simulateProgress() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (mounted && _isProcessing) {
        setState(() => _processProgress = 0.3);
      }
    });
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted && _isProcessing) {
        setState(() => _processProgress = 0.7);
      }
    });
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('智能整理'),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // 图片选择区域
            _buildImagePickerSection(),
            const SizedBox(height: 24),

            // 进度条
            if (_isProcessing) _buildProgressSection(),
            const SizedBox(height: 24),

            // 识别结果
            if (_recognizedText.isNotEmpty) _buildResultsSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildImagePickerSection() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          if (_selectedImagePath != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Image.asset(_selectedImagePath!),
            )
          else
            Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: const [
                  Icon(Icons.image, size: 64, color: Colors.grey),
                  SizedBox(height: 16),
                  Text(
                    '选择或拍照上传证件、银行卡等',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey),
                  ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _pickImage(ImageSource.camera),
                    icon: const Icon(Icons.camera_alt),
                    label: const Text('拍照'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _pickImage(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library),
                    label: const Text('相册'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressSection() {
    return Column(
      children: [
        const Text('正在识别文字...'),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            value: _processProgress,
            minHeight: 6,
          ),
        ),
        const SizedBox(height: 8),
        Text('${(_processProgress * 100).toStringAsFixed(0)}%'),
      ],
    );
  }

  Widget _buildResultsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '识别结果',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),

        // 识别的文字
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: SelectableText(_recognizedText),
          ),
        ),
        const SizedBox(height: 16),

        // 提取的字段
        if (_extractedFields.isNotEmpty) ..._buildExtractedFields(),

        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () {
              // TODO: 保存为记录
              Navigator.pop(context);
            },
            icon: const Icon(Icons.save),
            label: const Text('保存为记录'),
          ),
        ),
      ],
    );
  }

  List<Widget> _buildExtractedFields() {
    return [
      const Text(
        '提取的字段',
        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
      ),
      const SizedBox(height: 8),
      ..._extractedFields.entries.map((entry) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Expanded(
                  flex: 1,
                  child: Text(
                    entry.key,
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      entry.value,
                      style: const TextStyle(fontFamily: 'monospace'),
                    ),
                  ),
                ),
              ],
            ),
          )),
    ];
  }
}
