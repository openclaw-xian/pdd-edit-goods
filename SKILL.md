---
name: pdd-edit-goods
description: 拼多多多店铺「商品编辑」：在商品编辑页批量换图（商品轮播图/商品详情图/SKU 预览图）以及批量填改价/库存；默认只改页面不保存，检查后再显式保存草稿/提交。换图按 references/images.md 的图区判据，改价/库存用 CDP 一次性滚动+填值覆盖多 SKU 虚拟表格。Use when 用户要改拼多多商品主图/详情图/预览图，或要按百分比改价、批量设库存，或要填完编辑页后自己检查再提交。Negative：不做上架、下架、删除、标题文案；不代登录。
---

# pdd-edit-goods — 编辑页商品操作

> 统一处理现有商品「编辑」页的三类操作：
> 1. **换图**：轮播图 / 详情图 / SKU 预览图
> 2. **改价**：批量百分比改拼单价/单买价
> 3. **库存**：批量设改后库存
>
> 默认**只操作页面、不保存**；用户检查后再显式保存草稿/提交。
> 换图的完整图区判据、压缩要求、常见坑在 [references/images.md](references/images.md)。

## 安全默认

- 页面操作默认**不保存、不提交**；换图尤其不能自动保存。
- `saveMode` 是整页保存（价格/库存/图片），图片另需 `confirmSaveImages:true`：
  - `"fill"`（默认）：只填，不保存
  - `"draft"`：点「保存草稿」
  - `"submit"`：点「提交」，需 `confirmSubmit:true`
- 换图与改价/库存可以同页做，但**建议分两轮**：先换图检查，再改价/库存检查，最后统一保存/提交。

## 空间归属

- 只使用名字以 `pdd-edit-goods-` 开头的专用空间；不碰用户 `店铺-*` 空间。
- 上次使用的空间名持久化到 `~/.pdd-edit-goods-spaces.json`（profile → name）。
- 下次按**名字**恢复，不依赖 spaceId 或列表顺序；其他空间被删/顺序变化无影响。
- 如果专用空间被删，新建 `pdd-edit-goods-<店铺>` 并更新状态文件。
- 空间 handOff 后仍可 takeOver；不要抢用户正在用的空间。

## 前置

1. ego 浏览器；按店铺名 `profiles()` 取 `profileId`，建/续空间，回读左侧店铺名。
2. 图片单图 ≤3MB；上传前压副本（最长边 1200，PNG optimize，超 2.5MB 转 JPEG q88–92），文件名 ASCII。
3. 商品列表 → 在售中 → 商品ID 过滤 → 行内「编辑」
   - 新标签：`goods_add/index?id=<commitId>&goods_id=<gid>&type=edit`
4. 编辑页底部有 `提交` / `保存草稿`；默认都不点。

## 换图（自动执行 + 操作判据）

```json
"images": {
  "carousel": ["<图片目录>/main-01.png", "<图片目录>/main-02.png"],
  "detail": ["<图片目录>/detail-01.png", "<图片目录>/detail-02.png"],
  "sku": [{ "match": "<规格编码>", "path": "<图片目录>/sku-01.png" }]
}
```

- `carousel`：自动删到 0 → 上传新图；第一张即新首图
- `detail`：自动留 1 张 → 上传新版 → 删开头旧图
- `sku`：按规格编码匹配行 → 删旧预览 → 行内 input 上传
- `saveMode:draft/submit` 是整页保存，**包含已替换的图片**；换图+改价先 `fill` 检查，保存时必须显式 `confirmSaveImages:true`。

### 轮播图（10 slot）

- 区容器 `.goods-basic-line.carouse`
- 单 slot `[class*="MaterialModalButton_v2_materialContainer"]`
- 删除：slot 内 `[class*="DeleteIcon_v2_delete"]`，先 hover 再 click
- 计数：`已上传N/10张`
- 上传：区内 `input[type=file]`（祖先链含「图片空间上传 本地上传」）一次传多张
- 顺序策略：保留首图 → 从尾部删到只剩 1 张 → 一次上传新图

