---
name: pdd-edit-images
description: 拼多多商品「编辑」页批量换图（商品轮播图 / 商品详情图 / SKU 预览图），ego 浏览器版：定位各图区 → 删旧 → 上传新图 → 回读计数，默认不保存、不提交。Use when 用户说「改主图」「换详情图」「换预览图」「编辑这条链接的图」「把图换成新素材包」，尤其给了 goods_id + 图片目录。Negative：不用于上架、改价、改标题文案、下架/删除商品；不代登录。
---

# 拼多多编辑页换图（ego 版）

> 来源：2026-11-07 鱼越 `1021597575925`（吸音格栅，12 SKU）实跑。踩过的坑都写在「常见坑」，
> 尤其是**编辑页有多个 `input[type=file]`，选错就把图传到别的区**。

## 何时用 / 不用

- 用：已上架（或草稿）商品要换 主图/轮播图、详情图、SKU 预览图。
- 不用：上架新链接（用 `pdd-ego-listing`）、改价改库存、标题文案、下架删除。
- 下架用 `pdd-delist`。

## 0. 前置

1. **ego 浏览器**：按店铺名 `profiles()` 取 `profileId`，建/续空间；**建空间后回读左侧店铺名**校验。
2. **图片必须先过 3MB**：平台单图 ≤3MB（实测原图常见 3–7MB，直接被拒）。
   用 Pillow 压副本（最长边 1200，PNG optimize，超 2.5MB 转 JPEG q88–92），**不要动原图**：
   建议落到 `<工作目录>/img/{main,detail,sku}/`，文件名 ASCII（如 `m02.png` / `d01.png` / `s_white.png`）。
3. **默认不保存、不提交**：除非用户明确说「保存/提交」。改完把页面留给用户检查。

## 1. 进入编辑页

```js
// 商品列表 → 在售中 → 商品ID 过滤 → 该行「编辑」
// 会打开新标签：https://mms.pinduoduo.com/goods/goods_add/index?id=<commitId>&goods_id=<gid>&type=edit
```

- 页面上有 `提交`、`保存草稿` 两个按钮；**确认没有「不可编辑/活动锁定」提示**再动手。
- 编辑页的 URL 里 `id=` 是 commitId，**重进时不要手拼**，从商品列表点「编辑」即可。

## 2. 三个图区怎么改（全部实测）

### 2a. 商品轮播图（10 slot）

| 项 | 判据 |
|---|---|
| 区容器 | `document.querySelector(".goods-basic-line.carouse")`；内含 10 张缩略图 |
| 单 slot | `[class*="MaterialModalButton_v2_materialContainer"]`（含 imageWrapper / imgContainer / IMG / DeleteIcon / actionBox「预览 更换」） |
| 删除 | slot 内 `[class*="DeleteIcon_v2_delete"]`；**先 hover slot**（mouseover/mouseenter/mousemove）再 click |
| 计数 | 区文本 `已上传N/10张` |
| 上传 | 区内的 `input[type=file]`（祖先链含「图片空间上传 本地上传」）用 `setInputFiles` 一次传多张；**该区满 10 张时追加无效** |

顺序策略：**保留第 1 张 → 从尾部删到只剩 1 张 → 一次上传新的若干张**（新图追加在末尾，顺序即旧首图 + 新图）。

### 2b. 商品详情图（≤50）

| 项 | 判据 |
|---|---|
| 区容器 | 从叶子「商品详情」向上找 innerText 命中 `快捷编辑 … 已上传N/50` 的祖先 |
| 单图 | `[class*="ImageWithRemark_v2_imageContainer"]`（含 IMG、actionBox「预览 更换」、`DeleteIcon_v2_delete`） |
| 计数 | `快捷编辑 已上传N/50张` |
| 上传 | **必须用该区内、祖先链含「快捷编辑 已上传N/50」的那个 `input[type=file]`**；一次传多张，追加在末尾 |

**硬规则：详情区不能删到 0**（平台会拦「商详装修图片不能为空」）。
要「全部换成新版」的正确顺序：

