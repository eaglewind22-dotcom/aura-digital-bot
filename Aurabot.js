const { Telegraf, Markup } = require('telegraf');
const http = require('http');

const BOT_TOKEN = '8953970980:AAG-8uV8P9ni_vlmXVGdTZfdVrSFHuosX3Y';
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => ctx.reply('Bot အလုပ်လုပ်နေပါပြီ။'));

const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    if (req.url === `/bot${BOT_TOKEN}`) {
        bot.handleUpdate(req, res);
    } else {
        res.end('Bot is running.');
    }
});

server.listen(PORT, () => {
    console.log('Bot is live.');
});
