const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    console.log('User sent /start');
    ctx.reply('Bot အလုပ်လုပ်နေပါပြီ အကိုရေ!');
});

bot.on('text', (ctx) => {
    console.log('Received:', ctx.message.text);
    ctx.reply('Message ရောက်ပါတယ်ဗျ။');
});

bot.launch().then(() => {
    console.log('🚀 Bot started in Polling Mode successfully!');
});
