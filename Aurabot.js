const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const http = require('http');

// ==========================================
// 1. CONFIGURATIONS & DB CONNECTION
// ==========================================
const BOT_TOKEN = '8953970980:AAG-8uV8P9ni_vlmXVGdTZfdVrSFHuosX3Y';
const ADMIN_CHAT_ID = '7534742589'; 
const ADMIN_USERNAME = '@Wunna2232003';
const CHANNEL_USERNAME = '@AuraDigitalPremium';

const MONGO_URI = 'mongodb+srv://eaglewind22_db:2232003wunna@cluster0.qqgs4ef.mongodb.net/aura_digital?retryWrites=true&w=majority&appName=Cluster0';

const KPAY_QR_FILE_ID = 'AgACAgUAAxkBAAPFakA6PlHwqkOWeaqurTgoBIpMAdEAAkMRaxvFEgFWSpVMAsTjLFkBAAMCAAN5AAM8BA'; 

mongoose.connect(MONGO_URI)
    .then(() => console.log('🟢 MongoDB Connected!'))
    .catch(err => console.error('🔴 MongoDB Error:', err));

const bot = new Telegraf(BOT_TOKEN);
const userSessions = new Map();
let adminBroadcastState = {}; 
let adminActionState = {}; 

// Admin ဟုတ်မဟုတ် တိတိကျကျ စစ်ဆေးပေးမည့် Engine
function isAdmin(ctx) {
    const uid = ctx.from ? ctx.from.id.toString() : null;
    if (uid === ADMIN_CHAT_ID) return true;
    if (ctx.message && ctx.message.sender_chat && ctx.message.sender_chat.id.toString() === ADMIN_CHAT_ID) return true;
    if (ctx.callbackQuery && ctx.callbackQuery.message && ctx.callbackQuery.message.chat.id.toString() === ADMIN_CHAT_ID) return true;
    return false;
}

// ==========================================
// 2. DATABASE SCHEMAS
// ==========================================
const UserSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: String,
    name: String,
    savedGameId: { type: String, default: null },
    points: { type: Number, default: 0 },
    couponsCount: { type: Number, default: 0 }, 
    referredBy: { type: String, default: null },
    hasPurchased: { type: Boolean, default: false },
    totalSpent: { type: Number, default: 0 }, 
    lastCheckIn: { type: Date, default: null } 
});

const OrderSchema = new mongoose.Schema({
    orderId: String,
    telegramId: String,
    itemName: String,
    itemKey: String,
    gameId: String,
    price: Number,
    cost: { type: Number, default: 0 }, 
    status: { type: String, default: 'Pending' }, 
    createdAt: { type: Date, default: Date.now }
});

const ShopSchema = new mongoose.Schema({
    shopOpen: { type: Boolean, default: true },
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 }, 
    prices: { type: Map, of: Number, default: {
        'mlbb_wp': 6450, 'mlbb_tp': 34300, 'mlbb_86': 5650, 'mlbb_172': 10650
    }},
    costs: { type: Map, of: Number, default: { 
        'mlbb_wp': 5500, 'mlbb_tp': 30000, 'mlbb_86': 4800, 'mlbb_172': 9000
    }},
    promo: {
        code: { type: String, default: null },
        poolPoints: { type: Number, default: 0 },
        expiry: { type: Date, default: null },
        claimedUsers: { type: [String], default: [] } 
    }
});

const User = mongoose.model('User', UserSchema);
const Order = mongoose.model('Order', OrderSchema);
const Shop = mongoose.model('Shop', ShopSchema);

async function initShop() {
    if (await Shop.countDocuments() === 0) { await Shop.create({}); }
}
initShop();

const ITEM_NAMES = {
    'mlbb_wp': '🔥 Weekly Pass', 'mlbb_tp': '🤩 Twilight Pass', 'mlbb_86': '💎 Dia 86', 'mlbb_172': '💎 Dia 172'
};

// ==========================================
// 3. KEYBOARDS & MIDDLEWARES
// ==========================================
const userMainMenu = Markup.keyboard([
    ['🎮 စိန်ဖြည့်ရန် (Top-Up Store)'],
    ['🎁 Daily Check-In', '💰 My Points & Coupons'],
    ['📜 ဝယ်ယူမှုမှတ်တမ်း', '💡 အသုံးပြုပုံလမ်းညွှန်'],
    ['📞 Contact Admin']
]).resize();

const adminMainMenu = Markup.keyboard([
    ['📊 Dashboard (စာရင်းချုပ်)', '🏪 ဆိုင် ဖွင့်/ပိတ် Panel'],
    ['🔧 ဈေးနှုန်း/ရင်းဈေး ပြင်ရန်', '👤 User Point ပြင်ရန်'],
    ['🎟️ Promo Code အသစ်ထုတ်ရန်', '📢 ကြော်ငြာစာ ပို့ရန်']
]).resize();

function getMainMenu(ctx) { return isAdmin(ctx) ? adminMainMenu : userMainMenu; }

