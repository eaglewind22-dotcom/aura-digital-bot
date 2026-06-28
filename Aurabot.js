const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const http = require('http');

// ==========================================
// 1. CONFIGURATIONS
// ==========================================
const BOT_TOKEN = '8953970980:AAG-8uV8P9ni_vlmXVGdTZfdVrSFHuosX3Y';
const ADMIN_CHAT_ID = '7534742589'; 
const ADMIN_USERNAME = '@Wunna2232003';
const CHANNEL_USERNAME = '@AuraDigitalPremium';

const MONGO_URI = 'mongodb+srv://eaglewind22_db:2232003wunna@cluster0.qqgs4ef.mongodb.net/aura_digital?retryWrites=true&w=majority&appName=Cluster0';
const KPAY_QR_FILE_ID = 'AgACAgUAAxkBAAPFakA6PlHwqkOWeaqurTgoBIpMAdEAAkMRaxvFEgFWSpVMAsTjLFkBAAMCAAN5AAM8BA'; 

mongoose.connect(MONGO_URI).then(() => console.log('🟢 DB Connected')).catch(err => console.error(err));

const bot = new Telegraf(BOT_TOKEN);
const userSessions = new Map();
let adminBroadcastState = {}; 
let adminActionState = {}; 

function isAdmin(ctx) {
    if (!ctx.from) return false;
    return ctx.from.id.toString() === ADMIN_CHAT_ID.toString();
}

// ==========================================
// 2. SCHEMAS & MODELS
// ==========================================
const UserSchema = new mongoose.Schema({
    telegramId: String, username: String, name: String, savedGameId: String,
    points: { type: Number, default: 0 }, couponsCount: { type: Number, default: 0 }, 
    totalSpent: { type: Number, default: 0 }, lastCheckIn: Date, hasPurchased: { type: Boolean, default: false },
    referredBy: String
});
const OrderSchema = new mongoose.Schema({
    orderId: String, telegramId: String, itemName: String, itemKey: String,
    gameId: String, price: Number, cost: Number, status: { type: String, default: 'Pending' }, createdAt: { type: Date, default: Date.now }
});
const ShopSchema = new mongoose.Schema({
    shopOpen: { type: Boolean, default: true }, totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 }, totalProfit: { type: Number, default: 0 },
    prices: { type: Map, of: Number, default: { 'mlbb_wp': 6450, 'mlbb_tp': 34300, 'mlbb_86': 5650, 'mlbb_172': 10650 }},
    costs: { type: Map, of: Number, default: { 'mlbb_wp': 5500, 'mlbb_tp': 30000, 'mlbb_86': 4800, 'mlbb_172': 9000 }},
    promo: { code: String, poolPoints: Number, expiry: Date, claimedUsers: [String] }
});

const User = mongoose.model('User', UserSchema);
const Order = mongoose.model('Order', OrderSchema);
const Shop = mongoose.model('Shop', ShopSchema);

async function initShop() { if (await Shop.countDocuments() === 0) await Shop.create({}); }
initShop();

const ITEM_NAMES = { 'mlbb_wp': '🔥 Weekly Pass', 'mlbb_tp': '🤩 Twilight Pass', 'mlbb_86': '💎 Dia 86', 'mlbb_172': '💎 Dia 172' };

// ==========================================
// 3. KEYBOARDS & MIDDLEWARES (FIXED LAYOUT)
// ==========================================
const userMenu = Markup.keyboard([
    ['🎮 စိန်ဖြည့်ရန် (Top-Up Store)'],
    ['🎁 Daily Check-In', '💰 My Points & Coupons'],
    ['📜 ဝယ်ယူမှုမှတ်တမ်း', '💡 အသုံးပြုပုံလမ်းညွှန်'],
    ['📞 Contact Admin']
]).resize();

