const { Telegraf, Markup } = require('telegraf');

// 🔐 Aura Digital Core Setup & Verified Credentials
const BOT_TOKEN = '8953970980:AAG-8uV8P9ni_vlmXVGdTZfdVrSFHuosX3Y';
const ADMIN_CHAT_ID = '7534742589'; // ညီလေး၏ Chat ID အား စနစ်တကျ ချိတ်ဆက်ပြီး

const bot = new Telegraf(BOT_TOKEN);
const userSessions = new Map();

// 🛒 Aura Digital Strategy Price List (ဈေးကွက်သိမ်းပိုက်မည့် ဗျူဟာမြောက် စျေးနှုန်းများ)
const PRICES = {
    mlbb: {
        'mlbb_wp': { name: '🔥 Weekly Pass (Best Price)', price: 6450 },
        'mlbb_tp': { name: '🤩 Twilight Pass', price: 34300 },
        'mlbb_86': { name: '💎 Dia 86', price: 5650 },
        'mlbb_172': { name: '💎 Dia 172', price: 10650 },
        'mlbb_257': { name: '💎 Dia 257', price: 15500 },
        'mlbb_514': { name: '💎 Dia 514', price: 30500 },
        'mlbb_1049': { name: '💎 Dia 1049', price: 62500 }
    },
    pubg: {
        'pubg_60': { name: '💰 UC 60', price: 4150 },
        'pubg_120': { name: '💰 UC 120', price: 8150 },
        'pubg_325': { name: '💰 UC 325', price: 19650 },
        'pubg_720': { name: '💰 UC 720', price: 42500 },
        'pubg_1800': { name: '💰 UC 1800', price: 98500 }
    }
};

// 🔐 DDOS, Spam & Flood Protection (Hacker ကာကွယ်ရေး ခံတပ်)
const rateLimit = new Map();
function isSpamming(userId) {
    const now = Date.now();
    if (rateLimit.has(userId) && (now - rateLimit.get(userId) < 1500)) return true;
    rateLimit.set(userId, now);
    return false;
}

// ၁။ Welcome Menu (ဆိုင်မျက်နှာစာ)
bot.start((ctx) => {
    if (isSpamming(ctx.from.id)) return;
    userSessions.delete(ctx.from.id);
    
    ctx.replyWithMarkdownV2(
        `✨ *AURA DIGITAL \\- Instant Top\\-Up System* \n\n🤖 ပြိုင်ဘက်ထက် ဈေးနှုန်းသက်သာပြီး စက္ကန့်ပိုင်းအတွင်း စိတ်ချရဆုံး စနစ်ဖြင့် ဝန်ဆောင်မှုပေးနေပါတယ်ဗျာ။`,
        Markup.inlineKeyboard([
            [Markup.button.callback('🎮 Mobile Legends (MLBB)', 'cat_mlbb')],
            [Markup.button.callback('🔫 PUBG Mobile (UC)', 'cat_pubg')]
        ])
    );
});

// ၂။ Dynamic Category Menus
const showMenu = (ctx, type, text) => {
    const keyboard = [];
    Object.keys(PRICES[type]).forEach((key) => {
        const item = PRICES[type][key];
        keyboard.push([Markup.button.callback(`🔹 ${item.name} - ${item.price.toLocaleString()} Ks`, `buy_${type}_${key}`)]);
    });
    keyboard.push([Markup.button.callback('↩️ Back to Main', 'main_menu')]);
    ctx.editMessageText(text, Markup.inlineKeyboard(keyboard));
};

bot.action('cat_mlbb', (ctx) => showMenu(ctx, 'mlbb', '💎 MLBB Diamonds & Pass စာရင်း -'));
bot.action('cat_pubg', (ctx) => showMenu(ctx, 'pubg', '💰 PUBG UC စာရင်း -'));

// ၃။ Purchase Handler & Session Capture
bot.action(/^buy_(mlbb|pubg)_(.+)$/, (ctx) => {
    const type = ctx.match[1];
    const key = ctx.match[2];
    const item = PRICES[type][key];
    
    if (!item) return ctx.reply('⚠️ ပစ္စည်းရှာမတွေ့ပါ။');
    
    userSessions.set(ctx.from.id, { item: item.name, price: item.price, step: 'AWAITING_ID' });
    
    ctx.reply(`🎯 ရွေးချယ်ထားသောပစ္စည်း: *${item.name}*\n💰 ကျသင့်ငွေ: *${item.price.toLocaleString()} Ks*\n\n👉 ကျေးဇူးပြု၍ လူကြီးမင်း၏ *Game ID နှင့် Zone ID (သို့မဟုတ် Character ID)* ကို ရိုက်ထည့်ပေးပါဗျာ။`);
});

