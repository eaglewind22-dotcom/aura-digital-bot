const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const http = require('http');

// ==========================================
// 1. ENVIRONMENT & CONFIGURATIONS
// ==========================================
const BOT_TOKEN = '8617573176:AAGIaiuKEeRD3Zki5Rx8nk3jtGRB49thUNQ';
const ADMIN_CHAT_ID = '7534742589'; // အစ်ကို့ရဲ့ Telegram ID
const CHANNEL_USERNAME = '@AuraDigitalPremium'; 
const MONGO_URI = 'mongodb+srv://eaglewind22_db:2232003wunna@cluster0.qqgs4ef.mongodb.net/aura_digital?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
    .then(() => console.log('🟢 MongoDB ချိတ်ဆက်ပြီးပါပြီ။'))
    .catch(err => console.error('🔴 MongoDB Error:', err));

const bot = new Telegraf(BOT_TOKEN);
bot.use(session()); // User တွေရဲ့ အဆင့်တွေကို မှတ်သားရန်

bot.catch((err, ctx) => {
    console.error(`🔴 Global Bot Error:`, err);
});

function isAdmin(ctx) {
    if (!ctx || !ctx.from) return false;
    return ctx.from.id.toString() === ADMIN_CHAT_ID.toString();
}

// ==========================================
// 2. DATABASE SCHEMAS
// ==========================================
const UserSchema = new mongoose.Schema({
    telegramId: String, username: String, name: String, points: { type: Number, default: 0 },
    lastCheckIn: Date, createdAt: { type: Date, default: Date.now }
});

const ShopSchema = new mongoose.Schema({
    shopOpen: { type: Boolean, default: true },
    prices: { type: Map, of: Number, default: { 'mlbb_wp': 6450, 'mlbb_tp': 34300, 'mlbb_86': 5650, 'mlbb_172': 10650 }}
});

const User = mongoose.model('User', UserSchema);
const Shop = mongoose.model('Shop', ShopSchema);

const ITEM_NAMES = { 'mlbb_wp': '🔥 Weekly Pass', 'mlbb_tp': '🤩 Twilight Pass', 'mlbb_86': '💎 Dia 86', 'mlbb_172': '💎 Dia 172' };

// ==========================================
// 3. KEYBOARDS & LAYOUTS (ပုံထဲကအတိုင်း အတိအကျ)
// ==========================================
const userMenu = Markup.keyboard([
    ['🎮 စိန်ဖြည့်ရန် (Top-Up Store)'],
    ['🎁 Daily Check-In', '💰 My Points & Coupons'],
    ['📜 ဝယ်ယူမှုမှတ်တမ်း', '💡 အသုံးပြုပုံလမ်းညွှန်'],
    ['📞 Contact Admin']
]).resize();

const adminMenu = Markup.keyboard([
    ['📊 Dashboard (စာရင်းချုပ်)', '🏪 ဆိုင် ဖွင့်/ပိတ် Panel'],
    ['💰 ဈေးနှုန်းများကြည့်ရန်', '📢 ကြော်ငြာစာ ပို့ရန်']
]).resize();

function getMainMenu(ctx) { return isAdmin(ctx) ? adminMenu : userMenu; }

// ==========================================
// 4. MIDDLEWARE (Channel Join စစ်ဆေးခြင်း)
// ==========================================
async function checkRequirements(ctx, next) {
    if (isAdmin(ctx)) return next();
    try {
        const uid = ctx.from.id;
        const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, uid);
        if (['left', 'kicked'].includes(member.status)) {
            return ctx.reply(`⚠️ Aura Digital ကို အသုံးပြုရန် Channel သို့ အရင် Join ပေးပါဗျာ။`,
                Markup.inlineKeyboard([[Markup.button.url('📢 Channel သို့ဝင်ရန်', `https://t.me/${CHANNEL_USERNAME.replace('@','')}`)]])
            );
        }
        let shop = await Shop.findOne();
        if (shop && !shop.shopOpen && ctx.message && ctx.message.text === '🎮 စိန်ဖြည့်ရန် (Top-Up Store)') {
            return ctx.reply('👋 မင်္ဂလာပါဗျာ။ လက်ရှိအချိန်တွင် Aura Digital ဆိုင်ခေတ္တ ပိတ်ထားပါသည်ဗျာ။');
        }
    } catch (e) { console.error('Channel Check Error:', e); }
    return next();
}

