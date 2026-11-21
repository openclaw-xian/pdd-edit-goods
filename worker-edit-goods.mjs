// worker-edit-goods.mjs — 编辑页改价/库存（fill 默认，不保存）
const fs = await import("node:fs/promises");
const JOB = globalThis.__JOB || {};
const T0 = Date.now();
const logs = [];
const log = (...a) => { const s = "[t=" + ((Date.now() - T0) / 1000).toFixed(1) + "s] " + a.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" "); logs.push(s); console.log(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RECORD_DIR = (JOB.recordRoot || "D:/pdd-edit-goods").replace(/\\/g, "/").replace(/\/$/, "") + "/" + JOB.shop;
let task = null, page = null;

async function writeResult(obj) {
  const r = { ...obj, shop: JOB.shop, goodsId: JOB.goodsId, elapsedSec: Number(((Date.now() - T0) / 1000).toFixed(1)) };
  if (JOB.resultPath) await fs.writeFile(JOB.resultPath, JSON.stringify(r, null, 1), "utf8").catch(() => {});
  if (JOB.logPath) await fs.writeFile(JOB.logPath, logs.join("\n"), "utf8").catch(() => {});
  return r;
}
function today() { return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10); }
function localStamp() { return new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19) + " +08:00"; }
async function newPageSafe() { const pages = await task.pages().catch(() => []); if (pages.length >= 8) throw new Error("page_budget_full:" + pages.length); return task.newPage(); }

async function openEdit() {
  const spaces = await listTaskSpaces();
  let entry = spaces.find((s) => String(s.profileName || "") === String(JOB.profile || ""));
  if (entry) {
    task = entry.ownership === "user" ? await claimTaskSpace(entry.id) : entry.ownership === "agentDelegatedToUser" ? await takeOverTaskSpace(entry.id) : await taskSpace(entry.id);
    page = await newPageSafe().catch(async (e) => {
      if (!/page_budget_full/.test(String(e.message || e))) throw e;
      log("page_budget_recreate", String(e.message || e));
      try { await task.finish({ keep: [] }); } catch (e2) {}
      return null;
    });
  }
  if (!page) {
    const ps = await profiles();
    const p = ps.find((x) => String(x.name || "") === String(JOB.profile || ""));
    if (!p) throw new Error("shop_not_logged_in:" + JOB.profile);
    task = await taskSpace("pdd-edit-goods-" + JOB.shop + "-" + Date.now(), { profileId: p.id });
    page = await newPageSafe();
  }
  await page.goto("https://mms.pinduoduo.com/goods/goods_list", { timeout: 60000 });
  await page.waitForTimeout(4500);
  const shopArea = await page.evaluate(() => { const t = document.body.innerText || ""; const i = t.indexOf("主账号"); return i >= 0 ? t.slice(Math.max(0, i - 60), i + 8) : ""; });
  if (!shopArea.includes(JOB.shop)) throw new Error("shop_mismatch:" + shopArea.slice(-40));
  // 在售中
  const tab = await page.evaluate(() => { const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}; const txt=(e)=>(e?(e.textContent||"").trim():""); const t=[...document.querySelectorAll("*")].filter(e=>vis(e)&&!e.children.length&&/^在售中/.test(txt(e)))[0]; if(!t)return null; const r=t.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; });
  if (tab) { await page.mouse.click(tab.x, tab.y); await page.waitForTimeout(2500); }
  // filter ID
  await page.evaluate((gid) => { const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}; const labels=[...document.querySelectorAll("*")].filter(e=>vis(e)&&!e.children.length&&(e.textContent||"").trim()==="商品ID"); let inp=null; for(const lab of labels){let row=lab;for(let i=0;i<8&&row;i++){row=row.parentElement;if(!row)break;const c=[...row.querySelectorAll("input")].filter(x=>vis(x)&&x.type!=="checkbox"&&x.type!=="radio");if(c.length){inp=c[0];break;}}if(inp)break;} if(inp){const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;s.call(inp,gid);inp.dispatchEvent(new Event("input",{bubbles:true}));inp.dispatchEvent(new Event("change",{bubbles:true}));inp.focus();} }, JOB.goodsId);
  await page.keyboard.press("Enter"); await page.waitForTimeout(2500);
  const editBtn = await page.evaluate((gid) => { const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}; const txt=(e)=>(e?(e.innerText||e.textContent||"").trim():""); const anchor=[...document.querySelectorAll("*")].find(e=>vis(e)&&!e.children.length&&txt(e).includes(gid)); if(!anchor)return null; let n=anchor,row=null; for(let i=0;i<8&&n;i++){n=n.parentElement;if(!n)break;if(/销售中|已下架/.test(txt(n))){row=n;break;}} if(!row)return null; const btn=[...row.querySelectorAll("*")].filter(e=>vis(e)&&!e.children.length&&txt(e)==="编辑")[0]; if(!btn)return null; const r=btn.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; }, JOB.goodsId);
  if (!editBtn) throw new Error("edit_button_not_found");
  const before = (await task.pages()).length;
  await page.mouse.click(editBtn.x, editBtn.y);
  await page.waitForTimeout(4500);
  const pages = await task.pages();
  const edit = pages.length > before ? pages[pages.length - 1] : pages[pages.length - 1];
  page = edit;
  await page.waitForTimeout(3500);
  const url = await page.url();
  if (!String(url).includes("goods_add")) throw new Error("edit_page_not_open:" + url);
  log("edit_page", String(url));
}

