const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const fs = require('fs');

// 🔐 Verified Core Setup
const BOT_TOKEN = '8953970980:AAG-8uV8P9ni_vlmXVGdTZfdVrSFHuosX3Y';
const ADMIN_CHAT_ID = '7534742589'; 
const CHANNEL_USERNAME = '@AuraDigitalPremium'; // Review များ Auto သွားမည့် Channel

const bot = new Telegraf(BOT_TOKEN);
const userSessions = new Map();

// 📂 Lightweight Persistent Database for Sales Bookkeeping
const DB_FILE = 'aura_sales_db.json';
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ total_orders: 0, total_revenue: 0, orders: [] }, null, 2));
}

function getSalesData() { return JSON.parse(fs.readFileSync(DB_FILE)); }
function saveSalesData(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

// 🛒 Strategy Pricing Matrix
const PRICES = {
    'mlbb_wp': { name: '🔥 Weekly Pass (Best Price)', price: 6450 },
    'mlbb_tp': { name: '🤩 Twilight Pass', price: 34300 },
    'mlbb_86': { name: '💎 Dia 86', price: 5650 },
    'mlbb_172': { name: '💎 Dia 172', price: 10650 },
    'mlbb_257': { name: '💎 Dia 257', price: 15500 },
    'mlbb_514': { name: '💎 Dia 514', price: 30500 },
    'mlbb_1049': { name: '💎 Dia 1049', price: 62500 }
};

// 🛡️ Anti-Spam Control
const rateLimit = new Map();
function isSpamming(userId) {
    const now = Date.now();
    if (rateLimit.has(userId) && (now - rateLimit.get(userId) < 1200)) return true;
    rateLimit.set(userId, now);
    return false;
}

// ---------------------- [ ၁။ USER INTERFACE INTERACTION ] ----------------------

bot.start((ctx) => {
    if (isSpamming(ctx.from.id)) return;
    userSessions.delete(ctx.from.id);
    
    ctx.replyWithMarkdownV2(
        `✨ *AURA DIGITAL \\- Top\\-Up Service* \n\n🤖 ပြိုင်ဘက်ထက် ဈေးနှုန်းသက်သာပြီး စိတ်ချရဆုံးစနစ်ဖြင့် လူကိုယ်တိုင် စိစစ်ဖြည့်သွင်းပေးနေပါတယ်ဗျာ။\n\n📌 *Official Channel:* [Aura Digital Channel](https://t\\.me/AuraDigitalPremium)`,
        Markup.inlineKeyboard([[Markup.button.callback('🎮 Mobile Legends (MLBB)', 'cat_mlbb')]])
    );
});

bot.action('cat_mlbb', (ctx) => {
    const keyboard = [];
    Object.keys(PRICES).forEach((key) => {
        const item = PRICES[key];
        keyboard.push([Markup.button.callback(`🔹 ${item.name} - ${item.price.toLocaleString()} Ks`, `buy_${key}`)]);
    });
    keyboard.push([Markup.button.callback('↩️ Back to Main', 'main_menu')]);
    ctx.editMessageText('💎 MLBB Diamonds & Pass စာရင်း -', Markup.inlineKeyboard(keyboard)).catch(() => {});
});

bot.action(/^buy_(.+)$/, (ctx) => {
    const key = ctx.match[1];
    const item = PRICES[key];
    if (!item) return ctx.reply('⚠️ ပစ္စည်းရှာမတွေ့ပါ။');

    userSessions.set(ctx.from.id, { item: item.name, price: item.price, step: 'AWAITING_ID' });

    ctx.deleteMessage().catch(() => {});
    ctx.replyWithMarkdownV2(
        `🎯 ရွေးချယ်ထားသောပစ္စည်း: *${item.name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}*\n💰 ကျသင့်ငွေ: *${item.price.toLocaleString()} Ks*\n\n` +
        `👉 ကျေးဇူးပြု၍ လူကြီးမင်း၏ *User ID နှင့် Zone ID* အား သေချာစွာ တွဲလျက် ရိုက်ထည့်ပေးပါဗျာ။\n\n` +
        `📝 *ပုံစံနမူနာ:* \`166049831 (2851)\``
    );
});

bot.on('text', async (ctx) => {
    if (isSpamming(ctx.from.id)) return;
    const session = userSessions.get(ctx.from.id);
    if (!session || session.step !== 'AWAITING_ID') return;

    const inputId = ctx.message.text.trim();
    if (!/^\d+\s*\(\d+\)$/.test(inputId) && !/^\d+\s+\d+$/.test(inputId)) {
        return ctx.reply('⚠️ ပုံစံမမှန်ကန်ပါ။ ကျေးဇူးပြု၍ နမူနာပြထားသည့်အတိုင်း User ID နှင့် Zone ID ကွင်းစကွင်းပိတ်ပါဝင်အောင် ရိုက်ထည့်ပေးပါရန်။ \n\n(ဥပမာ - 166049831 (2851))');
    }

    session.gameId = inputId;
    session.step = 'AWAITING_RECEIPT';
    userSessions.set(ctx.from.id, session);

    await ctx.replyWithMarkdownV2(
        `💵 *စုစုပေါင်းကျသင့်ငွေ:* ${session.price.toLocaleString()} Kyats\n\n` +
        `📌 *အောက်ပါအကောင့်များသို့သာ ငွေလွှဲပေးပါရန်:* \n` +
        `• 📱 *KPay:* \`09692272242\` \\(Daw Aye Aye Myint\\)\n` +
        `• 🌊 *WaveMoney:* \`09400266700\` \\(Wunna Myo Oo\\)\n\n` +
        `⚠️ *🛑 အရေးကြီးသတိပေးချက် 🛑* \n` +
        `ငွေလွှဲခရက်ဒစ် Note ထဲတွင် *""Di / Uc / Wp""* စသည့် စာသားများ *လုံးဝ \\(လုံးဝ\\) မရေးရပါ\\!* ရေးလာပါက အော်ဒါကို ပယ်ဖျက်ပါမည်။\n\n` +
        `လွှဲပြီးပါက *ငွေလွှဲပြေစာ Screenshot* ကို ဤ Chat ထဲသို့ ပို့ပေးပါဗျာ။`
    );
});

bot.on('photo', async (ctx) => {
    const session = userSessions.get(ctx.from.id);
    if (!session || session.step !== 'AWAITING_RECEIPT') return;

    const orderId = 'AD' + Math.floor(1000 + Math.random() * 9000);
    session.orderId = orderId;

    ctx.reply(`🎉 Aura Digital မှ လူကြီးမင်း၏ ငွေလွှဲပြေစာကို လက်ခံရရှိပါပြီ။ \nအော်ဒါနံပါတ်: #${orderId} \nလူကိုယ်တိုင် စိစစ်ပြီး မိနစ်ပိုင်းအတွင်း ဖြည့်သွင်းပေးပါမည်ဗျာ။`);

    const orderDetails = `🚨 *AURA DIGITAL - MLBB အော်ဒါအသစ်* 🚨\n\n` +
                         `🆔 Order ID: *#${orderId}*\n` +
                         `👤 ဝယ်ယူသူ: [${ctx.from.first_name || 'Customer'}](tg://user?id=${ctx.from.id})\n` +
                         `🎮 ပစ္စည်း: *${session.item}*\n` +
                         `🎯 MLBB ID: \`${session.gameId}\`\n` +
                         `💰 စစ်ဆေးရမည့်ငွေ: *${session.price.toLocaleString()} Ks*`;

    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

    try {
        await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, photoId, {
            caption: orderDetails,
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ Confirm Order (Done)', `confirm_${ctx.from.id}_${orderId}`)]
            ])
        });
    } catch (e) { console.error("Notification Error:", e); }

    userSessions.set(ctx.from.id, session); // Save for review phase
});

