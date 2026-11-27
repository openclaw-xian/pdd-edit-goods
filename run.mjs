// run.mjs — 编辑页改价/库存调度（默认 fill，不保存）
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { resolveLedgerRoot, assertCan, recordResult } from "./product-ledger.mjs";

const CFG_PATH = process.argv[2];
if (!CFG_PATH) { console.error("用法: node run.mjs edit-config.json"); process.exit(2); }
const CFG = JSON.parse(await fs.readFile(CFG_PATH, "utf8"));
const SELF_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKER = String(CFG.worker || path.join(SELF_DIR, "worker-edit-goods.mjs")).replace(/\\/g, "/");
const RECORD_ROOT = String(CFG.recordRoot || "D:/pdd-edit-goods").replace(/\\/g, "/").replace(/\/$/, "");
const LEDGER_ROOT = resolveLedgerRoot(CFG);
const EGO = String(CFG.ego || path.join(os.homedir(), ".local", "share", "ego", "active_version_dir", "ego-browser.exe")).replace(/\\/g, "/");
const RUN_ID = "edit-goods-" + new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const RUN_DIR = path.join(RECORD_ROOT, "_runs", RUN_ID);
const RESULT_DIR = path.join(RUN_DIR, "results");
const LOG_DIR = path.join(RUN_DIR, "logs");
const RUNTIME = path.join(os.tmpdir(), "pdd-edit-goods-runtime", RUN_ID);
const saveMode = String(CFG.saveMode || "fill");
const pricePercent = CFG.pricePercent === undefined ? null : Number(CFG.pricePercent);
const stockSet = CFG.stockSet === undefined ? null : Number(CFG.stockSet);
const images = CFG.images || {};
const shops = (CFG.shops || []).map((s) => typeof s === "string" ? { shop: s } : s).filter((s) => s && s.shop);
const issues = [];
const addIssue = (code, q) => issues.push({ code, question: q });

if (!shops.length) addIssue("shops_missing", "config 需要 shops");
if (!["fill", "draft", "submit"].includes(saveMode)) addIssue("saveMode_invalid", "saveMode 只能是 fill/draft/submit");
if (pricePercent === null && stockSet === null && !Array.isArray(images.carousel) && !Array.isArray(images.detail) && !Array.isArray(images.sku)) addIssue("action_missing", "需要 pricePercent/stockSet 或 images.carousel/detail");
if ((pricePercent !== null && !Number.isFinite(pricePercent)) || (stockSet !== null && !Number.isFinite(stockSet))) addIssue("value_invalid", "pricePercent/stockSet 必须是数字");
if (saveMode === "submit" && CFG.confirmSubmit !== true) addIssue("submit_not_confirmed", "submit 生效需显式 confirmSubmit:true；先用 fill 检查");
if (!shops.some((s) => s.goodsId || CFG.goodsId)) addIssue("goods_missing", "需要 goodsId（全局或每个 shop）");
if (saveMode !== "fill") {
  for (const s of shops) {
    const id = String(s.goodsId || CFG.goodsId || "");
    if (!id) continue;
    const chk = await assertCan({ root: LEDGER_ROOT, shop: s.shop, goodsId: id, action: "edit-goods-" + saveMode, targetId: id, allowUnknown: true });
    if (!chk.allowed) addIssue(chk.blocked, `商品 ${id} 当前状态 ${chk.state.lifecycleStatus}，不能编辑`);
  }
}
if (!existsSync(EGO)) addIssue("ego_not_found", "ego-browser 不可用");
if (issues.length) { console.log("PREFLIGHT=needs_user_input"); console.log(JSON.stringify({ status: "needs_user_input", issues }, null, 1)); process.exit(3); }

await fs.mkdir(RESULT_DIR, { recursive: true });
await fs.mkdir(LOG_DIR, { recursive: true });
await fs.mkdir(RUNTIME, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runOne(store, i) {
  const goodsId = String(store.goodsId || CFG.goodsId || "");
  const job = {
    shop: store.shop, profile: store.profile || null, goodsId,
    pricePercent, stockSet, saveMode, images,
    recordRoot: RECORD_ROOT,
    resultPath: path.join(RESULT_DIR, store.shop + ".json"),
    logPath: path.join(LOG_DIR, store.shop + ".log"),
  };
  const wrapper = path.join(RUNTIME, "job-" + i + ".mjs");
  await fs.writeFile(wrapper, "globalThis.__JOB = " + JSON.stringify(job) + ";\nawait import('file:///" + WORKER + "');\n", "utf8");
  const started = Date.now();
  const wrapperUrl = "file:///" + wrapper.replace(/\\/g, "/");
  const child = spawn(EGO, ["nodejs", "-e", "await import('" + wrapperUrl + "')"], { stdio: "inherit", windowsHide: true });
  child.on("error", (e) => { try { console.error("SPAWN_ERROR=" + e.message); } catch (_) {} });
  let result = null;
  const deadline = started + Number(CFG.jobTimeoutSec || 600) * 1000;
  while (!result && Date.now() < deadline) {
    try { result = JSON.parse(await fs.readFile(job.resultPath, "utf8")); } catch (e) { await sleep(500); }
  }
  if (!result) result = { ok: false, status: "failed", error: "no_result_file" };
  try { if (!child.killed) child.kill(); } catch (e) {}
  return { shop: store.shop, goodsId, result, wallSec: Number(((Date.now() - started) / 1000).toFixed(1)) };
}

async function recordEdit(r) {
  if (saveMode === "fill" || !r.result || !r.result.saved || !r.result.saved.ok) return;
  const status = r.result.status || "done";
  await recordResult({ root: LEDGER_ROOT, skill: "pdd-edit-goods", shop: r.shop, action: "edit-goods-" + saveMode, goodsId: r.goodsId, targetId: r.goodsId, target: "商品编辑", before: "编辑前", after: { price: r.result.summary && r.result.summary.priceRange || null, stock: r.result.summary && r.result.summary.totalStock || null, lifecycleStatus: status === "rejected" ? "未知" : "在售" }, result: status === "rejected" ? "rejected" : "success", runId: RUN_ID, evidence: path.join(RESULT_DIR, r.shop + ".json") });
}
const done = [];
for (let i = 0; i < shops.length; i++) {
  const r = await runOne(shops[i], i);
  done.push(r);
  try { await recordEdit(r); } catch (e) { console.error("RECORD_FAILED " + (e && e.message || e)); }
  console.log("DONE " + r.shop + " goodsId=" + r.goodsId + " status=" + (r.result.status || "?") + " changed=" + ((r.result.changed && r.result.changed.length) || 0) + " wall=" + r.wallSec + "s" + (r.result.error ? " err=" + r.result.error : ""));
}
const report = { runId: RUN_ID, saveMode, pricePercent, stockSet, recordRoot: RECORD_ROOT, stores: done.map((d) => ({ shop: d.shop, goodsId: d.goodsId, wallSec: d.wallSec, ...d.result })) };
await fs.writeFile(path.join(RUN_DIR, "report.json"), JSON.stringify(report, null, 1), "utf8");
console.log("REPORT=" + path.join(RUN_DIR, "report.json"));
if (report.stores.some((s) => s.status === "failed" || s.status === "submit_failed")) process.exit(5);
if (report.stores.some((s) => s.status === "needs" || s.needs)) process.exit(4);
