import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { startTerminalPreviews, stopTerminalPreviews } from "./start-terminal-previews.mjs";

const root = process.cwd();
const reportPath = join(root, ".tmp", "loginto-usable-preview-acceptance.md");

const checks = [
  {
    name: "health-check",
    label: "三端预览健康检查",
    command: ["tools/check-terminal-previews.mjs"]
  },
  {
    name: "readiness-report",
    label: "生成用户可读可用性报告",
    command: ["tools/create-readiness-report.mjs"]
  },
  {
    name: "desktop-app-shell",
    label: "桌面端 CRUD / 提醒 / 备份 / 配对验证",
    command: ["tools/smoke-desktop-app-shell.mjs"]
  },
  {
    name: "mobile-app-shell",
    label: "手机端 CRUD / 提醒 / OCR 入库 / 配对验证",
    command: ["tools/smoke-mobile-app-shell.mjs"]
  },
  {
    name: "tablet-app-shell",
    label: "平板端 CRUD / 提醒 / 整理 / 配对验证",
    command: ["tools/smoke-tablet-app-shell.mjs"]
  },
  {
    name: "terminal-shells",
    label: "三端本地同步与冲突预览验证",
    command: ["tools/smoke-terminal-shells.mjs"]
  },
  {
    name: "terminal-app-windows",
    label: "三端本机 App 窗口入口验证",
    command: ["tools/smoke-terminal-app-windows.mjs"]
  },
  {
    name: "mobile-direct-transport",
    label: "手机局域网 / 热点直连传输契约验证",
    command: ["tools/smoke-mobile-local-network-transport.mjs"]
  },
  {
    name: "bluetooth-sync-envelope",
    label: "蓝牙近场加密同步包信封验证",
    command: ["tools/smoke-bluetooth-sync-envelope.mjs"]
  },
  {
    name: "discovery-candidate-actions",
    label: "近场候选配对 / 重配 / 同步确认分流验证",
    command: ["tools/smoke-discovery-candidate-actions.mjs"]
  },
  {
    name: "near-field-connection-state",
    label: "近场连接状态 / 离线 / 等待确认流程验证",
    command: ["tools/smoke-near-field-connection-state.mjs"]
  },
  {
    name: "sync-demo-failure-states",
    label: "三端同步超时 / 对方拒绝状态验证",
    command: ["tools/smoke-sync-demo-failure-states.mjs"]
  },
  {
    name: "sync-receipt-summary",
    label: "三端同步收据摘要展示验证",
    command: ["tools/smoke-sync-receipt-summary.mjs"]
  },
  {
    name: "sync-review-contract",
    label: "三端同步确认摘要与再次配对契约验证",
    command: ["tools/smoke-sync-review-contract.mjs"]
  },
  {
    name: "trusted-device-management",
    label: "三端可信设备列表与重配入口验证",
    command: ["tools/smoke-trusted-device-management.mjs"]
  },
  {
    name: "desktop-backup-restore",
    label: "桌面加密备份恢复验证",
    command: ["tools/smoke-desktop-backup-restore.mjs"]
  },
  {
    name: "usable-preview-package",
    label: "可用预览交付包入口验证",
    command: ["tools/smoke-package-usable-preview.mjs"]
  },
  {
    name: "reset-preview-state",
    label: "预览数据归档重置验证",
    command: ["tools/smoke-reset-preview-state.mjs"]
  },
  {
    name: "contracts",
    label: "交付合同校验",
    command: ["tools/validate-contracts.mjs"]
  }
];

const results = [];
let previews;

try {
  console.log("[LoginTo acceptance] 启动三端预览");
  previews = await startTerminalPreviews({
    open: process.argv.includes("--open"),
    print: true
  });

  for (const check of checks) {
    console.log(`\n[LoginTo acceptance] ${check.label}`);
    const startedAt = Date.now();
    const result = await runCheckCommand(check.command);
    const finishedAt = Date.now();
    const passed = result.status === 0;
    results.push({
      ...check,
      passed,
      status: result.status,
      durationMs: finishedAt - startedAt,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? ""
    });
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    if (!passed) {
      break;
    }
  }
} catch (error) {
  results.push({
    name: "start-terminal-previews",
    label: "启动三端预览",
    passed: false,
    status: 1,
    durationMs: 0,
    stdout: "",
    stderr: error?.message ?? String(error)
  });
  console.error(error?.message ?? error);
} finally {
  await stopTerminalPreviews(previews);
}

const accepted = results.length === checks.length && results.every((result) => result.passed);
await writeAcceptanceReport({
  accepted,
  results
});

console.log("");
console.log(accepted ? "LoginTo usable preview acceptance passed." : "LoginTo usable preview acceptance failed.");
console.log(`Acceptance report: ${reportPath}`);

if (!accepted) {
  process.exit(1);
}

async function writeAcceptanceReport(input) {
  const lines = [
    "# LoginTo 用户可用预览验收报告",
    "",
    `生成时间：${new Date().toISOString()}`,
    "",
    `总体状态：${input.accepted ? "通过" : "未通过"}`,
    "",
    "## 验收项",
    ""
  ];

  for (const result of input.results) {
    lines.push(`- ${result.passed ? "通过" : "失败"}：${result.label} (${result.durationMs} ms)`);
  }

  const missing = checks.filter((check) => !input.results.some((result) => result.name === check.name));
  for (const check of missing) {
    lines.push(`- 未运行：${check.label}`);
  }

  lines.push("");
  lines.push("## 覆盖范围");
  lines.push("");
  lines.push("- 验收脚本会自动启动三端预览，并检查默认预览 URL 可访问。");
  lines.push("- 桌面、手机、平板均覆盖增删改查、提醒处理和本地持久化。");
  lines.push("- 手机覆盖拍照 OCR 整理入库预览。");
  lines.push("- 桌面覆盖加密备份导出与恢复验证。");
  lines.push("- 三端覆盖可信同步、同步确认、记录级预览、冲突处理和本地优先隔离。");
  lines.push("- 近场候选覆盖首次配对、重新配对、可信设备同步确认分流。");
  lines.push("- 同步后覆盖三端统一收据摘要，包括对方设备、发送/接收/冲突数量和失败状态。");
  lines.push("- 交付入口覆盖前台常驻启动、停止脚本、可用性报告、预览数据归档重置和交付包包装脚本。");
  lines.push("");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
}

function runCheckCommand(command) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, command, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolveRun({
        status: 1,
        stdout,
        stderr: `${stderr}${error.message}`
      });
    });
    child.on("close", (status) => {
      resolveRun({
        status,
        stdout,
        stderr
      });
    });
  });
}
