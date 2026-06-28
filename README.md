# 🦎 變色龍訓練 — 神經網路色彩感知遊戲

## 專案目的

透過神經網路理解人類色彩感知，並以此為基礎設計一個「變色龍偽裝」互動遊戲。使用者訓練一個小型神經網路學習 HSV→RGB 的映射關係，然後在遊戲中利用對顏色的直覺調整 HSV 滑桿，讓變色龍融入背景色。

核心學習目標：
- 理解 HSV 色彩模型（色相、飽和度、亮度）與 RGB 的關係
- 視覺化神經網路的前向傳遞、訓練曲線與預測誤差
- 在限時壓力下訓練色彩敏感度

---

## 目前進度

### 已完成

- **訓練頁面**（`training.html`）：完整的類神經網路實驗室
  - 6000 筆合成訓練資料產生器（隨機 HSV + 10% 灰色樣本）
  - 8 維特徵萃取（sin/cos 色相編碼、飽和度、亮度、彩度、強度、色度標記、色相區段）
  - TensorFlow.js 三層全連接網路（64→32→16→3），BatchNorm + Dropout
  - **即時訓練曲線圖**：主軸正確率 0→100%（粗綠實線 + 驗證正確率虛線），副軸 Loss（紅細線）/ MAE（藍細線），底部圖例
  - 訓練狀態列顯示「訓練正確率 % (驗證正確率 %) | Loss」
  - 前向傳遞示範（逐層活化值視覺化）
  - 預測測試（目標 vs 預測 RGB 比對表）
  - 模型架構表與反向傳遞說明
  - 訓練完成後自動儲存模型（**localStorage JSON 序列化**，完全避開 file:// 協定限制）

- **遊戲頁面**（`game.html`）：色彩躲貓貓
  - 5 關漸難關卡（容差 0.20 → 0.05）
  - 每關 45 秒限時，HSV 滑桿即時調整
  - 純色背景（無天空/地板/葉子）
  - 按下確認或時間到自動判定是否過關
  - AI 教練在判定後顯示具體調整建議
  - 失敗導回訓練頁面，全部通關顯示勝利畫面
  - 側欄收合、RWD 響應式設計

- **共通架構**
  - HSV↔RGB 轉換、DeltaE 色差計算等工具函數
  - Renderer 統一 Canvas 繪圖（變色龍、場景、訓練圖表、結果遮罩）
  - **模型持久化**：純 localStorage JSON 序列化（不依賴 TF.js storage handlers，相容 file:// 協定）
  - 無後端依賴，純前端 CDN 載入 TensorFlow.js

### 待完成／已知問題

- 無（目前所有核心功能已實現）

---

## 專案架構

```
自主學習 神經網路/
├── index.html               # 登陸頁（訓練/遊戲 入口卡片）
├── training.html             # 訓練實驗室頁面
├── game.html                 # 遊戲頁面
│
├── css/
│   └── style.css             # 全域樣式（RWD 雙斷點）
│
├── js/
│   ├── config.js             # 設定檔 + HSV/RGB 色彩工具函數
│   ├── training-data.js      # TrainingDataGenerator 類別
│   ├── model.js              # ColorNet 類別（TF.js 神經網路封裝）
│   ├── coach.js              # AICoach 類別（色彩分析 + 建議）
│   ├── game.js               # Game 類別（遊戲邏輯）
│   └── renderer.js           # Renderer 類別（Canvas 繪圖）
│
├── (js/app.js)               # 舊版主控（未使用）
├── (js/ui.js)                # 舊版 UI 管理（未使用）
│
└── README.md                 # 本文件
```

### 檔案角色

