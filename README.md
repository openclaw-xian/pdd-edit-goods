# pdd-edit-goods

拼多多多店铺「商品编辑」—— 编辑页批量改价/库存。默认只填不保存，检查后再显式提交。

## 安全

- `saveMode:"fill"` 默认，只填不保存
- `saveMode:"submit"` 才提交，且需要 `confirmSubmit:true`
- 一次只改一个商品；多店顺序

## 用法

```bash
node run.mjs edit-config.json
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

## 输出

`<recordRoot>/<店铺>/pdd-edit-goods-<日期>.md` + `_runs/edit-goods-<时间>/report.json`

详细字段/算法/坑见 [SKILL.md](SKILL.md)。
