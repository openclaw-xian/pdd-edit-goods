# Changelog

## 0.3.2 — 2026-11-27

- 图片提交平台驳回不再列为 skill 缺口：`verifyImageSubmitOutcome` 已检测「新版本已驳回/审核不通过/审核驳回」，返回 `rejected` 或 `needs`，提示用户先处理驳回版本。
- 平台未给具体驳回原因，不尝试绕过审核。

## 0.3.1 — 2026-11-26

- 补充图片提交实测结论：轮播测试图提交后新版本被平台驳回，图片 submit 不可用。

## 0.3.0 — 2026-11-23

- 编辑前检测商品列表行：出现「新版本已驳回 / 审核不通过」立即停止，status=`needs`，exit 4，并带出原因。
- 提交后检测商品列表：出现驳回标记 status=`rejected`。
- 点击提交后无 success URL/无成功提示 status=`submit_failed`，exit 5。
- 实测当前驳回商品：11.7s 检测到 `product_rejected_version`，未再点编辑/提交，线上不变。
## 0.2.9 — 2026-11-23

- 提交后增加结果状态：`submitted` / `rejected` / `submit_failed`。
- 提交成功后再读商品列表：出现「新版本已驳回 / 审核不通过」标 `rejected`。
- 点击提交后无 success URL/无成功提示标 `submit_failed`。
- 当前商品处于「新版本已驳回」状态时，编辑页不再能正常打开，导致该逻辑未能完成 live 验证。
- 待办：处理驳回版本入口，再复测提交结果检测。
## 0.2.7 — 2026-11-23

- 加图片预检：≤3MB、PNG/JPEG 头解析、轮播 1:1 或 3:4 且 ≥480、区域数量上限。
- 专用空间 page budget 满时，关闭本空间旧页并新建页，不再无限新建空间。
- 全量 runner 图片：488.8s，轮播 2、详情 2、SKU 72/72，未保存。
- 预检拒绝：bad-ratio（600x200）、4MB 文件；有效 4 图通过。
- draft 保存点击后返回未确认成功（无 success URL/无 toast），仍待查。
## 0.2.5 — 2026-11-23

- run.mjs 图片冒烟通过：按名字使用 space 9，轮播 2、详情 2，80.6s，exit 0，未保存。
- 记录更新；仍不提交。

## 0.2.4 — 2026-11-23

- 空间定位改为按**名字**持久化到 `~/.pdd-edit-goods-spaces.json`，不依赖 spaceId 或列表顺序。
- 只使用 `pdd-edit-goods-*` 自己的空间；其他空间被删/顺序变化不影响。
- 实测：runner 按名字找到 space 9，no-op fill 72 SKU，26.4s，exit 0。

## 0.2.3 — 2026-11-23

- 修 run.mjs 启动：worker wrapper URL 改正斜杠，不再用 PowerShell 包一层。
- 专用空间选择：只用 `pdd-edit-goods-*` 命名空间；不碰用户 `店铺-*` 空间；handOff 后仍可 takeOver 自己的空间。
- runner smoke 通过：space 9，no-op fill 72 SKU，25.9s，exit 0。

## 0.2.2 — 2026-11-21

- 最终全量冒烟：轮播 2/10（首图为测试图）、详情 2/50、SKU 72/72；全部未保存。
- 轮播改为删到 0 再上传，保证第一张为新图。

## 0.2.1 — 2026-11-21

- SKU 预览图全量自动替换实测 **72/72**；每行按规格编码滚动定位，删旧→行内上传→background 恢复。
- 换图全量冒烟（未保存）：轮播 10→0→2（首图为测试图）、详情 12→2、SKU 72/72。
- 修复 SKU 虚拟表只在当前滚动位置查找、导致大量漏行的问题；每次查找先回表头。
- 已知：run.mjs 的 ego 子进程启动在当前环境有卡住记录，直接 worker 可用。

## 0.2.0 — 2026-11-21

- 换图自动化落地：轮播图、详情图、SKU 预览图。
- 轮播首图冒烟：10/10 → 删到 0 → 上传 2 → 2/10，第一张为新图。
- 详情图冒烟：12/50 → 留 1 → 上传 2 → 3 → 删开头旧图 → 2。
- SKU 预览冒烟：按规格编码匹配行，删旧 → 行内上传 → background-image 恢复。
- 全部未保存；线上商品不变。
- 已知：run.mjs 的 ego 子进程启动在当前环境有卡住记录，直接 worker 可用。

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