### 详情图（≤50）

- 区容器：叶子「商品详情」向上找含 `快捷编辑 … 已上传N/50` 的祖先
- 单图 `[class*="ImageWithRemark_v2_imageContainer"]`
- 上传：必须用该区内、祖先链含「快捷编辑 已上传N/50」的 `input[type=file]`
- **详情区不能删到 0**；全换顺序：留 1 张 → 传新版 N 张 → 删开头旧图

### SKU 预览图

- 行：`tbody tr`，顺序 = 尺寸 × 款式
- 预览格：含 `goods-sku-img` 的 `td`；图是 background-image
- 删除：格内 `[class*="DeleteIcon_delete"]`，先 hover
- 删除后格内才出现行内 `input[type=file]`（`MmsUiUploadPicVideoButton`），此时才能上传
- 颜色映射按款式名对：珍珠白→白图、樱花粉→粉、奶油黄→黄、天空蓝→蓝

### 换图回读

- 轮播 `已上传N/10`（期望 = 保留首图 + 新图数）
- 详情 `已上传N/50`（期望 = 新图数）
- 预览每行 background-image 存在 → x/12
- 包装标签图保持 `0/10`；动了就是传错区，要清回 0
- 截图留档；默认把页面留给用户检查

## 改价/库存（自动化执行）

```bash
node <skill目录>/run.mjs edit-config.json
```

```json
{
  "recordRoot": "<编辑记录目录>",
  "saveMode": "fill",
  "confirmSubmit": false,
  "shops": [
    { "shop": "<店铺A>", "profile": "<profile-A>", "goodsId": "<goods_id>" }
  ],
  "pricePercent": 10,
  "stockSet": 10000
}
```

- `pricePercent`：相对当前价改百分比，正数加、负数减；同时改拼单价和单买价
- `stockSet`：每个 SKU 的改后库存设为目标绝对值
- 全局 `goodsId` 或每店 `shops[].goodsId`
- 一次只改一个商品；多店顺序执行

### 编辑页价格/库存表

- 表头：`尺寸 | 款式 | 当前库存 | 库存加减 | 改后库存 | 拼单价 | 单买价 | 预览图 | 规格编码 | 状态`
- 每行 5 个 `input[placeholder="请输入"]`：
  - [0] 库存加减（留空）
  - [1] 改后库存
  - [2] 拼单价
  - [3] 单买价
  - [4] 规格编码

### 填值算法

- ego `page.evaluate` 15s 上限，72 SKU 会超时；改用 CDP `Runtime.evaluate`（timeout 240s）
- 页内找所有含 `tbody tr` 的可滚动容器 + window
- 从 0 滚到 `maxScrollHeight+600`，步长 140，pause 80
- 按规格编码去重；返回 changed/writes/scrollHeight
- 实测 72 SKU：约 100–145s，72/72 覆盖

## 保存 / 提交

- `fill`：不保存，`handOff` 给用户检查
- `draft`：点「保存草稿」
- `submit`：点底部「提交」；成功后 URL 为 `goods_add/success?...&wait_audit=false`
- 提交线上会生效；恢复原值要用原值清单再填一次并提交，不能只靠百分比反推
- 换图默认不保存；`saveMode:draft/submit` 会保存图片，必须 `confirmSaveImages:true`；用户要求保存时再显式执行

## 输出

```
<recordRoot>/<店铺>/pdd-edit-goods-<YYYY-MM-DD>.md
<recordRoot>/_runs/edit-goods-<时间>/report.json
<recordRoot>/_runs/edit-goods-<时间>/logs/<店铺>.log
<recordRoot>/_runs/edit-goods-<时间>/results/<店铺>.json
```

md 表：规格编码 / 原库存 / 改后库存 / 原拼单价 / 改后拼单价 / 原单买价 / 改后单买价；末尾写保存模式与结果。换图记录按 `references/images.md` 模板另记。

