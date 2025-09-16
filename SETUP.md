# LINE-Notion 知識庫助手 部署指南

本指南將帶您一步步設置和部署 LINE-Notion 知識庫助手。

## 目錄
1. [前置準備](#前置準備)
2. [LINE Developer 設定](#line-developer-設定)
3. [Notion API 設定](#notion-api-設定)
4. [專案設定](#專案設定)
5. [Vercel 部署](#vercel-部署)
6. [測試與驗證](#測試與驗證)

## 前置準備

需要準備的帳號：
- LINE Developer 帳號
- Notion 帳號
- GitHub 帳號
- Vercel 帳號

需要的開發環境：
- Node.js 14.x 或更高版本
- npm 或 yarn
- Git

## LINE Developer 設定

1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 創建新的 Provider
   - 點擊 "Create New Provider"
   - 輸入 Provider 名稱

3. 創建 Messaging API Channel
   - 在 Provider 頁面中點擊 "Create Channel"
   - 選擇 "Messaging API"
   - 填寫以下資訊：
     - Channel name（頻道名稱）
     - Channel description（頻道描述）
     - Category（類別）
     - Subcategory（子類別）
     - Email address（聯絡信箱）

4. 獲取重要資訊
   - Channel secret
   - Channel access token
   - 保存這些資訊，稍後會用到

5. 設定 Webhook
   - 進入 Messaging API 設定頁面
   - 打開 "Use webhook" 功能
   - Webhook URL 先留空，等 Vercel 部署後再設定

## Notion API 設定

1. 訪問 [Notion Integrations](https://www.notion.so/my-integrations)
2. 點擊 "Create new integration"
3. 填寫整合資訊：
   - Name: LINE-Notion Bot
   - 選擇關聯的工作區
   - 設定適當的功能權限

4. 獲取 Notion API Key
   - 複製生成的 Internal Integration Token
   - 保存此 token，稍後會用到

5. 創建 Notion 資料庫
   - 在 Notion 中創建新頁面
   - 添加一個新的資料庫
   - 設定以下屬性：
     - 問題（標題欄位）
     - 專案（文字）
     - 提問者（文字）
     - 回答（文字）
     - 日期（日期）

6. 分享資料庫給整合
   - 打開資料庫頁面
   - 點擊 Share 按鈕
   - 邀請剛才創建的整合
   - 複製資料庫 ID（從 URL 中獲取）

## 專案設定

1. 克隆專案
   \`\`\`bash
   git clone https://github.com/your-username/line-notion-bot.git
   cd line-notion-bot
   \`\`\`

2. 安裝依賴
   \`\`\`bash
   npm install
   # 或
   yarn install
   \`\`\`

3. 設定環境變數
   創建 `.env.local` 文件：
   \`\`\`
   LINE_CHANNEL_SECRET=你的LINE頻道密鑰
   LINE_CHANNEL_ACCESS_TOKEN=你的LINE存取權杖
   NOTION_API_KEY=你的Notion API金鑰
   NOTION_DATABASE_ID=你的Notion資料庫ID
   \`\`\`

## Vercel 部署

1. 在 [Vercel](https://vercel.com/) 註冊/登入
2. 導入專案
   - 點擊 "Import Project"
   - 選擇 GitHub 倉庫
   - 選擇 line-notion-bot 專案

3. 配置部署設定
   - 設定 Framework Preset 為 Next.js
   - 在 Environment Variables 中添加：
     - LINE_CHANNEL_SECRET
     - LINE_CHANNEL_ACCESS_TOKEN
     - NOTION_API_KEY
     - NOTION_DATABASE_ID

4. 部署
   - 點擊 "Deploy"
   - 等待部署完成
   - 記下生成的網域（例如：your-app.vercel.app）

5. 更新 LINE Webhook URL
   - 返回 LINE Developers Console
   - 設定 Webhook URL：
     \`\`\`
     https://your-app.vercel.app/api/line-webhook
     \`\`\`
   - 點擊 "Verify" 測試連接

## 測試與驗證

1. 掃描 LINE Bot QR Code 加入好友
2. 測試基本功能：
   - 快速提問：
     \`\`\`
     ?這是一個測試問題
     \`\`\`
   - 專案分類提問：
     \`\`\`
     project: 測試專案
     QA: 這是一個測試問題
     \`\`\`

3. 確認 Notion 資料庫
   - 檢查問題是否正確記錄
   - 驗證所有欄位是否正確填寫

## 故障排除

常見問題：

1. Webhook 驗證失敗
   - 檢查 LINE Channel Secret 是否正確
   - 確認 Webhook URL 是否正確
   - 檢查 Vercel 環境變數設定

2. Notion 資料庫無法寫入
   - 確認 Notion API Key 權限
   - 檢查資料庫 ID 是否正確
   - 確認整合已被邀請至資料庫

3. 消息未正確解析
   - 檢查訊息格式是否正確
   - 查看 Vercel 部署日誌尋找錯誤信息

## 維護與更新

1. 定期檢查
   - 監控 Vercel 部署狀態
   - 檢查 LINE Bot 運行狀態
   - 確認 Notion 資料庫訪問權限

2. 版本更新
   - 關注 GitHub 倉庫更新
   - 定期更新依賴包
   - 測試新功能

## 安全建議

1. 環境變數
   - 永遠不要在代碼中硬編碼敏感信息
   - 定期輪換 API 密鑰
   - 使用環境變數管理所有敏感信息

2. 權限控制
   - 限制 Notion 資料庫訪問權限
   - 定期審查 LINE Bot 權限設定
   - 監控異常訪問行為

3. 數據備份
   - 定期備份 Notion 資料庫
   - 保存配置信息
   - 記錄重要更改

## 參考資源

- [LINE Messaging API 文檔](https://developers.line.biz/en/docs/messaging-api/)
- [Notion API 文檔](https://developers.notion.com/)
- [Vercel 部署文檔](https://vercel.com/docs)
- [Next.js 文檔](https://nextjs.org/docs)
