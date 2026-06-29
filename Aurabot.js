const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const http = require('http');

// ==========================================
// 1. CONFIGURATIONS
// ==========================================
const BOT_TOKEN = '8953970980:AAG-8uV8P9ni_vlmXVGdTZfdVrSFHuosX3Y';
const ADMIN_CHAT_ID = '7534742589'; 
const ADMIN_USERNAME = '@Wunna2232003';
const BOT_USERNAME = 'AuraDigitalPremium_Bot'; 
const CHANNEL_USERNAME = '@AuraDigitalPremium'; 
const MONGO_URI = 'mongodb+srv://eaglewind22_db:2232003wunna@cluster0.qqgs4ef.mongodb.net/aura_digital?retryWrites=true&w=majority&appName=Cluster0';
const URL = 'https://aura-digital-bot.onrender.com';

mongoose.connect(MONGO_URI)
    .then(() => console.log('🟢 DB Connected'))
    .catch(err => console.error('🔴 DB Error:', err));

const bot = new Telegraf(BOT_TOKEN);

// Separated Memory States To Avoid Collision
const userSessions = new Map(); 
const adminState = new Map(); 
const userPromoState = new Map();

function isAdmin(ctx) {
    if (!ctx || !ctx.from) return false;
    return ctx.from.id.toString() === ADMIN_CHAT_ID.toString();
}

// ==========================================
// 2. SCHEMAS & MONGOOSE MODELS
// ==========================================
const UserSchema = new mongoose.Schema({
    telegramId: String, username: String, name: String, savedGameId: String,
    points: { type: Number, default: 0 }, couponsCount: { type: Number, default: 0 }, 
    totalSpent: { type: Number, default: 0 }, lastCheckIn: Date, hasPurchased: { type: Boolean, default: false },
    referredBy: String, createdAt: { type: Date, default: Date.now }
});

const OrderSchema = new mongoose.Schema({
    orderId: String, telegramId: String, itemName: String, itemKey: String,
    gameId: String, price: Number, cost: Number, status: { type: String, default: 'Pending' }, 
    paymentMethod: String, usedCoupon: { type: Boolean, default: false },
    isGift: { type: Boolean, default: false }, pendingBalance: { type: Number, default: 0 },
    receiptFileId: String, balanceReceiptFileId: String, createdAt: { type: Date, default: Date.now }
});

const ShopSchema = new mongoose.Schema({
    shopOpen: { type: Boolean, default: true },
    kpayNumber: { type: String, default: '09692272242' }, kpayName: { type: String, default: 'Aura Topup' }, kpayQrId: String,
    waveNumber: { type: String, default: '09400266700' }, waveName: { type: String, default: 'Wunna Myo Oo' }, waveQrId: String,
    totalOrders: { type: Number, default: 0 }, totalRevenue: { type: Number, default: 0 }, totalProfit: { type: Number, default: 0 }, 
    prices: { type: Map, of: Number, default: { 'mlbb_wp': 6450, 'mlbb_tp': 34300, 'mlbb_86': 5650, 'mlbb_172': 10650 }},
    costs: { type: Map, of: Number, default: { 'mlbb_wp': 5500, 'mlbb_tp': 30000, 'mlbb_86': 4800, 'mlbb_172': 9000 }},
    promo: { code: String, poolPoints: Number, expiry: Date, claimedUsers: [String] }
});

const User = mongoose.model('User', UserSchema);
const Order = mongoose.model('Order', OrderSchema);
const Shop = mongoose.model('Shop', ShopSchema);

const ITEM_NAMES = { 'mlbb_wp': '🔥 Weekly Pass', 'mlbb_tp': '🤩 Twilight Pass', 'mlbb_86': '💎 Dia 86', 'mlbb_172': '💎 Dia 172' };
const ITEM_COUPONS = { 'mlbb_wp': '3%', 'mlbb_tp': '5%', 'mlbb_86': '3%', 'mlbb_172': '5%' }; 

// ==========================================
// 3. KEYBOARDS & LAYOUTS
// ==========================================
const userMenu = Markup.keyboard([
    ['🎮 မိတ်ဆွေဖျော်ဖြေရေး (Top-Up Store)'],
    ['🎁 Daily Check-In', '💰 My Points & Coupons'],
    ['📜 ဝယ်ယူမှုမှတ်တမ်း', '💡 အသုံးပြုပုံလမ်းညွှန်'],
    ['📞 Contact Admin']
]).resize();

const adminMenu = Markup.keyboard([
    ['📊 Dashboard (စာရင်းချုပ်)', '🏪 ဆိုင် ဖွင့်/ပိတ် Panel'],
    ['💰 လက်ရှိဈေးနှုန်းများကြည့်ရန်', '⚙️ အချက်အလက်များ ပြင်ရန်'],
    ['🎟️ Promo Code ထုတ်ရန်', '⚙️ Promo Code စီမံရန်'],
    ['🔍 မေ့ကျန်ခဲ့သော အော်ဒါများစစ်ရန်', '📢 ကြော်ငြာစာ ပို့ရန်']
]).resize();

function getMainMenu(ctx) { return isAdmin(ctx) ? adminMenu : userMenu; }

// ==========================================
// 4. MIDDLEWARES & LOGIC ROUTERS
// ==========================================
async function checkForcedJoinAndShop(ctx, next) {
    if (isAdmin(ctx)) return next();
    try {
        const uid = ctx.from.id;
        const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, uid);
        if (['left', 'kicked'].includes(member.status)) {
            return ctx.reply(`⚠️ လူကြီးမင်းအနေဖြင့် ကျွန်ုပ်တို့၏ ဝန်ဆောင်မှုများကို အသုံးပြုနိုင်ရန် Aura Digital Channel ကို အရင် Join ပေးရန် လိုအပ်ပါသည်ဗျာ။`,
                Markup.inlineKeyboard([[Markup.button.url('📢 Channel သို့ဝင်ရန်', `t.me/${CHANNEL_USERNAME.replace('@','')}`)]])
            );
        }
        
        let shop = await Shop.findOne();
        if (!shop) {
            shop = await Shop.create({});
        }
        
        if (shop && !shop.shopOpen && ctx.message && ctx.message.text && ctx.message.text.includes('Top-Up')) {
            return ctx.reply('👋 မင်္ဂလာပါဗျာ။ လက်ရှိအချိန်တွင် Aura Digital ဆိုင်ခေတ္တ ပိတ်ထားပါသဖြင့် အော်ဒါတင်၍ မရနိုင်သေးပါဗျာ။');
        }
    } catch (e) { console.error('Error in Middleware:', e); }
    return next();
}