// ၄။ Secure ID Validation & Interactive Payment Gate
bot.on('text', async (ctx) => {
    if (isSpamming(ctx.from.id)) return;
    const session = userSessions.get(ctx.from.id);
    if (!session || session.step !== 'AWAITING_ID') return;

    const inputId = ctx.message.text.trim();
    // Input Validation: SQL Injection နှင့် စာသားအတုများ လာရိုက်ခြင်းမှ ကာကွယ်ရန်
    if (!/^\d+[\s()\-]*\d+$/.test(inputId)) {
        return ctx.reply('⚠️ အမှားအယွင်း ရှိနေပါသည်။ ကျေးဇူးပြု၍ ဂဏန်းသန့်သန့် သေချာစွာ ပြန်လည်ရိုက်ထည့်ပေးပါရန်။');
    }

    session.gameId = inputId;
    session.step = 'AWAITING_RECEIPT';
    userSessions.set(ctx.from.id, session);

    // 🛑 ငွေပေးချေမှု ညွှန်ကြားချက် (ညီလေး၏ အကောင့်အစစ်အမှန်များဖြင့် ပြင်ဆင်ပြီး)
    await ctx.replyWithMarkdownV2(
        `💵 *စုစုပေါင်းကျသင့်ငွေ:* ${session.price.toLocaleString()} Kyats\n\n` +
        `📌 *အောက်ပါအကောင့်များသို့သာ ငွေလွှဲပေးပါရန်:* \n` +
        `• 📱 *KPay:* \`09692272242\` \\(Daw Aye Aye Myint\\)\n` +
        `• 🌊 *WaveMoney:* \`09400266700\` \\(Wunna Myo Oo\\)\n\n` +
        `⚠️ *🛑 အရေးကြီးသတိပေးချက် 🛑* \n` +
        `ငွေလွှဲခရက်ဒစ် Note ထဲတွင် *""Di / Uc / Wp""* စသည့် စာသားများ *လုံးဝ \\(လုံးဝ\\) မရေးရပါ\\!* ရေးလာပါက အကောင့်လုံခြုံရေးအရ ငွေအဆုံးရှုံးခံရမည်ဖြစ်ပြီး အော်ဒါကို ပယ်ဖျက်ပါမည်။\n\n` +
        `လွှဲပြီးပါက *ငွေလွှဲပြေစာ Screenshot* ကို ဤ Chat ထဲသို့ ပို့ပေးပါဗျာ။`,
        { parse_mode: 'MarkdownV2' }
    );
});

// ၅။ Receipt Forwarding (Hybrid Notification to ညီလေးဆီတိုက်ရိုက်)
bot.on('photo', async (ctx) => {
    const session = userSessions.get(ctx.from.id);
    if (!session || session.step !== 'AWAITING_RECEIPT') return;

    ctx.reply('🎉 Aura Digital မှ လူကြီးမင်း၏ ငွေလွှဲပြေစာကို လက်ခံရရှိပါပြီ။ မိနစ်ပိုင်းအတွင်း ဂိမ်းထဲသို့ စိစစ်ဖြည့်သွင်းပေးပါမည်ဗျာ။');

    const orderDetails = `🚨 *AURA DIGITAL - အော်ဒါအသစ်* 🚨\n\n👤 ဝယ်ယူသူ: [${ctx.from.first_name}](tg://user?id=${ctx.from.id})\n🎮 ပစ္စည်း: *${session.item}*\n🎯 Game ID: \`${session.gameId}\`\n💰 ရရှိရမည့်ငွေ: *${session.price.toLocaleString()} Ks*`;
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    
    try {
        // Admin (7534742589) ထံသို့ ပုံနှင့်တကွ အော်ဒါချက်ချင်း ပို့ဆောင်ခြင်း
        await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, photoId, { caption: orderDetails, parse_mode: 'Markdown' });
    } catch (e) { console.error("Notification Error:", e); }

    userSessions.delete(ctx.from.id);
});

// Back to Main Menu Logic
bot.action('main_menu', (ctx) => {
    userSessions.delete(ctx.from.id);
    ctx.editMessageText('👋 Aura Digital Main Menu မှ ကြိုဆိုပါတယ်ဗျာ။',
        Markup.inlineKeyboard([
            [Markup.button.callback('🎮 Mobile Legends (MLBB)', 'cat_mlbb')],
            [Markup.button.callback('🔫 PUBG Mobile (UC)', 'cat_pubg')]
        ])
    );
});

bot.launch().then(() => console.log('Aura Digital Fully Customized Bot is Live & Secure 🚀'));