const adminMenu = Markup.keyboard([
    ['Dashboard (စာရင်းချုပ်)', 'ဆိုင် ဖွင့်/ပိတ် Panel'],
    ['ဈေးနှုန်း/ရင်းဈေး ပြင်ရန်', 'User Point ပြင်ရန်'],
    ['Promo Code အသစ်ထုတ်ရန်', '⚙️ Promo Code ပြန်ပြင်ရန်'],
    ['ကြော်ငြာစာ ပို့ရန်']
]).resize();

function getMainMenu(ctx) { return isAdmin(ctx) ? adminMenu : userMenu; }

// 🏪 ဆိုင်ဖွင့်/ပိတ် စစ်ဆေးရန် Middleware
async function checkMiddleware(ctx, next) {
    if (isAdmin(ctx)) return next(); 
    const shop = await Shop.findOne();
    if (shop && !shop.shopOpen) {
        return ctx.reply('👋 မင်္ဂလာပါဗျာ။ လက်ရှိအချိန်တွင် Aura Digital ဆိုင်ခေတ္တ ပိတ်ထားပါသဖြင့် အော်ဒါတင်၍ ရဦးမည်မဟုတ်ပါဗျာ။');
    }
    return next();
}

function askConfirmBroadcast(ctx, text, photoId) {
    const btns = Markup.inlineKeyboard([[Markup.button.callback('🚀 အခုပို့မည်', 'bc_confirm'), Markup.button.callback('❌ ဖျက်သိမ်းမည်', 'bc_cancel')]]);
    const caption = `📝 *ကြော်ငြာ Preview စာသား*\n\n-----------------\n${text || '_စာသားမပါပါ_'}`;
    if (photoId) return ctx.replyWithPhoto(photoId, { caption, parse_mode: 'Markdown', ...btns });
    return ctx.replyWithMarkdown(caption, btns);
}

// ==========================================
// 4. ADMIN & USER TEXT COMMANDS
// ==========================================
bot.start(async (ctx) => {
    const uid = ctx.from.id.toString(); userSessions.delete(uid);
    let user = await User.findOne({ telegramId: uid });
    if (!user) {
        let rId = (ctx.startPayload && ctx.startPayload.startsWith('ref_')) ? ctx.startPayload.replace('ref_', '') : null;
        user = await User.create({ telegramId: uid, username: ctx.from.username, name: ctx.from.first_name, referredBy: rId });
    }
    ctx.reply(`✨ Aura Digital မှ ကြိုဆိုပါတယ်ဗျာ။`, getMainMenu(ctx));
});

bot.hears(/Dashboard/i, async (ctx) => {
    if (!isAdmin(ctx)) return;
    const s = await Shop.findOne();
    const btns = Markup.inlineKeyboard([[Markup.button.callback('🔄 စာရင်းအသစ်ပြန်စမည် (Reset)', 'reset_dashboard')]]);
    ctx.replyWithMarkdown(`📊 *AURA DIGITAL - စာရင်းဇယားချုပ်*\n\n📝 အော်ဒါစုစုပေါင်း: *${s.totalOrders} ခု*\n💰 ရောင်းရငွေစုစုပေါင်း: *${s.totalRevenue.toLocaleString()} Ks*\n📈 *အသားတင်အမြတ်စုစုပေါင်း: ${s.totalProfit.toLocaleString()} Ks*\n\n💡 _Reset နှိပ်လျှင် အပေါ်က စာရင်းချုပ် ကိန်းဂဏန်းများသာ ၀ ပြန်ဖြစ်သွားမည်။ User data များ လုံးဝမပျက်ပါ။_`, btns);
});

bot.hears(/ဆိုင် ဖွင့်\/ပိတ်/i, async (ctx) => {
    if (!isAdmin(ctx)) return;
    const s = await Shop.findOne();
    ctx.reply(`🏪 လက်ရှိဆိုင်အခြေအနေ: ${s.shopOpen ? '🟢 ဖွင့်ထားသည်' : '🔴 ပိတ်ထားသည်'}`, Markup.inlineKeyboard([[Markup.button.callback('🟢 ဖွင့်မည်', 'shop_open'), Markup.button.callback('🔴 ပိတ်မည်', 'shop_close')]]));
});

