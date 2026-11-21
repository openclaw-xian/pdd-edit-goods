# Changelog

## 0.1.1 — 2026-11-21

- 合并原 pdd-edit-images 的换图能力：轮播图/详情图/SKU 预览图操作手册与判据保留在 `references/images.md`。
- SKILL 描述/范围扩为“编辑页商品操作：换图 + 改价 + 库存”。
- 换图默认不保存；改价/库存保留 fill/draft/submit。
- 明确换图自动化执行层尚未写入 worker，当前按手册操作。

## 0.1.0 — 2026-11-21

- 从 pdd-edit-images 升级为 pdd-edit-goods：聚焦编辑页改价/库存。
- CDP 一次性滚动+填值（参考 pdd-ego-listing），72 SKU 约 100–145s。
- 默认 fill 不保存；支持 draft/submit；submit 需 confirmSubmit。
- 实测：fill 72/72；submit 线上生效；restore 回原值 13.50～47.50 / 719928。
