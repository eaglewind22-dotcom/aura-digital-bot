const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const fs = require('fs');

const BOT_TOKEN = '8953970980:AAG-8uV8P9ni_vlmXVGdTZfdVrSFHuosX3Y';
const ADMIN_CHAT_ID = '7534742589'; 
const CHANNEL_USERNAME = '@AuraDigitalPremium'; // သင့် Channel Username ကို ဖော်ပြပါ

const bot = new Telegraf(BOT_TOKEN);
const userSessions = new Map();

const DB_FILE = 'aura_sales_db.json';
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ total_orders: 0, total_revenue: 0, orders: [] }, null, 2));
}

function getSalesData() { return JSON.parse(fs.readFileSync(DB_FILE)); }
function saveSalesData(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

const PRICES = {
    'mlbb_wp': { name: '🔥 Weekly Pass (Best Price)', price: 6450 },
    'mlbb_tp': { name: '🤩 Twilight Pass', price: 34300 },
    'mlbb_86': { name: '💎 Dia 86', price: 5650 },
    'mlbb_172': { name: '💎 Dia 172', price: 10650 },
    'mlbb_257': { name: '💎 Dia 257', price: 15500 },
    'mlbb_514': { name: '💎 Dia 514', price: 30500 },
    'mlbb_1049': { name: '💎 Dia 1049', price: 62500 }
};

// 1. User Side - Start
bot.start((ctx) => {
    const uid = ctx.from.id.toString();
    userSessions.delete(uid);
    ctx.replyWithMarkdownV2(
        `✨ *AURA DIGITAL \\- Top\\-Up Service* \n\n🤖 စိတ်ချရဆုံးစနစ်ဖြင့် လူကိုယ်တိုင် စိစစ်ဖြည့်သွင်းပေးနေပါတယ်ဗျာ။\n\n📌 *Official Channel:* [Aura Digital Channel](https://t\\.me/AuraDigitalPremium)`,
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

    const uid = ctx.from.id.toString();
    userSessions.set(uid, { item: item.name, price: item.price, step: 'AWAITING_ID' });

    ctx.deleteMessage().catch(() => {});
    ctx.replyWithMarkdownV2(
        `🎯 ရွေးချယ်ထားသောပစ္စည်း: *${item.name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}*\n💰 ကျသင့်ငွေ: *${item.price.toLocaleString()} Ks*\n\n` +
        `👉 ကျေးဇူးပြု၍ လူကြီးမင်း၏ *User ID နှင့် Zone ID* အား သေချာစွာ တွဲလျက် ရိုက်ထည့်ပေးပါဗျာ။\n\n` +
        `📝 *ပုံစံနမူနာ:* \`166049831 (2851)\``
    );
});

bot.on('text', async (ctx) => {
    const uid = ctx.from.id.toString();
    const session = userSessions.get(uid);
    if (!session || session.step !== 'AWAITING_ID') return;

    const inputId = ctx.message.text.trim();
    if (!/^\d+\s*\(\d+\)$/.test(inputId) && !/^\d+\s+\d+$/.test(inputId)) {
        return ctx.reply('⚠️ ပုံစံမမှန်ကန်ပါ။ ဥပမာအတိုင်း ကွင်းစကွင်းပိတ်ပါဝင်အောင် ရိုက်ပေးပါရန်။ (ဥပမာ - 166049831 (2851))');
    }

    session.gameId = inputId;
    session.step = 'AWAITING_RECEIPT';
    userSessions.set(uid, session);

    await ctx.replyWithMarkdownV2(
        `💵 *စုစုပေါင်းကျသင့်ငွေ:* ${session.price.toLocaleString()} Kyats\n\n` +
        `📌 *အောက်ပါအကောင့်များသို့ ငွေလွှဲပေးပါရန်:* \n` +
        `• 📱 *KPay:* \`09692272242\`\n` +
        `• 🌊 *WaveMoney:* \`09400266700\`\n\n` +
        `လွှဲပြီးပါက *ငွေလွှဲပြေစာ Screenshot* ကို ပို့ပေးပါဗျာ။`
    );
});

bot.on('photo', async (ctx) => {
    const uid = ctx.from.id.toString();
    const session = userSessions.get(uid);
    if (!session || session.step !== 'AWAITING_RECEIPT') return;

    const orderId = 'AD' + Math.floor(1000 + Math.random() * 9000);
    session.orderId = orderId;
    userSessions.set(uid, session);

    ctx.reply(`🎉 ပြေစာလက်ခံရရှိပါပြီ။ အော်ဒါနံပါတ်: #${orderId} ကို မကြာမီ ဖြည့်သွင်းပေးပါမည်ဗျာ။`);

    const orderDetails = `🚨 *AURA DIGITAL - အော်ဒါအသစ်* 🚨\n\n` +
                         `🆔 Order ID: *#${orderId}*\n` +
                         `👤 ဝယ်ယူသူ: [${ctx.from.first_name || 'Customer'}](tg://user?id=${uid})\n` +
                         `🎮 ပစ္စည်း: *${session.item}*\n` +
                         `🎯 MLBB ID: \`${session.gameId}\`\n` +
                         `💰 ငွေပမာဏ: *${session.price.toLocaleString()} Ks*`;

    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

    try {
        await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, photoId, {
            caption: orderDetails,
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('✅ Confirm (Done)', `confirm_${uid}_${orderId}`),
                    Markup.button.callback('❌ Cancel', `cancel_${uid}_${orderId}`)
                ]
            ])
        });
    } catch (e) { console.error(e); }
});

