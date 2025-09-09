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

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    console.log('Receiving data chunk');
  });

  req.on('end', async () => {
    console.log('Request end, body:', body);
    try {
      const parsedBody = JSON.parse(body);
      console.log('Webhook triggered:', parsedBody);

      const events = parsedBody.events || [];
      for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
          try {
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
            console.log('Reply sent to LINE');
          } catch (err) {
            console.error(
              'LINE reply error:',
              err.originalError?.response?.data || err
            );
          }
        } else {
          console.log('Event not handled:', event);
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