| 檔案 | 角色 |
|------|------|
| `index.html` | 登陸頁，兩張卡片導向訓練/遊戲 |
| `training.html` | 訓練實驗室：資料產生、模型訓練、曲線繪製、前向傳遞、預測測試 |
| `game.html` | 色彩躲貓貓遊戲：HSV 滑桿、計時器、AI 教練、關卡推進 |
| `config.js` | `CONFIG` 常數（訓練超參數、遊戲設定、關卡容差表）、`hsv2rgb`/`rgb2hsv`/`deltaE`/`rgb2hex`/`hsv2hex`/`clamp` |
| `training-data.js` | `TrainingDataGenerator`：產生隨機 HSV→RGB 資料、萃取 8 維特徵 |
| `model.js` | `ColorNet`：建構/訓練/預測/儲存/載入 TF.js 模型 |
| `coach.js` | `AICoach`：比對目標與使用者色彩，產生中文調整建議 |
| `game.js` | `Game`：管理關卡生命週期、計時、判定 |
| `renderer.js` | `Renderer`：繪製變色龍、場景、訓練圖表、結果遮罩、勝利畫面 |
| `style.css` | 所有頁面共用樣式，含 RWD 響應式 |

### 資料流

```
HSV（使用者/目標）
  ↓ hsv2rgb() / hsv2hex()
RGB / Hex（Canvas 繪圖 + 顯示）
  ↓ deltaE()
色差（判定過關 / AI 教練分析）

訓練資料流：
隨機 HSV → hsv2rgb() → extractFeatures() → 8D 特徵陣列 → tf.model.fit()
                                                      → predict() → RGB 輸出

模型儲存流（純 localStorage，無 TF.js storage handlers，相容 file:// 協定）：
JSON.stringify({ topology, weights, history }) → localStorage['color-net-model']
JSON.parse(...) → tf.models.modelFromJSON(topology) → layer.setWeights(tensors)
```

---

## 神經網路訓練原理

### 訓練資料產生 (`training-data.js`)

模型要學會的是：給定一組 HSV 數值，輸出對應的 RGB 顏色。

但神經網路不懂 HSV，所以需要把顏色轉成網路能理解的特徵向量。做法：

```
隨機產生 HSV → hsv2rgb() → 萃取 8 維特徵 → 做為輸入 (X)
                             原始 RGB       → 做為輸出 (Y)
```

`TrainingDataGenerator.generateUniform(6000)` 產生 6000 組隨機顏色：

| 步驟 | 說明 |
|------|------|
| 1. 隨機 H (0~360)、S (0.2~1.0)、V (0.2~1.0) | 涵蓋整個色彩空間 |
| 2. 約 10% 樣本強制為灰色 (S=0) | 確保網路學會無彩色 |
| 3. hsv2rgb() 轉成 RGB | 做為訓練目標 (Y) |

### 特徵萃取 (`extractFeatures`)

每組 RGB 被轉成一個 **8 維向量**：

| 維度 | 計算方式 | 意義 |
|------|----------|------|
| 1 | `sin(hueRad)` | 色相角度投影（連續編碼，避免 0°/360° 跳躍） |
| 2 | `cos(hueRad)` | 色相角度投影（與 sin 搭配唯一確定色相） |
| 3 | `s` | 飽和度（原始值） |
| 4 | `v` | 亮度（原始值） |
| 5 | `chroma = max(R,G,B) - min(R,G,B)` | 色彩的「純度」— 與飽和度相關但計算不同 |
| 6 | `intensity = (R+G+B)/3` | 顏色的整體明暗 |
| 7 | `isChromatic = chroma > 0.08 ? 1 : 0` | 二值標記：是否為彩色 |
| 8 | `hueBand = floor(hue/30)/12` | 色相量化到 12 區段 (0~1) |

為什麼不用原始的 HSV 就好？因為：
- H 是角度 (0~360)，0° 和 360° 是同一顏色但數值相差很大 → 用 sin+cos 編碼解決
- 飽和度/亮度在不同色相下對視覺的影響不同 → 加入 chroma、intensity 輔助
- `isChromatic` 幫助網路區分彩色 vs 灰色

### 神經網路架構 (`model.js`)

```
輸入層 (8 維特徵)
  │
  ▼
全連接層 1  —  64 個神經元 · ReLU 激活   (512 + 64 = 576 參數)
BatchNorm  —  標準化活化值，加速收斂
Dropout    —  隨機丟棄 15% 神經元，防止過擬合
  │
  ▼
全連接層 2  —  32 個神經元 · ReLU 激活   (2048 + 32 = 2080 參數)
BatchNorm  —  標準化
Dropout    —  隨機丟棄 10% 神經元
  │
  ▼
全連接層 3  —  16 個神經元 · ReLU 激活   (528 + 16 = 544 參數)
  │
  ▼
輸出層     —  3 個神經元 · Sigmoid 激活  → (R, G, B)，各值 0~1
```