async function handleMenuInterruption(ctx, targetField, nextFunc) {
    try {
        const uid = ctx.from.id.toString();
        const session = userSessions.get(uid);
        if (session && session.step && !['COMPLETED', 'AWAITING_ID_OPTION'].includes(session.step)) {
            userSessions.set(uid, { ...session, interruptedTo: targetField });
            return ctx.reply(`⚠️ လူကြီးမင်းတွင် ဝယ်ယူလက်စ လုပ်ငန်းစဉ်တစ်ခု ရှိနေပါသေးသည်ဗျာ။ ယခုလုပ်ငန်းစဉ်ကို ဖျက်သိမ်းပြီး Menu သို့သွားမလား သို့မဟုတ် အော်ဒါဆက်တင်မလားဗျာ?`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('❌ လုပ်ငန်းစဉ်ဖျက်မည်', 'int_cancel')],
                    [Markup.button.callback('🎮 အော်ဒါဆက်တင်မည်', 'int_continue')]
                ])
            );
        }
    } catch (e) { console.error(e); }
    return nextFunc();
}

function setSessionTimeout(uid) {
    const session = userSessions.get(uid);
    if (session && session.timeoutRef) clearTimeout(session.timeoutRef);
    const timeoutRef = setTimeout(() => {
        const current = userSessions.get(uid);
        if (current && current.step && current.step !== 'COMPLETED') {
            userSessions.delete(uid);
            bot.telegram.sendMessage(uid, '⏳ လူကြီးမင်းသည် အချိန်ကြာမြင့်စွာ တုံ့ပြန်မှုမရှိသဖြင့် ဝယ်ယူမှုလုပ်ငန်းစဉ်အား စနစ်မှ Auto ဖျက်သိမ်းလိုက်ပါပြီဗျာ။').catch(()=>{});
        }
    }, 15 * 60 * 1000); 
    return timeoutRef;
}

// ==========================================
// 5. USER COMMANDS & INTERACTIONS
// ==========================================
bot.start(checkForcedJoinAndShop, async (ctx) => {
    try {
        const uid = ctx.from.id.toString(); 
        userSessions.delete(uid);
        let user = await User.findOne({ telegramId: uid });
        if (!user) {
            let rId = (ctx.startPayload && ctx.startPayload.startsWith('ref_')) ? ctx.startPayload.replace('ref_', '') : null;
            user = await User.create({ telegramId: uid, username: ctx.from.username, name: ctx.from.first_name, referredBy: rId });
        }
        ctx.reply(`✨ Aura Digital Premium Top-Up Bot မှ နွေးထွေးစွာ ကြိုဆိုပါတယ်ဗျာ။`, getMainMenu(ctx));
    } catch(e) { console.error(e); }
});

bot.hears('🎮 မိတ်ဆွေဖျော်ဖြေရေး (Top-Up Store)', checkForcedJoinAndShop, (ctx) => {
    handleMenuInterruption(ctx, 'STORE', async () => {
        try {
            let shop = await Shop.findOne() || await Shop.create({});
            const kb = Object.keys(ITEM_NAMES).map(k => [Markup.button.callback(`🔹 ${ITEM_NAMES[k]} - ${(shop.prices.get(k) || 0).toLocaleString()} Ks`, `buy_${k}`)]);
            kb.push([Markup.button.callback('❌ ဖျက်သိမ်းမည်', 'cancel_flow')]);
            ctx.reply('💎 စိန်နှင့် ပရီမီယံ ပစ္စည်းစာရင်းများ -', Markup.inlineKeyboard(kb));
        } catch(e) { console.error(e); }
    });
});

bot.hears('🎁 Daily Check-In', checkForcedJoinAndShop, (ctx) => {
    handleMenuInterruption(ctx, 'CHECKIN', async () => {
        try {
            const uid = ctx.from.id.toString();
            const user = await User.findOne({ telegramId: uid });
            const now = new Date();
            if (user.lastCheckIn && now.toDateString() === user.lastCheckIn.toDateString()) {
                return ctx.reply('⚠️ လူကြီးမင်း ယနေ့အတွက် Daily Check-In ရယူပြီးပါပြီဗျာ။ မနက်ဖြန်မှ ထပ်မံရယူပေးပါ။');
            }
            await User.findOneAndUpdate({ telegramId: uid }, { $inc: { points: 20 }, $set: { lastCheckIn: now } });
            ctx.reply('🎉 နေ့စဉ် Check-In ဝင်ရောက်မှု အောင်မြင်ပြီး မေတ္တာလက်ဆောင် +20 Points ရရှိပါပြီဗျာ။');
        } catch(e) { console.error(e); }
    });
});

bot.hears('💰 My Points & Coupons', checkForcedJoinAndShop, (ctx) => {
    handleMenuInterruption(ctx, 'POINTS', async () => {
        try {
            const uid = ctx.from.id.toString(); 
            const user = await User.findOne({ telegramId: uid });
            const botUser = BOT_USERNAME; 
            let msg = `💰 *Aura Digital - လူကြီးမင်း၏ အမှတ်စာရင်း* 💰\n\n` +
                      `🎯 လက်ရှိအမှတ်: *${user.points.toLocaleString()} Points*\n` +
                      `🎟️ လက်ဝယ်ရှိကူပွန်: *${user.couponsCount || 0} ရွက်*\n\n` +
                      `👉 ကိုယ်ပိုင် ဖိတ်ခေါ်ခြင်း Link: \`t.me/${botUser}?start=ref_${uid}\` \n\n` +
                      `🎟️ ပရိုမိုးရှင်းကုဒ် (Promo Code) ရှိပါက အောက်ကခလုတ်ကိုနှိပ်ပြီး ကံစမ်းနိုင်ပါတယ်ဗျာ။`;
            
            // ✅ (ERROR FIXED နေရာ) - Keyboard ဖွင့်/ပိတ် မှားယွင်းမှု
            ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
                [Markup.button.callback('🎟️ Promo Code ရိုက်ထည့်မည်', 'ent_promo')],
                [Markup.button.callback('🎟️ 3%/5% Coupon လဲမည် (-5000 Pts)', 'claim_coupon')]
            ])});
        } catch(e) { console.error(e); }
    });
});

bot.hears('📜 ဝယ်ယူမှုမှတ်တမ်း', checkForcedJoinAndShop, (ctx) => {
    handleMenuInterruption(ctx, 'HISTORY', async () => {
        try {
            const uid = ctx.from.id.toString();
            const orders = await Order.find({ telegramId: uid }).sort({ createdAt: -1 }).limit(5);
            if (orders.length === 0) return ctx.reply('⚠️ လူကြီးမင်းထံတွင် ဝယ်ယူထားသော မှတ်တမ်းမရှိသေးပါဗျာ။');

            let msg = `📜 *လူကြီးမင်း၏ နောက်ဆုံး ဝယ်ယူမှုမှတ်တမ်း (၅) ခု*\n\n`;
            orders.forEach((o, i) => {
                const emoji = o.status === 'Success' ? '✅' : (o.status === 'Cancelled' ? '❌' : '⏳');
                msg += `${i + 1}. #${o.orderId} - *${o.itemName}*\n   💰 ကျသင့်ငွေ: ${o.price} Ks\n   📊 အခြေအနေ: ${emoji} *${o.status}*\n\n`;
            });
            ctx.reply(msg, { parse_mode: 'Markdown' });
        } catch(e) { console.error(e); }
    });
});

