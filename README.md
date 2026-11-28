# pdd-edit-goods

拼多多多店铺「商品编辑」—— 编辑页换图 + 改价/库存。

## 安全

- 默认只操作页面，不保存、不提交
- 改价/库存 `saveMode:"fill"` 默认；`submit` 需双开关
- 换图按 `references/images.md` 操作，默认不保存

## 用法

```bash
node run.mjs edit-config.json
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
  "stockSet": 10000,
  "images": {
    "carousel": ["<图片目录>/main-01.png", "<图片目录>/main-02.png"],
    "detail": ["<图片目录>/detail-01.png", "<图片目录>/detail-02.png"],
    "sku": [{ "match": "<规格编码>", "path": "<图片目录>/sku-01.png" }]
  }
}
```

## 能力

- 换图：轮播图 / 详情图 / SKU 预览图（操作手册 + 图区判据见 references/images.md）
- 改价：批量百分比改拼单价/单买价
- 库存：批量设改后库存
- CDP 滚动填值，覆盖多 SKU 虚拟表格
- fill / draft / submit 三种保存模式

## 输出

`<recordRoot>/<店铺>/pdd-edit-goods-<日期>.md` + `_runs/edit-goods-<时间>/report.json`

详细规则/算法/坑见 [SKILL.md](SKILL.md)。

## 操作账本

保存/提交成功后写入 `店铺运营日志/商品编辑/`，按商品生成历史；`fill` 模式不记录。

## 首次使用

必须询问用户运营日志目录并配置 `ledgerRoot`；未配置返回 `ledger_root_required`，不默认 C 盘，不创建目录。

## 共享账本配置

首次指定 `ledgerRoot` 后会写入共享配置（默认 `%USERPROFILE%/.config/pdd/ledger.json`，可用 `PDD_LEDGER_CONFIG` 覆盖）。其他 skill 自动读取，不再重复询问；配置里只存目录指针，不存业务数据。

- `images.skuAll`：用一张图统一替换全部 SKU 预览图。