## 红线

1. 默认不保存、不提交；`submit` 必须 `saveMode:"submit"` + `confirmSubmit:true`
2. 换图上传前先压到 ≤3MB
3. 详情区永远 ≥1 张
4. 多 input 必须按锚点选，禁止下标猜
5. 不换错区（包装标签图必须保持 0）
6. 一轮只改一个链接；失败即停
7. 恢复原值要原值清单，不靠百分比反推
8. 不代登录、不改标题、不上下架、不删除

## 常见坑

- **刷新编辑页不一定丢改动**：PDD 会保留草稿；关闭旧编辑标签，再从商品列表重新点「编辑」才回到线上原值。
- 72 SKU 虚拟滚动；只读可见行会漏。
- `page.evaluate` 填 72 行 15s 超时；必须 CDP。
- 提交按钮点底部最后一个「提交」，成功后 URL 是 `goods_add/success`。
- 图传到「包装标签图」：多 input 选错；清回 0。
- 上传后计数不涨：轮播满 10/10，或详情用错 input。
- 详情少图：先传后删顺序错；用「留1→传N→删1」。
- SKU 预览点开素材弹窗不是正确路径；删旧后行内 input 才能传。
- 首图被误换：轮播从尾部删，别删 index 0。
- 一个 SKU 库存漏填/重复 code：按页面总库存核对并补。

## 测试边界

- 换图自动执行 2026-11-21 冒烟通过（全部未保存）：
  - 轮播首图：10/10 → 删到 0 → 上传 2 → 2/10，第一张为新图
  - 详情图：12/50 → 留 1 → 上传 2 → 3 → 删开头旧图 → 2
  - SKU 预览：72/72 行全部删旧 → 行内上传 → background-image 恢复
- 改价/库存 fill：72/72；submit live；restore 回原值 13.50～47.50 / 719928
- `run.mjs` 已修：wrapper URL 正斜杠 + 专用空间；2026-11-23 runner smoke 通过（space 9，25.9s）

## 操作账本

`saveMode` 为 `draft`/`submit` 且保存成功时，按商品写：

- `店铺运营日志/商品编辑/<店铺>/<YYYY-MM>/操作记录.jsonl`
- `商品编辑/<店铺>/商品历史/<年>/<商品ID>.md`

`fill` 只填不保存，不落账。驳回记录 `result=rejected`，不记成功。

## 商品主档

保存/提交前调用 `assertCan`；已下架商品返回 `product_delisted`，不允许编辑。保存/提交后写 `店铺运营日志/商品/<店铺>/<商品ID>/`，更新价格/库存/状态；`fill` 不落账。

## 首次使用

必须询问用户运营日志目录并配置 `ledgerRoot`；未配置返回 `ledger_root_required`，不默认 C 盘，不创建目录。

## 共享账本配置

首次指定 `ledgerRoot` 后会写入共享配置（默认 `%USERPROFILE%/.config/pdd/ledger.json`，可用 `PDD_LEDGER_CONFIG` 覆盖）。其他 skill 自动读取，不再重复询问；配置里只存目录指针，不存业务数据。

## 批量与退出码

- 一次只处理一个商品；批量 N 个链接 = 跑 N 次配置，按店铺串行。
- 退出码：0 完成/预览；3 预检；4 needs；5 失败。

- `images.skuAll`：用一张图统一替换全部 SKU 预览图。

## 多店铺约定

- 一个 `profile` 只对应一个店铺，`profile` 是唯一身份。
- `shop` 只用于展示和账本/产物目录，不用于定位登录态。
- 配置必须显式给 `{ shop, profile }`，不按店铺名猜 profile。
- 登录、space、操作都按 profile 隔离。
- profile 缺失/失效 → `shop_not_logged_in` / `login_required`，不自动映射。
- 账本/产物路径按 shop 分：`<root>/<shop>/...`。