bot.hears('💡 အသုံးပြုပုံလမ်းညွှန်', checkForcedJoinAndShop, (ctx) => {
    handleMenuInterruption(ctx, 'GUIDE', () => {
        try {
            ctx.replyWithMarkdown(`💡 *Aura Digital - လမ်းညွှန်ချက်များ*\n\n` +
                                  `၁။ *စိန်ဖြည့်နည်း:* Store ထဲဝင်ပြီး ပစ္စည်းရွေး၊ MLBB ID ရိုက်ထည့်ကာ ငွေလွှဲပြေစာ ပို့ပေးရုံဖြင့် ရပါပြီ။\n` +
                                  `၂။ *ကူပွန်စနစ်:* ဝယ်ယူမှုတိုင်းမှ ရလာသော Point ၅,၀၀၀ ပြည့်လျှင် ကူပွန်လဲနိုင်ပြီး၊ ၎င်းကူပွန်ကို ဝယ်ယူချိန်တွင် မိမိစိတ်ကြိုက် အသုံးပြုနိုင်ပါသည်။\n` +
                                  `၃။ *အခမဲ့စိန်ရယူနည်း:* My Points ထဲရှိ Referral link အား သူငယ်ချင်းများထံ မျှဝေပြီး သူတို့ဝယ်ယူတိုင်း အမှတ်များ အလကား စုဆောင်းနိုင်ပါသည်။`);
        } catch (e) { console.error(e); }
    });
});

bot.hears('📞 Contact Admin', (ctx) => ctx.reply(`👨‍💻 Aura Digital တာဝန်ခံ Admin Account: ${ADMIN_USERNAME}`));
// ==========================================
// 6. CALLBACK HANDLERS (SYSTEM FLOWS)
// ==========================================
bot.action(/^buy_(.+)$/, checkForcedJoinAndShop, async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const k = ctx.match[1]; 
        let shop = await Shop.findOne() || await Shop.create({});
        const uid = ctx.from.id.toString();
        const user = await User.findOne({ telegramId: uid });

        const session = {
            itemKey: k, itemName: ITEM_NAMES[k], basePrice: shop.prices.get(k), costPrice: shop.costs.get(k),
            step: 'AWAITING_ID_OPTION', timeoutRef: null
        };
        session.timeoutRef = setSessionTimeout(uid);
        userSessions.set(uid, session);

        if (user.savedGameId) {
            ctx.reply(`🎮 ${ITEM_NAMES[k]} အတွက် မည်သည့် ID သို့ ထည့်သွင်းရမည်နည်းဗျာ?`, Markup.inlineKeyboard([
                [Markup.button.callback(`👤 အကောင့်ဟောင်း (${user.savedGameId})`, 'id_use_saved')],
                [Markup.button.callback('🎁 အခြားသူအား လက်ဆောင်ပေးမည် (Gift)', 'id_use_gift')],
                [Markup.button.callback('❌ ဖျက်သိမ်းမည်', 'cancel_flow')]
            ]));
        } else {
            userSessions.set(uid, { ...session, step: 'AWAITING_NEW_ID', isGift: false });
            ctx.reply(`🎯 ${ITEM_NAMES[k]} အတွက် MLBB User ID (Zone ID) ကို ရိုက်ပို့ပေးပါဗျာ။\nဥပမာ - 166049831(2851)`, Markup.inlineKeyboard([[Markup.button.callback('❌ ဖျက်သိမ်းမည်', 'cancel_flow')]]));
        }
    } catch(e) { console.error(e); }
});

bot.action('id_use_saved', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const uid = ctx.from.id.toString(); const session = userSessions.get(uid); if (!session) return;
        const user = await User.findOne({ telegramId: uid });
        session.gameId = user.savedGameId; session.isGift = false;
        userSessions.set(uid, session);
        askCouponUsage(ctx, uid, session);
    } catch(e) { console.error(e); }
});

bot.action('id_use_gift', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const uid = ctx.from.id.toString(); const session = userSessions.get(uid); if (!session) return;
        session.step = 'AWAITING_NEW_ID'; session.isGift = true;
        userSessions.set(uid, session);
        ctx.reply('🎁 လက်ဆောင်ပေးမည့်သူ၏ MLBB User ID (Zone ID) ကို ရိုက်ပို့ပေးပါဗျာ။', Markup.inlineKeyboard([[Markup.button.callback('❌ ဖျက်သိမ်းမည်', 'cancel_flow')]]));
    } catch(e) { console.error(e); }
});

function askCouponUsage(ctx, uid, session) {
    User.findOne({ telegramId: uid }).then(user => {
        const allowedType = ITEM_COUPONS[session.itemKey];
        if (user && user.couponsCount > 0) {
            ctx.reply(`🎟️ လူကြီးမင်းထံတွင် ကူပွန်ရှိနေပါသည်။ ယခု Item သည် အမြတ်တွက်ချက်မှုအရ [${allowedType} Coupon] အသုံးပြုခွင့်ရှိပါသည်။ အသုံးပြုပြီး ဈေးလျှော့မလားဗျာ?`, Markup.inlineKeyboard([
                [Markup.button.callback(`✅ ${allowedType} Discount သုံးမည်`, 'coupon_yes')],
                [Markup.button.callback('❌ မသုံးပါ၊ ပုံမှန်အတိုင်းဝယ်မည်', 'coupon_no')],
                [Markup.button.callback('❌ ဖျက်သိမ်းမည်', 'cancel_flow')]
            ]));
        } else {
            goToPaymentSelection(ctx, uid, session, false);
        }
    }).catch(e => console.error(e));
}

bot.action('coupon_yes', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const uid = ctx.from.id.toString(); const session = userSessions.get(uid); if (!session) return;
        const pct = ITEM_COUPONS[session.itemKey] === '5%' ? 0.05 : 0.03;
        session.finalPrice = Math.floor(session.basePrice * (1 - pct));
        session.usedCoupon = true;
        userSessions.set(uid, session);
        goToPaymentSelection(ctx, uid, session, true);
    } catch(e) { console.error(e); }
});

bot.action('coupon_no', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const uid = ctx.from.id.toString(); const session = userSessions.get(uid); if (!session) return;
        session.finalPrice = session.basePrice; session.usedCoupon = false;
        userSessions.set(uid, session);
        goToPaymentSelection(ctx, uid, session, false);
    } catch(e) { console.error(e); }
});

function goToPaymentSelection(ctx, uid, session, hasDiscount) {
    if (!session.finalPrice) session.finalPrice = session.basePrice;
    userSessions.set(uid, session);
    ctx.reply(`💵 ကျသင့်ငွေစာရင်း: *${session.finalPrice.toLocaleString()} Ks* ${hasDiscount ? '(ကူပွန်နှုတ်ပြီး)' : ''}\n\nကျေးဇူးပြု၍ Ngwe ပေးချေမည့် စနစ်အား ရွေးချယ်ပေးပါဗျာ။`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🟢 KBZPay ဖြင့်ပေးချေမည်', 'pay_kpay'), Markup.button.callback('🟢 WaveMoney ဖြင့်ပေးချေမည်', 'pay_wave')],
            [Markup.button.callback('❌ ဖျက်သိမ်းမည်', 'cancel_flow')]
        ])
    });
}

