import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkTerminalPreviews } from "./check-terminal-previews.mjs";
import { startTerminalPreviews, stopTerminalPreviews } from "./start-terminal-previews.mjs";

const defaultReportPath = join(process.cwd(), ".tmp", "loginto-readiness-report.md");

export async function createReadinessReport(input = {}) {
  const autoStart = input.autoStart ?? true;
  let previews;
  try {
    if (autoStart) {
      previews = await startTerminalPreviews({
        open: false,
        print: input.printPreviews ?? false
      });
    }

    const health = await checkTerminalPreviews({
      timeoutMs: input.timeoutMs ?? 10_000,
      fallbackSpan: input.fallbackSpan
    });
    const terminals = [];
    for (const terminal of health.terminals) {
      terminals.push({
        ...terminal,
        appState: terminal.ok ? await fetchAppState(terminal.url) : undefined
      });
    }

    const report = {
      ok: health.ok && terminals.every((terminal) => terminal.appState),
      checkedAt: health.checkedAt,
      reportPath: input.reportPath ?? defaultReportPath,
      autoStarted: autoStart,
      terminals
    };
    const markdown = renderReadinessMarkdown(report);
    await mkdir(dirname(report.reportPath), { recursive: true });
    await writeFile(report.reportPath, markdown, "utf8");
    return {
      ...report,
      markdown
    };
  } finally {
    if (autoStart) {
      await stopTerminalPreviews(previews);
    }
  }
}

async function fetchAppState(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${url}/api/app-state`, {
        signal: AbortSignal.timeout(8_000)
      });
      if (response.ok) {
        return response.json();
      }
    } catch {
      // App-state can take a moment while probing local peers.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return undefined;
}

function renderReadinessMarkdown(report) {
  const lines = [
    "# LoginTo 可用性报告",
    "",
    `生成时间：${report.checkedAt}`,
    "",
    `总体状态：${report.ok ? "可用" : "需要检查"}`,
    "",
    "## 三端状态",
    ""
  ];

  for (const terminal of report.terminals) {
    lines.push(`### ${terminal.label}`);
    lines.push("");
    if (!terminal.ok || !terminal.appState) {
      lines.push("- 状态：不可用");
      lines.push(`- 地址：${terminal.url}`);
      lines.push(`- 原因：${terminal.error ?? "app-state unavailable"}`);
      lines.push("");
      continue;
    }

    lines.push("- 状态：可用");
    lines.push(`- 地址：${terminal.url}`);
    lines.push(`- 产品：${terminal.product}`);
    lines.push(...renderTerminalFacts(terminal.name, terminal.appState));
    lines.push("");
  }

  lines.push("## 用户可验证动作");
  lines.push("");
  lines.push("- 桌面端：新增/编辑/删除记录，处理提醒，导出并验证本地加密备份，同步到手机/平板。");
  lines.push("- 手机端：新增/编辑/删除记录，拍照整理预览入库，处理提醒，扫码或从近场候选信任桌面并同步。");
  lines.push("- 平板端：大屏整理记录，保存备注，处理提醒，从近场候选信任桌面并同步。");
  lines.push("- 近场同步：候选卡会显示可信状态、变更摘要、配对/重配原因，并分流到配对、重新配对或同步确认。");
  lines.push("- 同步日志：三端都会显示最近同步日志；失败记录提供重新扫描和重新配对入口。");
  lines.push("- 验收入口：`LoginTo-Acceptance.cmd` 会自动启动临时三端预览并运行完整验收。");
  lines.push("- 本机数据：`LoginTo-Data-Folder.cmd` 会打开本机 `.tmp` 数据目录，便于确认数据没有离开本机。");
  lines.push("- 交付包：`dist\\LoginTo-usable-preview` 包含启动、停止、检查、数据目录、报告、重置、验收入口和最新报告。");
  lines.push("");

  lines.push("## 本地优先确认");
  lines.push("");
  lines.push(`- 报告生成方式：${report.autoStarted ? "自动临时启动三端预览，并在结束后清理" : "读取当前正在运行的三端预览"}。`);
  lines.push("- 三端 app-state 均来自本机 localhost。");
  lines.push("- vault、runtime-state、device-identity、同步收据和备份包都写入本机 `.tmp`。");
  lines.push("- 可通过 `LoginTo-Data-Folder.cmd` 直接打开 `.tmp`，检查本机保存的数据与报告。");
  lines.push("- 桌面端可通过 `LoginTo-SQLite.cmd` 使用 SQLite 本机数据库模式打开三端 App 窗口。");
  lines.push("- 同步仍需要可信设备和每次同步确认。");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderTerminalFacts(name, appState) {
  if (name === "desktop") {
    const transportPlan = appState.sync?.discovery?.transportPlan ?? {};
    const security = appState.security ?? {};
    return [
      `- 本地记录：${appState.vault?.records ?? 0}`,
      `- 到期提醒：${appState.vault?.dueReminders ?? 0}`,
      `- 数据层：${formatDesktopStorageKind(appState.vault?.storageKind)}`,
      `- SQLite 数据库：${appState.vault?.sqliteVaultPath ?? "未启用"}`,
      `- 可信设备：${appState.sync?.trustedDevices ?? 0}`,
      `- 连接状态：${formatConnectionState(appState.sync?.connectionState)}`,
      `- 本地保险箱：${formatSecurityStatus(security)}`,
      `- 推荐传输：${transportPlan.recommendedTransport ?? "unknown"}`,
      `- 传输通道：${formatTransportChannels(transportPlan.channels)}`,
      `- 蓝牙信封：${formatBluetoothEnvelopeStatus(transportPlan.channels)}`,
      `- 近场候选：${appState.sync?.discovery?.candidates?.length ?? 0}`,
      `- 最新同步：${appState.sync?.lastReceiptSummary?.label ?? "暂无"}`,
      `- 同步日志：${appState.sync?.recentReceipts?.length ?? 0} 条`,
      `- 备份状态：${appState.backup?.status ?? "unknown"} (${appState.backup?.format ?? "unknown"})`,
      `- 备份路径：${appState.backup?.targetPath ?? "未设置"}`
    ];
  }

  const storage = appState.storage ?? {};
  const runtime = appState.runtime ?? {};
  const syncPanel = appState.syncPanel ?? {};
  const deviceContainer = appState.deviceContainer ?? {};
  const transportPlan = syncPanel.discovery?.transportPlan ?? deviceContainer.transportPlan ?? {};
  const security = appState.security ?? {};
  return [
    `- 本地记录：${runtime.records ?? 0}`,
    `- 到期提醒：${runtime.dueReminders ?? 0}`,
    `- 可信设备：${runtime.trustedDevices ?? 0}`,
    `- 连接状态：${formatConnectionState(syncPanel.connectionState)}`,
    `- 本地保险箱：${formatSecurityStatus(security)}`,
    `- 设备容器：${deviceContainer.formFactor ?? "unknown"} / ${deviceContainer.runtime ?? "unknown"}`,
    `- App 窗口：${deviceContainer.appWindow?.width ?? "?"}x${deviceContainer.appWindow?.height ?? "?"}`,
    `- 推荐传输：${transportPlan.recommendedTransport ?? "unknown"}`,
    `- 传输通道：${formatTransportChannels(transportPlan.channels)}`,
    `- 蓝牙信封：${formatBluetoothEnvelopeStatus(transportPlan.channels)}`,
    `- 下一步原生适配：${(deviceContainer.nativeReadiness?.nextNativeAdapters ?? []).join("、") || "未声明"}`,
    `- 近场候选：${syncPanel.discovery?.candidates?.length ?? 0}`,
    `- 最新同步：${syncPanel.lastReceiptSummary?.label ?? "暂无"}`,
    `- 同步日志：${syncPanel.recentReceipts?.length ?? 0} 条`,
    `- vault 持久化：${storage.persistedVault ? "是" : "否"}`,
    `- runtime-state 持久化：${storage.persistedRuntimeState ? "是" : "否"}`
  ];
}

