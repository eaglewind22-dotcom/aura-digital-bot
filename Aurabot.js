const { Telegraf } = require('telegraf');
const http = require('http');

const BOT_TOKEN = '8617573176:AAGIaiuKEeRD3Zki5Rx8nk3jtGRB49thUNQ';
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => ctx.reply('✅ Aura Digital Premium Bot အသစ် အလုပ်လုပ်နေပါပြီ!'));

// ==========================================
// WEBHOOK INITIALIZATION
// ==========================================
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/bot${BOT_TOKEN}`;
const WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL}${WEBHOOK_PATH}`;

bot.telegram.setWebhook(WEBHOOK_URL).then(() => {
    console.log(`✅ Webhook set successfully to: ${WEBHOOK_URL}`);
}).catch(err => console.error('🔴 Webhook Error:', err));

// HTTP Server ဖြင့် Webhook လက်ခံခြင်း
const server = http.createServer((req, res) => {
    if (req.url === WEBHOOK_PATH && req.method === 'POST') {
        bot.webhookCallback(WEBHOOK_PATH)(req, res);
    } else {
        res.end('Aura Digital Bot is Online via Webhook.');
    }
});

server.listen(PORT, () => {
    console.log(`🚀 Bot is live on port ${PORT}`);
});
