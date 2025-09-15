import { Client } from '@line/bot-sdk';
import { Client as NotionClient } from '@notionhq/client';
import imgurUploader from 'imgur-anonymous-uploader';

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const notion = new NotionClient({ auth: process.env.NOTION_TOKEN });
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

const lineClient = new Client(lineConfig);

export default async function handler(req, res) {
  console.log('Webhook received:', req.method);
  console.log('Headers:', req.headers);

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
        // 1. 新增 QA 問題
        if (event.type === 'message' && event.message.type === 'text' && event.message.text.startsWith('QA')) {
          const question = event.message.text.trim();
          const now = new Date().toISOString();
          try {
            await notion.pages.create({
              parent: { database_id: NOTION_DATABASE_ID },
              properties: {
                question: {
                  title: [{ text: { content: question } }],
                },
                date: { date: { start: now } },
              },
            });
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: '已自動上傳到 Notion！',
            });
          } catch (err) {
            console.error('Notion upload error:', err);
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: '上傳 Notion 失敗，請稍後再試。',
            });
          }
        }
        // 2. 回覆 QA（文字或圖片都會連接在 answer 欄位）
        else if (
          event.type === 'message' &&
          (event.message.type === 'text' || event.message.type === 'image') &&
          event.message?.quotedMessage?.text &&
          event.message.quotedMessage.text.startsWith('QA')
        ) {
          const replied = event.message.quotedMessage.text;
          // 查找對應的 QA 問題
          const response = await notion.databases.query({
            database_id: NOTION_DATABASE_ID,
            filter: {
              property: 'question',
              title: { equals: replied },
            },
          });
          if (response.results.length > 0) {
            const page = response.results[0];
            const oldAnswer = page.properties.answer?.rich_text?.map(rt => rt.plain_text).join('\n') || '';
            let newAnswer = oldAnswer;
            // 2-1. 文字回答
            if (event.message.type === 'text') {
              const answerText = event.message.text.trim();
              newAnswer = oldAnswer
                ? `${oldAnswer}\n---\n${answerText}`
                : answerText;
            }
            // 2-2. 圖片回答
            if (event.message.type === 'image') {
              try {
                // 下載 LINE 圖片
                const stream = await lineClient.getMessageContent(event.message.id);
                const chunks = [];
                for await (const chunk of stream) {
                  chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
                // 上傳到 imgur
                const imgurRes = await imgurUploader(buffer);
                const imageUrl = imgurRes.link;
                newAnswer = oldAnswer
                  ? `${oldAnswer}\n---\n[圖片](${imageUrl})`
                  : `[圖片](${imageUrl})`;
              } catch (err) {
                console.error('Image upload error:', err);
                await lineClient.replyMessage(event.replyToken, {
                  type: 'text',
                  text: '圖片上傳失敗，請稍後再試。',
                });
                continue;
              }
            }
            // 更新 Notion answer 欄位
            try {
              await notion.pages.update({
                page_id: page.id,
                properties: {
                  answer: {
                    rich_text: [{ text: { content: newAnswer } }],
                  },
                },
              });
              await lineClient.replyMessage(event.replyToken, {
                type: 'text',
                text: '已將回答寫入 Notion！',
              });
            } catch (err) {
              console.error('Notion answer update error:', err);
              await lineClient.replyMessage(event.replyToken, {
                type: 'text',
                text: '寫入 Notion 回答失敗，請稍後再試。',
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