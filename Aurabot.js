const { Telegraf } = require('telegraf');
const http = require('http');

// တိုက်ရိုက်ချိတ်ဆက်ခြင်း
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply('Bot အလုပ်လုပ်နေပါပြီ!'));

bot.launch({
  dropPendingUpdates: true, // အရေးကြီးပါတယ် - Pending update တွေကို ဖျက်ထုတ်ပေးပါ
});

const server = http.createServer((req, res) => {
  res.end('Bot is running');
});
server.listen(process.env.PORT || 3000);
