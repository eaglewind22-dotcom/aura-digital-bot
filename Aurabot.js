const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const fs = require('fs');

// ==========================================
// CONFIGURATIONS (ပြင်ဆင်ရန် အချက်အလက်များ)
// ==========================================
const BOT_TOKEN = '8953970980:AAG-8uV8P9ni_vlmXVGdTZfdVrSFHuosX3Y';
const ADMIN_CHAT_ID = '7534742589'; 
const ADMIN_USERNAME = '@Wunna2232003';
const CHANNEL_USERNAME = '@AuraDigitalPremium'; // @ တပ်ပေးရပါမည်

const bot = new Telegraf(BOT_TOKEN);
const userSessions = new Map();

// DB Files Setup (Data မပျောက်ပျက်စေရန် File ဖြင့် သိမ်းဆည်းခြင်း)
const DB_FILE = 'aura_sales_db.json';
const USER_DB_FILE = 'aura_users_db.json';

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ total_orders: 0, total_revenue: 0, orders: [], shop_open: true }, null, 2));
}
if (!fs.existsSync(USER_DB_FILE)) {
    fs.writeFileSync(USER_DB_FILE, JSON.stringify({}, null, 2));
}

// Helper Functions
function getSalesData() { return JSON.parse(fs.readFileSync(DB_FILE)); }
function saveSalesData(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
function getUserDB() { return JSON.parse(fs.readFileSync(USER_DB_FILE)); }
function saveUserDB(data) { fs.writeFileSync(USER_DB_FILE, JSON.stringify(data, null, 2)); }

// MLBB Item Prices
const PRICES = {
    'mlbb_wp': { name: '🔥 Weekly Pass (Best Price)', price: 6450 },
    'mlbb_tp': { name: '🤩 Twilight Pass', price: 34300 },
    'mlbb_86': { name: '💎 Dia 86', price: 5650 },
    'mlbb_172': { name: '💎 Dia 172', price: 10650 },
    'mlbb_257': { name: '💎 Dia 257', price: 15500 },
    'mlbb_514': { name: '💎 Dia 514', price: 30500 },
    'mlbb_1049': { name: '💎 Dia 1049', price: 62500 }
};

// ==========================================
// MIDDLEWARE: FORCE JOIN & SHOP STATUS CHECK
// ==========================================
async function checkMiddleware(ctx, next) {
    const uid = ctx.from ? ctx.from.id.toString() : null;
    if (!uid) return;

    // Admin ဆိုလျှင် Check ချက်ချင်းကျော်မည်
    if (uid === ADMIN_CHAT_ID) return next();

    const db = getSalesData();
    // ၁။ ဆိုင်ပိတ်/ဖွင့် စစ်ဆေးခြင်း
    if (!db.shop_open) {
        return ctx.reply('👋 မင်္ဂလာပါဗျာ။ လက်ရှိအချိန်တွင် Aura Digital ဆိုင်ခေတ္တ ပိတ်ထားပါသဖြင့် အော်ဒါတင်၍ ရဦးမည်မဟုတ်ပါဗျာ။ ဆိုင်ပြန်ဖွင့်ချိန်တွင် Channel မှတစ်ဆင့် အကြောင်းကြားပေးပါမည်။');
    }

    // ၂။ Force Join စစ်ဆေးခြင်း
    try {
        const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
        if (member.status === 'left' || member.status === 'kicked') {
            return ctx.reply(
                `📢 Aura Digital Bot ကို အသုံးပြုရန်အတွက် ကျွန်ုပ်တို့၏ Official Channel ကို အရင် Join ပေးရပါမယ်ဗျာ။`,
                Markup.inlineKeyboard([
                    [Markup.button.url('📢 Join Channel', `https://t.me/${CHANNEL_USERNAME.replace('@', '')}`)],
                    [Markup.button.callback('🔄 Joined (စစ်ဆေးမည်)', 'check_join')]
                ])
            );
        }
    } catch (error) {
        console.error('Force Join Error:', error);
        // တကယ်လို့ Channel Link မှားနေရင် Bot အလုပ်မလုပ်တော့မှာ စိုးလို့ Next ပေးထားမည်
    }
    return next();
}

// ==========================================
// MAIN REPLIES KEYBOARDS (အောက်ခြေ Buttons)
// ==========================================
const userMainMenu = Markup.keyboard([
    ['🎮 စိန်ဖြည့်ရန် (Top-Up Store)'],
    ['📞 Contact Admin (အကူအညီရယူရန်)']
]).resize();

const adminMainMenu = Markup.keyboard([
    ['🎮 စိန်ဖြည့်ရန် (Top-Up Store)'],
    ['📊 Dashboard (စာရင်းချုပ်)', '🏪 ဆိုင် ဖွင့်/ပိတ် Panel']
]).resize();

function getMainMenu(uid) {
    return uid === ADMIN_CHAT_ID ? adminMainMenu : userMainMenu;
}

// ==========================================
// BOT ACTIONS & COMMANDS
// ==========================================
bot.start(checkMiddleware, (ctx) => {
    const uid = ctx.from.id.toString();
    userSessions.delete(uid);
    ctx.reply(`✨ Aura Digital Top-Up Service မှ ကြိုဆိုပါတယ်ဗျာ။\n\nအောက်ပါ Menu ခလုတ်များကို နှိပ်၍ ဝန်ဆောင်မှု ရယူနိုင်ပါပြီ။`, getMainMenu(uid));
});

bot.action('check_join', checkMiddleware, (ctx) => {
    ctx.deleteMessage().catch(() => {});
    ctx.reply('🎉 Channel Join ပြီးမြောက်မှု အောင်မြင်ပါသည်။ အောက်ပါ Menu ကို သုံးနိုင်ပါပြီ။', getMainMenu(ctx.from.id.toString()));
});

// Text Buttons Handling
bot.hears('🎮 စိန်ဖြည့်ရန် (Top-Up Store)', checkMiddleware, (ctx) => {
    const keyboard = [];
    Object.keys(PRICES).forEach((key) => {
        const item = PRICES[key];
        keyboard.push([Markup.button.callback(`🔹 ${item.name} - ${item.price.toLocaleString()} Ks`, `buy_${key}`)]);
    });
    ctx.reply('💎 MLBB Diamonds & Pass စာရင်း -', Markup.inlineKeyboard(keyboard));
});

bot.hears('📞 Contact Admin (အကူအညီရယူရန်)', (ctx) => {
    ctx.reply(`📞 လူကြီးမင်း၏ အော်ဒါနှင့်ပတ်သက်၍ အဆင်မပြေမှုတစ်စုံတစ်ရာ ရှိပါက Aura Digital တာဝန်ခံ Admin ဆီသို့ တိုက်ရိုက်ဆက်သွယ် မေးမြန်းနိုင်ပါသည်ဗျာ။\n\n👨‍💻 Admin Account: ${ADMIN_USERNAME}`);
});

// Item Selection
bot.action(/^buy_(.+)$/, checkMiddleware, (ctx) => {
    const key = ctx.match[1];
    const item = PRICES[key];
    if (!item) return ctx.reply('⚠️ ပစ္စည်းရှာမတွေ့ပါ။');

    const uid = ctx.from.id.toString();
    userSessions.set(uid, { item: item.name, price: item.price });

    const userDB = getUserDB();
    // အကယ်၍ User ID ရှိပြီးသား ဖြစ်ပါက (Profile Saver System)
    if (userDB[uid]) {
        const savedId = userDB[uid];
        ctx.editMessageText(`🎯 ရွေးချယ်မှု: ${item.name}\n💰 ကျသင့်ငွေ: ${item.price.toLocaleString()} Ks\n\n💡 လူကြီးမင်း ယခင်ဖြည့်ခဲ့ဖူးသော ID ဟောင်း ဖြင့်ပဲ ပြန်လည်ဖြည့်သွင်းမလားဗျာ?`, Markup.inlineKeyboard([
            [Markup.button.callback(`🆔 ID ဟောင်းသုံးမည်: ${savedId}`, `use_saved_id`)],
            [Markup.button.callback('🎁 အခြားသူအား Gift ပေးမည် (ID အသစ်ရိုက်မည်)', 'use_new_id')]
        ])).catch(() => {});
    } else {
        // အကယ်၍ User အသစ်ဖြစ်ပါက ID တောင်းမည်
        askForGameId(ctx);
    }
});

function askForGameId(ctx) {
    const uid = ctx.from.id.toString();
    const session = userSessions.get(uid);
    session.step = 'AWAITING_ID';
    userSessions.set(uid, session);

    ctx.deleteMessage().catch(() => {});
    ctx.reply(`📝 ကျေးဇူးပြု၍ လူကြီးမင်း၏ MLBB User ID နှင့် Zone ID အား သေချာစွာ တွဲလျက် ရိုက်ထည့်ပေးပါဗျာ။\n\n📌 ဥပမာပုံစံ - 166049831(2851)`);
}

bot.action('use_new_id', checkMiddleware, (ctx) => { askForGameId(ctx); });

bot.action('use_saved_id', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString();
    const session = userSessions.get(uid);
    const userDB = getUserDB();
    
    session.gameId = userDB[uid];
    session.step = 'AWAITING_RECEIPT';
    userSessions.set(uid, session);

    ctx.deleteMessage().catch(() => {});
    await sendPaymentDetails(ctx, session);
});

