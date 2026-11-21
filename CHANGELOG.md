# Changelog

## 0.1.0 — 2026-11-21

- 从 pdd-edit-images 升级为 pdd-edit-goods：聚焦编辑页改价/库存。
- CDP 一次性滚动+填值（参考 pdd-ego-listing），72 SKU 约 100–145s。
- 默认 fill 不保存；支持 draft/submit；submit 需 confirmSubmit。
- 实测：fill 72/72；submit 线上生效；restore 回原值 13.50～47.50 / 719928。
- 换图/标题不在本 skill。
