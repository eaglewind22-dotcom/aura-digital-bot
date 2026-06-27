const { Telegraf, Markup } = require('telegraf');
const http = require('http');

// 🔐 Aura Digital Core Setup
const BOT_TOKEN = '8953970980:AAG-8uV8P9ni_vlmXVGdTZfdVrSFHuosX3Y';
const ADMIN_CHAT_ID = '7534742589'; 

const bot = new Telegraf(BOT_TOKEN);
const userSessions = new Map();

// 🛒 Aura Digital MLBB Only Strategy Price List
const PRICES = {
    'mlbb_wp': { name: '🔥 Weekly Pass (Best Price)', price: 6450 },
    'mlbb_tp': { name: '🤩 Twilight Pass', price: 34300 },
    'mlbb_86': { name: '💎 Dia 86', price: 5650 },
    'mlbb_172': { name: '💎 Dia 172', price: 10650 },
    'mlbb_257': { name: '💎 Dia 257', price: 15500 },
    'mlbb_514': { name: '💎 Dia 514', price: 30500 },
    'mlbb_1049': { name: '💎 Dia 1049', price: 62500 }
};

// 🔐 Spam Protection
const rateLimit = new Map();
function isSpamming(userId) {
    const now = Date.now();
    if (rateLimit.has(userId) && (now - rateLimit.get(userId) < 1500)) return true;
    rateLimit.set(userId, now);
    return false;
}

// ၁။ Welcome Menu (Manual Base Text Update)
bot.start((ctx) => {
    if (isSpamming(ctx.from.id)) return;
    userSessions.delete(ctx.from.id);

    ctx.replyWithMarkdownV2(
        `✨ *AURA DIGITAL \\- Top\\-Up Service* \n\n🤖 ပြိုင်ဘက်ထက် ဈေးနှုန်းသက်သာပြီး စိတ်ချရဆုံးစနစ်ဖြင့် လူကိုယ်တိုင် စိစစ်ဖြည့်သွင်းပေးနေပါတယ်ဗျာ။\n\n📌 *Channel ကိုလည်း Join ထားပေးပါဦး:* [Aura Digital Channel](https://t\\.me/Aura\\_Digital\\_Premium)`,
        Markup.inlineKeyboard([
            [Markup.button.callback('🎮 Mobile Legends (MLBB)', 'cat_mlbb')]
        ])
    );
});

// ၂။ MLBB Menu
bot.action('cat_mlbb', (ctx) => {
    const keyboard = [];
    Object.keys(PRICES).forEach((key) => {
        const item = PRICES[key];
        keyboard.push([Markup.button.callback(`🔹 ${item.name} - ${item.price.toLocaleString()} Ks`, `buy_${key}`)]);
    });
    keyboard.push([Markup.button.callback('↩️ Back to Main', 'main_menu')]);
    ctx.editMessageText('💎 MLBB Diamonds & Pass စာရင်း -', Markup.inlineKeyboard(keyboard));
});

// ၃။ Purchase Handler & Session Capture
bot.action(/^buy_(.+)$/, (ctx) => {
    const key = ctx.match[1];
    const item = PRICES[key];

    if (!item) return ctx.reply('⚠️ ပစ္စည်းရှာမတွေ့ပါ။');

    userSessions.set(ctx.from.id, { item: item.name, price: item.price, step: 'AWAITING_ID' });

    ctx.replyWithMarkdownV2(
        `🎯 ရွေးချယ်ထားသောပစ္စည်း: *${item.name}*\n💰 ကျသင့်ငွေ: *${item.price.toLocaleString()} Ks*\n\n` +
        `👉 ကျေးဇူးပြု၍ လူကြီးမင်း၏ *User ID နှင့် Zone ID* အား သေချာစွာ ရိုက်ထည့်ပေးပါဗျာ။\n\n` +
        `📝 *ပုံစံနမူနာ:* \`123456789 (1234)\``,
        { parse_mode: 'MarkdownV2' }
    );
});

