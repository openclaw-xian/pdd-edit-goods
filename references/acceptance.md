# 验收清单

- [x] config 驱动，多店顺序
- [x] 打开商品编辑页（在售中 → ID → 编辑）
- [x] CDP 滚动+填值，72/72
- [x] fill 默认不保存
- [x] submit 双开关 + success URL
- [x] 提交后可恢复原值（用原值清单）
- [x] md/JSON 记录
- [x] 常见坑/测试记录
- [ ] draft live
- [ ] 多店 submit live
- [x] 换图操作手册/判据已合并保留（references/images.md）
- [ ] 换图自动化执行层（当前按手册操作）
- [ ] 标题（不在范围）

## 走查

1. 先 fill +10%/库存 10000，检查页面
2. 用户确认后 submit
3. 核对线上商品列表价格/库存
4. 需要恢复时用原值清单再 fill+submit
