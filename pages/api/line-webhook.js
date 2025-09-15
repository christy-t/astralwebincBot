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
        if (event.type === 'message' && event.message.type === 'text') {
          const text = event.message.text.trim();
          
          // 當訊息開頭是 QA
          if (text.startsWith('QA')) {
            try {
              // 建立 Notion 頁面
              await notion.pages.create({
                parent: { database_id: NOTION_DATABASE_ID },
                properties: {
                  question: {
                    title: [
                      {
                        text: { content: text }
                      }
                    ]
                  },
                  date: {
                    date: {
                      start: new Date().toISOString()
                    }
                  }
                }
              });

              // 回覆訊息
              await lineClient.replyMessage(event.replyToken, {
                type: 'text',
                text: '已自動上傳到 Notion！'
              });
            } catch (err) {
              console.error('Notion upload error:', err);
              await lineClient.replyMessage(event.replyToken, {
                type: 'text',
                text: '上傳 Notion 失敗，請稍後再試。'
              });
            }
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
