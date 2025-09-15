import { Client } from '@line/bot-sdk';
import { Client as NotionClient } from '@notionhq/client';

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const notion = new NotionClient({ auth: process.env.NOTION_TOKEN });
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

const lineClient = new Client(lineConfig);

// 處理新增問題到 Notion
async function handleNewQuestion(questionText, replyToken) {
  try {
    await notion.pages.create({
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        question: {
          title: [{ text: { content: questionText } }]
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
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      sorts: [
        {
          property: "date",
          direction: "descending"
        }
      ],
      page_size: 1
    });

    if (response.results.length > 0) {
      const page = response.results[0];
      const oldAnswer = page.properties.answer?.rich_text?.[0]?.text?.content || '';
      
      const newAnswer = oldAnswer 
        ? `${oldAnswer}\n---\n${newContent}`
        : newContent;

      await notion.pages.update({
        page_id: page.id,
        properties: {
          answer: {
            rich_text: [{ text: { content: newAnswer } }]
          }
        }
      });

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

export default async function handler(req, res) {
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
        if (event.message.type === 'text' && messageText?.startsWith('QA')) {
          const questionText = messageText.substring(2).trim();
          if (questionText) {
            await handleNewQuestion(questionText, event.replyToken);
          }
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
}

export const config = {
  api: {
    bodyParser: true
  }
};
