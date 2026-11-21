# DOM 契约（编辑页改价/库存）

- 商品列表 → 在售中 → 商品ID 过滤 → 编辑
- 编辑页 URL：`goods_add/index?id=<commitId>&goods_id=<gid>&type=edit`
- 价格/库存表：`tbody tr`，表头含「改后库存」「拼单价」「单买价」「规格编码」
- 每行 `input[placeholder="请输入"]`：
  - 0 库存加减（通常空）
  - 1 改后库存
  - 2 拼单价
  - 3 单买价
  - 4 规格编码
- 页面底部：`提交` / `保存草稿`
- 提交成功 URL：`goods_add/success?...&wait_audit=false...`
- 页面总库存/价格区间文本：`总库存 719928`、`拼单价 13.50～47.50元`
- 虚拟滚动：只渲染可见十几行；必须滚完所有容器
