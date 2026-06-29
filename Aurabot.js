const { Telegraf } = require('telegraf');

const BOT_TOKEN = '8953970980:AAG-8uV8P9ni_vlmXVGdTZfdVrSFHuosX3Y';
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => ctx.reply('Bot အလုပ်လုပ်နေပါပြီ!'));

bot.launch().then(() => {
    console.log('Bot ပွင့်နေပါပြီ။');
});