async function evalLong(fnSource, arg, { timeoutMs = 180000 } = {}) {
  const expression = "(" + fnSource + ")(" + JSON.stringify(arg === undefined ? null : arg) + ")";
  const res = await page.cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, { timeout: timeoutMs });
  if (!res) return null;
  if (res.exceptionDetails) return { __error: String((res.exceptionDetails.exception && res.exceptionDetails.exception.description) || res.exceptionDetails.text).slice(0, 300) };
  return res.result && res.result.value !== undefined ? res.result.value : (res.result || {});
}

async function fillAll() {
  const pct = Number(JOB.pricePercent);
  const stockSet = JOB.stockSet === undefined || JOB.stockSet === null ? null : Number(JOB.stockSet);
  if (!Number.isFinite(pct) && stockSet === null) throw new Error("action_empty");
  const FN = `async (a) => {
    const { pct, stockSet, step, pauseMs } = a;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const setVal = (el, v) => {
      if (String(el.value) === String(v)) return false;
      setter.call(el, String(v));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };
    const sc = [...document.querySelectorAll("*")].filter((e) => e.querySelector && e.querySelector("tbody tr") && e.scrollHeight > e.clientHeight + 30);
    const body = document.querySelector("tbody tr") ? document.querySelector("tbody tr").parentElement : null;
    if (body && body.scrollHeight > body.clientHeight + 20) sc.push(body);
    const all = [...new Set(sc)];
    const maxSh = Math.max(3000, ...all.map((e) => e.scrollHeight));
    const seen = new Map();
    let writes = 0;
    const stepFn = () => {
      for (const tr of [...document.querySelectorAll("tbody tr")]) {
        const ins = [...tr.querySelectorAll('input[placeholder="请输入"]')].filter((e) => e.offsetParent);
        if (ins.length < 5) continue;
        const code = String(ins[4].value || "").trim();
        if (!code || seen.has(code)) continue;
        const stockIn = ins[1], priceIn = ins[2], singleIn = ins[3];
        const oldStock = Number(stockIn.value) || 0;
        const oldPrice = Number(priceIn.value) || 0;
        const oldSingle = Number(singleIn.value) || 0;
        const nextStock = stockSet === null ? oldStock : stockSet;
        const nextPrice = Number.isFinite(pct) ? Math.round(oldPrice * (1 + pct / 100) * 100) / 100 : oldPrice;
        const nextSingle = Number.isFinite(pct) ? Math.round(oldSingle * (1 + pct / 100) * 100) / 100 : oldSingle;
        if (stockSet !== null && setVal(stockIn, nextStock)) writes++;
        if (Number.isFinite(pct)) {
          if (setVal(priceIn, nextPrice)) writes++;
          if (setVal(singleIn, nextSingle)) writes++;
        }
        seen.set(code, { code, oldStock, nextStock, oldPrice, nextPrice, oldSingle, nextSingle });
      }
    };
    all.forEach((e) => { e.scrollTop = 0; });
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
    stepFn();
    for (let st = 0; st <= maxSh + 600; st += step) {
      all.forEach((e) => { e.scrollTop = st; });
      window.scrollTo(0, st);
      await new Promise((r) => setTimeout(r, pauseMs));
      stepFn();
    }
    all.forEach((e) => { e.scrollTop = 0; });
    window.scrollTo(0, 0);
    return { changed: [...seen.values()], writes, scrollHeight: maxSh };
  }`;
  const res = await evalLong(FN, { pct: Number.isFinite(pct) ? pct : null, stockSet, step: 140, pauseMs: 80 }, { timeoutMs: 240000 });
  if (!res || res.__error) throw new Error("fill_failed:" + (res && res.__error || "no_result"));
  log("fill_cdp", JSON.stringify({ changed: res.changed.length, writes: res.writes, scrollHeight: res.scrollHeight }));
  return res.changed;
}
async function clickSave(label) {
  const hit = await page.evaluate((label) => {
    const vis=(x)=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0;};
    const txt=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
    const els=[...document.querySelectorAll("button,span,div")].filter(x=>vis(x)&&!x.children.length&&txt(x)===label);
    const el=els[els.length-1];
    if(!el)return null;
    el.scrollIntoView({block:"center"});
    const r=el.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
  }, label);
  if (!hit) return { ok: false, why: "button_not_found:" + label };
  await page.mouse.click(hit.x, hit.y);
  await page.waitForTimeout(2500);
  const confirm = await page.evaluate(() => {
    const vis=(x)=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0;};
    const txt=(x)=>(x?(x.innerText||x.textContent||"").trim():"");
    const boxes=[...document.querySelectorAll("[class*=MDL_inner]")].filter(vis);
    const box=boxes.find(b=>/确认|提交|保存/.test(txt(b)));
    if(!box)return null;
    const leaf=[...box.querySelectorAll("*")].filter(x=>vis(x)&&!x.children.length&&/^(确定|确认|提交|保存)$/.test(txt(x)))[0];
    if(!leaf)return null;
    const r=leaf.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),text:txt(leaf)};
  });
  if (confirm) { await page.mouse.click(confirm.x, confirm.y); await page.waitForTimeout(3500); }
  await page.waitForTimeout(3000);
  const url = String(await page.url());
  return { ok: /goods_add\/success/.test(url), url, confirm: confirm ? confirm.text : null };
}

