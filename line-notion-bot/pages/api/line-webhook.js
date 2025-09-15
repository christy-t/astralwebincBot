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

  if (req.method === 'POST') {
    console.log('Received POST request');
    res.status(200).end();
  } else {
    console.log('Received non-POST request');
    res.status(200).end();
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};