// ID Validation & Text Input Handling
bot.on('text', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString();
    const session = userSessions.get(uid);
    if (!session || session.step !== 'AWAITING_ID') return;

    const inputId = ctx.message.text.trim();
    
    // MLBB ID Validation Strict Regex (User ID 8-10 လုံး ၊ Zone ID 4-5 လုံး)
    const idRegex = /^\d{8,10}\s*\(\d{4,5}\)$|^\d{8,10}\s+\d{4,5}$/;
    
    if (!idRegex.test(inputId)) {
        return ctx.reply('⚠️ ID ပုံစံမမှန်ကန်ပါ။ User ID (၈ လုံးမှ ၁၀ လုံး) နှင့် Zone ID (၄ လုံးမှ ၅ လုံး) ကို ကွင်းစကွင်းပိတ်ဖြင့် သေချာစွာ ပြန်လည်ရိုက်ထည့်ပေးပါဗျာ။\n\nဥပမာ - 166049831 (2851)');
    }

    session.gameId = inputId;
    session.step = 'AWAITING_RECEIPT';
    userSessions.set(uid, session);

    // Profile Database တွင် ID အား အမြဲသိမ်းဆည်းမည်
    const userDB = getUserDB();
    userDB[uid] = inputId;
    saveUserDB(userDB);

    await sendPaymentDetails(ctx, session);
});

