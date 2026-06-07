import 'dart:typed_data';
import 'package:image/image.dart' as img;
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

/// OCR 智能整理服务
class OcrService {
  final TextRecognizer _textRecognizer = TextRecognizer();

  /// 从图像识别文本
  Future<String> recognizeText(String imagePath) async {
    try {
      print('[OCR] 开始识别文本: $imagePath');
      
      final inputImage = InputImage.fromFilePath(imagePath);
      final recognizedText = await _textRecognizer.processImage(inputImage);
      
      print('[OCR] 识别完成，识别到 ${recognizedText.blocks.length} 个文本块');
      
      return recognizedText.text;
    } catch (e) {
      print('[OCR] 识别失败: $e');
      rethrow;
    }
  }

  /// 从二进制图像数据识别文本
  Future<String> recognizeTextFromBytes(Uint8List imageBytes) async {
    try {
      print('[OCR] 从字节数据识别文本');
      
      final inputImage = InputImage.fromBytes(
        bytes: imageBytes,
        metadata: InputImageMetadata(
          size: const Size(0, 0),
          rotation: InputImageRotation.rotation0deg,
          format: InputImageFormat.nv21,
          bytesPerRow: 0,
        ),
      );
      
      final recognizedText = await _textRecognizer.processImage(inputImage);
      return recognizedText.text;
    } catch (e) {
      print('[OCR] 识别失败: $e');
      rethrow;
    }
  }

  /// 智能提取字段
  Map<String, String> extractFields(String text) {
    final fields = <String, String>{};
    final lines = text.split('\n');

    for (final line in lines) {
      // 提取账号
      if (_isEmail(line)) {
        fields['email'] = line.trim();
      }
      // 提取电话
      if (_isPhoneNumber(line)) {
        fields['phone'] = line.trim();
      }
      // 提取身份证号
      if (_isIdCardNumber(line)) {
        fields['id_card'] = line.trim();
      }
      // 提取银行卡号
      if (_isBankCardNumber(line)) {
        fields['card_number'] = line.trim();
      }
      // 提取有效期
      if (_isDate(line)) {
        fields['expiration_date'] = line.trim();
      }
    }

    print('[OCR] 提取到字段: $fields');
    return fields;
  }

  /// 检测是否为邮箱
  bool _isEmail(String text) {
    return RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\$')
        .hasMatch(text.trim());
  }

  /// 检测是否为电话号码
  bool _isPhoneNumber(String text) {
    return RegExp(r'^[+]?[0-9]{7,15}\$').hasMatch(text.replaceAll(' ', ''));
  }

  /// 检测是否为身份证号
  bool _isIdCardNumber(String text) {
    return RegExp(r'^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]\$')
        .hasMatch(text.replaceAll(' ', ''));
  }

  /// 检测是否为银行卡号
  bool _isBankCardNumber(String text) {
    final cardNumber = text.replaceAll(' ', '');
    return RegExp(r'^[0-9]{13,19}\$').hasMatch(cardNumber) && _luhnCheck(cardNumber);
  }

  /// 检测是否为日期
  bool _isDate(String text) {
    return RegExp(r'^(0[1-9]|1[0-2])/([0-9]{2})\$').hasMatch(text.trim()) ||
        RegExp(r'^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\$')
            .hasMatch(text.trim());
  }

  /// Luhn 算法验证银行卡号
  bool _luhnCheck(String cardNumber) {
    int sum = 0;
    bool isEven = false;

    for (int i = cardNumber.length - 1; i >= 0; i--) {
      int digit = int.parse(cardNumber[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 == 0;
  }

  /// 清理资源
  Future<void> close() async {
    await _textRecognizer.close();
  }
}

/// OCR 结果模型
class OcrResult {
  final String rawText;
  final Map<String, String> extractedFields;
  final double confidence;

  OcrResult({
    required this.rawText,
    required this.extractedFields,
    this.confidence = 0.8,
  });
}
