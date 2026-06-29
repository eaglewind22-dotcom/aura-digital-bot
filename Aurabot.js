const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

const bot = new Telegraf(BOT_TOKEN);

mongoose.connect(MONGO_URI).then(() => console.log('🟢 DB Connected')).catch(err => console.error('🔴 DB Error:', err));

// စမ်းသပ်ရန် handler များ (ဒီမှာ checkForcedJoinAndShop ကို ဖြုတ်ထားတယ်)
bot.start(async (ctx) => {
    console.log("✅ Start command received from:", ctx.from.id);
    ctx.reply("Bot အလုပ်လုပ်နေပါပြီ!");
});

bot.hears('🎮 မိတ်ဆွေဖျော်ဖြေရေး (Top-Up Store)', async (ctx) => {
    console.log("✅ Store menu clicked!");
    ctx.reply("Store menu ရောက်ပါပြီ!");
});

// --- Server Setup (ဒါတွေကို မဖျက်ရပါဘူး) ---
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL}/bot${BOT_TOKEN}`;

bot.telegram.setWebhook(WEBHOOK_URL).then(() => console.log(`✅ Webhook Set`));

const server = http.createServer((req, res) => {
    if (req.url === `/bot${BOT_TOKEN}`) {
        bot.handleUpdate(req, res);
    } else {
        res.end('Aura Digital Bot is Online.');
    }
});

server.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
