import type { RecordTemplate, RecordType } from "./index.ts";

export const RECORD_TEMPLATES = [
  {
    type: "account",
    label: "网站/社交账号",
    icon: "user-round-key",
    description: "用于保存网站、社交平台、邮箱和常规登录账号。",
    defaultReminderDaysBefore: 30,
    fields: [
      { key: "username", label: "用户名", kind: "text", sensitivity: "private", required: false, searchable: true },
      { key: "password", label: "密码", kind: "password", sensitivity: "secret", required: false, searchable: false },
      { key: "email", label: "绑定邮箱", kind: "email", sensitivity: "private", required: false, searchable: true },
      { key: "phone", label: "绑定手机号", kind: "phone", sensitivity: "private", required: false, searchable: true },
      { key: "url", label: "网址", kind: "url", sensitivity: "public", required: false, searchable: true },
      { key: "otp_backup", label: "2FA 备用码", kind: "otp_backup", sensitivity: "critical", required: false, searchable: false },
      { key: "notes", label: "备注", kind: "textarea", sensitivity: "private", required: false, searchable: true }
    ]
  },
  {
    type: "bank_card",
    label: "银行卡",
    icon: "credit-card",
    description: "用于保存银行卡、账单日、还款日和有效期提醒。",
    defaultReminderDaysBefore: 7,
    fields: [
      { key: "bank_name", label: "银行", kind: "text", sensitivity: "public", required: true, searchable: true },
      { key: "cardholder", label: "持卡人", kind: "text", sensitivity: "private", required: false, searchable: true },
      { key: "card_number", label: "卡号", kind: "number", sensitivity: "secret", required: false, searchable: false },
      { key: "expiry_date", label: "有效期", kind: "date", sensitivity: "private", required: false, searchable: false, reminderCandidate: true },
      { key: "statement_day", label: "账单日", kind: "number", sensitivity: "private", required: false, searchable: false, reminderCandidate: true },
      { key: "repayment_day", label: "还款日", kind: "number", sensitivity: "private", required: false, searchable: false, reminderCandidate: true },
      { key: "reserved_phone", label: "预留手机号", kind: "phone", sensitivity: "private", required: false, searchable: true },
      { key: "notes", label: "备注", kind: "textarea", sensitivity: "private", required: false, searchable: true }
    ]
  },
  {
    type: "membership",
    label: "会员信息",
    icon: "badge-check",
    description: "用于保存会员号、权益、等级、到期日和续费提醒。",
    defaultReminderDaysBefore: 7,
    fields: [
      { key: "member_name", label: "会员名称", kind: "text", sensitivity: "public", required: true, searchable: true },
      { key: "member_id", label: "会员号", kind: "text", sensitivity: "private", required: false, searchable: true },
      { key: "level", label: "等级", kind: "text", sensitivity: "public", required: false, searchable: true },
      { key: "benefits", label: "权益", kind: "textarea", sensitivity: "private", required: false, searchable: true },
      { key: "expires_at", label: "到期日", kind: "date", sensitivity: "private", required: false, searchable: false, reminderCandidate: true },
      { key: "service_phone", label: "客服电话", kind: "phone", sensitivity: "public", required: false, searchable: true },
      { key: "notes", label: "备注", kind: "textarea", sensitivity: "private", required: false, searchable: true }
    ]
  },
  {
    type: "identity_document",
    label: "证件信息",
    icon: "id-card",
    description: "用于保存证件号、签发地、有效期和证件照片附件。",
    defaultReminderDaysBefore: 30,
    fields: [
      { key: "document_type", label: "证件类型", kind: "text", sensitivity: "public", required: true, searchable: true },
      { key: "document_number", label: "证件号码", kind: "text", sensitivity: "secret", required: false, searchable: false },
      { key: "issued_by", label: "签发地/机构", kind: "text", sensitivity: "private", required: false, searchable: true },
      { key: "expires_at", label: "有效期", kind: "date", sensitivity: "private", required: false, searchable: false, reminderCandidate: true },
      { key: "notes", label: "备注", kind: "textarea", sensitivity: "private", required: false, searchable: true }
    ]
  },
  {
    type: "secret_key",
    label: "密钥/API",
    icon: "key-round",
    description: "用于保存 API Key、Secret、Recovery Code 和权限说明。",
    defaultReminderDaysBefore: 30,
    fields: [
      { key: "platform", label: "平台", kind: "text", sensitivity: "public", required: true, searchable: true },
      { key: "key_id", label: "Key ID", kind: "text", sensitivity: "private", required: false, searchable: true },
      { key: "secret", label: "Secret", kind: "password", sensitivity: "critical", required: false, searchable: false },
      { key: "scope", label: "权限范围", kind: "textarea", sensitivity: "private", required: false, searchable: true },
      { key: "rotation_due_at", label: "轮换日期", kind: "date", sensitivity: "private", required: false, searchable: false, reminderCandidate: true },
      { key: "notes", label: "备注", kind: "textarea", sensitivity: "private", required: false, searchable: true }
    ]
  },
  {
    type: "custom",
    label: "自定义记录",
    icon: "square-pen",
    description: "用于保存不属于内置模板的私密资料。",
    fields: [
      { key: "notes", label: "备注", kind: "textarea", sensitivity: "private", required: false, searchable: true }
    ]
  }
] as const satisfies readonly RecordTemplate[];

export function getRecordTemplate(type: RecordType): RecordTemplate {
  const template = RECORD_TEMPLATES.find((item) => item.type === type);
  if (!template) {
    throw new Error(`Unknown record template: ${type}`);
  }
  return template;
}
