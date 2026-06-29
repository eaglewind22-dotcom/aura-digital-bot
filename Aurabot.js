const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000; // Render က ပေးတဲ့ Port ကို သုံးမယ်

const bot = new Telegraf(BOT_TOKEN);

mongoose.connect(MONGO_URI)
    .then(() => console.log('🟢 DB Connected'))
    .catch(err => console.error('🔴 DB Error:', err));

bot.start(async (ctx) => ctx.reply("Bot အလုပ်လုပ်နေပါပြီ!"));

// Webhook Setup
const WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL}/bot${BOT_TOKEN}`;
bot.telegram.setWebhook(WEBHOOK_URL).then(() => console.log(`✅ Webhook Set`));

const server = http.createServer((req, res) => {
    if (req.url === `/bot${BOT_TOKEN}`) {
        bot.handleUpdate(req, res);
    } else {
        res.end('Aura Digital Bot is Online.');
    }
});

// အရေးကြီး: server ကို သေချာ listen လုပ်ပေးပါ
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