async function checkMiddleware(ctx, next) {
    if (isAdmin(ctx)) return next(); 

    const uid = ctx.from ? ctx.from.id.toString() : null;
    if (!uid) return;

    const shop = await Shop.findOne();
    if (shop && !shop.shopOpen) return ctx.reply('👋 မင်္ဂလာပါဗျာ။ လက်ရှိအချိန်တွင် Aura Digital ဆိုင်ခေတ္တ ပိတ်ထားပါသဖြင့် အော်ဒါတင်၍ ရဦးမည်မဟုတ်ပါဗျာ။');

    try {
        const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
        if (['left', 'kicked'].includes(member.status)) {
            return ctx.reply(`📢 Aura Digital Bot ကို အသုံးပြုရန်အတွက် ကျွန်ုပ်တို့၏ Official Channel ကို အရင် Join ပေးရပါမယ်ဗျာ။`,
                Markup.inlineKeyboard([
                    [Markup.button.url('📢 Join Channel', `https://t.me/${CHANNEL_USERNAME.replace('@', '')}`)],
                    [Markup.button.callback('🔄 Joined (စစ်ဆေးမည်)', 'check_join')]
                ])
            );
        }
    } catch (e) { console.error(e); }
    return next();
}

// ==========================================
// 4. USER FUNCTIONS
// ==========================================
bot.start(async (ctx) => {
    const uid = ctx.from.id.toString(); userSessions.delete(uid);
    let user = await User.findOne({ telegramId: uid });
    if (!user) {
        let rId = (ctx.startPayload && ctx.startPayload.startsWith('ref_')) ? ctx.startPayload.replace('ref_', '') : null;
        if (rId === uid) rId = null;
        user = await User.create({ telegramId: uid, username: ctx.from.username, name: ctx.from.first_name, referredBy: rId });
    }
    ctx.reply(`✨ Aura Digital Top-Up Service မှ ကြိုဆိုပါတယ်ဗျာ။`, getMainMenu(ctx));
});

bot.action('check_join', checkMiddleware, async (ctx) => {
    await ctx.answerCbQuery('🔄 စစ်ဆေးနေပါသည်...'); ctx.deleteMessage().catch(() => {});
    ctx.reply('🎉 Channel Join အောင်မြင်ပါသည်။', getMainMenu(ctx));
});

bot.hears('🎁 Daily Check-In', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString();
    const user = await User.findOne({ telegramId: uid });
    const now = new Date();

    if (user.lastCheckIn && now.toDateString() === user.lastCheckIn.toDateString()) {
        return ctx.reply('⚠️ လူကြီးမင်း ယနေ့အတွက် Daily Point ယူပြီးပါပြီဗျာ။ မနက်ဖြန်မှ ပြန်လာခဲ့ပေးပါဦး။');
    }

    await User.findOneAndUpdate({ telegramId: uid }, { $inc: { points: 20 }, $set: { lastCheckIn: now } });
    ctx.reply('🎉 နေ့စဉ် Check-In အောင်မြင်ပြီး မေတ္တာလက်ဆောင် +20 Points အား လူကြီးမင်းအကောင့်ထဲ ထည့်သွင်းပေးလိုက်ပါပြီဗျာ။');
});

bot.hears('🎮 စိန်ဖြည့်ရန် (Top-Up Store)', checkMiddleware, async (ctx) => {
    const shop = await Shop.findOne();
    const keyboard = Object.keys(ITEM_NAMES).map(key => {
        return [Markup.button.callback(`🔹 ${ITEM_NAMES[key]} - ${(shop.prices.get(key) || 0).toLocaleString()} Ks`, `buy_${key}`)];
    });
    ctx.reply('💎 MLBB Diamonds & Pass စာရင်း -', Markup.inlineKeyboard(keyboard));
});

bot.hears('📜 ဝယ်ယူမှုမှတ်တမ်း', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString();
    const orders = await Order.find({ telegramId: uid }).sort({ createdAt: -1 }).limit(5);
    if (orders.length === 0) return ctx.reply('⚠️ လူကြီးမင်းထံတွင် ဝယ်ယူထားသော မှတ်တမ်းမရှိသေးပါဗျာ။');

    let msg = `📜 *လူကြီးမင်း၏ နောက်ဆုံး ဝယ်ယူမှုမှတ်တမ်း (၅) ခု*\n\n`;
    orders.forEach((o, i) => {
        const emoji = o.status === 'Success' ? '✅' : (o.status === 'Cancelled' ? '❌' : '⏳');
        msg += `${i + 1}. #\ ${o.orderId} - *${o.itemName}*\n   💰 ကျသင့်ငွေ: ${o.price} Ks\n   📊 အခြေအနေ: ${emoji} *${o.status}*\n\n`;
    });
    ctx.replyWithMarkdown(msg);
});

