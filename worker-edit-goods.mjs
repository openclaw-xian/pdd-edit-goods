// worker-edit-goods.mjs — 编辑页改价/库存（fill 默认，不保存）
const fs = await import("node:fs/promises");
const os = await import("node:os");
const JOB = globalThis.__JOB || {};
const T0 = Date.now();
const logs = [];
const log = (...a) => { const s = "[t=" + ((Date.now() - T0) / 1000).toFixed(1) + "s] " + a.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" "); logs.push(s); console.log(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RECORD_DIR = (JOB.recordRoot || "D:/pdd-edit-goods").replace(/\\/g, "/").replace(/\/$/, "") + "/" + JOB.shop;
const SPACE_STATE = String(JOB.spaceStatePath || (os.homedir() + "/.pdd-edit-goods-spaces.json")).replace(/\\/g, "/");
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

async function loadSpaceState() {
  try { return JSON.parse(await fs.readFile(SPACE_STATE, "utf8")); } catch (e) { return {}; }
}
async function saveSpaceState(state) {
  try { await fs.writeFile(SPACE_STATE, JSON.stringify(state, null, 1), "utf8"); } catch (e) {}
}

async function openEdit() {
  const ps = await profiles();
  const prof = ps.find((x) => String(x.name || "") === String(JOB.profile || ""));
  if (!prof) throw new Error("shop_not_logged_in:" + JOB.profile);
  const spaces = await listTaskSpaces();
  const state = await loadSpaceState();
  const key = String(JOB.profile || "");
  const preferred = state[key] && state[key].name ? String(state[key].name) : "";
  const ours = spaces.filter((s) => /^pdd-edit-goods-/.test(String(s.name || "")) && String(s.profileName || "") === String(JOB.profile || ""));
  let entry = null;
  if (JOB.spaceId !== undefined && JOB.spaceId !== null) {
    entry = spaces.find((s) => Number(s.id) === Number(JOB.spaceId));
    if (entry && String(entry.ownership) !== "agent") throw new Error("space_not_owned:" + JOB.spaceId);
  } else if (preferred) {
    entry = ours.find((s) => String(s.name || "") === preferred) || null;
  }
  if (!entry && ours.length) entry = ours[0];
  if (entry) {
    state[key] = { name: String(entry.name || "") };
    await saveSpaceState(state);
    task = String(entry.ownership) === "agent" ? await taskSpace(entry.id) : await takeOverTaskSpace(entry.id);
    log("space", JSON.stringify({ id: entry.id, name: entry.name, ownership: entry.ownership }));
    try {
      page = await newPageSafe();
    } catch (e) {
      if (!/page_budget_full/.test(String(e.message || e))) throw e;
      log("page_budget_close_extra", String(e.message || e));
      const oldPages = await task.pages().catch(() => []);
      for (const p of oldPages) { try { await p.close(); } catch (e2) {} }
      await sleep(600);
      try { page = await newPageSafe(); } catch (e3) {
        log("page_budget_recreate", String(e3.message || e3));
        try { await task.finish({ keep: [] }); } catch (e4) {}
        task = null; page = null;
      }
    }
  }
  if (!page) {
    const name = "pdd-edit-goods-" + JOB.shop;
    task = await taskSpace(name, { profileId: prof.id });
    state[key] = { name };
    await saveSpaceState(state);
    log("space_new", JSON.stringify({ id: task.id, name }));
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
  const rowText = await page.evaluate((gid) => { const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}; const txt=(e)=>(e?(e.innerText||e.textContent||"").replace(/\s+/g," ").trim():""); const a=[...document.querySelectorAll("*")].find(e=>vis(e)&&!e.children.length&&txt(e).includes(gid)); if(!a)return ""; let n=a,row=null; for(let i=0;i<8&&n;i++){n=n.parentElement;if(!n)break;if(/销售中|已下架|审核中|发布中|已驳回/.test(txt(n))){row=n;break;}} return row?txt(row):""; }, JOB.goodsId);
  if (/新版本已驳回|审核不通过|审核驳回/.test(rowText)) throw new Error("product_rejected_version:" + rowText.slice(-260));
  const editBtn = await page.evaluate((gid) => { const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}; const txt=(e)=>(e?(e.innerText||e.textContent||"").trim():""); const anchor=[...document.querySelectorAll("*")].find(e=>vis(e)&&!e.children.length&&txt(e).includes(gid)); if(!anchor)return null; let n=anchor,row=null; for(let i=0;i<8&&n;i++){n=n.parentElement;if(!n)break;if(/销售中|已下架/.test(txt(n))){row=n;break;}} if(!row)return null; const btn=[...row.querySelectorAll("*")].filter(e=>vis(e)&&!e.children.length&&txt(e)==="编辑")[0]; if(!btn)return null; const r=btn.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; }, JOB.goodsId);
  if (!editBtn) throw new Error("edit_button_not_found");
  await page.mouse.click(editBtn.x, editBtn.y);
  let edit = null;
  for (let i = 0; i < 20 && !edit; i++) {
    const pages = await task.pages();
    for (const p of pages) {
      let u = ""; try { u = String(await p.url()); } catch {}
      if (u.includes("goods_add") && u.includes(JOB.goodsId)) { edit = p; break; }
    }
    if (!edit) await sleep(500);
  }
  if (!edit) {
    const pages = await task.pages();
    for (const p of pages) { let u = ""; try { u = String(await p.url()); } catch {} if (u.includes("goods_add")) { edit = p; break; } }
  }
  if (!edit) throw new Error("edit_page_not_open:no_goods_add_tab");
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
  for (let i = 0; i < 60; i++) {
    const busy = await page.evaluate(() => /提交中|保存中|处理中/.test(document.body.innerText || ""));
    if (!busy) break;
    await page.waitForTimeout(1000);
  }
  const state = await page.evaluate(() => {
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const t = (x) => x ? String(x.innerText || x.textContent || "").trim() : "";
    const dialogs = [...document.querySelectorAll("[class*=MDL], [role=dialog], [class*=modal], [class*=Modal], [class*=Dialog], [class*=Toast], [class*=toast]")].filter(vis).map(t).filter(Boolean);
    return { url: location.href, text: (document.body.innerText || "").slice(-2000), dialogs: dialogs.join(" | ").slice(0, 2000) };
  });
  const url = String(state.url);
  const successUrl = /goods_add\/success/.test(url);
  const successToast = /保存成功|草稿保存成功|保存草稿成功|提交成功|已提交|审核中/.test(state.text);
  const dialogText = (state.dialogs || "") + " | " + (state.text || "");
  const lines = String(dialogText || "").split(/\n| \| /).map((x) => x.trim()).filter(Boolean);
  const platformMessage = lines.filter((x) => /不能|无法|失败|不支持|请|限制|锁定|活动|资源位|审核|错误/.test(x)).slice(-1)[0] || "";
  if (/大促.*资源位|大促搜索池|规格拼单价不能增加|无法修改\s*SKU\s*图|SKU\s*图.*(锁定|无法)/i.test(dialogText)) {
    const blocked = /SKU\s*图|规格图/i.test(dialogText) ? "sku_image_locked_by_activity" : "price_locked_by_activity";
    return { ok: false, blocked, platformMessage, dialogText: dialogText.slice(-800), url, confirm: confirm ? confirm.text : null, successUrl: false, successToast: false };
  }
  if (!successUrl && !successToast && platformMessage) {
    return { ok: false, blocked: "platform_submit_blocked", platformMessage, dialogText: dialogText.slice(-800), url, confirm: confirm ? confirm.text : null, successUrl: false, successToast: false };
  }
  return { ok: successUrl || successToast, url, confirm: confirm ? confirm.text : null, successUrl, successToast, platformMessage, dialogText: dialogText.slice(-500) };
}