// ၄။ ID Validation & Interactive Payment Gate
bot.on('text', async (ctx) => {
    if (isSpamming(ctx.from.id)) return;
    const session = userSessions.get(ctx.from.id);
    if (!session || session.step !== 'AWAITING_ID') return;

    const inputId = ctx.message.text.trim();
    
    // User ID (Zone ID) ပုံစံ Regex စစ်ဆေးချက်
    if (!/^\d+[\s()\-]*\d+$/.test(inputId)) {
        return ctx.reply('⚠️ အမှားအယွင်း ရှိနေပါသည်။ ကျေးဇူးပြု၍ နမူနာပြထားသည့်အတိုင်း User ID (Zone ID) ကို သေချာစွာ ပြန်လည်ရိုက်ထည့်ပေးပါရန်။');
    }

    session.gameId = inputId;
    session.step = 'AWAITING_RECEIPT';
    userSessions.set(ctx.from.id, session);

    await ctx.replyWithMarkdownV2(
        `💵 *စုစုပေါင်းကျသင့်ငွေ:* ${session.price.toLocaleString()} Kyats\n\n` +
        `📌 *အောက်ပါအကောင့်များသို့သာ ငွေလွှဲပေးပါရန်:* \n` +
        `• 📱 *KPay:* \`09692272242\` \\(Daw Aye Aye Myint\\)\n` +
        `• 🌊 *WaveMoney:* \`09400266700\` \\(Wunna Myo Oo\\)\n\n` +
        `⚠️ *🛑 အရေးကြီးသតិပေးချက် 🛑* \n` +
        `ငွေလွှဲခရက်ဒစ် Note ထဲတွင် *""Di / Uc / Wp""* စသည့် စာသားများ *လုံးဝ \\(လုံးဝ\\) မရေးရပါ\\!* ရေးလာပါက အော်ဒါကို ပယ်ဖျက်ပါမည်။\n\n` +
        `လွှဲပြီးပါက *ငွေလွှဲပြေစာ Screenshot* ကို ဤ Chat ထဲသို့ ပို့ပေးပါဗျာ။`,
        { parse_mode: 'MarkdownV2' }
    );
});

// ၅။ Receipt Forwarding & Order Complete Notification
bot.on('photo', async (ctx) => {
    const session = userSessions.get(ctx.from.id);
    if (!session || session.step !== 'AWAITING_RECEIPT') return;

    ctx.reply('🎉 Aura Digital မှ လူကြီးမင်း၏ ငွေလွှဲပြေစာကို လက်ခံရရှိပါပြီ။ လူကိုယ်တိုင် စိစစ်ပြီး မိနစ်ပိုင်းအတွင်း ဂိမ်းထဲသို့ ဖြည့်သွင်းပေးပါမည်ဗျာ။');

    const orderDetails = `🚨 *AURA DIGITAL - MLBB အော်ဒါအသစ်* 🚨\n\n👤 ဝယ်ယူသူ: [${ctx.from.first_name}](tg://user?id=${ctx.from.id})\n🎮 ပစ္စည်း: *${session.item}*\n🎯 MLBB ID: \`${session.gameId}\`\n💰 စစ်ဆေးရမည့်ငွေ: *${session.price.toLocaleString()} Ks*`;
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

    try {
        await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, photoId, { caption: orderDetails, parse_mode: 'Markdown' });
    } catch (e) { console.error("Notification Error:", e); }

    userSessions.delete(ctx.from.id);
});

// Back to Main Menu Logic
bot.action('main_menu', (ctx) => {
    userSessions.delete(ctx.from.id);
    ctx.editMessageText('👋 Aura Digital Main Menu မှ ကြိုဆိုပါတယ်ဗျာ။',
        Markup.inlineKeyboard([
            [Markup.button.callback('🎮 Mobile Legends (MLBB)', 'cat_mlbb')]
        ])
    );
});

// 🌐 Render Web Service Port 
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Aura Digital Bot is Running Perfectly!\n');
});
server.listen(PORT, () => {
    console.log(`Web server listening on port ${PORT}`);
});

bot.launch().then(() => console.log('Aura Digital MLBB Special Bot is Live 🚀'));