bot.hears(/ဈေးနှုန်း/i, (ctx) => {
    if (!isAdmin(ctx)) return;
    const kb = Object.keys(ITEM_NAMES).map(k => [Markup.button.callback(ITEM_NAMES[k], `eprc_${k}`)]);
    ctx.reply('🔧 ပြင်ဆင်လိုသည့် Item ရွေးပါ -', Markup.inlineKeyboard(kb));
});

bot.hears('User Point ပြင်ရန်', (ctx) => {
    if (!isAdmin(ctx)) return;
    adminActionState = { step: 'POINT_USER_ID' };
    ctx.reply('📝 အမှတ်ပြင်လိုသော User ၏ Telegram ID (ဂဏန်းသီးသန့်) ကို ရိုက်ပို့ပေးပါဗျာ။');
});

bot.hears(/ကြော်ငြာစာ/i, (ctx) => {
    if (!isAdmin(ctx)) return;
    adminBroadcastState = { step: 'AWAITING_MSG' };
    ctx.reply('📢 ကြော်ငြာစာသား ပို့ပေးပါ (သို့မဟုတ်) ပုံတင်ပြီး Caption ရိုက်ပေးပါ။');
});

bot.hears('Promo Code အသစ်ထုတ်ရန်', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const shop = await Shop.findOne();
    const now = new Date();
    if (shop.promo && shop.promo.code && shop.promo.expiry && now < shop.promo.expiry) {
        return ctx.reply(`❌ လက်ရှိအချိန်တွင် Active ဖြစ်နေသော Promo Code (${shop.promo.code}) ရှိနေသေးပါသဖြင့် ထပ်ထုတ်၍ မရသေးပါ။ သက်တမ်းကုန်ဆုံးချိန်အထိ စောင့်ပါ သို့မဟုတ် ပြန်ပြင်ရန် ခလုတ်မှ ပြင်ဆင်ပါ။`);
    }
    adminActionState = { step: 'PROMO_CODE_NAME' };
    ctx.reply('📝 ကမ်ပိန်းအတွက် အသုံးပြုမည့် Promo Code စာသားကို ရိုက်ပေးပါ (ဥပမာ - THADINGYUT)');
});

bot.hears('⚙️ Promo Code ပြန်ပြင်ရန်', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const shop = await Shop.findOne();
    if (!shop.promo || !shop.promo.code) return ctx.reply('⚠️ လက်ရှိတွင် မည်သည့် Promo Code မှ ထည့်သွင်းထားခြင်း မရှိသေးပါဗျာ။');
    
    ctx.reply(`🎟️ *လက်ရှိ ကမ်ပိန်းအခြေအနေ*\n\n🔑 ကုဒ်: *${shop.promo.code}*\n🎯 ကျန်ရှိ Point Pool: *${shop.promo.poolPoints} Pts*\n⏳ သက်တမ်းကုန်မည့်အချိန်: ${shop.promo.expiry ? shop.promo.expiry.toLocaleString() : 'သတ်မှတ်မထားပါ'}`,
        Markup.inlineKeyboard([
            [Markup.button.callback('🎯 Point Pool အသစ်ပြင်မည်', 'edit_promo_pool')],
            [Markup.button.callback('⏳ သက်တမ်း (နာရီ) တိုးမည်/ပြင်မည်', 'edit_promo_expiry')],
            [Markup.button.callback('❌ ဤကုဒ်အား လုံးဝဖျက်ပစ်မည်', 'delete_promo_code')]
        ])
    );
});

bot.hears('🎮 စိန်ဖြည့်ရန် (Top-Up Store)', checkMiddleware, async (ctx) => {
    const shop = await Shop.findOne();
    const kb = Object.keys(ITEM_NAMES).map(k => [Markup.button.callback(`🔹 ${ITEM_NAMES[k]} - ${(shop.prices.get(k) || 0).toLocaleString()} Ks`, `buy_${k}`)]);
    ctx.reply('💎 စိန်စာရင်း -', Markup.inlineKeyboard(kb));
});