async function carouselState() {
  return page.evaluate(() => {
    const car = document.querySelector(".goods-basic-line.carouse");
    if (!car) return { found: false };
    const t = (car.innerText || "");
    const m = t.match(/已上传\s*(\d+)\/10/);
    return { found: true, uploaded: m ? Number(m[1]) : null, imgs: car.querySelectorAll("img").length, files: car.querySelectorAll('input[type=file]').length };
  });
}

async function replaceCarousel(files) {
  for (const f of files) await fs.access(f).catch(() => { throw new Error("image_missing:" + f); });
  let st = await carouselState();
  if (!st.found) throw new Error("carousel_not_found");
  log("carousel_before", JSON.stringify(st));
  await page.evaluate(() => { const car=document.querySelector(".goods-basic-line.carouse"); if (car) car.scrollIntoView({ block: "center" }); });
  await page.waitForTimeout(600);
  for (let i = 0; i < 15 && st.uploaded > 0; i++) {
    const hit = await page.evaluate(() => {
      const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
      const car=document.querySelector(".goods-basic-line.carouse");
      const imgs=[...car.querySelectorAll("img")].filter(vis);
      const slot=imgs[imgs.length-1] ? imgs[imgs.length-1].closest('[class*="MaterialModalButton"]') : null;
      if(!slot)return null;
      slot.scrollIntoView({ block: "center" });
      const r=slot.getBoundingClientRect();
      return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
    });
    if (!hit) break;
    await page.mouse.move(hit.x, hit.y); await page.waitForTimeout(350);
    const del = await page.evaluate(() => {
      const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
      const car=document.querySelector(".goods-basic-line.carouse");
      const ds=[...car.querySelectorAll('[class*="DeleteIcon"]')].filter(vis);
      const d=ds[ds.length-1]; if(!d)return null;
      const r=d.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
    });
    if (!del) break;
    const prevUploaded = st.uploaded;
    await page.mouse.click(del.x, del.y);
    await page.waitForTimeout(900);
    st = await carouselState();
    log("carousel_delete", JSON.stringify(st));
    if (st.uploaded >= prevUploaded) { log("carousel_delete_stuck", st.uploaded); break; }
  }
  const input = await page.evaluate(() => {
    const car=document.querySelector(".goods-basic-line.carouse");
    const inp=[...car.querySelectorAll('input[type=file]')][0];
    if(!inp)return false; inp.setAttribute("id","carousel-upload-auto"); return true;
  });
  if (!input) throw new Error("carousel_upload_input_not_found");
  await page.setInputFiles("#carousel-upload-auto", files);
  await page.waitForTimeout(2500);
  st = await carouselState();
  log("carousel_after", JSON.stringify(st));
  if (st.uploaded === null || st.uploaded < files.length) throw new Error("carousel_upload_count_mismatch:" + JSON.stringify(st));
  return { before: null, after: st, keptFirst: true, uploaded: files.length };
}