function formatConnectionState(connection) {
  if (!connection) {
    return "未上报";
  }
  return `${connection.label ?? connection.stage ?? "未知"} · 下一步 ${connection.nextAction ?? "scan"}`;
}

function formatDesktopStorageKind(storageKind) {
  if (storageKind === "sqlite") return "SQLite 本机数据库";
  if (storageKind === "file") return "本机文件快照";
  return storageKind ?? "未知";
}

function formatLockState(lockState) {
  if (lockState === "unlocked") return "已解锁";
  if (lockState === "locked") return "已锁定";
  return "未知";
}

function formatSecurityStatus(security) {
  if (!security?.lockState) {
    return "未上报，请重启预览后重新生成报告";
  }
  return `${formatLockState(security.lockState)}，复制 ${security.copyClearSeconds ?? "?"} 秒后清理，自动锁定 ${security.autoLockSeconds ?? "?"} 秒`;
}

function formatTransportChannels(channels) {
  if (!Array.isArray(channels) || channels.length === 0) {
    return "未声明";
  }
  return channels.map((channel) => `${channel.id}:${channel.status}`).join("、");
}

function formatBluetoothEnvelopeStatus(channels) {
  const bluetooth = Array.isArray(channels)
    ? channels.find((channel) => channel.id === "bluetooth")
    : undefined;
  return bluetooth
    ? `${bluetooth.status} / encrypted-envelope-ready`
    : "未声明";
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

if (isMainModule()) {
  const report = await createReadinessReport();
  console.log(report.ok ? "LoginTo readiness report generated." : "LoginTo readiness report generated with warnings.");
  console.log(`Report: ${report.reportPath}`);
  if (!report.ok) {
    process.exit(1);
  }
}