async function sendPaymentDetails(ctx, session) {
    await ctx.reply(`💵 စုစုပေါင်းကျသင့်ငွေ: ${session.price.toLocaleString()} Kyats\n\n` +
        `📌 အောက်ပါအကောင့်များသို့ ငွေလွှဲပေးပါရန်: \n` +
        `• 📱 KPay: 09692272242\n` +
        `• 🌊 WaveMoney: 09400266700\n\n` +
        `လွှဲပြီးပါက ငွေလွှဲပြေစာ Screenshot (ဓာတ်ပုံ) ကို တိုက်ရိုက် ပို့ပေးပါဗျာ။`
    );
}

// Receipt Image Processing
bot.on('photo', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString();
    const session = userSessions.get(uid);
    if (!session || session.step !== 'AWAITING_RECEIPT') return;

    const orderId = 'AD' + Math.floor(1000 + Math.random() * 9000);
    session.orderId = orderId;
    userSessions.set(uid, session);

    ctx.reply(`🎉 ပြေစာလက်ခံရရှိပါပြီ။ အော်ဒါနံပါတ်: #${orderId} ကို မကြာမီ Admin ဘက်မှ စိစစ်ပြီး ဖြည့်သွင်းပေးပါမည်ဗျာ။`);

    const orderDetails = `🚨 *AURA DIGITAL - အော်ဒါအသစ်* 🚨\n\n` +
                         `🆔 Order ID: *#${orderId}*\n` +
                         `👤 ဝယ်ယူသူ: [${ctx.from.first_name || 'Customer'}](tg://user?id=${uid})\n` +
                         `🎮 ပစ္စည်း: *${session.item}*\n` +
                         `🎯 MLBB ID: \`${session.gameId}\`\n` +
                         `💰 ငွေပမာဏ: *${session.price.toLocaleString()} Ks*`;

    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

    try {
        // Admin Chat သို့ Confirm/Cancel Button ဖြင့် ပို့ခြင်း
        await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, photoId, {
            caption: orderDetails,
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('✅ Confirm (Done)', `admin_confirm_${uid}_${orderId}`),
                    Markup.button.callback('❌ Cancel', `admin_cancel_${uid}_${orderId}`)
                ]
            ])
        });
    } catch (e) { console.error('Admin Photo Send Error:', e); }
});