- **總參數**：約 3,200 個
- **優化器**：Adam (lr = 0.001) — 自適應學習率，適合小型網路
- **損失函數**：MSE (Mean Squared Error) — 預測 RGB 與目標 RGB 的均方誤差
- **評估指標**：MAE (Mean Absolute Error)
- **批次**：128 筆 / 次
- **Epoch**：40 次完整遍歷
- **驗證集**：15% 資料保留用於驗證（不參與訓練）

### 訓練過程 (`model.train()`)

```
每完成一個 Epoch：
  1. tf.Model.fit() 回傳 { loss, mae, val_loss, val_mae }
  2. 正確率 = max(0, 1 - MAE / 0.375) × 100
     (0.375 是隨機猜測的預期 MAE，正確率 0% = 亂猜，100% = 完美)
  3. history.push({ loss, mae, accuracy, val_accuracy })
  4. 回呼 training.html 更新 UI：進度條 + 正確率 + 曲線圖
```

### 正確率計算公式

```
accuracy(%) = max(0, 1 - MAE / 0.375) × 100
```

- 隨機猜測時 MAE ≈ 0.375 → 正確率 ≈ 0%
- MAE = 0.0375 → 正確率 = 90%
- MAE = 0.01875 → 正確率 = 95%
- MAE → 0（完美）→ 正確率 → 100%

### 模型儲存與載入 (`saveToStorage` / `loadFromStorage`)

不使用 TF.js 內建的 `localstorage://` 或 `indexeddb://` 儲存器（這些在 `file://` 協定下會被瀏覽器阻擋）。

改用手動序列化：

```
儲存：
  1. model.toJSON() → 取得模型架構
  2. 逐層讀取權重 → { shape, data[] }
  3. JSON.stringify({ topology, weights, history }) → localStorage

載入：
  1. localStorage.getItem('color-net-model') → JSON
  2. tf.models.modelFromJSON(topology) → 重建模型
  3. layer.setWeights(tensors) → 還原權重
  4. model.compile() → 設定優化器與損失函數
```

完全相容 `file://` 協定（直接開檔案即可使用，無需 HTTP server）。

---

## 完整遊戲規則

### 概述

玩家扮演一隻變色龍，在 5 個關卡中逐一將自己的體色調整至與背景一致。每關有限時 45 秒，時間到自動判定。滑桿調整過程中 AI 教練**不會即時回應**，只有在按下「確認」或時間結束後才顯示分析結果。

### 關卡結構

| 關卡 | 名稱 | 容許色差 (Tolerance) |
|------|------|----------------------|
| 1 | 第1關 | 0.20 |
| 2 | 第2關 | 0.15 |
| 3 | 第3關 | 0.12 |
| 4 | 第4關 | 0.08 |
| 5 | 第5關 | 0.05 |

- 容許值為 DeltaE（RGB 歐氏距離），值越小表示要求越精準
- 最多 5 關，通過所有關卡即獲得勝利

### 遊戲流程

```
開始遊戲
  │
  ▼
第 N 關開始（N=1）
  │
  ├── 顯示目標背景色（Canvas 純色填滿）
  ├── 顯示使用者的變色龍（初始隨機色）
  ├── 倒數計時 45 秒開始
  │
  ├── 玩家調整 H/S/V 滑桿
  │     └── 無即時教練回饋
  │
  ├── [選項 A] 按下「✓ 確認」
  │     └── 立即判定
  │
  └── [選項 B] 時間到（45 秒歸零）
        └── 自動判定
              │
              ▼
          計算 DeltaE
              │
        ┌─────┴─────┐
        │            │
     通過           失敗
   (diff<tol)    (diff>=tol)
        │            │
        ▼            ▼
  顯示成功遮罩    顯示失敗遮罩
  更新關卡 N+1   顯示 AI 教練建議
        │        顯示「返回訓練」按鈕
        │            │
        └── N<5 ──┘  │
        │             │
      N=5             │
        │             │
        ▼             ▼
   勝利畫面        回到訓練頁
  (全部通關!)     (training.html)
```

