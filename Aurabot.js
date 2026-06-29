const { Telegraf } = require('telegraf');
const http = require('http');

// အသစ်ရလာတဲ့ Token ကို ဒီမှာထည့်ပါ
const BOT_TOKEN = '8617573176:AAGIaiuKEeRD3Zki5Rx8nk3jtGRB49thUNQ';
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => ctx.reply('✅ Aura Digital Premium Bot အသစ် အလုပ်လုပ်နေပါပြီ!'));

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL}/bot${BOT_TOKEN}`;

// Webhook ချိတ်ဆက်ခြင်း
bot.telegram.setWebhook(WEBHOOK_URL).then(() => {
    console.log(`✅ Webhook set successfully to: ${WEBHOOK_URL}`);
});

const server = http.createServer((req, res) => {
    if (req.url === `/bot${BOT_TOKEN}`) {
        bot.handleUpdate(req, res);
    } else {
        res.end('Aura Digital Bot is Online.');
    }
});

server.listen(PORT, () => {
    console.log(`🚀 Bot is live on port ${PORT}`);
});