bot.hears('💡 အသုံးပြုပုံလမ်းညွှန်', (ctx) => {
    ctx.replyWithMarkdown(`💡 *Aura Digital - လမ်းညွှန်ချက်များ*\n\n` +
                          `၁။ *စိန်ဖြည့်နည်း:* Store ထဲဝင်ပြီး ပစ္စည်းရွေး၊ MLBB ID ရိုက်ထည့်ကာ Ngwe Lwဲပြေစာ ပို့ပေးရုံဖြင့် ရပါပြီ။\n` +
                          `၂။ *ကူပွန်စနစ်:* ဝယ်ယူမှုတိုင်းမှ ရလာသော Point ၅,၀၀၀ ပြည့်လျှင် 5% ကူပွန်လဲနိုင်ပြီး၊ ၎င်းကူပွန်ကို ဝယ်ယူချိန်တွင် မိမိစိတ်ကြိုက် အသုံးပြုနိုင်ပါသည်။\n` +
                          `၃။ *အခမဲ့စိန်ရယူနည်း:* My Points ထဲရှိ Referral link အား သူငယ်ချင်းများထံ မျှဝေပြီး သူတို့ဝယ်ယူတိုင်း ၁၀% အမှတ်များ အလကား စုဆောင်းနိုင်ပါသည်။`);
});

bot.hears('📞 Contact Admin', (ctx) => ctx.reply(`👨‍💻 Aura Digital တာဝန်ခံ Admin Account: ${ADMIN_USERNAME}`));

bot.hears('💰 My Points & Coupons', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString(); const user = await User.findOne({ telegramId: uid });
    let msg = `💰 *Aura Digital - လူကြီးမင်း၏ အမှတ်စာရင်း* 💰\n\n` +
              `🎯 လက်ရှိအမှတ်: *${user.points.toLocaleString()} Points*\n` +
              `🎟️ လက်ဝယ်ရှိကူပွန်: *${user.couponsCount || 0} ရွက်*\n\n` +
              `👉 ကိုယ်ပိုင် Link: \`t.me/${ctx.botInfo.username}?start=ref_${uid}\` \n\n` +
              `🎟️ ပရိုမိုးရှင်းကုဒ် (Promo Code) ရှိပါက အောက်ကခလုတ်ကိုနှိပ်ပြီး ရိုက်ထည့်နိုင်ပါတယ်ဗျာ။`;
    ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
        [Markup.button.callback('🎟️ Promo Code ရိုက်ထည့်မည်', 'ent_promo')],
        [Markup.button.callback('🎟️ 5% Coupon လဲမည် (-5000 Pts)', 'claim_coupon_5')]
    ]));
});

// ==========================================
// 5. ENGINE & ORDER MANAGEMENT
// ==========================================
bot.action(/^buy_(.+)$/, checkMiddleware, async (ctx) => {
    await ctx.answerCbQuery('🛒..._'); const key = ctx.match[1]; const shop = await Shop.findOne();
    const price = shop.prices.get(key); const cost = shop.costs.get(key) || 0; const uid = ctx.from.id.toString();
    userSessions.set(uid, { itemKey: key, itemName: ITEM_NAMES[key], basePrice: price, costPrice: cost, finalPrice: price, discountUsed: 0, couponBurned: 0 });
    const user = await User.findOne({ telegramId: uid });
    if (user && user.savedGameId) {
        ctx.editMessageText(`🎯 ရွေးချယ်မှု: ${ITEM_NAMES[key]}\n💰 ဈေးနှုန်း: ${price.toLocaleString()} Ks\n\n💡 ယခင် ID ဟောင်း ဖြင့်ပဲ ပြန်လည်ဖြည့်သွင်းမလားဗျာ?`, Markup.inlineKeyboard([
            [Markup.button.callback(`🆔 ID ဟောင်းသုံးမည်: ${user.savedGameId}`, `use_saved_id`)],
            [Markup.button.callback('🎁 အခြား ID အသစ်ရိုက်မည်', 'use_new_id')]
        ])).catch(() => {});
    } else { askForGameId(ctx); }
});

function askForGameId(ctx) {
    const uid = ctx.from.id.toString(); const session = userSessions.get(uid); session.step = 'AWAITING_ID'; userSessions.set(uid, session);
    ctx.deleteMessage().catch(() => {}); ctx.reply(`📝 ကျေးဇူးပြု၍ MLBB User ID နှင့် Zone ID အား ရိုက်ထည့်ပေးပါဗျာ။\n\n📌 ဥပမာ - 166049831(2851)`);
}
bot.action('use_new_id', checkMiddleware, async (ctx) => { askForGameId(ctx); });
bot.action('use_saved_id', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString(); const session = userSessions.get(uid); const user = await User.findOne({ telegramId: uid });
    session.gameId = user.savedGameId; userSessions.set(uid, session); ctx.deleteMessage().catch(() => {}); await processDiscountStep(ctx, user, session);
});

async function processDiscountStep(ctx, user, session) {
    if (user.couponsCount > 0) {
        ctx.reply(`🎟️ လူကြီးမင်းထံတွင် 5% လျှော့ဈေးကူပွန် ရှိနေပါသည်။ ယခုဝယ်ယူမှုတွင် သုံးမလားဗျာ?`, Markup.inlineKeyboard([
            [Markup.button.callback(`✅ ကူပွန်သုံးမည် (5% OFF)`, 'apply_stored_coupon')],
            [Markup.button.callback('❌ မသုံးပါ၊ နောက်မှ သုံးပါမည်', 'skip_discount')]
        ]));
    } else {
        session.step = 'AWAITING_RECEIPT'; userSessions.set(user.telegramId, session); await sendPaymentDetails(ctx, session);
    }
}