bot.action(/^pay_(kpay|wave)$/, async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const uid = ctx.from.id.toString(); const session = userSessions.get(uid); if (!session) return;
        const method = ctx.match[1];
        session.paymentMethod = method; session.step = 'AWAITING_RECEIPT';
        userSessions.set(uid, session);

        let shop = await Shop.findOne() || await Shop.create({});
        if (method === 'kpay') {
            const txt = `💵 *KBZPay ဖြင့် ငွေပေးချေခြင်း* 💵\n\n💰 လွှဲရမည့်ပမာဏ: *${session.finalPrice.toLocaleString()} Ks*\n📱 နံပါတ်: \`${shop.kpayNumber}\`\n👤 အမည်: *${shop.kpayName}*\n\nငွေလွှဲပြီးပါက ပြေစာ (Screenshot) အား ဤနေရာသို့ ပို့ပေးပါဗျာ။`;
            if (shop.kpayQrId) await ctx.replyWithPhoto(shop.kpayQrId, { caption: txt, parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ ဖျက်သိမ်းမည်', 'cancel_flow')]]) });
            else await ctx.replyWithMarkdown(txt, Markup.inlineKeyboard([[Markup.button.callback('❌ ဖျက်သိမ်းမည်', 'cancel_flow')]]));
        } else {
            const txt = `💵 *WaveMoney ဖြင့် ငွေလွှဲခြင်း* 💵\n\n💰 လွှဲရမည့်ပမာဏ: *${session.finalPrice.toLocaleString()} Ks*\n📱 နံပါတ်: \`${shop.waveNumber}\`\n👤 အမည်: *${shop.waveName}*\n\nငွေလွှဲပြီးပါက ပြေစာ (Screenshot) အား ဤနေရာသို့ ပို့ပေးပါဗျာ။`;
            if (shop.waveQrId) await ctx.replyWithPhoto(shop.waveQrId, { caption: txt, parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ ဖျက်သိမ်းမည်', 'cancel_flow')]]) });
            else await ctx.replyWithMarkdown(txt, Markup.inlineKeyboard([[Markup.button.callback('❌ ဖျက်သိမ်းမည်', 'cancel_flow')]]));
        }
    } catch(e) { console.error(e); }
});

bot.action('cancel_flow', async (ctx) => {
    try { await ctx.answerCbQuery('❌ ဖျက်သိမ်းပြီးပါပြီ'); userSessions.delete(ctx.from.id.toString()); ctx.editMessageText('❌ ယခုဝယ်ယူမှု လုပ်ငန်းစဉ်အား အောင်မြင်စွာ ဖျက်သိမ်းလိုက်ပါပြီဗျာ။'); } catch(e) {}
});

bot.action('int_cancel', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const uid = ctx.from.id.toString();
        userSessions.delete(uid);
        await ctx.editMessageText('❌ ယခင်လုပ်ငန်းစဉ်ဟောင်းအား ဖျက်သိမ်းလိုက်ပါပြီ။');
        ctx.reply('🔄 စာမျက်နှာကို ပြန်လည်ဖွင့်လှစ်ပေးနေပါသည်...', getMainMenu(ctx));
    } catch(e){}
});

bot.action('int_continue', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const uid = ctx.from.id.toString(); const session = userSessions.get(uid); if (!session) return;
        delete session.interruptedTo; userSessions.set(uid, session);
        await ctx.editMessageText('🎮 လုပ်ငန်းစဉ် ဆက်လက်လုပ်ဆောင်နေပါသည်။');
        if (session.step === 'AWAITING_RECEIPT') ctx.reply('👉 ဆက်လက်ပြီး ငွေလွှဲပြေစာ (Receipt Screenshot) ကို ပို့ပေးပါဦးဗျာ။');
        else if (session.step === 'AWAITING_NEW_ID') ctx.reply('👉 ဆက်လက်ပြီး MLBB User ID ကို ရိုက်ပို့ပေးပါဦးဗျာ။');
    } catch(e){}
});

bot.action('claim_coupon', async (ctx) => {
    try {
        const uid = ctx.from.id.toString(); const user = await User.findOne({ telegramId: uid });
        if (user.points < 5000) return ctx.answerCbQuery('⚠️ Points ၅,၀၀၀ မပြည့်သေးပါဗျာ။', { show_alert: true });
        await User.findOneAndUpdate({ telegramId: uid }, { $inc: { points: -5000, couponsCount: 1 } });
        await ctx.answerCbQuery('🎉 Coupon ရရှိပါပြီ။');
        ctx.reply('🎟️ Point ၅,၀၀၀ အား ကူပွန် ၁ ရွက်အဖြစ် အောင်မြင်စွာ လဲလှယ်ပြီးပါပြီဗျာ။ ဝယ်ယူချိန်တွင် သုံးနိုင်ပါပြီ။');
    } catch(e) {}
});

bot.action('ent_promo', async (ctx) => {
    try { await ctx.answerCbQuery(); userPromoState.set(ctx.from.id.toString(), { step: 'USER_PROMO_INPUT' }); ctx.reply('🎟️ လူကြီးမင်းထံရှိသော ပရိုမိုးရှင်းကုဒ် (Promo Code) အား စာလုံးအကြီးဖြင့် ရိုက်ပို့ပေးပါဗျာ။'); } catch(e) {}
});

