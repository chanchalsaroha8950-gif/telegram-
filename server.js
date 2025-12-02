const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT2_TOKEN = process.env.BOT2_TOKEN;
const BIN_CHANNEL_ID = process.env.BIN_CHANNEL_ID;
const BOT2_USERNAME = (process.env.BOT2_USERNAME || '').replace('@', '');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const FORCE_SUB_CHANNEL_ID = process.env.FORCE_SUB_CHANNEL_ID;
const FORCE_SUB_CHANNEL_LINK = process.env.FORCE_SUB_CHANNEL_LINK;
const PORT = process.env.PORT || 3000;

const OWNER_IDS = [7773543746, 8248143999];

if (!BOT_TOKEN || !BOT2_TOKEN || !BIN_CHANNEL_ID || !BOT2_USERNAME || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing required environment variables!');
  console.error('Required: BOT_TOKEN, BOT2_TOKEN, BIN_CHANNEL_ID, BOT2_USERNAME, SUPABASE_URL, SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const bot1 = new TelegramBot(BOT_TOKEN, { polling: true });
const bot2 = new TelegramBot(BOT2_TOKEN, { polling: true });

function generateLinkCode(length = 24) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function saveVideo(videoData) {
  try {
    const { data, error } = await supabase
      .from('videos')
      .insert([videoData])
      .select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data[0] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getVideoByLinkCode(linkCode) {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('link_code', linkCode)
      .limit(1);
    if (error || !data || data.length === 0) {
      return { success: false };
    }
    return { success: true, data: data[0] };
  } catch (err) {
    return { success: false };
  }
}

async function checkChannelMembership(userId) {
  if (!FORCE_SUB_CHANNEL_ID) return { isMember: true };
  try {
    const member = await bot2.getChatMember(FORCE_SUB_CHANNEL_ID, userId);
    const isMember = ['member', 'administrator', 'creator'].includes(member.status);
    return { isMember };
  } catch (error) {
    return { isMember: false };
  }
}

console.log('='.repeat(50));
console.log('Telegram File Storage Bot Started!');
console.log('='.repeat(50));
console.log(`Bot 1: File Storage`);
console.log(`Bot 2: @${BOT2_USERNAME}`);
console.log(`Storage Channel: ${BIN_CHANNEL_ID}`);
if (FORCE_SUB_CHANNEL_ID) console.log(`Force Subscribe: ${FORCE_SUB_CHANNEL_ID}`);
console.log('='.repeat(50));

bot1.on('message', async (msg) => {
  if (msg.chat.type !== 'private') return;
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!OWNER_IDS.includes(userId)) {
    return;
  }

  if (msg.text === '/start') {
    await bot1.sendMessage(chatId, 
      'Welcome to File Storage Bot!\n\n' +
      'Send me any file and I will:\n' +
      '1. Save it to storage channel\n' +
      '2. Give you a shareable link\n\n' +
      'Supported: Videos, Photos, Documents, Audio, Voice, GIFs'
    );
    return;
  }

  if (msg.text === '/status') {
    await bot1.sendMessage(chatId, `Bot Status: Online\nStorage: ${BIN_CHANNEL_ID}\nBot 2: @${BOT2_USERNAME}`);
    return;
  }

  let file = null, fileType = '';
  if (msg.video) { file = msg.video; fileType = 'video'; }
  else if (msg.photo) { file = msg.photo[msg.photo.length - 1]; fileType = 'photo'; }
  else if (msg.document) { file = msg.document; fileType = 'document'; }
  else if (msg.audio) { file = msg.audio; fileType = 'audio'; }
  else if (msg.voice) { file = msg.voice; fileType = 'voice'; }
  else if (msg.video_note) { file = msg.video_note; fileType = 'video_note'; }
  else if (msg.animation) { file = msg.animation; fileType = 'animation'; }

  if (!file) {
    if (msg.text) await bot1.sendMessage(chatId, 'Please send me a file to save it.');
    return;
  }

  console.log(`New ${fileType} from user ${userId}`);
  await bot1.sendMessage(chatId, 'Saving file...');

  try {
    const methodMap = {
      video: 'sendVideo', photo: 'sendPhoto', document: 'sendDocument',
      audio: 'sendAudio', voice: 'sendVoice', video_note: 'sendVideoNote', animation: 'sendAnimation'
    };

    const options = fileType !== 'video_note' ? { caption: msg.caption || `Uploaded by ${userId}` } : {};
    const forwardedMsg = await bot1[methodMap[fileType]](BIN_CHANNEL_ID, file.file_id, options);

    const savedFileId = forwardedMsg[fileType]?.file_id || 
                        (fileType === 'photo' ? forwardedMsg.photo?.[forwardedMsg.photo.length - 1]?.file_id : file.file_id);

    const linkCode = generateLinkCode();
    const bot2Link = `https://t.me/${BOT2_USERNAME}?start=${linkCode}`;

    const result = await saveVideo({
      file_id: savedFileId,
      caption: msg.caption || null,
      user_id: userId.toString(),
      message_id: forwardedMsg.message_id,
      link_code: linkCode,
      shareable_link: bot2Link
    });

    if (result.success) {
      console.log(`Saved! Link: ${bot2Link}`);
      await bot1.sendMessage(chatId, 
        `File saved!\n\nType: ${fileType}\n\nLink:\n${bot2Link}\n\nShare this link to send the file!`
      );
    } else {
      await bot1.sendMessage(chatId, `Error: ${result.error}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    await bot1.sendMessage(chatId, `Error: ${error.message}`);
  }
});

bot2.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const param = match[1].trim();

  if (!param) {
    await bot2.sendMessage(chatId, 'Welcome! Use a valid file link to get your file.');
    return;
  }

  console.log(`File request: ${param} from ${msg.from.id}`);

  const membership = await checkChannelMembership(msg.from.id);

  if (!membership.isMember) {
    if (!FORCE_SUB_CHANNEL_LINK) {
      await bot2.sendMessage(chatId, 'Configuration error. Contact admin.');
      return;
    }
    await bot2.sendMessage(chatId,
      '❌ You must join our channel first!\n\n👇 Join and click "I Have Joined"',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔔 Join Channel', url: FORCE_SUB_CHANNEL_LINK }],
            [{ text: '✅ I Have Joined', callback_data: `check_${param}` }]
          ]
        }
      }
    );
    return;
  }

  await sendFileToUser(chatId, param);
});

bot2.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith('check_')) {
    const linkCode = data.replace('check_', '');
    const membership = await checkChannelMembership(query.from.id);

    if (!membership.isMember) {
      await bot2.answerCallbackQuery(query.id, { text: '❌ Please join the channel first!', show_alert: true });
      return;
    }

    await bot2.answerCallbackQuery(query.id, { text: '✅ Verified!' });
    try { await bot2.deleteMessage(chatId, query.message.message_id); } catch (e) {}
    await sendFileToUser(chatId, linkCode);
  }
});

async function sendFileToUser(chatId, linkCode) {
  const result = await getVideoByLinkCode(linkCode);

  if (!result.success) {
    await bot2.sendMessage(chatId, 'Invalid link.');
    return;
  }

  await bot2.sendMessage(chatId, '✅ Sending your file...');

  let sentMessageId = null;
  try {
    const sent = await bot2.copyMessage(chatId, BIN_CHANNEL_ID, result.data.message_id);
    sentMessageId = sent.message_id;
  } catch (e) {
    try {
      const sent = await bot2.forwardMessage(chatId, BIN_CHANNEL_ID, result.data.message_id);
      sentMessageId = sent.message_id;
    } catch (e2) {
      await bot2.sendMessage(chatId, 'Could not send file. It may have been deleted.');
      return;
    }
  }

  if (sentMessageId) {
    const warning = await bot2.sendMessage(chatId, 
      '⚠ The file will be automatically deleted after 1 hour.\nForward it to your chat if you want to save it.'
    );

    setTimeout(async () => {
      try { await bot2.deleteMessage(chatId, sentMessageId); } catch (e) {}
      try { await bot2.deleteMessage(chatId, warning.message_id); } catch (e) {}
      console.log(`Auto-deleted file for ${chatId}`);
    }, 60 * 60 * 1000);

    console.log(`File sent to ${chatId}, auto-delete in 1 hour`);
  }
}

bot1.on('polling_error', (e) => console.error('Bot1 error:', e.message));
bot2.on('polling_error', (e) => console.error('Bot2 error:', e.message));

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Health server running on port ${PORT}`);
});

process.on('SIGINT', () => { bot1.stopPolling(); bot2.stopPolling(); process.exit(0); });
process.on('SIGTERM', () => { bot1.stopPolling(); bot2.stopPolling(); process.exit(0); });

console.log('Bots are running...');
