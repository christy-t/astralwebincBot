import { Client } from '@line/bot-sdk';
import { Client as NotionClient } from '@notionhq/client';

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const notion = new NotionClient({ auth: process.env.NOTION_TOKEN });
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

const lineClient = new Client(lineConfig);

// 取得用戶資訊
async function getUserProfile(userId) {
  try {
    const profile = await lineClient.getProfile(userId);
    return profile;
  } catch (err) {
    console.error('獲取用戶資料失敗:', err);
    return null;
  }
}

// 解析訊息內容
function parseMessage(text) {
  // 檢查是否是簡單模式 ("?" 開頭)
  if (text.startsWith('?')) {
    return {
      project: '未分類',
      question: text.substring(1).trim()
    };
  }

  // 檢查標準格式 (project: xxx QA: xxx)
  const projectMatch = text.match(/^project:\s*(.+?)(?:\n|QA:|$)/i);
  const qaMatch = text.match(/QA:\s*(.+?)(?:\n|$)/i);

  if (projectMatch || qaMatch) {
    return {
      project: projectMatch ? projectMatch[1].trim() : '未分類',
      question: qaMatch ? qaMatch[1].trim() : null
    };
  }

  // 如果不符合任何格式，返回 null
  return null;
}

// 處理新增問題到 Notion
async function handleNewQuestion(messageText, userId, replyToken) {
  try {
    // 解析訊息
    const parsed = parseMessage(messageText);
    
    if (!parsed || !parsed.question) {
      await lineClient.replyMessage(replyToken, {
        type: 'text',
        text: '請使用以下格式：\n' +
              '1. 簡單模式：?您的問題\n' +
              '2. 完整模式：\n' +
              'project: 專案名稱\n' +
              'QA: 您的問題'
      });
      return;
    }

    // 獲取用戶資料
    const userProfile = await getUserProfile(userId);
    console.log('用戶資料:', userProfile);

    // 建立 Notion 頁面
    await notion.pages.create({
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        question: {
          title: [{ text: { content: parsed.question } }]
        },
        project: {
          select: { 
            name: parsed.project,
            create_option: true  // 允許創建新選項
          }
        },
        user: {
          rich_text: [{ text: { content: userProfile ? userProfile.displayName : '未知用戶' } }]
        },
        date: {
          date: { start: new Date().toISOString() }
        }
      }
    });

    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '已自動上傳到 Notion！'
    });
  } catch (err) {
    console.error('Notion 上傳錯誤:', err);
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '上傳失敗，請稍後再試。'
    });
  }
}

// 處理回覆更新到 Notion
async function handleReply(newContent, replyToken) {
  try {
    console.log('查詢 Notion 資料庫...');
    // 先獲取資料庫的結構
    const database = await notion.databases.retrieve({
      database_id: NOTION_DATABASE_ID
    });
    console.log('資料庫結構:', database);

    // 查詢最新的頁面
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      sorts: [
        {
          timestamp: "created_time",
          direction: "descending"
        }
      ],
      page_size: 1
    });

    if (response.results.length > 0) {
      const page = response.results[0];
      console.log('找到頁面:', page);
      
      // 獲取當前頁面的所有屬性
      const pageDetail = await notion.pages.retrieve({
        page_id: page.id
      });
      console.log('頁面詳細資訊:', pageDetail);
      
      // 尋找 rich_text 類型的屬性作為答案欄位
      const answerPropId = Object.entries(database.properties)
        .find(([_, prop]) => prop.type === 'rich_text' && (prop.name.toLowerCase() === 'answer' || prop.name.toLowerCase() === 'answers'))?.[0];

      if (!answerPropId) {
        throw new Error('找不到答案欄位，請確認資料庫結構');
      }

      const oldAnswer = page.properties[answerPropId]?.rich_text?.[0]?.text?.content || '';
      const newAnswer = oldAnswer 
        ? `${oldAnswer}\n---\n${newContent}`
        : newContent;

      const updateData = {
        page_id: page.id,
        properties: {}
      };
      updateData.properties[answerPropId] = {
        rich_text: [{ text: { content: newAnswer } }]
      };

      console.log('更新資料:', updateData);
      await notion.pages.update(updateData);

      await lineClient.replyMessage(replyToken, {
        type: 'text',
        text: '已更新回答到 Notion！'
      });
      console.log('回答已更新到 Notion');
    } else {
      console.log('找不到最近的問題');
      await lineClient.replyMessage(replyToken, {
        type: 'text',
        text: '無法找到對應的問題，請確認回覆的是正確的問題。'
      });
    }
  } catch (err) {
    console.error('更新回答錯誤:', err);
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '更新回答失敗，請稍後再試。'
    });
  }
}

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    const events = req.body?.events || [];
    console.log('收到 webhook:', JSON.stringify(req.body, null, 2));

    for (const event of events) {
      if (event.deliveryContext?.isRedelivery) {
        console.log('忽略重複事件');
        continue;
      }

      if (event.type === 'message') {
        const messageText = event.message.text?.trim();
        
        // 處理新的 QA 問題
        if (event.message.type === 'text' && 
            (messageText?.startsWith('?') || 
             messageText?.toLowerCase().includes('qa:') || 
             messageText?.toLowerCase().includes('project:'))) {
          await handleNewQuestion(
            messageText, 
            event.source.userId, 
            event.replyToken);
        }
        // 處理回覆
        else if (event.message.quotedMessageId) {
          let content = '';
          if (event.message.type === 'text') {
            content = event.message.text;
          } else if (event.message.type === 'image') {
            content = `[${new Date().toISOString()}] 收到圖片回覆（請查看 LINE 對話）`;
          }
          
          if (content) {
            await handleReply(content, event.replyToken);
          }
        }
      }
    }
    return res.status(200).end();
  } catch (err) {
    console.error('Webhook 處理錯誤:', err);
    return res.status(500).json({ error: '內部伺服器錯誤' });
  }
};

export default handler;

export const config = {
  api: {
    bodyParser: true
  }
};