// ==========================================
// ADMIN EXCLUSIVE CONTROL ACTIONS
// ==========================================
bot.action(/^admin_confirm_(\d+)_(.+)$/, async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return ctx.answerCbQuery('⚠️ No Permission');
    
    const uid = ctx.match[1];
    const orderId = ctx.match[2];
    const session = userSessions.get(uid);

    if (!session || session.orderId !== orderId) {
        return ctx.answerCbQuery('⚠️ ဤအော်ဒါသည် System Cache တွင် သက်တမ်းကုန်သွားပါပြီ။', { show_alert: true });
    }

    // စာရင်းရေးသွင်းခြင်း
    const db = getSalesData();
    db.total_orders += 1;
    db.total_revenue += session.price;
    db.orders.push({ orderId, item: session.item, price: session.price, date: new Date().toLocaleDateString() });
    saveSalesData(db);

    ctx.editMessageCaption(`✅ *အော်ဒါအောင်မြင်စွာ ဖြည့်သွင်းပြီးပါပြီ။* \n\n🆔 Order: #${orderId}\n🎮 Item: ${session.item}`, { parse_mode: 'Markdown' }).catch(() => {});

    // User ထံ အော်ဒါအောင်မြင်ကြောင်း စာပို့ခြင်း + Review တောင်းခြင်း
    try {
        await bot.telegram.sendMessage(uid, 
            `⚡ *Order Delivered!* \n\nလူကြီးမင်း၏ အော်ဒါနံပါတ် *#${orderId}* အား အောင်မြင်စွာ ဖြည့်သွင်းပေးပြီးပါပြီဗျာ။\n\nဝန်ဆောင်မှုကို သဘောကျရင် Review လေး ပေးခဲ့ပါဦးဗျာ။`,
            Markup.inlineKeyboard([[Markup.button.callback('⭐️⭐️⭐️⭐️⭐️ အရမ်းမြန်လို့ သဘောကျတယ်', `rev_5_${orderId}_${uid}`)]])
        );
    } catch (e) { console.error(e); }

    ctx.answerCbQuery('✅ Confirmed!');
});

bot.action(/^admin_cancel_(\d+)_(.+)$/, async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return ctx.answerCbQuery('⚠️ No Permission');

    const uid = ctx.match[1];
    const orderId = ctx.match[2];

    ctx.editMessageCaption(`❌ *ဤအော်ဒါကို ပယ်ဖျက်လိုက်ပါပြီ။* \n🆔 Order: #${orderId}`, { parse_mode: 'Markdown' }).catch(() => {});

    try {
        await bot.telegram.sendMessage(uid, `❌ လူကြီးမင်း၏ အော်ဒါနံပါတ် *#${orderId}* သည် ငွေလွှဲပြေစာ မမှန်ကန်ခြင်း (သို့မဟုတ်) အချက်အလက်မှားယွင်းခြင်းကြောင့် ပယ်ဖျက်ခြင်း ခံရပါသည်ဗျာ။`);
    } catch (e) { console.error(e); }

    userSessions.delete(uid);
    ctx.answerCbQuery('❌ Cancelled');
});

