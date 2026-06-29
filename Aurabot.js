const { Telegraf } = require('telegraf');
const http = require('http');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply('Bot အလုပ်လုပ်နေပါပြီ အကိုရေ!'));

// Webhook မသုံးတော့ဘဲ Polling သုံးမယ်
bot.launch();

// ဒါပေမဲ့ Render က Port ဖွင့်ခိုင်းနေလို့ ဒါလေးကို ထည့်ပေးထားပါ
const server = http.createServer((req, res) => {
    res.end('Bot is running');
});
server.listen(process.env.PORT || 3000);