1. 删到只剩 **1 张**（保留任意一张旧图）；
2. 一次性上传新版 N 张（现在 = N+1 张）；
3. 再删掉开头那张旧图 → 剩 N 张，顺序正好是新版 01→0N。

### 2c. SKU 预览图（每 SKU 一行）

| 项 | 判据 |
|---|---|
| 行 | `tbody tr`（第 N 行顺序 = 商品 SKU 顺序：尺寸 × 款式） |
| 预览格 | 该行含 `goods-sku-img` 的 `td`；有图时是 `MaterialModalButton_imageWrapper + imgContainer`，图是 **background-image**（不是 `<img>`） |
| 删除 | 格内 `[class*="DeleteIcon_delete"]`（先 hover）→ 删后该格变成 **「本地上传 / 请上传预览图」** |
| 上传 | 删完之后格内才会出现行内 `input[type=file]`（`MmsUiUploadPicVideoButton___origin___*`），**这时才能 setInputFiles** |

- 有图状态下**没有**行内 input（直接 set 会失败/传错区）——必须先删。
- 颜色映射按款式名对：珍珠白→白图、樱花粉→粉、奶油黄→黄、天空蓝→蓝；每色复用给该色的各长度行。

## 3. 回读与交付

改完逐区读一遍：

```
轮播：已上传N/10   （期望 = 保留首图 + 新图数）
详情：已上传N/50   （期望 = 新图数）
预览：每行 background-image 存在 → x/12
包装标签图：已上传0/10（本来无素材，动了就是传错区，要清回 0）
```

再截图留档（`page.screenshot({path})` 绝对路径），**然后 `task.handOff()` 把控制权还给用户**，让他自己保存/提交。

## 硬红线

1. **默认不保存、不提交**；用户没喊「保存」，就不点。
2. **详情区永远 ≥1 张**；不要尝试删到 0。
3. **上传前先压到 ≤3MB**；拿不准就先 `os.path.getsize` 判一遍。
4. **多 input 必须按锚点选**：轮播的 input 祖先链含「图片空间上传 本地上传」；详情含「快捷编辑 已上传N/50」；SKU 预览是行内 `MmsUiUploadPicVideoButton`。**禁止用 `document.querySelectorAll('input[type=file]')[k]` 下标猜**。
5. **用户接管浏览器时立刻停**：`Control of this task space is with the user` 是硬停，不要抢控制权，等用户说「继续」再 `takeOverTaskSpace`。
6. **回读计数为准**：上传后如果 count 少于预期，说明有图没落库，要补传（不要假设成功）。
7. 一次只改一个链接；改完一个再做下一个。

## 常见坑（全踩过）

- **图传到「包装标签图」**：编辑页 5–7 个 image `input`，下标选中了标签图的框；用户会看到标签图变成 1/10。处置：清回 0（hover + `DeleteIcon` 循环，直到计数 0）。
- **上传后计数不涨**：轮播已 10/10 时追加无效；详情用错 input 也不涨。先确认区域 + 是否已满。
- **详情少了前两张**：先传后删是对的，但若删的是「头部 13 张」而新图里个别没落库，就会出现缺 1–2 张；修法同上「留 1 → 传 N → 删 1」。
- **SKU 预览格点开是素材弹窗**（`上传图片` + 图片池）：那是图片空间选择器，**不是换预览的正确路径**；正确路径是「删旧 → 行内 input 上传」。
- **`tabs` 里编辑页是新标签**：`goods_add/index?...&type=edit`，取 tab 用 URL 匹配 `goods_add`。
- **首图被误换**：轮播删除一律**从尾部删**，别删 index 0。

## 回滚

- 没保存 = 什么都没变：**刷新页面 / 从商品列表重新点「编辑」**即可丢弃全部改动。
- 已保存 = 线上已生效（会走审核）；要回退只能再改一次并提交。

## 记录模板

| 店铺 | goods_id | 轮播 | 详情 | 预览 | 保存/提交 | 备注 |
|---|---|---|---|---|---|---|
| 鱼越贴饰 | 1021597575925 | 首图保留 + 新版主图02–08 | 新版详情01–10 | 12 行按 白/粉/黄/蓝 | 未保存 | 压缩副本在 EDIT-…/img |
