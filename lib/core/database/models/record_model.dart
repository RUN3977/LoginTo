import 'dart:convert';
import 'package:json_annotation/json_annotation.dart';

part 'record_model.g.dart';

@JsonSerializable()
class RecordModel {
  final int? id;
  final String uuid;
  final String type; // login, bank_card, identity, membership, custom
  final String title;
  final String? username;
  final String? password; // 加密存储
  final Map<String, dynamic>? fields; // 自定义字段，JSON 格式
  final String? notes;
  final int createdAt;
  final int updatedAt;
  final int? deletedAt;

  const RecordModel({
    this.id,
    required this.uuid,
    required this.type,
    required this.title,
    this.username,
    this.password,
    this.fields,
    this.notes,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
  });

  RecordModel copyWith({
    int? id,
    String? uuid,
    String? type,
    String? title,
    String? username,
    String? password,
    Map<String, dynamic>? fields,
    String? notes,
    int? createdAt,
    int? updatedAt,
    int? deletedAt,
  }) {
    return RecordModel(
      id: id ?? this.id,
      uuid: uuid ?? this.uuid,
      type: type ?? this.type,
      title: title ?? this.title,
      username: username ?? this.username,
      password: password ?? this.password,
      fields: fields ?? this.fields,
      notes: notes ?? this.notes,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      deletedAt: deletedAt ?? this.deletedAt,
    );
  }

  Map<String, dynamic> toJson() => _$RecordModelToJson(this);
  factory RecordModel.fromJson(Map<String, dynamic> json) => _$RecordModelFromJson(json);

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'uuid': uuid,
      'type': type,
      'title': title,
      'username': username,
      'password': password,
      'fields': fields != null ? jsonEncode(fields) : null,
      'notes': notes,
      'created_at': createdAt,
      'updated_at': updatedAt,
      'deleted_at': deletedAt,
    };
  }

  factory RecordModel.fromMap(Map<String, dynamic> map) {
    return RecordModel(
      id: map['id'],
      uuid: map['uuid'],
      type: map['type'],
      title: map['title'],
      username: map['username'],
      password: map['password'],
      fields: map['fields'] != null ? jsonDecode(map['fields']) : null,
      notes: map['notes'],
      createdAt: map['created_at'],
      updatedAt: map['updated_at'],
      deletedAt: map['deleted_at'],
    );
  }

  bool get isDeleted => deletedAt != null;
}