async function detailState() {
  return page.evaluate(() => {
    const groups=[...document.querySelectorAll(".mui-form-group")];
    const g=groups.find(x=>/快捷编辑/.test(x.innerText||"") && /已上传/.test(x.innerText||""));
    if(!g)return {found:false};
    const t=(g.innerText||"");
    const m=t.match(/已上传\s*(\d+)\/50/);
    const imgs=[...g.querySelectorAll('[class*="ImageWithRemark_v2_imageContainer"]')];
    const first=imgs[0];
    const firstImg=first?first.querySelector("img"):null;
    const src=firstImg?String(firstImg.src||""):"";
    const bg=first?getComputedStyle(first).backgroundImage:"";
    const firstText=first?String(first.innerText||""):"";
    const groupText=String(g.innerText||"");
    const firstEmpty=!first || /文本暂无预览|暂无预览/.test(firstText) || /文本暂无预览|暂无预览/.test(groupText) || (!/^https?:/i.test(src) && !/url\(["']?https?:/i.test(bg));
    return {found:true,uploaded:m?Number(m[1]):null,imgs:imgs.length,firstEmpty,files:g.querySelectorAll('input[type=file]').length};
  });
}

async function replaceDetail(files) {
  for (const f of files) await fs.access(f).catch(() => { throw new Error("image_missing:" + f); });
  let st = await detailState();
  if (!st.found) throw new Error("detail_not_found");
  log("detail_before", JSON.stringify(st));
  if (st.imgs === 0) throw new Error("detail_area_empty");
  const placeholder = !!st.firstEmpty;
  const MIN_DETAIL = (st.imgs === 2 || placeholder) ? 2 : 1;
  const oldIndex = placeholder ? 1 : 0;
  const hadOld = st.imgs > 0;
  for (let i=0;i<80 && st.imgs>MIN_DETAIL;i++) {
    const hit = await page.evaluate(() => {
      const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
      const groups=[...document.querySelectorAll(".mui-form-group")];
      const g=groups.find(x=>/快捷编辑/.test(x.innerText||"") && /已上传/.test(x.innerText||""));
      if(!g)return null;
      const imgs=[...g.querySelectorAll('[class*="ImageWithRemark_v2_imageContainer"]')].filter(vis);
      const slot=imgs[imgs.length-1]; if(!slot)return null; slot.scrollIntoView({block:"center"});
      const r=slot.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
    });
    if(!hit) break;
    await page.mouse.move(hit.x,hit.y); await page.waitForTimeout(350);
    const del=await page.evaluate(()=>{
      const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
      const groups=[...document.querySelectorAll(".mui-form-group")];
      const g=groups.find(x=>/快捷编辑/.test(x.innerText||"") && /已上传/.test(x.innerText||""));
      if(!g)return null;
      const ds=[...g.querySelectorAll('[class*="DeleteIcon"]')].filter(vis); const d=ds[ds.length-1]; if(!d)return null;
      const r=d.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
    });
    if(!del) break; await page.mouse.click(del.x,del.y); await page.waitForTimeout(800);
    const prevImgs = st.imgs;
    st=await detailState(); log("detail_delete",JSON.stringify(st));
    if (st.imgs >= prevImgs) { log("detail_delete_stuck", st.imgs); break; }
  }
  if (st.imgs > MIN_DETAIL + 1) throw new Error("detail_delete_incomplete:" + st.imgs);
  const input=await page.evaluate(()=>{
    const groups=[...document.querySelectorAll(".mui-form-group")];
    const g=groups.find(x=>/快捷编辑/.test(x.innerText||"") && /已上传/.test(x.innerText||""));
    const inp=g?[...g.querySelectorAll('input[type=file]')][0]:null; if(!inp)return false; inp.setAttribute("id","detail-upload-auto");return true;
  });
  if(!input) throw new Error("detail_upload_input_not_found");
  await page.setInputFiles("#detail-upload-auto", files);
  await page.waitForTimeout(2500);
  st=await detailState(); log("detail_after_upload",JSON.stringify(st));
  // delete first old image (keep first was old)
  const delFirst=await page.evaluate((idx)=>{
    const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
    const groups=[...document.querySelectorAll(".mui-form-group")];
    const g=groups.find(x=>/快捷编辑/.test(x.innerText||"") && /已上传/.test(x.innerText||""));
    if(!g)return null; const imgs=[...g.querySelectorAll('[class*="ImageWithRemark_v2_imageContainer"]')].filter(vis); const slot=imgs[idx]; if(!slot)return null; slot.scrollIntoView({block:"center"});
    const r=slot.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
  }, oldIndex);
  if(delFirst){
    await page.mouse.move(delFirst.x,delFirst.y); await page.waitForTimeout(350);
    const d=await page.evaluate((idx)=>{const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};const groups=[...document.querySelectorAll(".mui-form-group")];const g=groups.find(x=>/快捷编辑/.test(x.innerText||"") && /已上传/.test(x.innerText||""));const ds=[...g.querySelectorAll('[class*="DeleteIcon"]')].filter(vis);const d=ds[idx];if(!d)return null;const r=d.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};}, oldIndex);
    if(d){await page.mouse.click(d.x,d.y); await page.waitForTimeout(800);}
  }
  st=await detailState(); log("detail_final",JSON.stringify(st));
  if (st.imgs < files.length) throw new Error("detail_upload_incomplete:" + st.imgs);
  return {after:st, uploaded:files.length};
}
async function collectSkuCodes() {
  const FN = `async () => {
    const sc=[...document.querySelectorAll("*")].filter(e=>e.querySelector&&e.querySelector("tbody tr")&&e.scrollHeight>e.clientHeight+30);
    const all=[...new Set(sc)]; const maxSh=Math.max(3000,...all.map(e=>e.scrollHeight));
    const seen=new Set();
    const step=()=>{for(const tr of [...document.querySelectorAll("tbody tr")]){const ins=[...tr.querySelectorAll('input[placeholder="请输入"]')].filter(e=>e.offsetParent);if(ins.length<5)continue;const code=String(ins[4].value||"").trim();if(code)seen.add(code);}};
    all.forEach(e=>e.scrollTop=0);window.scrollTo(0,0);await new Promise(r=>setTimeout(r,300));step();
    for(let st=0;st<=maxSh+600;st+=140){all.forEach(e=>e.scrollTop=st);window.scrollTo(0,st);await new Promise(r=>setTimeout(r,80));step();}
    return [...seen];
  }`;
  const res = await evalLong(FN, null, { timeoutMs: 240000 });
  if (!res || res.__error) throw new Error("sku_collect_failed:" + (res && res.__error || "no_result"));
  log("sku_codes", JSON.stringify({ count: res.length }));
  return res;
}

async function replaceAllSkuPreviews(path) {
  await fs.access(path).catch(() => { throw new Error("image_missing:" + path); });
  const codes = await collectSkuCodes();
  if (!codes.length) throw new Error("sku_none");
  return replaceSkuPreviews(codes.map((match) => ({ match, path })));
}
async function findSkuCell(match) {
  await page.evaluate(() => {
    const vis=(x)=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0;};
    const tables=[...document.querySelectorAll("table")].filter(vis).filter(x=>x.querySelectorAll("tbody tr").length>0);
    const t=tables[0];
    if(t){
      const cands=[t,...(t.parentElement?[t.parentElement]:[]),...(t.parentElement&&t.parentElement.parentElement?[t.parentElement.parentElement]:[])].filter(x=>x.scrollHeight>x.clientHeight+20);
      if(cands.length)cands[0].scrollTop=0;
    }
    window.scrollTo(0,0);
  });
  await page.waitForTimeout(400);
  for (let step = 0; step < 80; step++) {
    const hit = await page.evaluate((match) => {
      const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
      const tr=[...document.querySelectorAll("tbody tr")].find(r=>[...r.querySelectorAll("input")].some(i=>String(i.value||"").includes(match)));
      if (tr) {
        const c=tr.querySelector("td.sku-preview-cell");
        if (c) { c.scrollIntoView({block:"center"}); const r=c.getBoundingClientRect(); return {found:true,x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; }
      }
      const tables=[...document.querySelectorAll("table")].filter(vis).filter(x=>x.querySelectorAll("tbody tr").length>0);
      const t=tables[0];
      if (t) {
        const cands=[t,...(t.parentElement?[t.parentElement]:[]),...(t.parentElement&&t.parentElement.parentElement?[t.parentElement.parentElement]:[])].filter(x=>x.scrollHeight>x.clientHeight+20);
        if (cands.length) { cands[0].scrollTop += 300; return {found:false,scrolled:true}; }
      }
      return {found:false,scrolled:false};
    }, match);
    if (hit && hit.found) return hit;
    if (!hit || !hit.scrolled) return null;
    await page.waitForTimeout(250);
  }
  return null;
}
async function replaceSkuPreviews(items) {
  const out = [];
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    if (!item || !item.match || !item.path) throw new Error("sku_item_invalid:" + JSON.stringify(item));
    await fs.access(item.path).catch(() => { throw new Error("image_missing:" + item.path); });
    const cell = await findSkuCell(item.match);
    if (!cell) { out.push({ match: item.match, ok: false, why: "row_or_cell_not_found" }); continue; }
    await page.mouse.move(cell.x, cell.y); await page.waitForTimeout(400);
    const del = await page.evaluate((match) => {
      const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
      const tr=[...document.querySelectorAll("tbody tr")].find(r=>[...r.querySelectorAll("input")].some(i=>String(i.value||"").includes(match)));
      const c=tr?tr.querySelector("td.sku-preview-cell"):null; if(!c)return null;
      const ds=[...c.querySelectorAll('[class*="DeleteIcon"]')].filter(vis); const d=ds[0]; if(!d)return null;
      const r=d.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
    }, item.match);
    if (del) { await page.mouse.click(del.x, del.y); await page.waitForTimeout(900); }
    const input = await page.evaluate((match) => {
      const tr=[...document.querySelectorAll("tbody tr")].find(r=>[...r.querySelectorAll("input")].some(i=>String(i.value||"").includes(match)));
      const c=tr?tr.querySelector("td.sku-preview-cell"):null; const i=c?c.querySelector('input[type=file]'):null;
      if(!i)return false; i.setAttribute("id","sku-preview-auto-"+Math.floor(Math.random()*100000)); return i.id;
    }, item.match);
    if (!input) { out.push({ match: item.match, ok: false, why: "upload_input_not_found" }); continue; }
    await page.setInputFiles("#" + input, item.path);
    await page.waitForTimeout(2200);
    const after = await page.evaluate((match) => {
      const tr=[...document.querySelectorAll("tbody tr")].find(r=>[...r.querySelectorAll("input")].some(i=>String(i.value||"").includes(match)));
      const c=tr?tr.querySelector("td.sku-preview-cell"):null;
      return { ok: !!c && !!c.querySelector('[style*="background-image"]'), text: c ? (c.innerText||"").slice(0,40) : "" };
    }, item.match);
    out.push({ match: item.match, ok: after.ok, after });
  }
  return out;
}
async function imageInfo(file) {
  const st = await fs.stat(file).catch(() => null);
  if (!st) throw new Error("image_missing:" + file);
  if (st.size > 3 * 1024 * 1024) throw new Error("image_too_large:" + file + ":" + st.size);
  const b = await fs.readFile(file);
  const sig = b.slice(0, 8);
  if (sig[0] === 0x89 && sig.toString("ascii", 1, 4) === "PNG") {
    return { file, size: st.size, format: "png", width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b[0] === 0xFF && b[1] === 0xD8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { file, size: st.size, format: "jpeg", width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      }
      const len = b.readUInt16BE(i + 2);
      i += 2 + len;
    }
    throw new Error("image_bad_jpeg:" + file);
  }
  throw new Error("image_format_unsupported:" + file);
}