// ==========================================
// 5. USER & ADMIN CORE LOGIC (အဓိက လုပ်ဆောင်ချက်များ)
// ==========================================

// --- START COMMAND ---
bot.start(checkRequirements, async (ctx) => {
    ctx.session = null; // Session အဟောင်းရှိရင် ရှင်းမည်
    const uid = ctx.from.id.toString(); 
    let user = await User.findOne({ telegramId: uid });
    if (!user) {
        user = await User.create({ telegramId: uid, username: ctx.from.username, name: ctx.from.first_name });
    }
    const msg = isAdmin(ctx) ? '👑 Admin Panel မှ ကြိုဆိုပါတယ်။' : '✨ Aura Digital Premium Top-Up Bot မှ နွေးထွေးစွာ ကြိုဆိုပါတယ်ဗျာ။';
    ctx.reply(msg, getMainMenu(ctx));
});

// --- USER MENUS ---
bot.hears('🎮 စိန်ဖြည့်ရန် (Top-Up Store)', checkRequirements, async (ctx) => {
    let shop = await Shop.findOne() || await Shop.create({});
    const kb = Object.keys(ITEM_NAMES).map(k => [Markup.button.callback(`🔹 ${ITEM_NAMES[k]} - ${(shop.prices.get(k) || 0).toLocaleString()} Ks`, `buy_${k}`)]);
    ctx.reply('💎 ဝယ်ယူလိုသည့် အမျိုးအစားကို ရွေးချယ်ပါ -', Markup.inlineKeyboard(kb));
});

bot.hears('🎁 Daily Check-In', checkRequirements, async (ctx) => {
    const uid = ctx.from.id.toString();
    const user = await User.findOne({ telegramId: uid });
    const now = new Date();
    if (user.lastCheckIn && now.toDateString() === user.lastCheckIn.toDateString()) {
        return ctx.reply('⚠️ လူကြီးမင်း ယနေ့အတွက် Check-In ရယူပြီးပါပြီ။ မနက်ဖြန်မှ ထပ်မံရယူပေးပါ။');
    }
    await User.findOneAndUpdate({ telegramId: uid }, { $inc: { points: 20 }, $set: { lastCheckIn: now } });
    ctx.reply('🎉 နေ့စဉ် Check-In အောင်မြင်ပါသည်။ လက်ဆောင် +20 Points ရရှိပါပြီဗျာ。');
});

bot.hears('💡 အသုံးပြုပုံလမ်းညွှန်', (ctx) => {
    ctx.reply('📖 **အသုံးပြုပုံလမ်းညွှန်**\n၁။ "စိန်ဖြည့်ရန်" ကိုနှိပ်ပါ။\n၂။ မိမိလိုချင်သော ပက်ကေ့ချ်ကို ရွေးချယ်ပါ။\n၃။ Game ID (Zone ID) ရိုက်ထည့်ပါ။\n၄။ ငွေလွှဲပြေစာ ပို့ပေးပါ။');
});

bot.hears('📞 Contact Admin', (ctx) => {
    ctx.reply('💬 အခက်အခဲတစ်စုံတစ်ရာ ရှိပါက Admin @Wunna2232003 သို့ တိုက်ရိုက်ဆက်သွယ်နိုင်ပါသည်ဗျာ။');
});

// --- ORDER FLOW (အော်ဒါတင်သည့် အဆင့်များ) ---
bot.action(/buy_(.+)/, async (ctx) => {
    const itemKey = ctx.match[1];
    let shop = await Shop.findOne();
    const price = shop.prices.get(itemKey);
    
    ctx.session = { step: 'WAITING_GAME_ID', itemKey, price, itemName: ITEM_NAMES[itemKey] };
    ctx.editMessageText(`✅ သင်ရွေးချယ်ထားသည်မှာ: **${ITEM_NAMES[itemKey]}**\nကျသင့်ငွေ: **${price} Ks**\n\n👉 ကျေးဇူးပြု၍ လူကြီးမင်း၏ **Game ID (Zone ID)** ကို စာရိုက်၍ ပို့ပေးပါ။`);
});