bot.action('apply_stored_coupon', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString(); const session = userSessions.get(uid);
    const exactDiscount = Math.floor(session.basePrice * 0.05); 
    const finalDiscount = Math.floor(exactDiscount / 50) * 50; 
    session.couponBurned = 1; session.discountUsed = finalDiscount; session.finalPrice = Math.max(0, session.basePrice - finalDiscount);
    session.step = 'AWAITING_RECEIPT'; userSessions.set(uid, session); ctx.deleteMessage().catch(() => {}); await sendPaymentDetails(ctx, session);
});
bot.action('skip_discount', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString(); const session = userSessions.get(uid);
    session.step = 'AWAITING_RECEIPT'; userSessions.set(uid, session); ctx.deleteMessage().catch(() => {}); await sendPaymentDetails(ctx, session);
});

async function sendPaymentDetails(ctx, session) {
    let msg = `💵 *AURA DIGITAL - ငွေပေးချေမှု* 💵\n\nပစ္စည်း: *${session.itemName}*\n🎯 MLBB ID: \`${session.gameId}\`\n`;
    if (session.discountUsed > 0) msg += `🔥 ကူပွန်လျှော့ဈေး: -${session.discountUsed.toLocaleString()} Ks\n`;
    msg += `💰 *လွှဲရမည့်ငွေ: ${session.finalPrice.toLocaleString()} Kyats*\n\n• KPay: \`09692272242\` (ဒေါ်အေးအေးမြင့်)\n\nလွှဲပြီးပါက ပြေစာ Screenshot (ဓာတ်ပုံ) ကို ပို့ပေးပါဗျာ။`;
    ctx.replyWithPhoto(KPAY_QR_FILE_ID, { caption: msg, parse_mode: 'Markdown' }).catch(() => ctx.replyWithMarkdown(msg));
}