// ---------------------- [ ၂။ ADMIN OPERATIONS & AUTOMATION ] ----------------------

bot.action(/^confirm_(\d+)_(.+)$/, async (ctx) => {
    const userId = ctx.match[1];
    const orderId = ctx.match[2];
    const session = userSessions.get(parseInt(userId));

    if (!session || session.orderId !== orderId) {
        return ctx.answerCbQuery('⚠️ ဤအော်ဒါ session သက်တမ်းကုန်ဆုံးသွားပါပြီ သို့မဟုတ် ပြီးစီးသွားပါပြီ။', { show_alert: true });
    }

    // ၁။ Bookkeeping Database ထဲ စာရင်းအလိုအလျောက် သွင်းခြင်း
    const db = getSalesData();
    db.total_orders += 1;
    db.total_revenue += session.price;
    db.orders.push({ orderId: orderId, item: session.item, price: session.price, date: new Date().toLocaleDateString() });
    saveSalesData(db);

    // ၂။ Admin Chat အား Status ပြောင်းလဲခြင်း
    ctx.editMessageCaption(`✅ *အော်ဒါအောင်မြင်စွာ ဖြည့်သွင်းပြီးပါပြီ။* \n\n🆔 Order: #${orderId}\n🎮 Item: ${session.item}\n💰 Price: ${session.price.toLocaleString()} Ks`, { parse_mode: 'Markdown' }).catch(() => {});

    // ၃။ Customer ဆီသို့ စိတ်ပညာဆန်းသစ်သော Review တောင်းသည့်စနစ် ပို့ဆောင်ခြင်း
    try {
        await bot.telegram.sendMessage(userId, 
            `⚡ *Order Delivered\\!* \n\nလူကြီးမင်း၏ အော်ဒါနံပါတ် *#${orderId}* အား Aura Digital မှ ဂိမ်းထဲသို့ အောင်မြင်စွာ ဖြည့်သွင်းပေးပြီးပါပြီဗျာ။ \n\n🥰 ဝန်ဆောင်မှုကို သဘောကျနှစ်သက်တယ်ဆိုရင် အောက်ကခလုတ်လေးကိုနှိပ်ပြီး Review ပေးခဲ့ဖို့ မေတ္တာရပ်ခံပါတယ်ဗျာ။`,
            {
                parse_mode: 'MarkdownV2',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⭐️⭐️⭐️⭐️⭐️ အရမ်းမြန်ပြီး စိတ်ချရတယ်ဗျာ', `rev_5_${orderId}`)],
                    [Markup.button.callback('⭐️⭐️⭐️⭐️ အဆင်ပြေပါတယ်', `rev_4_${orderId}`)]
                ])
            }
        );
    } catch (e) { console.error("Notify User Success Error:", e); }

    ctx.answerCbQuery('✅ အော်ဒါပြီးစီးကြောင်း မှတ်တမ်းတင်ပြီးပါပြီ။');
});