// ==========================================
// 7. PHOTO & FILE CAPTURE HANDLERS
// ==========================================
bot.on('photo', checkForcedJoinAndShop, async (ctx) => {
    try {
        const uid = ctx.from.id.toString();
        const aState = adminState.get(uid);
        
        if (isAdmin(ctx) && aState && aState.step === 'AWAITING_QR_PHOTO') {
            aState.photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            aState.step = 'CONFIRM_PAYMENT_SETUP';
            adminState.set(uid, aState);
            return ctx.reply(`⚠️ *ပြင်ဆင်ချက်အချက်အလက်အသစ်အား အတည်ပြုပါ*\n\n📱 စနစ်: ${aState.method.toUpperCase()}\n📱 နံပါတ်: ${aState.number}\n👤 အမည်: ${aState.name}\n\nဤအချက်အလက်အသစ်များကို လုံးဝ အစားထိုးသိမ်းဆည်းမှာ သေချာပါသလားဗျာ?`,
                Markup.inlineKeyboard([[Markup.button.callback('✅ သေချာသည်', 'cfg_pay_save'), Markup.button.callback('❌ ပယ်ဖျက်သည်', 'cfg_pay_cancel')]])
            );
        }

        const session = userSessions.get(uid);
        if (!session) return;

        if (session.step === 'AWAITING_BALANCE_RECEIPT') {
            const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            await Order.findOneAndUpdate({ orderId: session.targetOrderId }, { status: 'Pending', balanceReceiptFileId: fileId });
            userSessions.delete(uid); ctx.reply(`🎉 လက်ကျန်ငွေပြေစာအား လက်ခံရရှိပါပြီ။ Admin စစ်ဆေးမှုကို စောင့်ဆိုင်းပေးပါဗျာ။`);
            
            const o = await Order.findOne({ orderId: session.targetOrderId });
            const details = `🚨 *<b>လက်ကျန်ငွေ ထပ်မံပေးသွင်းလာသော အော်ဒါ</b>* 🚨\n\nID: *#${o.orderId}*\nဂိမ်း ID: \`${o.gameId}\`\n💵 မူလလွှဲငွေ + လက်ကျန်လွှဲငွေ: *${(o.price - o.pendingBalance).toLocaleString()} + ${o.pendingBalance.toLocaleString()} = ${o.price.toLocaleString()} Ks*\n\n(အောက်ပါပုံသည် ဒုတိယအကြိမ် ပို့လာသော လက်ကျန်ပြေစာပုံ ဖြစ်သည်)`;
            bot.telegram.sendPhoto(ADMIN_CHAT_ID, fileId, {
                caption: details, parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([[Markup.button.callback('✅ Confirm', `acnf_${o.orderId}`), Markup.button.callback('❌ Cancel Options', `acxl_opt_${o.orderId}`)]])
            });
            return;
        }

        if (session.step === 'AWAITING_RECEIPT') {
            if (session.timeoutRef) clearTimeout(session.timeoutRef);
            const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            const oid = 'AD' + Math.floor(1000 + Math.random() * 9000);
            
            await Order.create({
                orderId: oid, telegramId: uid, itemName: session.itemName, itemKey: session.itemKey,
                gameId: session.gameId, price: session.finalPrice, cost: session.costPrice,
                paymentMethod: session.paymentMethod, usedCoupon: !!session.usedCoupon, isGift: !!session.isGift,
                receiptFileId: fileId
            });

            if (!session.isGift) await User.findOneAndUpdate({ telegramId: uid }, { savedGameId: session.gameId });

            userSessions.set(uid, { step: 'COMPLETED' });
            ctx.reply(`🎉 ပြေစာရရှိပါပြီ။ အော်ဒါအမှတ် #${oid} အား စစ်ဆေးပေးသွင်းနေပြီဖြစ်၍ ခေတ္တစောင့်ဆိုင်းပေးပါဗျာ။`);

            const details = `🚨 *အော်ဒါအသစ် တက်လာပါသည်* 🚨\n\nအော်ဒါနံပါတ်: *#${oid}*\nဝယ်ယူသူ: [${ctx.from.first_name}](tg://user?id=${uid})\nပစ္စည်း: *${session.itemName}*\nဂိမ်း ID: \`${session.gameId}\`\n💵 လွှဲငွေ: *${session.finalPrice.toLocaleString()} Ks* (${session.paymentMethod.toUpperCase()})`;
            bot.telegram.sendPhoto(ADMIN_CHAT_ID, fileId, {
                caption: details, parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([[Markup.button.callback('✅ Confirm', `acnf_${oid}`), Markup.button.callback('❌ Cancel Options', `acxl_opt_${oid}`)]])
            });
        }
    } catch(e) { console.error(e); }
});