async function preflightImages() {
  const images = JOB.images || {};
  const carousel = Array.isArray(images.carousel) ? images.carousel : [];
  const detail = Array.isArray(images.detail) ? images.detail : [];
  const sku = Array.isArray(images.sku) ? images.sku : [];
  const skuAll = typeof images.skuAll === "string" ? [images.skuAll] : [];
  if (carousel.length > 10) throw new Error("carousel_too_many:" + carousel.length);
  if (detail.length > 50) throw new Error("detail_too_many:" + detail.length);
  const all = [...carousel, ...detail, ...sku.map((x) => x && x.path), ...skuAll].filter(Boolean);
  const infos = [];
  for (const f of all) infos.push(await imageInfo(f));
  for (const m of infos) {
    if (m.format === "png" || m.format === "jpeg") {
      const ratio = m.width / m.height;
      const square = Math.abs(ratio - 1) <= 0.03;
      const portrait34 = Math.abs(ratio - 0.75) <= 0.03;
      if (carousel.includes(m.file) && !(m.width >= 480 && m.height >= 480 && (square || portrait34))) {
        throw new Error("carousel_bad_ratio:" + m.file + ":" + m.width + "x" + m.height);
      }
    }
  }
  log("image_preflight", JSON.stringify({ count: infos.length, carousel: carousel.length, detail: detail.length, sku: sku.length, skuAll: skuAll.length }));
  return infos;
}
async function verifyImageSubmitOutcome() {
  const images = JOB.images || {};
  const hasImages = (Array.isArray(images.carousel) && images.carousel.length) || (Array.isArray(images.detail) && images.detail.length) || (Array.isArray(images.sku) && images.sku.length) || (typeof images.skuAll === "string" && images.skuAll);
  if (!hasImages) return { checked: false };
  await page.goto("https://mms.pinduoduo.com/goods/goods_list", { timeout: 60000 });
  await page.waitForTimeout(4500);
  const tab = await page.evaluate(() => { const vis=(x)=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0;}; const txt=(x)=>(x?(x.textContent||"").trim():""); const t=[...document.querySelectorAll("*")].filter(x=>vis(x)&&!x.children.length&&/^在售中/.test(txt(x)))[0]; if(!t)return null; const r=t.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; });
  if (tab) { await page.mouse.click(tab.x, tab.y); await page.waitForTimeout(2500); }
  await page.evaluate((gid) => { const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}; const labels=[...document.querySelectorAll("*")].filter(e=>vis(e)&&!e.children.length&&(e.textContent||"").trim()==="商品ID"); let inp=null; for(const lab of labels){let row=lab;for(let i=0;i<8&&row;i++){row=row.parentElement;if(!row)break;const c=[...row.querySelectorAll("input")].filter(x=>vis(x)&&x.type!=="checkbox"&&x.type!=="radio");if(c.length){inp=c[0];break;}}if(inp)break;} if(inp){const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;s.call(inp,gid);inp.dispatchEvent(new Event("input",{bubbles:true}));inp.dispatchEvent(new Event("change",{bubbles:true}));inp.focus();} }, JOB.goodsId);
  await page.keyboard.press("Enter"); await page.waitForTimeout(2500);
  const row = await page.evaluate((gid) => { const vis=(x)=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0;}; const txt=(x)=>(x?(x.innerText||x.textContent||"").replace(/\s+/g," ").trim():""); const a=[...document.querySelectorAll("*")].find(x=>vis(x)&&!x.children.length&&txt(x).includes(gid)); if(!a)return null; let n=a,r=null;for(let i=0;i<8&&n;i++){n=n.parentElement;if(!n)break;if(/销售中|已下架|审核中|发布中|已驳回/.test(txt(n))){r=n;break;}} return r?txt(r):""; }, JOB.goodsId);
  const text = String(row || "");
  log("submit_outcome_row", JSON.stringify({ rejected: /新版本已驳回|审核不通过|审核驳回/.test(text), auditing: /审核中|发布中/.test(text), sale: /销售中/.test(text) }));
  return { checked: true, rejected: /新版本已驳回|审核不通过|审核驳回/.test(text), auditing: /审核中|发布中/.test(text), sale: /销售中/.test(text), rowText: text.slice(0, 500) };
}