### 判定規則

- **色差計算**：`DeltaE = sqrt((R₁-R₂)² + (G₁-G₂)² + (B₁-B₂)²)`，其中 RGB 值範圍 0~1
- **通過條件**：`DeltaE < 關卡容許值 (Tolerance)`
  - 範例：第 1 關容差 0.20，若使用者顏色與背景的 DeltaE < 0.20 即過關
- **手動確認**：玩家可隨時按下「✓ 確認」提前判定（節省時間）
- **自動判定**：時間到（45 秒）自動執行判定
- **失敗處理**：顯示 AI 教練分析（色相偏差、飽和度/亮度調整建議），點擊「返回訓練」回到 `training.html`
- **全部通關**：顯示勝利畫面，可點擊「返回訓練」

### 操作方式

| 操作 | 說明 |
|------|------|
| H 滑桿 (0°–360°) | 調整色相（紅橙黃綠藍紫） |
| S 滑桿 (0%–100%) | 調整飽和度（灰 ⟶ 鮮豔） |
| V 滑桿 (0%–100%) | 調整亮度（暗 ⟶ 亮） |
| ✓ 確認 | 提前檢查顏色是否通過 |
| ▶ 繼續 | 回合結束後前進下一關 |
| 點擊畫布 | 同「繼續」按鈕 |
| 側欄收合 ▲/▼ | 切換 AI 教練面板顯示 |

### AI 教練回饋

僅在「按下確認」或「時間到自動判定」後顯示於側欄：

- 通過時：顯示「✓ 通過！」與誤差值
- 失敗時：顯示具體調整建議，包含：
  - RGB 三通道比例偏差分析（哪個顏色過多或不足）
  - 色相偏移方向（順時針/逆時針調整）
  - 飽和度偏高或偏低
  - 亮度偏高或偏低

### 結束條件

| 條件 | 結果 |
|------|------|
| 任一關卡失敗 (diff ≥ tol) | 遊戲結束，顯示失敗畫面 + 教練建議 → 返回訓練頁 |
| 通過全部 5 關 | 勝利畫面 → 返回訓練頁 |

---

## 更動紀錄

### 2026-06-29 (第四輪重構 — file:// 相容性修復)

- **模型載入與 TF.js 解耦**：
  - 新增 `hasSavedData()`：僅檢查 localStorage 有無模型資料，**不需 TF.js**
  - 新增 `loadModelFromStorage()`：需要 TF.js 才重建模型，失敗不阻擋遊戲啟動
  - 移除 `loadFromStorage()` 舊方法
- **遊戲頁面不再依賴 TF.js 才能啟動**：
  - 有模型資料 + TF.js 可用 → 完整功能（含 AI 教練）
  - 有模型資料 + TF.js 不可用 → 遊戲正常進行，教練顯示「⚠️ AI 模型未載入」
  - 無模型資料 → 顯示「尚未訓練模型」遮罩導向訓練頁
- **README.md** 更新檔案結構與訓練原理章節

### 2026-06-29 (第三輪重構)

- **訓練圖表重寫**：
  - 主軸改為「正確率 %」（0→100%），粗綠實線為訓練正確率、淺綠虛線為驗證正確率
  - 副軸（右側）顯示 Loss（紅細線）與 MAE（藍細線）
  - 底部圖例區分四條曲線，Y 軸網格線以正確率為準
- **狀態列強化**：訓練時顯示 `正確率 XX.X% (驗證 XX.X%) | Loss X.XXXX`
- **模型儲存全面改用純 JSON**：
  - 完全捨棄 TF.js 內建 `localstorage://` / `indexeddb://` 儲存器（在 `file://` 協定下會被瀏覽器阻擋）
  - 改用手動序列化：`model.toJSON()` + 逐層權重讀取 → `JSON.stringify` → `localStorage`
  - 載入時 `tf.models.modelFromJSON()` 重建架構 + `layer.setWeights()` 還原權重
  - 完全相容 `file://` 協定（直接雙擊開檔即可使用）
- **README.md 初次建立**，收錄完整專案文件、神經網路訓練原理說明