// ==========================================
// 8. TEXT INPUT ENGINE & TEXT EVENT ROUTER
// ==========================================
bot.on('text', checkForcedJoinAndShop, async (ctx, next) => {
    try {
        const input = ctx.message.text.trim();
        const uid = ctx.from.id.toString();
        const aState = adminState.get(uid);
        const pState = userPromoState.get(uid);

        if (isAdmin(ctx) && aState) {
            if (aState.step === 'CFG_PAY_NUM') { aState.number = input; aState.step = 'CFG_PAY_NAME'; adminState.set(uid, aState); return ctx.reply('⚙️ အကောင့်အမည် (Account Name) ကို ရိုက်ပို့ပေးပါဗျာ။'); }
            if (aState.step === 'CFG_PAY_NAME') { aState.name = input; aState.step = 'AWAITING_QR_PHOTO'; adminState.set(uid, aState); return ctx.reply('⚙️ နောက်ဆုံးအဆင့်အနေဖြင့် အသုံးပြုမည့် QR Code ဓာတ်ပုံအား ပို့ပေးပါဗျာ။'); }
            if (aState.step === 'PRICE_NEW_AMT') { aState.price = parseInt(input); aState.step = 'COST_NEW_AMT'; adminState.set(uid, aState); return ctx.reply('⚙️ ရောင်းဈေး သိမ်းဆည်းပြီးပါပြီ။ ဆက်လက်ပြီး ရင်းဈေး (Cost) ကို ဂဏန်းသီးသန့် ရိုက်ပို့ပေးပါဗျာ။'); }
            if (aState.step === 'COST_NEW_AMT') {
                let s = await Shop.findOne() || await Shop.create({});
                s.prices.set(aState.key, aState.price); s.costs.set(aState.key, parseInt(input));
                await s.save(); ctx.reply('✅ ဈေးနှုန်းနှင့် ရင်းဈေး ပြင်ဆင်မှု အောင်မြင်ပါသည်။', adminMenu); adminState.delete(uid); return;
            }
            if (aState.step === 'REQ_BALANCE_AMT') {
                const balance = parseInt(input); const oid = aState.targetOid;
                const o = await Order.findOneAndUpdate({ orderId: oid }, { status: 'Awaiting_Balance', pendingBalance: balance });
                adminState.delete(uid); ctx.reply('✅ User ထံ လက်ကျန်ငွေတောင်းခံစာ ပို့လိုက်ပါပြီ။');
                bot.telegram.sendMessage(o.telegramId, `⚠️ အော်ဒါ #${oid} အတွက် လူကြီးမင်းလွှဲအပ်ထားသော Ngwe ပမာဏ မပြည့်စုံပါသဖြင့် လက်ကျန်ငွေ *${balance.toLocaleString()} Ks* အား ထပ်မံလွှဲပေးရန် လိုအပ်ပါသည်ဗျာ။`, {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([[Markup.button.callback('💵 လက်ကျန်ငွေလွှဲပြေစာ ပို့မည်', `send_bal_${oid}`)], [Markup.button.callback('❌ ဤအော်ဒါအား ဖျက်သိမ်းမည်', `user_cancel_order_${oid}`)]])
                }).catch(()=>{}); return;
            }
            if (aState.step === 'PROMO_CODE') { aState.code = input.toUpperCase(); aState.step = 'PROMO_POINTS'; adminState.set(uid, aState); return ctx.reply('🎟️ ယခု Promo Code တွင် ထည့်သွင်းမည့် စုစုပေါင်း Pool Points ပမာကို ရိုက်ထည့်ပါ (ဥပမာ - 50000)။'); }
            if (aState.step === 'PROMO_POINTS') {
                await Shop.findOneAndUpdate({}, { promo: { code: aState.code, poolPoints: parseInt(input), expiry: new Date(Date.now() + 7*24*60*60*1000), claimedUsers: [] } });
                ctx.reply(`✅ Promo Code [ ${aState.code} ] အား Points ${input} ဖြင့် အောင်မြင်စွာ ဖန်တီးလိုက်ပါပြီဗျာ။`, adminMenu); adminState.delete(uid); return;
            }
        }

        if (pState) {
            if (pState.step === 'USER_PROMO_INPUT') {
                let shop = await Shop.findOne() || await Shop.create({});
                if (!shop.promo || shop.promo.code !== input.toUpperCase()) return ctx.reply('❌ ဤပရိုမိုးရှင်းကုဒ် မှားယွင်းနေပါသည်ဗျာ။');
                if (shop.promo.claimedUsers.includes(uid)) return ctx.reply('⚠️ လူကြီးမင်းသည် ယခုပရိုမိုးရှင်းတွင် ပါဝင်ပြီးဖြစ်ပါသည်ဗျာ။');
                if (shop.promo.poolPoints <= 50) return ctx.reply('⚠️ စိတ်မကောင်းပါဘူးဗျာ၊ ယခု Promo Code ၏ Point Pool ကုန်ဆုံးသွားပါပြီ။');
                
                let wonPoints = Math.floor(50 + Math.random() * 151);
                await Shop.findOneAndUpdate({}, { $inc: { "promo.poolPoints": -wonPoints }, $push: { "promo.claimedUsers": uid } });
                await User.findOneAndUpdate({ telegramId: uid }, { $inc: { points: wonPoints } });
                ctx.reply(`🎉 ဂုဏ်ယူပါတယ်ဗျာ။ Promo Code ကုဒ်မှတစ်ဆင့် Point +${wonPoints} Points ရရှိပါပြီ။`);
                userPromoState.delete(uid); return;
            }
            if (pState.step === 'USER_RETRY_ID_VAL') {
                const oid = pState.targetOid;
                const o = await Order.findOneAndUpdate({ orderId: oid }, { status: 'Pending', gameId: input });
                userPromoState.delete(uid); ctx.reply('✅ ဂိမ်း ID အား ပြန်လည်ပြင်ဆင်ပြီးပါပြီ။ စစ်ဆေးပေးသွင်းမှုကို စောင့်ဆိုင်းပေးပါဗျာ။');
                
                const details = `🚨 *ဂိမ်း ID ပြန်လည်ပြင်ဆင်လာသော အော်ဒါ* 🚨\n\nID: *#${o.orderId}*\nဂိမ်း ID အသစ်: \`${input}\`\n💵 လွှဲငွေ: *${o.price.toLocaleString()} Ks*`;
                bot.telegram.sendPhoto(ADMIN_CHAT_ID, o.receiptFileId, { caption: details, parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('✅ Confirm', `acnf_${o.orderId}`), Markup.button.callback('❌ Cancel Options', `acxl_opt_${o.orderId}`)]]) });
                return;
            }
        }

        const session = userSessions.get(uid);
        if (session && session.step === 'AWAITING_NEW_ID') {
            session.gameId = input; userSessions.set(uid, session);
            return askCouponUsage(ctx, uid, session);
        }
    } catch(e) { console.error(e); }
    return next(); 
});
// ==========================================
// 9. ADMIN PANEL CALL FUNCTIONS
// ==========================================
bot.hears('📊 Dashboard (စာရင်းချုပ်)', async (ctx) => {
    if (!isAdmin(ctx)) return;
    try {
        let s = await Shop.findOne() || await Shop.create({});
        const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
        const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);

        const todayOrders = await Order.find({ status: 'Success', createdAt: { $gte: startOfToday } });
        const monthOrders = await Order.find({ status: 'Success', createdAt: { $gte: startOfMonth } });

        let dRev = todayOrders.reduce((acc, o) => acc + o.price, 0);
        let dProf = todayOrders.reduce((acc, o) => acc + (o.price - (o.cost || 0)), 0);
        let mRev = monthOrders.reduce((acc, o) => acc + o.price, 0);
        let mProf = monthOrders.reduce((acc, o) => acc + (o.price - (o.cost || 0)), 0);

        ctx.replyWithMarkdown(`📊 *AURA DIGITAL - ADVANCED DASHBOARD*\n\n` +
            `📅 *ယနေ့ စာရင်းချုပ်:*\n  • အော်ဒါအရေအတွက်: *${todayOrders.length} ခု*\n  • ရောင်းရငွေ: *${dRev.toLocaleString()} Ks*\n  • အသားတင်အမြတ်: *${dProf.toLocaleString()} Ks*\n\n` +
            `🗓️ *ယခုလ စာရင်းချုပ်:*\n  • အော်ဒါအရေအတွက်: *${monthOrders.length} ခု*\n  • ရောင်းရငွေ: *${mRev.toLocaleString()} Ks*\n  • အသားတင်အမြတ်: *${mProf.toLocaleString()} Ks*\n\n` +
            `Total Orders: *${s.totalOrders || 0}* | Total Profit: *${(s.totalProfit || 0).toLocaleString()} Ks*`);
    } catch(e) { console.error(e); }
});

bot.hears('🏪 ဆိုင် ဖွင့်/ပိတ် Panel', async (ctx) => {
    if (!isAdmin(ctx)) return;
    let s = await Shop.findOne() || await Shop.create({});
    ctx.reply(`🏪 လက်ရှိဆိုင်အခြေအနေ: ${s.shopOpen ? '🟢 ဖွင့်ထားသည်' : '🔴 ပိတ်ထားသည်'}`, Markup.inlineKeyboard([[Markup.button.callback('🟢 ဖွင့်မည်', 'shop_open'), Markup.button.callback('🔴 ပိတ်မည်', 'shop_close')]]));
});

bot.hears('💰 လက်ရှိဈေးနှုန်းများကြည့်ရန်', async (ctx) => {
    if (!isAdmin(ctx)) return;
    let s = await Shop.findOne() || await Shop.create({});
    let msg = `💰 *လက်ရှိ သတ်မှတ်ထားသော စျေးနှုန်းဇယား*\n\n`;
    Object.keys(ITEM_NAMES).forEach(k => { msg += `• *${ITEM_NAMES[k]}*\n  ရောင်းဈေး: ${s.prices.get(k) || 0} Ks | ရင်းဈေး: ${s.costs.get(k) || 0} Ks\n\n`; });
    const kb = Object.keys(ITEM_NAMES).map(k => [Markup.button.callback(`⚙️ ပြင်မည် - ${ITEM_NAMES[k]}`, `eprc_${k}`)]);
    ctx.reply(msg, Markup.inlineKeyboard(kb));
});

bot.hears('⚙️ အချက်အလက်များ ပြင်ရန်', (ctx) => {
    if (!isAdmin(ctx)) return;
    ctx.reply('⚙️ ပြင်ဆင်လိုသည့် Ngwe ပေးချေမှုစနစ် အချက်အလက်ကို ရွေးချယ်ပါဗျာ -', Markup.inlineKeyboard([
        [Markup.button.callback('⚙️ KBZPay အချက်အလက်ပြင်မည်', 'cfg_pay_kpay')],
        [Markup.button.callback('⚙️ WaveMoney အချက်အလက်ပြင်မည်', 'cfg_pay_wave')]
    ]));
});
bot.hears('🎟️ Promo Code ထုတ်ရန်', (ctx) => {
    if (!isAdmin(ctx)) return;
    adminState.set(ctx.from.id.toString(), { step: 'PROMO_CODE' });
    ctx.reply('🎟️ အသုံးပြုမည့် ပရိုမိုးရှင်းကုဒ် (Promo Code) အား စာလုံးအကြီးဖြင့် ရိုက်ထည့်ပေးပါ (ဥပမာ - AURA500)။');
});