async function main() {
  await openEdit();
  const changed = await fillAll();
  const summary = await page.evaluate(() => {
    const t=document.body.innerText||"";
    const m=t.match(/总库存\s*([0-9]+)/);
    const p=t.match(/拼单价\s*([0-9.]+～[0-9.]+元)/);
    return { totalStock: m?m[1]:null, priceRange: p?p[1]:null };
  });
  const mode = JOB.saveMode || "fill";
  let saved = null;
  if (mode !== "fill") {
    saved = await clickSave(mode === "submit" ? "提交" : "保存草稿");
    log("save_result", JSON.stringify(saved));
    if (mode === "submit" && !saved.ok) throw new Error("submit_failed:" + (saved.url || "no_success"));
  }
  await fs.mkdir(RECORD_DIR, { recursive: true }).catch(() => {});
  const mdPath = RECORD_DIR + "/pdd-edit-goods-" + today() + ".md";
  const lines = [
    "# 商品编辑 · " + JOB.shop + " · " + today(),
    "", "| 规格编码 | 原库存 | 改后库存 | 原拼单价 | 改后拼单价 | 原单买价 | 改后单买价 |", "|---|---|---|---|---|---|---|",
    ...changed.map(c=>"| "+c.code+" | "+c.oldStock+" | "+c.nextStock+" | "+c.oldPrice+" | "+c.nextPrice+" | "+c.oldSingle+" | "+c.nextSingle+" |"),
    "", "## 汇总", "- 商品ID：" + JOB.goodsId, "- 改价百分比：" + (Number.isFinite(Number(JOB.pricePercent))?JOB.pricePercent:"-"), "- 库存设为：" + (JOB.stockSet===undefined?"-":JOB.stockSet), "- 修改规格数：" + changed.length, "- 页面总库存：" + (summary.totalStock||"-"), "- 页面价格：" + (summary.priceRange||"-"), "- 保存模式：" + mode, "- 保存结果：" + (saved ? (saved.ok ? "success" : "failed") + " " + (saved.url || "") : "未保存"), "",
    "> 默认只填不保存；提交/保存需显式 saveMode。",
  ];
  await fs.appendFile(mdPath, (await fs.access(mdPath).then(()=>"\n\n---\n\n## 运行 "+localStamp()+"\n\n").catch(()=>"")) + lines.join("\n"), "utf8");
  return { status: mode === "submit" && saved && !saved.ok ? "failed" : "done", mode, record: mdPath, changed, summary, saved };
}
let result;
try { result = await main(); await writeResult({ ok: true, ...result }); }
catch (e) { const msg = String(e.message || e); log("ERROR", msg); result = { status: "failed", error: msg }; await writeResult({ ok: false, ...result }); }
finally {
  // 只填不保存：把手动控制留给用户检查
  try { if (task && (JOB.saveMode || "fill") === "fill") await task.handOff(); else if (task) await task.finish({ keep: [] }); } catch (e) {}
}
console.log("WORKER_RESULT=" + JSON.stringify({ shop: JOB.shop, goodsId: JOB.goodsId, status: result && result.status, changed: result && result.changed && result.changed.length }));