bot.hears('🎁 Daily Check-In', checkMiddleware, async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id.toString() });
    const now = new Date();
    if (user.lastCheckIn && now.toDateString() === user.lastCheckIn.toDateString()) return ctx.reply('⚠️ ယနေ့အတွက် ယူပြီးပါပြီ။');
    await User.findOneAndUpdate({ telegramId: ctx.from.id.toString() }, { $inc: { points: 20 }, $set: { lastCheckIn: now } });
    ctx.reply('🎉 မေတ္တာလက်ဆောင် +20 Points ရရှိပါပြီ။');
});

bot.hears('📜 ဝယ်ယူမှုမှတ်တမ်း', async (ctx) => {
    const uid = ctx.from.id.toString();
    const orders = await Order.find({ telegramId: uid }).sort({ createdAt: -1 }).limit(5);
    if (orders.length === 0) return ctx.reply('⚠️ လူကြီးမင်းထံတွင် ဝယ်ယူထားသော မှတ်တမ်းမရှိသေးပါဗျာ။');

    let msg = `📜 *လူကြီးမင်း၏ နောက်ဆုံး ဝယ်ယူမှုမှတ်တမ်း (၅) ခု*\n\n`;
    orders.forEach((o, i) => {
        const emoji = o.status === 'Success' ? '✅' : (o.status === 'Cancelled' ? '❌' : '⏳');
        msg += `${i + 1}. #${o.orderId} - *${o.itemName}*\n   💰 ကျသင့်ငွေ: ${o.price} Ks\n   📊 အခြေအနေ: ${emoji} *${o.status}*\n\n`;
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

bot.hears('💰 My Points & Coupons', async (ctx) => {
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
// 5. CALLBACK BUTTON ROUTERS
// ==========================================
bot.action('reset_dashboard', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('⚠️ No Permission');
    await Shop.findOneAndUpdate({}, { $set: { totalOrders: 0, totalRevenue: 0, totalProfit: 0 } });
    await ctx.answerCbQuery('✅ Reset လုပ်ပြီးပါပြီ');
    ctx.editMessageText('📊 *AURA DIGITAL*\n\n✅ ယခုတစ်ပတ်အတွက် စာရင်းချုပ်အားလုံးကို အောင်မြင်စွာ ဖျက်သိမ်းပြီး စာရင်းအသစ် ပြန်စလိုက်ပါပြီဗျာ။ (User Data များနှင့် အော်ဒါမှတ်တမ်းများ လုံးဝမပျက်ပါ)။');
});

bot.action('delete_promo_code', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('⚠️ No Permission');
    await Shop.findOneAndUpdate({}, { $set: { "promo.code": null, "promo.poolPoints": 0, "promo.expiry": null, "promo.claimedUsers": [] } });
    await ctx.answerCbQuery('🗑️ ဖျက်ပြီးပါပြီ');
    ctx.editMessageText('✅ Active ဖြစ်နေသော Promo Code အား Database မှ လုံးဝ ဖျက်သိမ်းလိုက်ပါပြီ။');
});

bot.action('edit_promo_pool', async (ctx) => {
    if (!isAdmin(ctx)) return; adminActionState = { step: 'EDIT_PROMO_POOL_VAL' };
    ctx.reply('📝 ယခု Promo Code အတွက် ထားရှိလိုသော *Point Pool အသစ်* ကို ဂဏန်းသီးသန့် ရိုက်ပို့ပေးပါဗျာ။');
});

bot.action('edit_promo_expiry', async (ctx) => {
    if (!isAdmin(ctx)) return; adminActionState = { step: 'EDIT_PROMO_EXP_VAL' };
    ctx.reply('📝 ယခုအချိန်မှစ၍ သက်တမ်းကုန်ဆုံးစေလိုသည့် *နာရီပမာဏ* ကို ရိုက်ပို့ပေးပါ (ဥပမာ - 24)');
});

bot.action('bc_confirm', async (ctx) => {
    if (!isAdmin(ctx)) return;
    await ctx.answerCbQuery('🚀 ပို့ဆောင်နေပါပြီ');
    ctx.editMessageText('🚀 ကြော်ငြာများ စတင်ပို့ဆောင်နေပါပြီ...').catch(() => {});
    const users = await User.find({});
    for (let u of users) {
        try {
            if (adminBroadcastState.photo) await bot.telegram.sendPhoto(u.telegramId, adminBroadcastState.photo, { caption: adminBroadcastState.text });
            else await bot.telegram.sendMessage(u.telegramId, adminBroadcastState.text);
            await new Promise(resolve => setTimeout(resolve, 50)); 
        } catch (e) {}
    }
    ctx.reply('✅ ကြော်ငြာပို့ဆောင်မှု ပြီးဆုံးပါပြီ။');
    adminBroadcastState = {};
});

bot.action('bc_cancel', (ctx) => {
    adminBroadcastState = {};
    ctx.editMessageText('❌ ကြော်ငြာအား ဖျက်သိမ်းလိုက်ပါပြီ။');
});

bot.action('shop_open', async (ctx) => { await Shop.findOneAndUpdate({}, { shopOpen: true }); ctx.editMessageText('🏪 ဆိုင်အခြေအနေအား [ 🟢 ဖွင့်လှစ်သည် ] သို့ ပြောင်းလဲလိုက်ပါပြီ။'); });
bot.action('shop_close', async (ctx) => { await Shop.findOneAndUpdate({}, { shopOpen: false }); ctx.editMessageText('🏪 ဆိုင်အခြေအနေအား [ 🔴 ပိတ်သိမ်းသည် ] သို့ ပြောင်းလဲလိုက်ပါပြီ။'); });

bot.action(/^buy_(.+)$/, checkMiddleware, async (ctx) => {
    const k = ctx.match[1]; const s = await Shop.findOne();
    userSessions.set(ctx.from.id.toString(), { itemKey: k, itemName: ITEM_NAMES[k], basePrice: s.prices.get(k), costPrice: s.costs.get(k), step: 'AWAITING_ID' });
    ctx.reply(`🎯 ${ITEM_NAMES[k]} အတွက် MLBB User ID(Zone ID) ပို့ပေးပါဗျာ။\nဥပမာ - 166049831(2851)`);
});

// ==========================================
// 6. PHOTO / RECEIPT AND BROADCAST LOGIC
// ==========================================
bot.on('photo', async (ctx) => {
    if (isAdmin(ctx) && adminBroadcastState.step === 'AWAITING_MSG') {
        adminBroadcastState.step = 'CONFIRMING'; adminBroadcastState.text = ctx.message.caption || ''; adminBroadcastState.photo = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        return askConfirmBroadcast(ctx, adminBroadcastState.text, adminBroadcastState.photo);
    }
    const session = userSessions.get(ctx.from.id.toString());
    if (!session || session.step !== 'AWAITING_RECEIPT') return;
    
    const oid = 'AD' + Math.floor(1000 + Math.random() * 9000);
    session.orderId = oid;
    await Order.create({ orderId: oid, telegramId: ctx.from.id.toString(), itemName: session.itemName, itemKey: session.itemKey, gameId: session.gameId, price: session.basePrice, cost: session.costPrice });
    
    ctx.reply(`🎉 ပြေစာရရှိပါပြီ။ Order ID: #${oid} အား စောင့်ဆိုင်းပေးပါ။`);
    const details = `🚨 *အော်ဒါအသစ်* 🚨\n\nID: *#${oid}*\nဝယ်ယူသူ: [${ctx.from.first_name}](tg://user?id=${ctx.from.id})\nပစ္စည်း: *${session.itemName}*\nID: \`${session.gameId}\`\n💰 လွှဲငွေ: *${session.basePrice.toLocaleString()} Ks*`;
    bot.telegram.sendPhoto(ADMIN_CHAT_ID, ctx.message.photo[ctx.message.photo.length - 1].file_id, {
        caption: details, parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('✅ Confirm', `acnf_${oid}`), Markup.button.callback('❌ Cancel', `acxl_${oid}`)]])
    });
});

// ==========================================
// 7. INPUT TEXT FLOW MANAGEMENT
// ==========================================
bot.on('text', async (ctx, next) => {
    const input = ctx.message.text.trim();
    const uid = ctx.from.id.toString();

    if (isAdmin(ctx)) {
        if (adminBroadcastState.step === 'AWAITING_MSG') {
            adminBroadcastState.step = 'CONFIRMING'; adminBroadcastState.text = input; adminBroadcastState.photo = null;
            return askConfirmBroadcast(ctx, input, null);
        }
        if (adminActionState.step === 'PRICE_NEW_AMT') {
            adminActionState.price = parseInt(input); adminActionState.step = 'COST_NEW_AMT';
            return ctx.reply('⚙️ ရောင်းဈေးသိမ်းဆည်းပြီးပါပြီ။ ဆက်လက်ပြီး ရင်းဈေး (Cost) ကို ဂဏန်းသီးသန့် ရိုက်ပို့ပေးပါဗျာ။');
        }
        if (adminActionState.step === 'COST_NEW_AMT') {
            const s = await Shop.findOne(); s.prices.set(adminActionState.key, adminActionState.price); s.costs.set(adminActionState.key, parseInt(input));
            await s.save(); ctx.reply('✅ ဈေးနှုန်းနှင့် ရင်းဈေး ပြင်ဆင်မှု အောင်မြင်ပါသည်။', adminMenu); adminActionState = {}; return;
        }
        if (adminActionState.step === 'POINT_USER_ID') {
            const targetUser = await User.findOne({ telegramId: input });
            if (!targetUser) return ctx.reply('⚠️ Database တွင် ဤ User ID အား ရှာမတွေ့ပါ။');
            adminActionState.targetUid = input; adminActionState.step = 'POINT_NEW_AMT';
            return ctx.reply(`👤 User: ${targetUser.name}\n🎯 လက်ရှိအမှတ်: ${targetUser.points} Pts\n\nတိုးမြှင့်/လျှော့ချချင်သော အမှတ်ပမာဏကို ရိုက်ထည့်ပါ (ဥပမာ - 5000 သို့မဟုတ် -2000)`);
        }
        if (adminActionState.step === 'POINT_NEW_AMT') {
            const amt = parseInt(input); if (isNaN(amt)) return ctx.reply('⚠️ ဂဏန်းအမှန်ကန်ဆုံး ရိုက်ပေးပါဗျာ။');
            await User.findOneAndUpdate({ telegramId: adminActionState.targetUid }, { $inc: { points: amt } });
            ctx.reply('✅ အမှတ်ပြင်ဆင်မှု အောင်မြင်ပါပြီဗျာ။', adminMenu);
            try { await bot.telegram.sendMessage(adminActionState.targetUid, `🔔 Admin မှ လူကြီးမင်း၏ အမှတ်စာရင်းအား ပြင်ဆင်လိုက်သဖြင့် Point အပြောင်းအလဲ ရှိသွားပါသည်ဗျာ။`); } catch (e) {}
            adminActionState = {}; return;
        }
        if (adminActionState.step === 'PROMO_CODE_NAME') {
            adminActionState.codeName = input.toUpperCase(); adminActionState.step = 'PROMO_POOL';
            return ctx.reply('🎟️ Promo Code အမည်ရပါပြီ။\n\nကမ်ပိန်းအတွက် *စုစုပေါင်း Point Pool (Total Points)* ကို ရိုက်ထည့်ပေးပါ (ဥပမာ - 10000)');
        }
        if (adminActionState.step === 'PROMO_POOL') {
            adminActionState.pool = parseInt(input); adminActionState.step = 'PROMO_EXPIRY';
            return ctx.reply('🎟️ Point Pool သတ်မှတ်ပြီးပါပြီ။\n\nက်တမ်းကုန်ဆုံးမည့် နာရီပမာဏကို ရိုက်ထည့်ပေးပါ (ဥပမာ - 48)');
        }
        if (adminActionState.step === 'PROMO_EXPIRY') {
            const hours = parseInt(input); const expDate = new Date(); expDate.setHours(expDate.getHours() + hours);
            await Shop.findOneAndUpdate({}, { $set: { "promo.code": adminActionState.codeName, "promo.poolPoints": adminActionState.pool, "promo.expiry": expDate, "promo.claimedUsers": [] } });
            ctx.reply(`✅ Promo Code အသစ်တစ်ခုကို လွှင့်တင်လိုက်ပါပြီ။\n🎟️ ကုဒ်: ${adminActionState.codeName}\n🎯 Pool: ${adminActionState.pool} Pts\n⏳ သက်တမ်း: ${hours} နာရီ`, adminMenu);
            adminActionState = {}; return;
        }
        if (adminActionState.step === 'EDIT_PROMO_POOL_VAL') {
            await Shop.findOneAndUpdate({}, { $set: { "promo.poolPoints": parseInt(input) } });
            ctx.reply(`✅ Promo Code ၏ Point Pool အား *${input} Pts* သို့ ပြောင်းလဲပြင်ဆင်ပြီးပါပြီဗျာ။`, adminMenu);
            adminActionState = {}; return;
        }
        if (adminActionState.step === 'EDIT_PROMO_EXP_VAL') {
            const hrs = parseInt(input); const newExp = new Date(); newExp.setHours(newExp.getHours() + hrs);
            await Shop.findOneAndUpdate({}, { $set: { "promo.expiry": newExp } });
            ctx.reply(`✅ Promo Code ၏ သက်တမ်းအား ယခုအချိန်မှစ၍ *${hrs} နာရီ* သို့ ပြောင်းလဲပြင်ဆင်ပြီးပါပြီဗျာ။`, adminMenu);
            adminActionState = {}; return;
        }
    }

    // User Promo Code Router
    if (uid && adminActionState[uid] && adminActionState[uid].step === 'USER_PROMO_INPUT') {
        const shop = await Shop.findOne();
        if (!shop.promo.code || shop.promo.code !== input.toUpperCase()) return ctx.reply('❌ ဤပရိုမိုးရှင်းကုဒ် မှားယွင်းနေပါသည်ဗျာ။');
        if (shop.promo.claimedUsers.includes(uid)) return ctx.reply('⚠️ လူကြီးမင်းသည် ယခုပရိုမိုးရှင်းတွင် ပါဝင်ပြီးဖြစ်ပါသည်ဗျာ။');
        
        const now = new Date();
        if (shop.promo.expiry && now > shop.promo.expiry) return ctx.reply('⏳ နှမြောစရာပဲဗျာ! ယခု ပရိုမိုးရှင်းကုဒ် သက်တမ်းကုန်ဆုံးသွားပါပြီ။');

        let wonPoints = Math.floor(50 + Math.random() * 151);
        if (shop.promo.poolPoints > 0) {
            if (wonPoints > shop.promo.poolPoints) wonPoints = shop.promo.poolPoints;
            await Shop.findOneAndUpdate({}, { $inc: { "promo.poolPoints": -wonPoints }, $push: { "promo.claimedUsers": uid } });
        } else {
            return ctx.reply('⚠️ စိတ်မကောင်းပါဘူးဗျာ၊ ကမ်ပိန်း၏ Point Pool ကုန်ဆုံးသွားပါပြီ။');
        }

        await User.findOneAndUpdate({ telegramId: uid }, { $inc: { points: wonPoints } });
        delete adminActionState[uid];
        return ctx.reply(`🎉 ဂုဏ်ယူပါတယ်ဗျာ။ Promo Code ကံစမ်းမှုမှတစ်ဆင့် Point +${wonPoints} Points ရရှိပါပြီဗျာ။`);
    }

    const session = userSessions.get(uid);
    if (session && session.step === 'AWAITING_ID') {
        session.gameId = input; session.step = 'AWAITING_RECEIPT';
        ctx.reply(`💵 *ငွေပေးချေမှု* 💵\n\nပစ္စည်း: *${session.itemName}*\nလွှဲငွေ: *${session.basePrice.toLocaleString()} Ks*\n\n• KPay: \`09692272242\`\nလွှဲပြီးပါက ပြေစာပုံ ပို့ပေးပါဗျာ။`);
    }
});

bot.action('ent_promo', async (ctx) => {
    await ctx.answerCbQuery('🎟️'); const uid = ctx.from.id.toString();
    adminActionState[uid] = { step: 'USER_PROMO_INPUT' };
    ctx.reply('📝 လူကြီးမင်းထံရှိသော ပရိုမိုးရှင်းကုဒ် (Promo Code) အား ရိုက်ပို့ပေးပါဗျာ။');
});

bot.action('claim_coupon_5', async (ctx) => {
    await ctx.answerCbQuery('🎟️'); const uid = ctx.from.id.toString(); const user = await User.findOne({ telegramId: uid });
    if (user.points < 5000) return ctx.reply('⚠️ လူကြီးမင်းတွင် Point ၅,၀၀၀ မပြည့်သေးပါသဖြင့် ကူပွန်လဲ၍မရနိုင်သေးပါဗျာ။');
    await User.findOneAndUpdate({ telegramId: uid }, { $inc: { points: -5000, couponsCount: 1 } }); ctx.editMessageText('🎟️ 5% Coupon အား လဲလှယ်သိမ်းဆည်းလိုက်ပါပြီ။').catch(() => {});
});

bot.action(/^acnf_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    const oid = ctx.match[1]; const o = await Order.findOneAndUpdate({ orderId: oid, status: 'Pending' }, { status: 'Success' });
    if (!o) return ctx.reply('⚠️ အော်ဒါမရှိတော့ပါ သို့မဟုတ် အောင်မြင်ပြီးသားဖြစ်သည်။');
    const profit = Math.max(0, o.price - (o.cost || 0));
    await Shop.findOneAndUpdate({}, { $inc: { totalOrders: 1, totalRevenue: o.price, totalProfit: profit } });
    await User.findOneAndUpdate({ telegramId: o.telegramId }, { $inc: { totalSpent: o.price, points: Math.floor(o.price / 10) }, $set: { hasPurchased: true } });
    ctx.editMessageCaption(`✅ အောင်မြင်စွာ ဖြည့်သွင်းပြီးပါပြီ။\nအမြတ်: +${profit} Ks`).catch(() => {});
    bot.telegram.sendMessage(o.telegramId, `⚡ အော်ဒါ #${oid} ဖြည့်သွင်းပြီးပါပြီ။ ကျေးဇူးတင်ပါတယ်!`);
});

bot.action(/^acxl_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    const oid = ctx.match[1]; await Order.findOneAndUpdate({ orderId: oid }, { status: 'Cancelled' });
    ctx.editMessageCaption(`❌ ပယ်ဖျက်လိုက်ပါပြီ။`).catch(() => {});
});

bot.action(/^eprc_(.+)$/, async (ctx) => {
    adminActionState = { step: 'PRICE_NEW_AMT', key: ctx.match[1] };
    ctx.editMessageText('📝 ရောင်းဈေးအသစ်ကို ဂဏန်းသီးသန့် ပို့ပေးပါဗျာ။');
});

const server = http.createServer((req, res) => { res.end('Aura Engine is Live.'); });
server.listen(process.env.PORT || 3000, () => { bot.launch().then(() => console.log('🚀 Aura Digital Started.')); });