bot.hears('⚙️ Promo Code စီမံရန်', async (ctx) => {
    if (!isAdmin(ctx)) return;
    let s = await Shop.findOne() || await Shop.create({});
    if (!s.promo || !s.promo.code) return ctx.reply('⚠️ စနစ်ထဲတွင် လက်ရှိဖွင့်ထားသော Promo Code မရှိသေးပါဗျာ။');
    ctx.reply(`🎟️ *လက်ရှိ Promo Code အခြေအနေ*\n\nကုဒ်အမည်: ${s.promo.code}\n` + 
              `လက်ကျန် Points: ${s.promo.poolPoints}\n` +
              `ပါဝင်ပြီးသူ: ${s.promo.claimedUsers.length} ယောက်`, 
        Markup.inlineKeyboard([[Markup.button.callback('❌ ကုဒ်အား ဖျက်သိမ်းမည်', 'del_promo')]]));
});

bot.hears('🔍 မေ့ကျန်ခဲ့သော အော်ဒါများစစ်ရန်', async (ctx) => {
    if (!isAdmin(ctx)) return;
    try {
        const pendings = await Order.find({ status: 'Pending' });
        if (pendings.length === 0) return ctx.reply('✅ ခလုတ်မနှိပ်ရသေးဘဲ ကျန်နေသော Pending Order လုံးဝမရှိပါဗျာ။');
        ctx.reply(`🔍 မေ့ကျန်နေသော အော်ဒါစုစုပေါင်း: *${pendings.length} ခု* တွေ့ရှိရပါသည်။`);
        for(let o of pendings) {
            const txt = `📋 *ကျန်ခဲ့သော အော်ဒါနံပါတ်: #${o.orderId}*\nပစ္စည်း: ${o.itemName}\nID: \`${o.gameId}\`\n💵 လွှဲငွေ: ${o.price.toLocaleString()} Ks (${o.paymentMethod})`;
            await ctx.replyWithPhoto(o.receiptFileId, { caption: txt, parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('✅ Confirm', `acnf_${o.orderId}`), Markup.button.callback('❌ Cancel Options', `acxl_opt_${o.orderId}`)]]) }).catch(()=>{});
        }
    } catch(e) { console.error(e); }
});

// ==========================================
// 10. INTERACTIVE ADMIN ORDER OPERATIONS
// ==========================================
bot.action(/^acnf_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    try {
        await ctx.answerCbQuery();
        const oid = ctx.match[1]; 
        const o = await Order.findOneAndUpdate({ orderId: oid, status: { $in: ['Pending', 'Awaiting_Balance'] } }, { status: 'Success' });
        if (!o) return ctx.reply('⚠️ အော်ဒါမရှိတော့ပါ သို့မဟုတ် အောင်မြင်ပြီးသားဖြစ်သည်။');

        const profit = Math.max(0, o.price - (o.cost || 0));
        await Shop.findOneAndUpdate({}, { $inc: { totalOrders: 1, totalRevenue: o.price, totalProfit: profit } });
        
        const baseRewardPoints = Math.floor(o.price / 10);
        const user = await User.findOneAndUpdate({ telegramId: o.telegramId }, { $inc: { totalSpent: o.price, points: baseRewardPoints }, $set: { hasPurchased: true } });
        
        if (o.usedCoupon) await User.findOneAndUpdate({ telegramId: o.telegramId }, { $inc: { couponsCount: -1 } });

        if (user && user.referredBy) {
            const isFirst = !user.hasPurchased;
            const refPct = isFirst ? 0.10 : 0.01;
            const refBonus = Math.floor(o.price * refPct);
            await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { points: refBonus } });
            bot.telegram.sendMessage(user.referredBy, `🔔 လူကြီးမင်း ဖိတ်ခေါ်ထားသော သူငယ်ချင်း (${user.name}) ၏ ဝယ်ယူမှုကြောင့် ပရိုမိုးရှင်းအမှတ် +${refBonus} Points လက်ခံရရှိပါသည်ဗျာ။`).catch(()=>{});
        }

        await ctx.editMessageCaption(`✅ အောင်မြင်စွာ ဖြည့်သွင်းပြီးပါပြီ။\nအမြတ်: +${profit} Ks`).catch(() => {});
        bot.telegram.sendMessage(o.telegramId, `⚡ လူကြီးမင်း၏ အော်ဒါ #${oid} (${o.itemName}) အား အောင်မြင်စွာ ဖြည့်သွင်းပေးပြီးပါပြီဗျာ။ ကျေးဇူးတင်ပါတယ်!`);
    } catch(e) { console.error(e); }
});

bot.action(/^acxl_opt_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    try {
        await ctx.answerCbQuery();
        const oid = ctx.match[1];
        ctx.editMessageReplyMarkup({
            inline_keyboard: [
                [Markup.button.callback('❌ ပြေစာမှားယွင်းမှု တောင်းရန်', `cxr_receipt_${oid}`)],
                [Markup.button.callback('❌ ဂိမ်း ID ပြန်ပြင်ခိုင်းရန်', `cxr_id_${oid}`)],
                [Markup.button.callback('❌ Ngwe မပြည့်၍ လက်ကျန်တောင်းရန်', `cxr_bal_${oid}`)]
            ]
        }).catch(()=>{});
    } catch(e) { console.error(e); }
});

bot.action(/^cxr_(receipt|id|bal)_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    try {
        await ctx.answerCbQuery();
        const type = ctx.match[1]; const oid = ctx.match[2];
        const o = await Order.findOne({ orderId: oid });
        if (!o) return ctx.reply('⚠️ အော်ဒါမရှိတော့ပါ။');

        if (type === 'receipt') {
            await Order.findOneAndUpdate({ orderId: oid }, { status: 'Cancelled_Receipt' });
            ctx.editMessageCaption(`❌ ပြေစာမှားယွင်းကြောင်း User ဆီသို့ အကြောင်းကြားပြီးပါပြီ။`).catch(() => {});
            bot.telegram.sendMessage(o.telegramId, `⚠️ လူကြီးမင်း၏ အော်ဒါ #${oid} အတွက် ပေးပို့လာသော ပြေစာပုံမှာ မှားယွင်းနေပါသည်ဗျာ။ ကျေးဇူးပြု၍ ပြေစာပုံအမှန်ကို အောက်ကခလုတ်နှိပ်ပြီး ပြန်လည်ပေးပို့ပေးပါဗျာ။`, {
                ...Markup.inlineKeyboard([[Markup.button.callback('📷 ပြေစာပုံအမှန် ပြန်ပို့မည်', `send_rec_${oid}`)], [Markup.button.callback('❌ ဤအော်ဒါအား လုံးဝဖျက်သိမ်းမည်', `user_cancel_order_${oid}`)]])
            }).catch(()=>{});
        } else if (type === 'id') {
            await Order.findOneAndUpdate({ orderId: oid }, { status: 'Cancelled_ID' });
            ctx.editMessageCaption(`❌ ဂိမ်း ID မှားယွင်းကြောင်း User ဆီသို့ အကြောင်းကြားပြီးပါပြီ။`).catch(() => {});
            bot.telegram.sendMessage(o.telegramId, `⚠️ လူကြီးမင်း၏ အော်ဒါ #${oid} အတွက် ဖြည့်သွင်းပေးထားသော ဂိမ်း ID (Zone ID) မှာ မှားယွင်းနေပါသည်ဗျာ။ ကျေးဇူးပြု၍ စစ်ဆေးပြီး အမှန်ပြန်လည်ပေးပို့ပါ။`, {
                ...Markup.inlineKeyboard([[Markup.button.callback('🎮 ဂိမ်း ID အမှန် ပြန်ရိုက်မည်', `send_id_${oid}`)]])
            }).catch(()=>{});
        } else if (type === 'bal') {
            adminState.set(ctx.from.id.toString(), { step: 'REQ_BALANCE_AMT', targetOid: oid });
            ctx.reply(`📝 အော်ဒါ #${oid} အတွက် User ထံမှ တောင်းခံမည့် 'လက်ကျန်ငွေပမာဏ' ကို ဂဏန်းသီးသန့် ရိုက်ထည့်ပေးပါဗျာ။`);
        }
    } catch(e) { console.error(e); }
});