// Text Inputs (Both User and Admin Router)
bot.on('text', checkMiddleware, async (ctx) => {
    const uid = ctx.from ? ctx.from.id.toString() : null;
    const input = ctx.message.text.trim();

    if (isAdmin(ctx)) {
        if (adminBroadcastState.step === 'AWAITING_MSG') {
            adminBroadcastState.step = 'CONFIRMING'; adminBroadcastState.text = input; adminBroadcastState.photo = null;
            return askConfirmBroadcast(ctx, input, null);
        }
        if (adminActionState.step === 'PRICE_NEW_AMT') {
            const amt = parseInt(input); if (isNaN(amt)) return ctx.reply('⚠️ ဂဏန်းအမှန်ကန်ဆုံး ရိုက်ပေးပါဗျာ။');
            adminActionState.price = amt; adminActionState.step = 'COST_NEW_AMT';
            return ctx.reply(`⚙️ ${ITEM_NAMES[adminActionState.key]} အတွက် ရောင်းဈေးကို ${amt} Ks ဟု မှတ်သားထားပါသည်။\n\nဆက်လက်၍ ၎င်းပစ္စည်း၏ *ရင်းဈေး (Cost)* အား ဂဏန်းသီးသန့် ရိုက်ပို့ပေးပါဗျာ။`);
        }
        if (adminActionState.step === 'COST_NEW_AMT') {
            const costAmt = parseInt(input); if (isNaN(costAmt)) return ctx.reply('⚠️ ဂဏန်းအမှန်ကန်ဆုံး ရိုက်ပေးပါဗျာ။');
            const shop = await Shop.findOne();
            shop.prices.set(adminActionState.key, adminActionState.price);
            shop.costs.set(adminActionState.key, costAmt);
            await shop.save();
            ctx.reply(`✅ ${ITEM_NAMES[adminActionState.key]} အား ပြင်ဆင်ပြီးပါပြီ။\n💰 ရောင်းဈေး: ${adminActionState.price} Ks\n📉 ရင်းဈေး: ${costAmt} Ks`, getMainMenu(ctx));
            adminActionState = {}; return;
        }
        if (adminActionState.step === 'POINT_USER_ID') {
            const targetUser = await User.findOne({ telegramId: input });
            if (!targetUser) return ctx.reply('⚠️ ဤ User ID အား Database တွင် ရှာမတွေ့ပါ။');
            adminActionState.targetUid = input; adminActionState.step = 'POINT_NEW_AMT';
            return ctx.reply(`👤 User: ${targetUser.name}\n🎯 လက်ရှိအမှတ်: ${targetUser.points} Pts\n\nတိုးမြှင့်/လျှော့ချချင်သော အမှတ်ပမာဏကို ရိုက်ထည့်ပါ (ဥပမာ - 5000 သို့မဟုတ် -2000)`);
        }
        if (adminActionState.step === 'POINT_NEW_AMT') {
            const amt = parseInt(input); if (isNaN(amt)) return ctx.reply('⚠️ ဂဏန်းအမှန်ကန်ဆုံး ရိုက်ပေးပါဗျာ။');
            await User.findOneAndUpdate({ telegramId: adminActionState.targetUid }, { $inc: { points: amt } });
            ctx.reply('✅ အမှတ်ပြင်ဆင်မှု အောင်မြင်ပါပြီဗျာ။', getMainMenu(ctx));
            try { await bot.telegram.sendMessage(adminActionState.targetUid, `🔔 Admin မှ လူကြီးမင်း၏ အမှတ်စာရင်းအား ပြင်ဆင်လိုက်သဖြင့် Point အပြောင်းအလဲ ရှိသွားပါသည်ဗျာ။`); } catch (e) {}
            adminActionState = {}; return;
        }
        if (adminActionState.step === 'PROMO_CODE_NAME') {
            adminActionState.codeName = input.toUpperCase(); adminActionState.step = 'PROMO_POOL';
            return ctx.reply('🎟️ Promo Code အမည်ရပါပြီ။\n\nယခု Campaign အတွက် သတ်မှတ်မည့် *စုစုပေါင်း Point Pool (Total Points)* ကို ရိုက်ထည့်ပေးပါ (ဥပမာ - 10000)');
        }
        if (adminActionState.step === 'PROMO_POOL') {
            const pool = parseInt(input); if (isNaN(pool)) return ctx.reply('⚠️ ဂဏန်းအမှန်ကန်ဆုံး ရိုက်ပေးပါဗျာ။');
            adminActionState.pool = pool; adminActionState.step = 'PROMO_EXPIRY';
            return ctx.reply('🎟️ Point Pool သတ်မှတ်ပြီးပါပြီ။\n\nသက်တမ်းကုန်ဆုံးမည့် နာရီပမာဏကို ရိုက်ထည့်ပေးပါ (ဥပမာ - ၂ ရက်ဆိုလျှင် 48 ၊ ၅ နာရီဆိုလျှင် 5)');
        }
        if (adminActionState.step === 'PROMO_EXPIRY') {
            const hours = parseInt(input); if (isNaN(hours)) return ctx.reply('⚠️ ဂဏန်းအမှန်ကန်ဆုံး ရိုက်ပေးပါဗျာ။');
            const expDate = new Date(); expDate.setHours(expDate.getHours() + hours);
            await Shop.findOneAndUpdate({}, {
                $set: {
                    "promo.code": adminActionState.codeName,
                    "promo.poolPoints": adminActionState.pool,
                    "promo.expiry": expDate,
                    "promo.claimedUsers": []
                }
            });
            ctx.reply(`✅ Promo Code အသစ်တစ်ခုကို လွှင့်တင်လိုက်ပါပြီ။\n🎟️ ကုဒ်: ${adminActionState.codeName}\n🎯 Pool: ${adminActionState.pool} Pts\n⏳ သက်တမ်း: ${hours} နာရီ`, getMainMenu(ctx));
            adminActionState = {}; return;
        }
    }

    // User Text Interaction Router
    if (uid && adminActionState[uid] && adminActionState[uid].step === 'USER_PROMO_INPUT') {
        const shop = await Shop.findOne(); const user = await User.findOne({ telegramId: uid });
        if (!shop.promo.code || shop.promo.code !== input.toUpperCase()) { return ctx.reply('❌ ဤပရိုမိုးရှင်းကုဒ်သည် မှားယွင်းနေပါသည် (သို့မဟုတ်) မရှိတော့ပါဗျာ။'); }
        if (shop.promo.claimedUsers.includes(uid)) { return ctx.reply('⚠️ လူကြီးမင်းသည် ယခုပရိုမိုးရှင်းတွင် ပါဝင်ပြီးဖြစ်သဖြင့် ထပ်မံရိုက်ကူး၍ မရနိုင်ပါဗျာ။'); }
        if (user.totalSpent < 10000) { return ctx.reply('🛡️ တောင်းပန်ပါတယ်ဗျာ။ ယခု Promo Code သည် အနည်းဆုံး ၁၀,၀၀၀ ကျပ်ဖိုး အော်ဒါ အောင်မြင်စွာ ဝယ်ယူဖူးသော Loyal Customers များသာ အသုံးပြုနိုင်ပါသည်ဗျာ။'); }

        const now = new Date();
        if (shop.promo.expiry && now > shop.promo.expiry) { return ctx.reply('⏳ နှမြောစရာပဲဗျာ! ယခု ပရိုမိုးရှင်းကုဒ်သည် သက်တမ်းကုန်ဆုံးသွားခဲ့ပါပြီ။'); }

        let wonPoints = 0; let isGift = false;
        if (shop.promo.poolPoints > 0) {
            wonPoints = Math.floor(50 + Math.random() * 151);
            if (wonPoints > shop.promo.poolPoints) wonPoints = shop.promo.poolPoints;
            await Shop.findOneAndUpdate({}, { $inc: { "promo.poolPoints": -wonPoints }, $push: { "promo.claimedUsers": uid } });
        } else {
            wonPoints = 20; isGift = true;
            await Shop.findOneAndUpdate({}, { $push: { "promo.claimedUsers": uid } });
        }

        await User.findOneAndUpdate({ telegramId: uid }, { $inc: { points: wonPoints } });
        delete adminActionState[uid];

        if (isGift) { ctx.reply(`❤️ Campaign ၏ ပင်မ Pool Point များ ကုန်သွားခဲ့သော်လည်း လူကြီးမင်းအား မေတ္တာလက်ဆောင်အဖြစ် +20 Points ချီးမြှင့်ပေးလိုက်ပါသည်ဗျာ။`); }
        else { ctx.reply(`🎉 ဂုဏ်ယူပါတယ်ဗျာ။ Promo Code ကံစမ်းမှုမှတစ်ဆင့် Point +${wonPoints} Points ရရှိပါပြီဗျာ။`); }
        return;
    }

    if (!uid) return;
    const session = userSessions.get(uid);
    if (!session || session.step !== 'AWAITING_ID') return;
    if (!/^\d{8,10}\s*\(\d{4,5}\)$|^\d{8,10}\s+\d{4,5}$/.test(input)) return ctx.reply('⚠️ ID ပုံစံမမှန်ပါ။ ပြန်လည်ရိုက်ထည့်ပေးပါဗျာ။\nဥပမာ - 166049831(2851)');

    session.gameId = input; userSessions.set(uid, session);
    const updatedUser = await User.findOneAndUpdate({ telegramId: uid }, { savedGameId: input }, { new: true });
    await processDiscountStep(ctx, updatedUser, session);
});