// 2. Admin Actions (Fixed String Match Bug)
bot.action(/^confirm_(\d+)_(.+)$/, async (ctx) => {
    const uid = ctx.match[1];
    const orderId = ctx.match[2];
    const session = userSessions.get(uid); // Fixed: String ID direct lookup

    if (!session || session.orderId !== orderId) {
        return ctx.answerCbQuery('⚠️ ဤအော်ဒါသည် သက်တမ်းကုန်ဆုံးသွားပါပြီ။', { show_alert: true });
    }

    // စာရင်းသွင်းခြင်း
    const db = getSalesData();
    db.total_orders += 1;
    db.total_revenue += session.price;
    db.orders.push({ orderId, item: session.item, price: session.price, date: new Date().toLocaleDateString() });
    saveSalesData(db);

    ctx.editMessageCaption(`✅ *အော်ဒါအောင်မြင်စွာ ဖြည့်သွင်းပြီးပါပြီ။* \n\n🆔 Order: #${orderId}\n🎮 Item: ${session.item}`, { parse_mode: 'Markdown' }).catch(() => {});

    // User ဆီ စာပို့ခြင်း
    try {
        await bot.telegram.sendMessage(uid, 
            `⚡ *Order Delivered!* \n\nလူကြီးမင်း၏ အော်ဒါနံပါတ် *#${orderId}* အား အောင်မြင်စွာ ဖြည့်သွင်းပေးပြီးပါပြီဗျာ။\n\nဝန်ဆောင်မှုကို သဘောကျရင် Review လေး ပေးခဲ့ပါဦးဗျာ။`,
            Markup.inlineKeyboard([[Markup.button.callback('⭐️⭐️⭐️⭐️⭐️ အရမ်းမြန်လို့ သဘောကျတယ်', `rev_5_${orderId}_${uid}`)]])
        );
    } catch (e) { console.error(e); }

    ctx.answerCbQuery('✅ Done!');
});

bot.action(/^cancel_(\d+)_(.+)$/, async (ctx) => {
    const uid = ctx.match[1];
    const orderId = ctx.match[2];

    ctx.editMessageCaption(`❌ *ဤအော်ဒါကို ပယ်ဖျက်လိုက်ပါပြီ။* \n🆔 Order: #${orderId}`, { parse_mode: 'Markdown' }).catch(() => {});

    try {
        await bot.telegram.sendMessage(uid, `❌ လူကြီးမင်း၏ အော်ဒါနံပါတ် *#${orderId}* သည် ငွေလွှဲပြေစာ မမှန်ကန်ခြင်း (သို့မဟုတ်) အချက်အလက်မှားယွင်းခြင်းကြောင့် ပယ်ဖျက်ခြင်း ခံရပါသည်ဗျာ။`);
    } catch (e) { console.error(e); }

    userSessions.delete(uid);
    ctx.answerCbQuery('❌ Cancelled');
});

// 3. Review to Channel
bot.action(/^rev_5_(.+)_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const uid = ctx.match[2];

    ctx.editMessageText('❤️ Review ပေးပေးတဲ့အတွက် ကျေးဇူးအထူးတင်ပါတယ်ဗျာ။').catch(() => {});

    const reviewPost = `✨ *CUSTOMER REVIEW | SUCCESSFUL ORDER* ✨\n\n📦 Order ID: \`#${orderId}\`\n💎 Status: *Successfully Transferred*\nထင်မြင်ချက်: ⭐️⭐️⭐️⭐️⭐️ *အရမ်းမြန်ပြီး စိတ်ချရတယ်ဗျာ*\n\n🤖 ဝန်ဆောင်မှုရယူရန်: @Aura_Digital_Bot`;

    try {
        await bot.telegram.sendMessage(CHANNEL_USERNAME, reviewPost, { parse_mode: 'Markdown' });
    } catch (e) { console.error(e); }

    userSessions.delete(uid);
});

// 4. Admin Dashboard
bot.command('dashboard', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    const db = getSalesData();
    ctx.replyWithMarkdown(`📊 *AURA DIGITAL - စာရင်းဇယားချုပ်* 📊\n\n📝 စုစုပေါင်းအော်ဒါ: *${db.total_orders} ခု*\n💰 စုစုပေါင်း ရောင်းရငွေ: *${db.total_revenue.toLocaleString()} Ks*`);
});

bot.action('main_menu', (ctx) => {
    const uid = ctx.from.id.toString();
    userSessions.delete(uid);
    ctx.editMessageText('👋 Aura Digital Main Menu မှ ကြိုဆိုပါတယ်ဗျာ။',
        Markup.inlineKeyboard([[Markup.button.callback('🎮 Mobile Legends (MLBB)', 'cat_mlbb')]])
    ).catch(() => {});
});

const server = http.createServer((req, res) => { res.writeHead(200); res.end('Running'); });
server.listen(process.env.PORT || 3000, () => { bot.launch(); });