bot.action(/^send_(rec|id|bal)_(.+)$/, async (ctx) => {
    try {
        await ctx.answerCbQuery(); const type = ctx.match[1]; const oid = ctx.match[2]; const uid = ctx.from.id.toString();
        if (type === 'rec') {
            const orderData = await Order.findOne({ orderId: oid }).lean();
            userSessions.set(uid, { step: 'AWAITING_RECEIPT', ...orderData });
            ctx.reply('📷 ကျေးဇူးပြု၍ ငွေလွှဲပြေစာပုံအမှန်အား စနစ်သို့ တိုက်ရိုက် ပို့ပေးပါဗျာ။');
        } else if (type === 'id') {
            userPromoState.set(uid, { step: 'USER_RETRY_ID_VAL', targetOid: oid });
            ctx.reply('🎮 ကျေးဇူးပြု၍ သင်၏ MLBB User ID (Zone ID) အမှန်အား ရိုက်ပို့ပေးပါဗျာ။');
        } else if (type === 'bal') {
            userSessions.set(uid, { step: 'AWAITING_BALANCE_RECEIPT', targetOrderId: oid });
            ctx.reply('📷 ကျေးဇူးပြု၍ ကျန်ရှိသော လက်ကျန်ငွေ လွှဲပြေစာပုံအား ဤနေရာသို့ တိုက်ရိုက် ပို့ပေးပါဗျာ။');
        }
    } catch(e) { console.error(e); }
});

bot.action(/^user_cancel_order_(.+)$/, async (ctx) => {
    try { await ctx.answerCbQuery(); await Order.findOneAndUpdate({ orderId: ctx.match[1] }, { status: 'User_Cancelled' }); ctx.editMessageText('❌ လူကြီးမင်း၏ တောင်းဆိုချက်အရ ဤအော်ဒါအား လုပ်ငန်းစဉ်ထဲမှ လုံးဝ ဖျက်သိမ်းလိုက်ပါပြီဗျာ။'); } catch(e) {}
});

bot.action(/^cfg_pay_(kpay|wave)$/, async (ctx) => {
    try { await ctx.answerCbQuery(); adminState.set(ctx.from.id.toString(), { step: 'CFG_PAY_NUM', method: ctx.match[1] }); ctx.editMessageText(`⚙️ ဆက်လက်ပြီး အသုံးပြုမည့် ${ctx.match[1].toUpperCase()} ဖုန်းနံပါတ်အသစ်အား ရိုက်ပို့ပေးပါဗျာ။`); } catch(e) {}
});

bot.action('cfg_pay_save', async (ctx) => {
    try {
        await ctx.answerCbQuery(); const uid = ctx.from.id.toString(); let s = await Shop.findOne() || await Shop.create({}); const aState = adminState.get(uid);
        if (aState.method === 'kpay') { s.kpayNumber = aState.number; s.kpayName = aState.name; s.kpayQrId = aState.photoId; }
        else { s.waveNumber = aState.number; s.waveName = aState.name; s.waveQrId = aState.photoId; }
        await s.save(); ctx.editMessageText('✅ အချက်အလက်သစ်များအားလုံး စနစ်ထဲသို့ အောင်မြင်စွာ အစားထိုး သိမ်းဆည်းလိုက်ပါပြီဗျာ။'); adminState.delete(uid);
    } catch(e) {}
});

bot.action('cfg_pay_cancel', async (ctx) => {
    try { await ctx.answerCbQuery(); adminState.delete(ctx.from.id.toString()); ctx.editMessageText('❌ ပြင်ဆင်ချက်အား ဖျက်သိမ်းလိုက်ပါပြီ။'); } catch(e){}
});

bot.action(/^eprc_(.+)$/, async (ctx) => {
    try { await ctx.answerCbQuery(); adminState.set(ctx.from.id.toString(), { step: 'PRICE_NEW_AMT', key: ctx.match[1] }); ctx.editMessageText('📝 ရောင်းဈေးအသစ်ကို ဂဏန်းသီးသန့် ပို့ပေးပါဗျာ။'); } catch(e){}
});

bot.action('shop_open', async (ctx) => { try { await ctx.answerCbQuery(); await Shop.findOneAndUpdate({}, { shopOpen: true }); ctx.editMessageText('🏪 ဆိုင်အား အောင်မြင်စွာ [ဖွင့်လှစ်] လိုက်ပါပြီဗျာ။'); } catch(e){} });
bot.action('shop_close', async (ctx) => { try { await ctx.answerCbQuery(); await Shop.findOneAndUpdate({}, { shopOpen: false }); ctx.editMessageText('🏪 ဆိုင်အား အောင်မြင်စွာ [ပိတ်သိမ်း] လိုက်ပါပြီဗျာ။'); } catch(e){} });
bot.action('del_promo', async (ctx) => { try { await ctx.answerCbQuery(); await Shop.findOneAndUpdate({}, { $unset: { promo: "" } }); ctx.editMessageText('✅ လက်ရှိ Promo Code အား စနစ်ထဲမှ အောင်မြင်စွာ ပယ်ဖျက်လိုက်ပါပြီဗျာ။'); } catch(e){} });

// ==========================================
// FIX: WEBHOOK INITIALIZATION
// ==========================================
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL}/bot${BOT_TOKEN}`;

bot.telegram.setWebhook(WEBHOOK_URL).then(() => {
    console.log(`✅ Webhook set successfully to: ${WEBHOOK_URL}`);
}).catch(err => {
    console.error(`🔴 Webhook Error:`, err);
});

const server = http.createServer((req, res) => {
    if (req.url === `/bot${BOT_TOKEN}`) {
        bot.handleUpdate(req, res);
    } else {
        res.end('Aura Digital Bot is Online via Webhook.');
    }
});

server.listen(PORT, () => {
    console.log(`🚀 Bot is live on port ${PORT} using Webhook.`);
});