bot.on('text', async (ctx, next) => {
    if (isAdmin(ctx) || !ctx.session) return next();
    
    if (ctx.session.step === 'WAITING_GAME_ID') {
        ctx.session.gameId = ctx.message.text;
        ctx.session.step = 'WAITING_RECEIPT';
        
        ctx.reply(`🎮 Game ID: ${ctx.session.gameId}\n\n💳 ကျေးဇူးပြု၍ အောက်ပါအကောင့်သို့ ${ctx.session.price} Ks လွှဲပေးပါ။\n- KPay: 09123456789 (Name)\n- Wave: 09123456789 (Name)\n\n📸 ငွေလွှဲပြီးပါက **Screenshot (ငွေလွှဲပြေစာ)** ကို ဤနေရာသို့ ပို့ပေးပါ။`);
    } else {
        return next();
    }
});

bot.on('photo', async (ctx) => {
    if (!ctx.session || ctx.session.step !== 'WAITING_RECEIPT') return;
    
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const orderDetails = `📦 အော်ဒါအသစ်ဝင်ပါသည်!\n\n👤 User: @${ctx.from.username || ctx.from.first_name}\n🎮 Item: ${ctx.session.itemName}\n🆔 Game ID: ${ctx.session.gameId}\n💰 Amount: ${ctx.session.price} Ks`;
    
    // Admin ဆီသို့ အော်ဒါပို့ခြင်း
    await bot.telegram.sendPhoto(ADMIN_CHAT_ID, photoId, {
        caption: orderDetails,
        reply_markup: {
            inline_keyboard: [
                [{ text: '✅ Approve', callback_data: `approve_${ctx.from.id}` }, { text: '❌ Reject', callback_data: `reject_${ctx.from.id}` }]
            ]
        }
    });
    
    ctx.session = null; // အော်ဒါတင်ပြီးရင် Session ဖျက်မည်
    ctx.reply('✅ လူကြီးမင်း၏ အော်ဒါတင်ခြင်း အောင်မြင်ပါသည်။ Admin မှ စစ်ဆေးပြီးပါက စိန်ဝင်လာပါမည်ဗျာ။', getMainMenu(ctx));
});

// --- ADMIN ACTIONS ---
bot.action(/approve_(.+)/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    const userId = ctx.match[1];
    await bot.telegram.sendMessage(userId, '🎉 လူကြီးမင်း၏ အော်ဒါ အောင်မြင်သွားပါပြီ။ စိန်ဝင်မဝင် စစ်ဆေးပေးပါဗျာ။');
    ctx.editMessageCaption(ctx.callbackQuery.message.caption + '\n\n✅ [APPROVED]');
});

bot.action(/reject_(.+)/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    const userId = ctx.match[1];
    await bot.telegram.sendMessage(userId, '❌ ငွေလွှဲပြေစာ မှားယွင်းနေသဖြင့် အော်ဒါ ပယ်ဖျက်လိုက်ပါသည်။ Admin သို့ ဆက်သွယ်ပါ။');
    ctx.editMessageCaption(ctx.callbackQuery.message.caption + '\n\n❌ [REJECTED]');
});

// ==========================================
// 6. ROCK-SOLID WEBHOOK INITIALIZATION
// ==========================================
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/bot${BOT_TOKEN}`;
const WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL}${WEBHOOK_PATH}`;

bot.telegram.setWebhook(WEBHOOK_URL)
    .then(() => console.log(`✅ Webhook ချိတ်ဆက်ပြီးပါပြီ။`))
    .catch(err => console.error('🔴 Webhook Error:', err));

const server = http.createServer((req, res) => {
    if (req.url === WEBHOOK_PATH && req.method === 'POST') {
        bot.webhookCallback(WEBHOOK_PATH)(req, res);
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bot is Running.');
    }
});

server.listen(PORT, () => {
    console.log(`🚀 Server is live on port ${PORT}`);
});
