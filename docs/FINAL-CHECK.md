# 最終檢查基準

分支：`camera-engine-v2`

目的：在進入手機實機測試前，固定目前真正存在的 Camera / Pointer / Renderer 行為與測試範圍。

## 核心座標規則

1. `Pointer.getCanvasPosition()` 將 `clientX/Y` 轉成 Canvas pixel 座標。
2. `Camera.screenToWorld()` 將 Canvas screen 座標轉成固定世界座標。
3. `DrawingEngine` 只接收世界座標並繪製到固定 `3000 × 5000` 世界畫布。
4. `Renderer.render()` 再使用 Camera 的 zoom/x/y 將世界畫布顯示於 viewport。
5. `devicePixelRatio`、CSS 像素與世界座標必須避免混用。

## 實機測試順序

### A. 基本繪圖
- 全畫面慢速畫線
- 快速畫線
- 四角與中央各畫一筆
- 確認筆尖與觸控位置一致

### B. 縮放
- 原始倍率畫記號
- 縮小後畫記號
- 放大後畫記號
- 在左、中、右及上、中、下位置重複
- 確認縮放中心附近與邊緣都不偏移

### C. 平移
- 啟用移動模式
- 向四方向拖曳
- 到世界邊界後繼續拖曳
- 確認不露出世界外錯誤區域

### D. 縮放 + 平移組合
- 縮小 → 平移 → 畫
- 放大 → 平移 → 畫
- 多次縮放與平移交替

### E. 手機 viewport
- 直向
- 橫向
- 瀏覽器工具列收起／展開
- resize 後繼續繪圖

## 暫不宣稱已完成

- 完整 30 回合多人實機流程
- Firebase 競態與斷線恢復
- 完整 History / Review 壓力測試
- 未來 World Mode

以上項目必須在核心繪圖實機確認後再逐項驗證。