bot.action('ent_promo', checkMiddleware, async (ctx) => {
    await ctx.answerCbQuery('🎟️_'); const uid = ctx.from.id.toString();
    adminActionState[uid] = { step: 'USER_PROMO_INPUT' };
    ctx.reply('📝 လူကြီးမင်းထံရှိသော ပရိုမိုးရှင်းကုဒ် (Promo Code) အား စာသားအမှန်အတိုင်း အင်္ဂလိပ်လို ရိုက်ပို့ပေးပါဗျာ။');
});

// ==========================================
// 6. PHOTO RECEIPTS & ACCURATE PROFIT PROCESSING
// ==========================================
bot.on('photo', checkMiddleware, async (ctx) => {
    const uid = ctx.from ? ctx.from.id.toString() : null;
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    if (isAdmin(ctx) && adminBroadcastState.step === 'AWAITING_MSG') {
        adminBroadcastState.step = 'CONFIRMING'; adminBroadcastState.text = ctx.message.caption || ''; adminBroadcastState.photo = photoId;
        return askConfirmBroadcast(ctx, adminBroadcastState.text, photoId);
    }
    if (!uid) return;
    const session = userSessions.get(uid); if (!session || session.step !== 'AWAITING_RECEIPT') return;

    const orderId = 'AD' + Math.floor(1000 + Math.random() * 9000); session.orderId = orderId; userSessions.set(uid, session);
    await Order.create({ orderId, telegramId: uid, itemName: session.itemName, itemKey: session.itemKey, gameId: session.gameId, price: session.finalPrice, cost: session.costPrice });

    ctx.reply(`🎉 ပြေစာရရှိပါပြီ။ Order ID: #${orderId} အား ခေတ္တစောင့်ဆိုင်းပေးပါဗျာ။`);

    const orderDetails = `🚨 *AURA DIGITAL - အော်ဒါအသစ်* 🚨\n\n🆔 Order ID: *#${orderId}*\n👤 ဝယ်ယူသူ: [${ctx.from.first_name}](tg://user?id=${uid})\n🎮 ပစ္စည်း: *${session.itemName}*\n🎯 MLBB ID: \`${session.gameId}\`\n💰 လွှဲငွေ: *${session.finalPrice.toLocaleString()} Ks*`;
    try {
        await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, photoId, {
            caption: orderDetails, parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[
                Markup.button.callback('✅ Confirm', `acnf_${orderId}`), Markup.button.callback('❌ Cancel', `acxl_${orderId}`)
            ]])
        });
    } catch (e) { console.error(e); }
});

