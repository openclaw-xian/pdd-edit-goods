---
name: pdd-edit-goods
description: 拼多多多店铺「商品编辑」：在商品编辑页批量填改价/库存，默认只填不保存，检查后再显式提交/保存草稿。用 CDP 一次性滚动+填值（参考 pdd-ego-listing），覆盖多 SKU 虚拟表格。Use when 用户要改拼多多商品价格/库存、按百分比改价、批量设库存，或要填完编辑页后自己检查再提交。Negative：不做上架、下架、删除、换图、标题文案；不代登录。
---

# pdd-edit-goods — 编辑页改价/库存

> 范围：在现有商品编辑页批量填 **拼单价/单买价/库存**；默认**只填不保存**。
> 换图/标题/上下架/删除不在本 skill。

## 安全默认

- `saveMode` 默认 `"fill"`：填完把页面留给用户检查，**不保存、不提交**。
- `"draft"`：填完点「保存草稿」。
- `"submit"`：填完点「提交」；必须显式 `saveMode:"submit"` + `confirmSubmit:true`，两者缺一不提交。
- 提交线上会生效；可恢复原值要再跑一次 fill/submit。

## 用法

```bash
node <skill目录>/run.mjs edit-config.json
```

```json
{
  "recordRoot": "D:/pdd-edit-goods",
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
- `stockSet`：把每个 SKU 的改后库存设为该绝对值
- 全局 `goodsId` 或每店 `shops[].goodsId`
- 一次只改一个商品；多店顺序执行

## 编辑页定位

1. 商品列表 → 在售中 → 商品ID 过滤 → 行内「编辑」
2. 打开新标签：`goods_add/index?id=<commitId>&goods_id=<gid>&type=edit`
3. 等页面加载完；价格/库存表在「规格与库存」
4. 表头：`尺寸 | 款式 | 当前库存 | 库存加减 | 改后库存 | 拼单价 | 单买价 | 预览图 | 规格编码 | 状态`
5. 每个 SKU 行 5 个 `input[placeholder="请输入"]`：
   - [0] 库存加减（留空）
   - [1] 改后库存
   - [2] 拼单价
   - [3] 单买价
   - [4] 规格编码

## 填值算法

参考 `pdd-ego-listing`：

- ego 的 `page.evaluate` 有 15s 上限，72 SKU 会超时
- 用 `page.cdp("Runtime.evaluate", ..., {timeout:240000})` 跑**一次页内异步函数**
- 页内找所有含 `tbody tr` 且可滚动的容器 + window
- 从 0 滚到 `maxScrollHeight + 600`，步长 140ms，每步对当前渲染行填值
- 按规格编码去重；填完回读 `covered / writes / 页面总库存 / 价格区间`
- 实测 72 SKU：约 100–145s，72/72 覆盖

## 输出

```
<recordRoot>/<店铺>/pdd-edit-goods-<YYYY-MM-DD>.md
<recordRoot>/_runs/edit-goods-<时间>/report.json
<recordRoot>/_runs/edit-goods-<时间>/logs/<店铺>.log
<recordRoot>/_runs/edit-goods-<时间>/results/<店铺>.json
```

md 表：规格编码 / 原库存 / 改后库存 / 原拼单价 / 改后拼单价 / 原单买价 / 改后单买价，末尾写保存模式与结果。

## 状态

- `fill`：已填，未保存；页面交给用户检查
- `draft`：已保存草稿
- `submit`：已提交；URL 应到 `goods_add/success`
- `failed`：填值/提交/验证失败

总控 exit：3 预检 / 5 失败 / 0 其余。

## 红线

1. 默认不保存、不提交；`submit` 必须双开关
2. 不换图、不改标题、不上下架、不删除
3. 不代登录
4. 不猜价格/库存；用户给值或百分比
5. 提交前检查页面总库存/价格区间
6. 失败即停，不重复点提交
7. 恢复原值要拿原值清单再提一次，不能只靠百分比反推

## 常见坑

- **刷新编辑页不一定丢改动**：PDD 会保留草稿；要关闭旧编辑标签，再从商品列表重新点「编辑」，才回到线上原值。
- 72 SKU 是虚拟滚动；只读可见行会漏，必须滚完。
- `page.evaluate` 填 72 行会 15s 超时；必须 CDP `Runtime.evaluate`。
- 提交按钮要点页面底部最后一个「提交」，不是顶部。
- 提交成功后 URL 是 `goods_add/success`；不是编辑页。
- 价格/库存提交后线上会变；恢复原值需再改一次并提交。
- 同一 SKU 有重复规格编码时，按 code 去重可能漏行；以页面总库存核对。

## 测试边界

- fill：72/72，约 145s；页面总库存 720000、价格 14.85～52.25，未保存
- submit：已 live 提交过一次；线上价格变为 14.85～52.25、库存 719999
- restore：已用原值清单恢复；线上回到 13.50～47.50 / 719928
- 换图/标题不在本 skill