async function waitImagesReady(timeoutMs = 120000) {
  const start = Date.now();
  let last = "", stable = 0;
  while (Date.now() - start < timeoutMs) {
    const s = await page.evaluate(() => {
      const t = document.body.innerText || "";
      const car = document.querySelector(".goods-basic-line.carouse");
      return { uploading: /上传中|图片上传中|正在上传/.test(t), failed: /上传失败|图片上传失败/.test(t), carImgs: car ? car.querySelectorAll("img").length : 0 };
    });
    if (s.failed) throw new Error("image_upload_failed");
    const sig = JSON.stringify(s);
    if (!s.uploading && sig === last) stable++; else stable = 0;
    last = sig;
    if (stable >= 3) { log("images_ready", sig); return s; }
    await page.waitForTimeout(1000);
  }
  log("images_wait_timeout");
  return null;
}

async function main() {
  await preflightImages();
  await openEdit();
  let changed = [];
  const hasPrice = JOB.pricePercent !== undefined && JOB.pricePercent !== null && Number.isFinite(Number(JOB.pricePercent));
  const hasStock = JOB.stockSet !== undefined && JOB.stockSet !== null;
  if (hasPrice || hasStock) changed = await fillAll();
  let imagesResult = null;
  const images = JOB.images || {};
  if (Array.isArray(images.carousel) && images.carousel.length) {
    imagesResult = { ...(imagesResult || {}), carousel: await replaceCarousel(images.carousel) };
  }
  if (Array.isArray(images.detail) && images.detail.length) {
    imagesResult = { ...(imagesResult || {}), detail: await replaceDetail(images.detail) };
  }
  if (Array.isArray(images.sku) && images.sku.length) {
    imagesResult = { ...(imagesResult || {}), sku: await replaceSkuPreviews(images.sku) };
  }
  if (typeof images.skuAll === "string" && images.skuAll) {
    imagesResult = { ...(imagesResult || {}), skuAll: await replaceAllSkuPreviews(images.skuAll) };
  }
  if (imagesResult) await waitImagesReady();
  const summary = await page.evaluate(() => {
    const t=document.body.innerText||"";
    const m=t.match(/总库存\s*([0-9]+)/);
    const p=t.match(/拼单价\s*([0-9.]+～[0-9.]+元)/);
    return { totalStock: m?m[1]:null, priceRange: p?p[1]:null };
  });
  const mode = JOB.saveMode || "fill";
  let saved = null;
  let submitOutcome = null;
  let finalStatus = "done";
  if (mode !== "fill") {
    saved = await clickSave(mode === "submit" ? "提交" : "保存草稿");
    log("save_result", JSON.stringify(saved));
    if (mode === "submit") {
      if (!saved.ok) finalStatus = saved.blocked ? "needs" : "submit_failed";
      else {
        submitOutcome = await verifyImageSubmitOutcome();
        if (submitOutcome && submitOutcome.rejected) finalStatus = "rejected";
        else finalStatus = "submitted";
      }
    }
  }
  await fs.mkdir(RECORD_DIR, { recursive: true }).catch(() => {});
  const mdPath = RECORD_DIR + "/pdd-edit-goods-" + today() + ".md";
  const lines = [
    "# 商品编辑 · " + JOB.shop + " · " + today(),
    "", "| 规格编码 | 原库存 | 改后库存 | 原拼单价 | 改后拼单价 | 原单买价 | 改后单买价 |", "|---|---|---|---|---|---|---|",
    ...changed.map(c=>"| "+c.code+" | "+c.oldStock+" | "+c.nextStock+" | "+c.oldPrice+" | "+c.nextPrice+" | "+c.oldSingle+" | "+c.nextSingle+" |"),
    "", "## 图片", imagesResult ? JSON.stringify(imagesResult) : "-", "", "## 汇总", "- 商品ID：" + JOB.goodsId, "- 改价百分比：" + (Number.isFinite(Number(JOB.pricePercent))?JOB.pricePercent:"-"), "- 库存设为：" + (JOB.stockSet===undefined?"-":JOB.stockSet), "- 修改规格数：" + changed.length, "- 页面总库存：" + (summary.totalStock||"-"), "- 页面价格：" + (summary.priceRange||"-"), "- 保存模式：" + mode, "- 状态：" + finalStatus, "- 保存结果：" + (saved ? (saved.ok ? "success" : "failed") + " " + (saved.url || "") : "未保存"), "- 提交后核验：" + (submitOutcome ? JSON.stringify(submitOutcome) : "-"), "",
    "> 默认只填不保存；提交/保存需显式 saveMode。",
  ];
  await fs.appendFile(mdPath, (await fs.access(mdPath).then(()=>"\n\n---\n\n## 运行 "+localStamp()+"\n\n").catch(()=>"")) + lines.join("\n"), "utf8");
  return { status: finalStatus, mode, record: mdPath, changed, summary, saved, submitOutcome, images: imagesResult };
}
let result;
try { result = await main(); await writeResult({ ok: true, ...result }); }
catch (e) {
  const msg = String(e.message || e);
  log("ERROR", msg);
  if (/product_rejected_version/.test(msg)) {
    result = {
      status: "needs",
      error: msg,
      needs: { code: "product_rejected_version", question: "商品存在「新版本已驳回」，未继续编辑。请先处理驳回版本/查看驳回原因，再重试。", detail: msg.slice(0, 500) },
    };
  } else {
    result = { status: "failed", error: msg };
  }
  await writeResult({ ok: false, ...result });
}
finally {
  // 只填不保存：把手动控制留给用户检查
  try { if (task && (JOB.saveMode || "fill") === "fill") await task.handOff(); else if (task) await task.finish({ keep: [] }); } catch (e) {}
}
console.log("WORKER_RESULT=" + JSON.stringify({ shop: JOB.shop, goodsId: JOB.goodsId, status: result && result.status, changed: result && result.changed && result.changed.length }));