// Review Process (Channel သို့ အလိုအလျောက် ပို့ပေးခြင်း)
bot.action(/^rev_5_(.+)_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const uid = ctx.match[2];

    ctx.editMessageText('❤️ Review ပေးပေးတဲ့အတွက် ကျေးဇူးအထူးတင်ပါတယ်ဗျာ။').catch(() => {});

    const reviewPost = `✨ *CUSTOMER REVIEW | SUCCESSFUL ORDER* ✨\n\n📦 Order ID: \`#${orderId}\`\n💎 Status: *Successfully Transferred*\nထင်မြင်ချက်: ⭐️⭐️⭐️⭐️⭐️ *အရမ်းမြန်ပြီး စိတ်ချရတယ်ဗျာ*\n\n🤖 ဝန်ဆောင်မှုရယူရန်: @${ctx.botInfo.username}`;

    try {
        await bot.telegram.sendMessage(CHANNEL_USERNAME, reviewPost, { parse_mode: 'Markdown' });
    } catch (e) { console.error('Channel Review Send Error (Bot Admin ဖြစ်ပါသလား စစ်ပါ):', e); }

    userSessions.delete(uid);
});

// Admin Panel Commands via Hears Buttons
bot.hears('📊 Dashboard (စာရင်းချုပ်)', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    const db = getSalesData();
    ctx.replyWithMarkdown(`📊 *AURA DIGITAL - စာရင်းဇယားချုပ်* 📊\n\n📝 စုစုပေါင်းအော်ဒါ: *${db.total_orders} ခု*\n💰 စုစုပေါင်း ရောင်းရငွေ: *${db.total_revenue.toLocaleString()} Ks*`);
});

bot.hears('🏪 ဆိုင် ဖွင့်/ပိတ် Panel', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    const db = getSalesData();
    const status = db.shop_open ? '🟢 ဆိုင်ဖွင့်ထားသည်' : '🔴 ဆိုင်ပိတ်ထားသည်';
    
    ctx.reply(`🏪 Aura Digital ဆိုင် ဖွင့်/ပိတ် ထိန်းချုပ်ခန်း\n\nလက်ရှိအခြေအနေ: ${status}`, Markup.inlineKeyboard([
        [Markup.button.callback('🟢 ဆိုင်ဖွင့်မည်', 'shop_open'), Markup.button.callback('🔴 ဆိုင်ပိတ်မည်', 'shop_close')]
    ]));
});

bot.action('shop_open', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    const db = getSalesData();
    db.shop_open = true;
    saveSalesData(db);
    ctx.editMessageText('🏪 ဆိုင်အခြေအနေအား [ 🟢 ဖွင့်လှစ်သည် ] သို့ ပြောင်းလဲလိုက်ပါပြီ။').catch(() => {});
});

bot.action('shop_close', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    const db = getSalesData();
    db.shop_open = false;
    saveSalesData(db);
    ctx.editMessageText('🏪 ဆိုင်အခြေအနေအား [ 🔴 ပိတ်သိမ်းသည် ] သို့ ပြောင်းလဲလိုက်ပါပြီ။').catch(() => {});
});

// Web Server for Render Hosting
const server = http.createServer((req, res) => { res.writeHead(200); res.end('Aura Digital Bot is Running Perfectly.'); });
server.listen(process.env.PORT || 3000, () => { 
    bot.launch().then(() => {
        console.log('Aura Digital Ultimate Bot Launched Successfully!');
    });
});
