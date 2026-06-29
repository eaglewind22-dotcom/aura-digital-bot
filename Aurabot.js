const { Telegraf } = require('telegraf');
const http = require('http');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply('Bot အလုပ်လုပ်နေပါပြီ!'));

const server = http.createServer((req, res) => {
    if (req.url === `/bot${process.env.BOT_TOKEN}`) {
        bot.handleUpdate(req, res);
    } else {
        res.end('Aura Digital Bot is Online.');
    }
});

// ဒီနေရာမှာ port ကို process.env.PORT နဲ့ အဓိကထားသုံးပါ
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
