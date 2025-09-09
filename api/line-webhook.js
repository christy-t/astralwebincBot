import { Client } from '@line/bot-sdk';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const lineClient = new Client(config);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  console.log('Webhook triggered:', req.body); // 新增這行
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      await lineClient.replyMessage(event.replyToken, {
        type: 'template',
        altText: '請選擇動作',
        template: {
          type: 'buttons',
          text: `你要將這個問題上傳到 Notion 嗎？\n\n"${event.message.text}"`,
          actions: [
            {
              type: 'postback',
              label: '上傳到 Notion',
              data: JSON.stringify({ action: 'upload', question: event.message.text }),
            },
          ],
        },
      });
    }
    // 這裡之後會串接 Notion API
  }
  res.status(200).end();
}