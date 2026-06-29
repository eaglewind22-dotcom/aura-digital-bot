const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

const bot = new Telegraf(BOT_TOKEN);

mongoose.connect(MONGO_URI)
    .then(() => console.log('🟢 DB Connected'))
    .catch(err => console.error('🔴 DB Error:', err));

// စမ်းသပ်ရန် handler များ
bot.start(async (ctx) => {
    console.log("✅ Start command received from:", ctx.from.id);
    ctx.reply("Bot အလုပ်လုပ်နေပါပြီ!");
});

bot.hears('🎮 မိတ်ဆွေဖျော်ဖြေရေး (Top-Up Store)', async (ctx) => {
    console.log("✅ Store menu clicked!");
    ctx.reply("Store menu ရောက်ပါပြီ!");
});

// Polling mode နဲ့ Run မယ် (Webhook server အပိုင်းတွေကို ဖျက်လိုက်ပါ)
bot.launch()
    .then(() => console.log('🚀 Bot is running in Polling mode'))
    .catch((err) => console.error('🔴 Launch Error:', err));

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