// ---------------------- [ ၃။ AUTOMATIC REVIEW TO CHANNEL SYSTEM ] ----------------------

bot.action(/^rev_(\d+)_(.+)$/, async (ctx) => {
    const rating = ctx.match[1];
    const orderId = ctx.match[2];
    const stars = '⭐️'.repeat(parseInt(rating));

    ctx.editMessageText('❤️ အဖိုးတန် Review ပေးပေးတဲ့အတွက် ကျေးဇူးအထူးတင်ပါတယ်ဗျာ။ လူကြီးမင်းတို့ရဲ့ စိတ်ချမ်းသာမှုက Aura Digital ရဲ့ ဂုဏ်သိက္ခာပါပဲ။').catch(() => {});

    // Channel ထဲသို့ Review အလိုအလျောက် ပို့ဆောင်ပြီး ပုံရိပ်မြှင့်တင်ခြင်း
    const reviewPost = `✨ *CUSTOMER REVIEW | SUCCESSFUL ORDER* ✨\n\n` +
                       `📦 Order ID: \`#${orderId}\`\n` +
                       `💎 Status: *Successfully Transferred*\n` +
                       `ထင်မြင်ချက်: ${stars} *အရမ်းမြန်ပြီး စိတ်ချရတယ်ဗျာ* \n\n` +
                       `🤖 ၂၄ နာရီ ဝန်ဆောင်မှုရယူရန်: @Aura_Digital_Bot`;

    try {
        await bot.telegram.sendMessage(CHANNEL_USERNAME, reviewPost, { parse_mode: 'Markdown' });
    } catch (e) { console.error("Channel Broadcast Error:", e); }

    userSessions.delete(ctx.from.id);
});

// ---------------------- [ ၄။ ADMIN BOOKKEEPING DASHBOARD ] ----------------------

// Admin Chat ထဲတွင် /dashboard ဟု ရိုက်နှိပ်ပါက စာရင်းဇယားချုပ် ချက်ချင်းထွက်လာမည်
bot.command('dashboard', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;

    const db = getSalesData();
    const summary = `📊 *AURA DIGITAL - နေ့စဉ်စာရင်းဇယားအနှစ်ချုပ်* 📊\n\n` +
                    `📝 ယနေ့အထိ စုစုပေါင်းအော်ဒါ: *${db.total_orders} ခု*\n` +
                    `💰 စုစုပေါင်း ရောင်းရငွေ: *${db.total_revenue.toLocaleString()} Ks*\n\n` +
                    `📉 _မှတ်ချက်: ဤစာရင်းသည် ဆာဗာ Restart ကျသော်လည်း Local Database တွင် အမြဲလုံခြုံစွာ ရှိနေမည် ဖြစ်သည်။_`;

    ctx.replyWithMarkdown(summary, Markup.inlineKeyboard([
        [Markup.button.callback('🧹 စာရင်းဇယားအားလုံး ဖျက်ပစ်ရန် (Reset)', 'db_reset')]
    ]));
});

bot.action('db_reset', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    fs.writeFileSync(DB_FILE, JSON.stringify({ total_orders: 0, total_revenue: 0, orders: [] }, null, 2));
    ctx.editMessageText('🧹 Local Database အားလုံးကို ၀ စုစုပေါင်းအဖြစ် အောင်မြင်စွာ Reset လုပ်ပြီးပါပြီဗျာ။').catch(() => {});
});

// Back to Main Logic
bot.action('main_menu', (ctx) => {
    userSessions.delete(ctx.from.id);
    ctx.editMessageText('👋 Aura Digital Main Menu မှ ကြိုဆိုပါတယ်ဗျာ။',
        Markup.inlineKeyboard([[Markup.button.callback('🎮 Mobile Legends (MLBB)', 'cat_mlbb')]])
    ).catch(() => {});
});

// Web Server Port for Render
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Aura Digital Advanced System is Active!\n');
});
server.listen(PORT, () => { console.log(`Web server running on port ${PORT}`); });

bot.launch().then(() => console.log('Aura Digital Next-Gen Bot is Fully Live 🚀'));