bot.action(/^acnf_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('⚠️ No Permission');
    const orderId = ctx.match[1]; await ctx.answerCbQuery('⚙️ Processing...');

    const order = await Order.findOneAndUpdate({ orderId, status: 'Pending' }, { status: 'Success' }, { new: true });
    if (!order) return ctx.reply('⚠️ အော်ဒါမရှိတော့ပါ သို့မဟုတ် အောင်မြင်ပြီးသားဖြစ်နေသည်။');

    const calculatedProfit = Math.max(0, order.price - order.cost); 
    await Shop.findOneAndUpdate({}, { $inc: { totalOrders: 1, totalRevenue: order.price, totalProfit: calculatedProfit } });
    const user = await User.findOneAndUpdate({ telegramId: order.telegramId }, { $set: { hasPurchased: true }, $inc: { totalSpent: order.price } });

    const session = userSessions.get(order.telegramId);
    if (session && session.couponBurned > 0) { await User.findOneAndUpdate({ telegramId: order.telegramId }, { $inc: { couponsCount: -1 } }); }

    const newDirectPoints = Math.floor(order.price / 10);
    await User.findOneAndUpdate({ telegramId: order.telegramId }, { $inc: { points: newDirectPoints } });

    if (user.referredBy) {
        const rfr = await User.findOne({ telegramId: user.referredBy });
        if (rfr && rfr.hasPurchased) {
            const refBonus = Math.floor(order.price * 0.1);
            await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { points: refBonus } });
            try { await bot.telegram.sendMessage(user.referredBy, `🎉 မိတ်ဆွေညွှန်းဆိုသူမှ ဝယ်ယူမှုကြောင့် Bonus Point +${refBonus.toLocaleString()} Pts ရရှိပါပြီ။`); } catch (e) {}
        }
    }

    ctx.editMessageCaption(`✅ *အော်ဒါအောင်မြင်စွာ ဖြည့်သွင်းပြီးပါပြီ။*\n🆔 Order: #${orderId}\n💰 ဝင်ငွေ: +${order.price} Ks\n📈 အမြတ်: +${calculatedProfit} Ks`, { parse_mode: 'Markdown' }).catch(() => {});
    try {
        await bot.telegram.sendMessage(order.telegramId, `⚡ *Order Delivered!*\n\nအော်ဒါနံပါတ် *#${orderId}* အောင်မြင်စွာ ဖြည့်သွင်းပြီးပါပြီ။\nPoint: +${newDirectPoints.toLocaleString()} Pts`,
            Markup.inlineKeyboard([[Markup.button.callback('⭐️⭐️⭐️⭐️⭐️ အရမ်းမြန်လို့ သဘောကျတယ်', `rev_${orderId}`)]])
        );
    } catch (e) {}
});

bot.action(/^acxl_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Cancelled');
    const orderId = ctx.match[1]; await ctx.answerCbQuery('❌ Processing...');
    await Order.findOneAndUpdate({ orderId, status: 'Pending' }, { status: 'Cancelled' });
    ctx.editMessageCaption(`❌ *ဤအော်ဒါကို ပယ်ဖျက်လိုက်ပါပြီ။*\n🆔 Order: #${orderId}`, { parse_mode: 'Markdown' }).catch(() => {});
    try { await bot.telegram.sendMessage(order.telegramId, `❌ လူကြီးမင်း၏ အော်ဒါနံပါတ် *#${orderId}* သည် ပြေစာမမှန်ကန်ခြင်းကြောင့် ပယ်ဖျက်ခြင်း ခံရပါသည်ဗျာ။`); } catch (e) {}
});

bot.action(/^rev_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('❤️ Thanks!'); const orderId = ctx.match[1]; ctx.editMessageText('❤️ Review ပေးပေးသည့်အတွက် ကျေးဇူးတင်ပါတယ်ဗျာ။').catch(() => {});
    const order = await Order.findOne({ orderId }); if (!order) return;
    const revPost = `✨ *CUSTOMER REVIEW* ✨\n\n📦 Order ID: \`#${orderId}\`\n💎 Item: *${order.itemName}*\nထင်မြင်ချက်: ⭐️⭐️⭐️⭐️⭐️ *အရမ်းမြန်ပြီး စိတ်ချရတယ်ဗျာ*\n\n🤖 @${ctx.botInfo.username}`;
    try { await bot.telegram.sendMessage(CHANNEL_USERNAME, revPost, { parse_mode: 'Markdown' }); } catch (e) {}
});

// ==========================================
// 7. ADMIN CONTROLS (PRICE EDIT, PROMO, DASHBOARD)
// ==========================================
bot.hears('🔧 ဈေးနှုန်း/ရင်းဈေး ပြင်ရန်', (ctx) => {
    if (!isAdmin(ctx)) return;
    const keyboard = Object.keys(ITEM_NAMES).map(key => [Markup.button.callback(ITEM_NAMES[key], `eprc_${key}`)]);
    ctx.reply('🔧 ပြင်ဆင်လိုသည့် Item ကို ရွေးချယ်ပေးပါဗျာ -', Markup.inlineKeyboard(keyboard));
});
bot.action(/^eprc_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('⚠️ No Perm');
    const key = ctx.match[1]; await ctx.answerCbQuery('⚙️_'); adminActionState = { step: 'PRICE_NEW_AMT', key: key };
    ctx.editMessageText(`📝 *${ITEM_NAMES[key]}* အတွက် *ရောင်းဈေးအသစ်* ကို ဂဏန်းသီးသန့် (Ks) ဖြင့် ရိုက်ပို့ပေးပါဗျာ။`);
});

bot.hears('👤 User Point ပြင်ရန်', (ctx) => {
    if (!isAdmin(ctx)) return; adminActionState = { step: 'POINT_USER_ID' };
    ctx.reply('📝 အမှတ်ပြင်လိုသော User ၏ Telegram ID (ဂဏန်းများ) ကို ရိုက်ပို့ပေးပါဗျာ။');
});

bot.hears('🎟️ Promo Code အသစ်ထုတ်ရန်', (ctx) => {
    if (!isAdmin(ctx)) return; adminActionState = { step: 'PROMO_CODE_NAME' };
    ctx.reply('📝 ကမ်ပိန်းအတွက် အသုံးပြုမည့် Promo Code စာသားကို ရိုက်ပေးပါဗျာ (ဥပမာ - THADINGYUT)');
});

