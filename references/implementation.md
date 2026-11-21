# 实现说明

## 结构

- `run.mjs`：预检 → 逐店 spawn worker → 汇总
- `worker-edit-goods.mjs`：打开编辑页 → CDP 填值 → 可选保存/提交 → 记录

## run.mjs

配置：
`recordRoot / shops[].goodsId / pricePercent / stockSet / saveMode / confirmSubmit`

预检：
- shops 非空
- 至少一个 goodsId
- pricePercent 或 stockSet
- saveMode 合法
- submit 必须 confirmSubmit:true

## worker

1. 按 profile 找/建 space；打开商品列表
2. 在售中 → 商品ID 过滤 → 编辑
3. 新标签等待加载
4. CDP `Runtime.evaluate` 一次性滚动+填值
5. 回读页面总库存/价格区间
6. `saveMode`：
   - fill：不保存，handOff
   - draft：点保存草稿
   - submit：点提交，检查 success URL
7. 写 md/JSON

## CDP 填值

- 不用 `page.evaluate`（15s 超时）
- `page.cdp("Runtime.evaluate", {awaitPromise,returnByValue}, {timeout:240000})`
- 页内找所有含 `tbody tr` 的可滚动容器 + window
- 从 0 到 maxScrollHeight+600，步长 140，pause 80
- 每步按规格编码去重，写 改后库存/拼单价/单买价
- 返回 changed/writes/scrollHeight
