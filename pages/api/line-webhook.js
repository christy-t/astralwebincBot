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
    return res.status(405).end();
  }

  // 使用 Promise 來確保完整接收請求內容
  const body = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  try {
    try {
      const parsedBody = JSON.parse(body);
      console.log('收到 webhook:', JSON.stringify(parsedBody, null, 2));
      const events = parsedBody.events || [];
      
      for (const event of events) {
        // 忽略重複送達的事件
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

                try {
                  await lineClient.replyMessage(event.replyToken, {
                    type: 'text',
                    text: '已自動上傳到 Notion！'
                  });
                } catch (replyErr) {
                  console.error('LINE 回覆錯誤:', replyErr);
                }
              } catch (err) {
                console.error('Notion 上傳錯誤:', err);
                try {
                  await lineClient.replyMessage(event.replyToken, {
                    type: 'text',
                    text: '上傳失敗，請稍後再試。'
                  });
                } catch (replyErr) {
                  console.error('LINE 錯誤回覆失敗:', replyErr);
                }
              }
            }
          }

          // 處理回覆
          const quotedMsg = event.message.quote?.text || event.message.quotedMessage?.text;
          if (quotedMsg) {
            console.log('處理回覆訊息:', quotedMsg);
            const originalQuestion = quotedMsg.startsWith('QA') ? 
              quotedMsg.substring(2).trim() : quotedMsg.trim();

            try {
              const response = await notion.databases.query({
                database_id: NOTION_DATABASE_ID,
                filter: {
                  property: 'question',
                  title: { equals: originalQuestion }
                }
              });

              if (response.results.length > 0) {
                const page = response.results[0];
                const oldAnswer = page.properties.answer?.rich_text?.[0]?.text?.content || '';
                
                let newContent = '';
                if (event.message.type === 'text') {
                  newContent = event.message.text;
                } else if (event.message.type === 'image') {
                  const timestamp = new Date().toISOString();
                  newContent = `[${timestamp}] 收到圖片回覆（請查看 LINE 對話）`;
                }

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

                try {
                  await lineClient.replyMessage(event.replyToken, {
                    type: 'text',
                    text: '已更新回答到 Notion！'
                  });
                } catch (replyErr) {
                  console.error('LINE 回覆錯誤:', replyErr);
                }
              } else {
                console.log('找不到對應的問題');
              }
            } catch (err) {
              console.error('更新回答錯誤:', err);
              try {
                await lineClient.replyMessage(event.replyToken, {
                  type: 'text',
                  text: '更新回答失敗，請稍後再試。'
                });
              } catch (replyErr) {
                console.error('LINE 錯誤回覆失敗:', replyErr);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Webhook 處理錯誤:', err);
      return res.status(500).json({ error: '內部伺服器錯誤' });
    }
  } finally {
    // 確保所有處理完成後才回應 LINE 平台
    res.status(200).end();
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
