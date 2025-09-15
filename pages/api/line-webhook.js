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
      console.log('收到 webhook:', JSON.stringify(parsedBody, null, 2));
      const events = parsedBody.events || [];
      
      for (const event of events) {
        console.log('處理事件:', event.type);
        
        if (event.type === 'message') {
          // 檢查是否為回覆訊息
          const replyMessage = event.message.replyToken;
          const quotedMessage = event.message.quoteToken || 
                              event.message.quote?.text || 
                              event.message.quotedMessage?.text;
          
          console.log('回覆token:', replyMessage);
          console.log('引用的訊息:', quotedMessage);
          console.log('訊息類型:', event.message.type);
          console.log('訊息內容:', event.message.text);

          // 處理新的 QA 問題
          if (event.message.type === 'text' && event.message.text.trim().startsWith('QA')) {
            console.log('處理新 QA');
            const questionText = event.message.text.trim().substring(2).trim();
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
                await lineClient.replyMessage(event.replyToken, {
                  type: 'text',
                  text: '已自動上傳到 Notion！'
                });
              } catch (err) {
                console.error('Notion 上傳錯誤:', err);
                await lineClient.replyMessage(event.replyToken, {
                  type: 'text',
                  text: '上傳失敗，請稍後再試。'
                });
              }
            }
          }
          
          // 處理回覆
          else if (quotedMessage) {
            console.log('處理回覆訊息');
            // 取得原始問題（可能包含或不包含 QA 前綴）
            const originalQuestion = quotedMessage.startsWith('QA') ? 
              quotedMessage.substring(2).trim() : quotedMessage.trim();
            
            console.log('查詢 Notion:', originalQuestion);
            
            try {
              const response = await notion.databases.query({
                database_id: NOTION_DATABASE_ID,
                filter: {
                  property: 'question',
                  title: { equals: originalQuestion }
                }
              });
              
              console.log('Notion 查詢結果:', response.results.length);

              if (response.results.length > 0) {
                const page = response.results[0];
                console.log('找到對應頁面:', page.id);
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

                console.log('更新 answer:', newAnswer);

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
              } else {
                console.log('找不到對應的問題');
              }
            } catch (err) {
              console.error('更新回答錯誤:', err);
              await lineClient.replyMessage(event.replyToken, {
                type: 'text',
                text: '更新回答失敗，請稍後再試。'
              });
            }
          }
        }
      }
      res.status(200).end();
    } catch (err) {
      console.error('Webhook 處理錯誤:', err);
      res.status(500).end();
    }
  });

  req.on('error', (err) => {
    console.error('請求錯誤:', err);
    res.status(500).end();
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
