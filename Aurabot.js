const { Telegraf } = require('telegraf');

const BOT_TOKEN = '8953970980:AAG-8uV8P9ni_vlmXVGdTZfdVrSFHuosX3Y';
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => ctx.reply('Bot အလုပ်လုပ်နေပါပြီ!'));

// အောက်ဆုံးမှာ bot.launch() လုံးဝ မရှိရပါဘူး
// အောက်ပါအတိုင်းပဲ ထားပါ

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL}/bot${BOT_TOKEN}`;

bot.telegram.setWebhook(WEBHOOK_URL).then(() => {
    console.log(`✅ Webhook set successfully to: ${WEBHOOK_URL}`);
});

const server = http.createServer((req, res) => {
    if (req.url === `/bot${BOT_TOKEN}`) {
        bot.handleUpdate(req, res);
    } else {
        res.end('Aura Digital Bot is Online via Webhook.');
    }
});

server.listen(PORT, () => {
    console.log(`🚀 Bot is live on port ${PORT} using Webhook.`);
});