bot.hears('📊 Dashboard (စာရင်းချုပ်)', async (ctx) => {
    if (!isAdmin(ctx)) return; const shop = await Shop.findOne();
    ctx.replyWithMarkdown(`📊 *AURA DIGITAL - စာရင်းဇယားချုပ်*\n\n📝 စုစုပေါင်းအော်ဒါ: *${shop.totalOrders} ခု*\n💰 စုစုပေါင်း ရောင်းရငွေ: *${shop.totalRevenue.toLocaleString()} Ks*\n📈 *အသားတင်အမြတ်စုစုပေါင်း: ${shop.totalProfit.toLocaleString()} Ks*`);
});

bot.hears('🏪 ဆိုင် ဖွင့်/ပိတ် Panel', async (ctx) => {
    if (!isAdmin(ctx)) return; const shop = await Shop.findOne();
    ctx.reply(`🏪 Aura Digital ဆိုင်လက်ရှိအခြေအနေ: ${shop.shopOpen ? '🟢 ဖွင့်ထားသည်' : '🔴 ပိတ်ထားသည်'}`, Markup.inlineKeyboard([
        [Markup.button.callback('🟢 ဆိုင်ဖွင့်မည်', 'shop_open'), Markup.button.callback('🔴 ဆိုင်ပိတ်မည်', 'shop_close')]
    ]));
});
bot.action('shop_open', async (ctx) => { await Shop.findOneAndUpdate({}, { shopOpen: true }); ctx.editMessageText('🏪 ဆိုင်အား [ 🟢 ဖွင့်လှစ်သည် ] သို့ ပြောင်းလဲလိုက်ပါပြီ။').catch(() => {}); });
bot.action('shop_close', async (ctx) => { await Shop.findOneAndUpdate({}, { shopOpen: false }); ctx.editMessageText('🏪 ဆိုင်အား [ 🔴 ပိတ်သိမ်းသည် ] သို့ ပြောင်းလဲလိုက်ပါပြီ။').catch(() => {}); });

bot.action('claim_coupon_5', async (ctx) => {
    await ctx.answerCbQuery('🎟️_'); const uid = ctx.from.id.toString(); const user = await User.findOne({ telegramId: uid });
    if (user.points < 5000) return ctx.reply('⚠️ လူကြီးမင်းတွင် Point ၅,၀၀၀ မပြည့်သေးပါသဖြင့် ကူပွန်လဲ၍မရနိုင်သေးပါဗျာ။');
    await User.findOneAndUpdate({ telegramId: uid }, { $inc: { points: -5000, couponsCount: 1 } }); ctx.editMessageText('🎟️ 5% Coupon အား လဲလှယ်သိမ်းဆည်းလိုက်ပါပြီ။').catch(() => {});
});

bot.hears('📢 ကြော်ငြာစာ ပို့ရန်', (ctx) => {
    if (!isAdmin(ctx)) return; adminBroadcastState = { step: 'AWAITING_MSG' };
    ctx.reply('📢 ကြော်ငြာချင်သော စာသား (သို့မဟုတ်) ပုံတင်ပြီး Caption ရိုက်ပို့ပေးပါဗျာ။');
});
function askConfirmBroadcast(ctx, text, photoId) {
    const inlineButtons = Markup.inlineKeyboard([[Markup.button.callback('🚀 လူတိုင်းဆီ ပို့မည်', 'bc_confirm'), Markup.button.callback('❌ ဖျက်သိမ်းမည်', 'bc_cancel')]]);
    if (photoId) { ctx.replyWithPhoto(photoId, { caption: `📝 *Preview*\n\n${text}`, parse_mode: 'Markdown', ...inlineButtons }); }
    else { ctx.replyWithMarkdown(`📝 *Preview*\n\n${text}`, inlineButtons); }
}
bot.action('bc_cancel', async (ctx) => { adminBroadcastState = {}; ctx.editMessageText('❌ ကြော်ငြာအား ဖျက်သိမ်းလိုက်ပါပြီ။').catch(() => {}); });
bot.action('bc_confirm', async (ctx) => {
    await ctx.answerCbQuery('🚀_'); ctx.editMessageText('🚀 စတင် ပို့ဆောင်နေပါပြီ...').catch(() => {});
    const allUsers = await User.find({}); let successCount = 0;
    for (let u of allUsers) {
        try {
            if (adminBroadcastState.photo) { await bot.telegram.sendPhoto(u.telegramId, adminBroadcastState.photo, { caption: adminBroadcastState.text }); }
            else { await bot.telegram.sendMessage(u.telegramId, adminBroadcastState.text); }
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 40)); 
        } catch (e) {}
    }
    ctx.reply(`🎉 လူဦးရေ *${successCount}* ယောက်ထံ ပေးပို့အောင်မြင်ခဲ့ပါတယ်ဗျာ။`); adminBroadcastState = {};
});

const server = http.createServer((req, res) => { res.writeHead(200); res.end('Aura Engine 2026 Online.'); });
server.listen(process.env.PORT || 3000, () => { bot.launch().then(() => console.log('🚀 Aura Digital Active.')); });
