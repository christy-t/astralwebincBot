import { Client } from '@line/bot-sdk';
import { Client as NotionClient } from '@notionhq/client';

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const notion = new NotionClient({ auth: process.env.NOTION_TOKEN });
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

const lineClient = new Client(lineConfig);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const parsedBody = JSON.parse(body);
      const events = parsedBody.events || [];
      
      for (const event of events) {
        // 1. 處理新的 QA 問題
        if (event.type === 'message' && 
            (event.message.type === 'text' || event.message.type === 'image')) {
          
          // 1.1 處理文字 QA
          if (event.message.type === 'text') {
            const text = event.message.text.trim();
            if (text.startsWith('QA')) {
              try {
                await notion.pages.create({
                  parent: { database_id: NOTION_DATABASE_ID },
                  properties: {
                    question: {
                      title: [{ text: { content: text } }]
                    },
                    date: {
                      date: { start: new Date().toISOString() }
                    }
                  }
                });
                await lineClient.replyMessage(event.replyToken, {
                  type: 'text',
                  text: '已自動上傳到 Notion！'
                });
              } catch (err) {
                console.error('Notion upload error:', err);
                await lineClient.replyMessage(event.replyToken, {
                  type: 'text',
                  text: '上傳失敗，請稍後再試。'
                });
              }
            }
          }
        }

        // 2. 處理回覆（更新 answer）
        if (event.type === 'message' && event.message.quotedMessage?.text?.startsWith('QA')) {
          const questionText = event.message.quotedMessage.text;
          try {
            // 2.1 查找原始 QA 記錄
            const response = await notion.databases.query({
              database_id: NOTION_DATABASE_ID,
              filter: {
                property: 'question',
                title: { equals: questionText }
              }
            });

            if (response.results.length > 0) {
              const page = response.results[0];
              const oldAnswer = page.properties.answer?.rich_text?.[0]?.text?.content || '';
              
              // 2.2 處理新的回答內容
              let newContent = '';
              if (event.message.type === 'text') {
                newContent = event.message.text;
              } else if (event.message.type === 'image') {
                // 只記錄有圖片，不上傳
                const timestamp = new Date().toISOString();
                newContent = `[${timestamp}] 收到圖片回覆（請查看 LINE 對話）`;
              }

              // 2.3 組合新舊回答
              const newAnswer = oldAnswer 
                ? `${oldAnswer}\n---\n${newContent}`
                : newContent;

              // 2.4 更新 Notion
              await notion.pages.update({
                page_id: page.id,
                properties: {
                  answer: {
                    rich_text: [{ text: { content: newAnswer } }]
                  }
                }
              });

              await lineClient.replyMessage(event.replyToken, {
                type: 'text',
                text: '已更新回答到 Notion！'
              });
            }
          } catch (err) {
            console.error('Answer update error:', err);
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: '更新回答失敗，請稍後再試。'
            });
          }
        }
      }
      res.status(200).end();
    } catch (err) {
      console.error('Webhook handler error:', err);
      res.status(500).end();
    }
  });

  req.on('error', (err) => {
    console.error('Request error:', err);
    res.status(500).end();
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
