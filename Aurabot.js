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

// ညီလေးပေးထားသော MongoDB Atlas Cloud လင့်ခ်အား ကုဒ်ထဲတွင် တိုက်ရိုက်ချိတ်ဆက်ပေးထားပါသည်
const MONGO_URI = 'mongodb+srv://eaglewind22_db:2232003wunna@cluster0.qqgs4ef.mongodb.net/aura_digital?retryWrites=true&w=majority&appName=Cluster0';

// Fallback Default File IDs (ညီလေး ပုံပို့လို့ ရလာမယ့် ID တွေကို ဒီနေရာမှာ လဲလှယ်နိုင်ပါတယ်)
let KPAY_QR_FILE_ID = 'AgACAgIAAxkBAAM...'; 
let WAVEMONEY_QR_FILE_ID = 'AgACAgIAAxkBAAM...';

mongoose.connect(MONGO_URI)
    .then(() => console.log('🟢 MongoDB Connected Successfully!'))
    .catch(err => console.error('🔴 MongoDB Connection Error:', err));

const bot = new Telegraf(BOT_TOKEN);
const userSessions = new Map();
let adminBroadcastState = {}; 

// ==========================================
// 2. DATABASE SCHEMAS
// ==========================================
const UserSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: String,
    name: String,
    savedGameId: { type: String, default: null },
    points: { type: Number, default: 0 },
    referredBy: { type: String, default: null },
    hasPurchased: { type: Boolean, default: false }
});

const ShopSchema = new mongoose.Schema({
    shopOpen: { type: Boolean, default: true },
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 }
});

const User = mongoose.model('User', UserSchema);
const Shop = mongoose.model('Shop', ShopSchema);

async function initShop() {
    const count = await Shop.countDocuments();
    if (count === 0) { await Shop.create({ shopOpen: true, totalOrders: 0, totalRevenue: 0 }); }
}
initShop();

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
// 3. MIDDLEWARES
// ==========================================
async function checkMiddleware(ctx, next) {
    const uid = ctx.from ? ctx.from.id.toString() : null;
    if (!uid) return;
    if (uid === ADMIN_CHAT_ID) return next();

    const shop = await Shop.findOne();
    if (shop && !shop.shopOpen) {
        return ctx.reply('👋 မင်္ဂလာပါဗျာ။ လက်ရှိအချိန်တွင် Aura Digital ဆိုင်ခေတ္တ ပိတ်ထားပါသဖြင့် အော်ဒါတင်၍ ရဦးမည်မဟုတ်ပါဗျာ။ ဆိုင်ပြန်ဖွင့်ချိန်တွင် Channel မှတစ်ဆင့် အကြောင်းကြားပေးပါမည်။');
    }

    try {
        const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
        if (['left', 'kicked'].includes(member.status)) {
            return ctx.reply(
                `📢 Aura Digital Bot ကို အသုံးပြုရန်အတွက် ကျွန်ုပ်တို့၏ Official Channel ကို အရင် Join ပေးရပါမယ်ဗျာ။`,
                Markup.inlineKeyboard([
                    [Markup.button.url('📢 Join Channel', `https://t.me/${CHANNEL_USERNAME.replace('@', '')}`)],
                    [Markup.button.callback('🔄 Joined (စစ်ဆေးမည်)', 'check_join')]
                ])
            );
        }
    } catch (e) { console.error('Force Join Error:', e); }
    return next();
}

// ==========================================
// 4. KEYBOARDS
// ==========================================
const userMainMenu = Markup.keyboard([
    ['🎮 စိန်ဖြည့်ရန် (Top-Up Store)'],
    ['💰 My Points (အမှတ်စာရင်း)', '📞 Contact Admin']
]).resize();

const adminMainMenu = Markup.keyboard([
    ['🎮 စိန်ဖြည့်ရန် (Top-Up Store)'],
    ['📊 Dashboard (စာရင်းချုပ်)', '🏪 ဆိုင် ဖွင့်/ပိတ် Panel'],
    ['📢 ကြော်ငြာစာ ပို့ရန်']
]).resize();

function getMainMenu(uid) { return uid === ADMIN_CHAT_ID ? adminMainMenu : userMainMenu; }

// ==========================================
// 5. CORE BOT BOT LOGIC
// ==========================================
bot.start(async (ctx) => {
    const uid = ctx.from.id.toString();
    userSessions.delete(uid);

    let user = await User.findOne({ telegramId: uid });
    if (!user) {
        let referrerId = null;
        if (ctx.startPayload && ctx.startPayload.startsWith('ref_')) {
            referrerId = ctx.startPayload.replace('ref_', '');
            if (referrerId === uid) referrerId = null; 
        }
        user = await User.create({
            telegramId: uid,
            username: ctx.from.username,
            name: ctx.from.first_name,
            referredBy: referrerId
        });
    }

    ctx.reply(`✨ Aura Digital Top-Up Service မှ ကြိုဆိုပါတယ်ဗျာ။\n\nအောက်ပါ Menu ခလုတ်များကို နှိပ်၍ ဝန်ဆောင်မှု ရယူနိုင်ပါပြီ။`, getMainMenu(uid));
});

bot.action('check_join', checkMiddleware, (ctx) => {
    ctx.deleteMessage().catch(() => {});
    ctx.reply('🎉 Channel Join ပြီးမြောက်မှု အောင်မြင်ပါသည်။ အောက်ပါ Menu ကို သုံးနိုင်ပါပြီ။', getMainMenu(ctx.from.id.toString()));
});

bot.hears('🎮 စိန်ဖြည့်ရန် (Top-Up Store)', checkMiddleware, (ctx) => {
    const keyboard = Object.keys(PRICES).map(key => [
        Markup.button.callback(`🔹 ${PRICES[key].name} - ${PRICES[key].price.toLocaleString()} Ks`, `buy_${key}`)
    ]);
    ctx.reply('💎 MLBB Diamonds & Pass စာရင်း -', Markup.inlineKeyboard(keyboard));
});

bot.hears('📞 Contact Admin', (ctx) => {
    ctx.reply(`📞 လူကြီးမင်း၏ အော်ဒါနှင့်ပတ်သက်၍ အဆင်မပြေမှုတစ်စုံတစ်ရာ ရှိပါက Aura Digital တာဝန်ခံ Admin ဆီသို့ တိုက်ရိုက်ဆက်သွယ် မေးမြန်းနိုင်ပါသည်ဗျာ။\n\n👨‍💻 Admin Account: ${ADMIN_USERNAME}`);
});

bot.hears('💰 My Points (အမှတ်စာရင်း)', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString();
    const user = await User.findOne({ telegramId: uid });
    if (!user) return ctx.reply('⚠️ User profile Error.');

    const cashValue = Math.floor(user.points / 100);
    let msg = `💰 *Aura Digital - လူကြီးမင်း၏ အမှတ်စာရင်း* 💰\n\n` +
              `👤 အသုံးပြုသူ: *${ctx.from.first_name}*\n` +
              `🎯 လက်ရှိပိုင်ဆိုင်သော အမှတ်: *${user.points.toLocaleString()} Points*\n` +
              `(ငွေသားတန်ဖိုးအားဖြင့် = *${cashValue.toLocaleString()} Ks*)\n\n` +
              `----------------------------------\n` +
              `💡 *Points တွေကို ဘယ်လိုအသုံးချမလဲ?*\n\n` +
              `🅰️ *နည်းလမ်း (A) - တိုက်ရိုက်လျှော့စျေး*\n` +
              `အမှတ် ၃၀,၀၀0 နှင့်အထက် ရှိပါက စိန်ဝယ်ယူသည့်အခါ ငွေသားအဖြစ် တိုက်ရိုက်ခုနှိမ်ပြီး လျှော့စျေး ရယူနိုင်ပါသည်။\n\n` +
              `🅱️ *နည်းလမ်း (B) - Weekly Pass အလကားလဲယူခြင်း*\n` +
              `အမှတ် ၆၅၀,၀၀၀ ပြည့်ပါက အောက်ပါ "🎁 Weekly Pass လဲလှယ်မည်" ခလုတ်ကို နှိပ်ပြီး လုံးဝ (Free) လဲလှယ်နိုင်ပါသည်။\n\n` +
              `🔗 *အမှတ်များများရအောင် ဘယ်လိုလုပ်မလဲ?*\n` +
              `လူကြီးမင်း၏ ကိုယ်ပိုင် Referral Link အား သူငယ်ချင်းများထံ မျှဝေပြီး သူငယ်ချင်းများ ဝယ်ယူသည့် ပမာဏတိုင်းမှ အမှတ် ၁၀% ကို အခမဲ့ ရယူနိုင်ပါသည်။\n` +
              `👉 ကိုယ်ပိုင် Link: \`t.me/${ctx.botInfo.username}?start=ref_${uid}\``;

    const inlineButtons = [];
    if (user.points >= 650000) {
        inlineButtons.push([Markup.button.callback('🎁 Weekly Pass အလကား လဲလှယ်မည်', 'claim_wp_points')]);
    }

    ctx.replyWithMarkdown(msg, inlineButtons.length > 0 ? Markup.inlineKeyboard(inlineButtons) : null);
});

// ==========================================
// 6. TOP-UP ENGINE & DISCOUNTS
// ==========================================
bot.action(/^buy_(.+)$/, checkMiddleware, async (ctx) => {
    const key = ctx.match[1];
    const item = PRICES[key];
    const uid = ctx.from.id.toString();

    userSessions.set(uid, { item: item.name, basePrice: item.price, finalPrice: item.price, discountUsed: 0, pointsToBurn: 0 });
    const user = await User.findOne({ telegramId: uid });

    if (user && user.savedGameId) {
        ctx.editMessageText(`🎯 ရွေးချယ်မှု: ${item.name}\n💰 ကျသင့်ငွေ: ${item.price.toLocaleString()} Ks\n\n💡 လူကြီးမင်း ယခင်ဖြည့်ခဲ့ဖူးသော ID ဟောင်း ဖြင့်ပဲ ပြንလည်ဖြည့်သွင်းမလားဗျာ?`, Markup.inlineKeyboard([
            [Markup.button.callback(`🆔 ID ဟောင်းသုံးမည်: ${user.savedGameId}`, `use_saved_id`)],
            [Markup.button.callback('🎁 အခြားသူအား Gift ပေးမည် (ID အသစ်ရိုက်မည်)', 'use_new_id')]
        ])).catch(() => {});
    } else {
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

bot.action('use_new_id', checkMiddleware, (ctx) => askForGameId(ctx));

bot.action('use_saved_id', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString();
    const session = userSessions.get(uid);
    const user = await User.findOne({ telegramId: uid });
    session.gameId = user.savedGameId;
    userSessions.set(uid, session);
    ctx.deleteMessage().catch(() => {});
    await processDiscountStep(ctx, user, session);
});

bot.on('text', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString();
    
    if (uid === ADMIN_CHAT_ID && adminBroadcastState.step === 'AWAITING_MSG') {
        adminBroadcastState.step = 'CONFIRMING';
        adminBroadcastState.text = ctx.message.text;
        adminBroadcastState.photo = null;
        return askConfirmBroadcast(ctx, ctx.message.text, null);
    }

    const session = userSessions.get(uid);
    if (!session || session.step !== 'AWAITING_ID') return;

    const inputId = ctx.message.text.trim();
    const idRegex = /^\d{8,10}\s*\(\d{4,5}\)$|^\d{8,10}\s+\d{4,5}$/;

    if (!idRegex.test(inputId)) {
        return ctx.reply('⚠️ ID ပုံစံမမှန်ကန်ပါ။ User ID (၈ လုံးမှ ၁၀ လုံး) နှင့် Zone ID (၄ လုံးမှ ၅ လုံး) ကို သေချာစွာ ပြန်လည်ရိုက်ထည့်ပေးပါဗျာ။\n\nဥပမာ - 166049831 (2851)');
    }

    session.gameId = inputId;
    userSessions.set(uid, session);

    const user = await User.findOneAndUpdate({ telegramId: uid }, { savedGameId: inputId }, { new: true });
    await processDiscountStep(ctx, user, session);
});

async function processDiscountStep(ctx, user, session) {
    const uid = user.telegramId;
    if (user.points >= 30000) {
        const burnablePoints = user.points;
        const discountAmount = Math.floor(burnablePoints / 100);
        
        ctx.reply(`💰 လူကြီးမင်းတွင် အမှတ် ${burnablePoints.toLocaleString()} Points (${discountAmount.toLocaleString()} Ks တန်ဖိုး) ရှိနေပါသည်။ \n\nယခုဝယ်ယူမှုတွင် အမှတ်များကို သုံးစွဲပြီး လျှော့စျေး ယူမလားဗျာ?`, Markup.inlineKeyboard([
            [Markup.button.callback(`✅ ယူမည် (-${discountAmount} Ks)`, 'apply_discount')],
            [Markup.button.callback('❌ မယူပါ၊ ပုံမှန်စျေးအတိုင်းပဲဝယ်မည်', 'skip_discount')]
        ]));
    } else {
        session.step = 'AWAITING_RECEIPT';
        userSessions.set(uid, session);
        await sendPaymentDetails(ctx, session);
    }
}

bot.action('apply_discount', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString();
    const session = userSessions.get(uid);
    const user = await User.findOne({ telegramId: uid });

    const discount = Math.floor(user.points / 100);
    session.pointsToBurn = user.points;
    session.discountUsed = discount;
    session.finalPrice = Math.max(0, session.basePrice - discount);
    session.step = 'AWAITING_RECEIPT';
    userSessions.set(uid, session);

    ctx.deleteMessage().catch(() => {});
    await sendPaymentDetails(ctx, session);
});

bot.action('skip_discount', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString();
    const session = userSessions.get(uid);
    session.step = 'AWAITING_RECEIPT';
    userSessions.set(uid, session);

    ctx.deleteMessage().catch(() => {});
    await sendPaymentDetails(ctx, session);
});

async function sendPaymentDetails(ctx, session) {
    let msg = `💵 *AURA DIGITAL - Ngwe Pay Chay Mhu* 💵\n\n` +
              `🎮 ပစ္စည်း: *${session.item}*\n` +
              `🎯 MLBB ID: \`${session.gameId}\`\n`;
              
    if (session.discountUsed > 0) {
        msg += `🔥 Discount ခုနှိမ်မှု: -${session.discountUsed.toLocaleString()} Ks\n`;
    }
    msg += `💰 *လူကြီးမင်းအမှန်တကယ် လွှဲရမည့်ငွေ: ${session.finalPrice.toLocaleString()} Kyats*\n\n` +
           `📌 အောက်ပါ QR Code များအား ဓာတ်ပုံသိမ်းပြီး Scan ဖတ်၍ဖြစ်စေ၊ ဖုန်းနံပါတ်ဖြင့်ဖြစ်စေ Ngwe Lwe Naing Par Tel.\n` +
           `• 📱 KPay: \`09692272242\`\n` +
           `• 🌊 WaveMoney: \`09400266700\`\n\n` +
           `ငွေလွှဲပြီးပါက *ငွေလွှဲပြေစာ Screenshot (ဓာတ်ပုံ)* ကို ဤနေရာသို့ တိုက်ရိုက် ပို့ပေးပါဗျာ။`;

    try {
        await ctx.replyWithPhoto(KPAY_QR_FILE_ID, { caption: msg, parse_mode: 'Markdown' });
    } catch (e) {
        await ctx.replyWithMarkdown(msg);
    }
}

// Photo Catcher (ငွေလွှဲပြေစာ သို့မဟုတ် File ID ထုတ်ပေးသည့်စနစ်)
bot.on('photo', checkMiddleware, async (ctx) => {
    const uid = ctx.from.id.toString();
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

    // 💡 [အလွယ်ဆုံးနည်းလမ်း] ညီလေး QR ပုံပို့လိုက်တာနဲ့ File ID အော်တိုပြန်ပြပေးမည့်စနစ်
    if (uid === ADMIN_CHAT_ID && !userSessions.has(uid) && adminBroadcastState.step !== 'AWAITING_MSG') {
        return ctx.reply(`🖼️ လူကြီးမင်း ပို့လိုက်သော ပုံ၏ File ID မှာ အောက်ပါအတိုင်း ဖြစ်ပါသည်ဗျာ - \n\n\`${photoId}\``, { parse_mode: 'Markdown' });
    }

    if (uid === ADMIN_CHAT_ID && adminBroadcastState.step === 'AWAITING_MSG') {
        adminBroadcastState.step = 'CONFIRMING';
        adminBroadcastState.text = ctx.message.caption || '';
        adminBroadcastState.photo = photoId;
        return askConfirmBroadcast(ctx, adminBroadcastState.text, photoId);
    }

    const session = userSessions.get(uid);
    if (!session || session.step !== 'AWAITING_RECEIPT') return;

    const orderId = 'AD' + Math.floor(1000 + Math.random() * 9000);
    session.orderId = orderId;
    userSessions.set(uid, session);

    ctx.reply(`🎉 ပြေစာလက်ခံရရှိပါပြီ။ အော်ဒါနံပါတ်: #${orderId} ကို မကြာမီ Admin ဘက်မှ စိစစ်ပြီး ဖြည့်သွင်းပေးပါမည်ဗျာ။`);

    const orderDetails = `🚨 *AURA DIGITAL - အော်ဒါအသစ်* 🚨\n\n` +
                         `🆔 Order ID: *#${orderId}*\n` +
                         `👤 ဝယ်ယူသူ: [${ctx.from.first_name}](tg://user?id=${uid})\n` +
                         `🎮 ပစ္စည်း: *${session.item}*\n` +
                         `🎯 MLBB ID: \`${session.gameId}\`\n` +
                         `💰 လွှဲရမည့်ငွေ: *${session.finalPrice.toLocaleString()} Ks*\n` +
                         `📉 အသုံးပြုခဲ့သည့် Points: ${session.pointsToBurn.toLocaleString()} Points`;

    try {
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
    } catch (e) { console.error(e); }
});

// ==========================================
// 7. ADMIN TRANS-MATURING & REFERRALS
// ==========================================
bot.action(/^admin_confirm_(\d+)_(.+)$/, async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return ctx.answerCbQuery('⚠️ No Permission');
    const uid = ctx.match[1];
    const orderId = ctx.match[2];
    const session = userSessions.get(uid);

    if (!session || session.orderId !== orderId) return ctx.answerCbQuery('⚠️ System Cache Error', { show_alert: true });

    await Shop.findOneAndUpdate({}, { $inc: { totalOrders: 1, totalRevenue: session.finalPrice } });
    
    const user = await User.findOneAndUpdate(
        { telegramId: uid },
        { $inc: { points: -session.pointsToBurn }, $set: { hasPurchased: true } },
        { new: true }
    );

    const newDirectPoints = session.finalPrice;
    await User.findOneAndUpdate({ telegramId: uid }, { $inc: { points: newDirectPoints } });

    // တင်းကျပ်သော Referral Rule (ညွှန်းသူကိုယ်တိုင် ဝယ်ဖူးမှ Points ရမည်)
    if (user.referredBy) {
        const referrer = await User.findOne({ telegramId: user.referredBy });
        if (referrer && referrer.hasPurchased) {
            const referralBonus = Math.floor(session.finalPrice * 0.1); 
            await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { points: referralBonus } });
            try {
                await bot.telegram.sendMessage(user.referredBy, `🎉 မိတ်ဆွေညွှန်းဆိုသူမှ ဝယ်ယူမှုကြောင့် လူကြီးမင်းထံသို့ Bonus Point +${referralBonus.toLocaleString()} Points ရောက်ရှိလာပါပြီဗျာ။`);
            } catch (e) {}
        }
    }

    ctx.editMessageCaption(`✅ *အော်ဒါအောင်မြင်စွာ ဖြည့်သွင်းပြီးပါပြီ။* \n\n🆔 Order: #${orderId}\n💰 ဝင်ငွေ: +${session.finalPrice} Ks`, { parse_mode: 'Markdown' }).catch(() => {});

    try {
        await bot.telegram.sendMessage(uid, 
            `⚡ *Order Delivered!* \n\nလူကြီးမင်း၏ အော်ဒါနံပါတ် *#${orderId}* အား အောင်မြင်စွာ ဖြည့်သွင်းပေးပြီးပါပြီဗျာ။\n\nဝယ်ယူမှုအတွက် ရရှိသော အမှတ်: +${newDirectPoints.toLocaleString()} Points\n\nဝန်ဆောင်မှုကို သဘောကျရင် Review လေး ပေးခဲ့ပါဦးဗျာ။`,
            Markup.inlineKeyboard([[Markup.button.callback('⭐️⭐️⭐️⭐️⭐️ အရမ်းမြန်လို့ သဘောကျတယ်', `rev_5_${orderId}_${uid}`)]])
        );
    } catch (e) {}
    ctx.answerCbQuery('✅ Confirmed!');
});

bot.action(/^admin_cancel_(\d+)_(.+)$/, async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return ctx.answerCbQuery('⚠️ No Permission');
    const uid = ctx.match[1];
    const orderId = ctx.match[2];

    ctx.editMessageCaption(`❌ *ဤအော်ဒါကို ပယ်ဖျက်လိုက်ပါပြီ။* \n🆔 Order: #${orderId}`, { parse_mode: 'Markdown' }).catch(() => {});
    try {
        await bot.telegram.sendMessage(uid, `❌ လူကြီးမင်း၏ အော်ဒါနံပါတ် *#${orderId}* သည် ငွေလွှဲပြေစာ မမှန်ကန်ခြင်း (သို့မဟုတ်) အချက်အလက်မှားယွင်းခြင်းကြောင့် ပယ်ဖျက်ခြင်း ခံရပါသည်ဗျာ။`);
    } catch (e) {}
    userSessions.delete(uid);
    ctx.answerCbQuery('❌ Cancelled');
});

bot.action(/^rev_5_(.+)_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const uid = ctx.match[2];
    ctx.editMessageText('❤️ Review ပေးပေးတဲ့အတွက် ကျေးဇူးအထူးတင်ပါတယ်ဗျာ။').catch(() => {});

    const reviewPost = `✨ *CUSTOMER REVIEW | SUCCESSFUL ORDER* ✨\n\n📦 Order ID: \`#${orderId}\`\n💎 Status: *Successfully Transferred*\nထင်မြင်ချက်: ⭐️⭐️⭐️⭐️⭐️ *အရမ်းမြန်ပြီး စိတ်ချရတယ်ဗျာ*\n\n🤖 ဝန်ဆောင်မှုရယူရန်: @${ctx.botInfo.username}`;
    try {
        await bot.telegram.sendMessage(CHANNEL_USERNAME, reviewPost, { parse_mode: 'Markdown' });
    } catch (e) {}
    userSessions.delete(uid);
});

bot.action('claim_wp_points', async (ctx) => {
    const uid = ctx.from.id.toString();
    const user = await User.findOne({ telegramId: uid });
    if (user.points < 650000) return ctx.answerCbQuery('⚠️ အမှတ်မလုံလောက်ပါ။', { show_alert: true });

    await User.findOneAndUpdate({ telegramId: uid }, { $inc: { points: -650000 } });
    ctx.editMessageText('🎁 Weekly Pass လဲလှယ်မှု အချက်အလက်များကို Admin ထံ ပေးပို့လိုက်ပါပြီ။ တာဝန်ခံမှ မကြာမီ ဖြည့်သွင်းပေးပါမည်ဗျာ။').catch(() => {});

    try {
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, `🎁 *POINT SHOP - WEEKLY PASS LEVELLING* 🎁\n\n👤 ဝယ်ယူသူ: [${ctx.from.first_name}](tg://user?id=${uid})\n🆔 Game ID ဟောင်း: \`${user.savedGameId || 'မရှိသေးပါ'}\`\n\n_ဤအကောင့်အား စစ်ဆေးပြီး Weekly Pass အခမဲ့ ဖြည့်ပေးပါရန်_`);
    } catch (e) {}
});

// ==========================================
// 8. TWO-STEP VERIFIED BROADCASTS
// ==========================================
bot.hears('📢 ကြော်ငြာစာ ပို့ရန်', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    adminBroadcastState = { step: 'AWAITING_MSG' };
    ctx.reply('📢 ကြော်ငြာချင်သော စာသားကို ရိုက်ပို့ပေးပါ (သို့မဟုတ်) ပုံတင်ပြီး ပုံ၏ အောက်တွင် စာသား (Caption) တွဲ၍ ပို့ပေးပါဗျာ။');
});

function askConfirmBroadcast(ctx, text, photoId) {
    const previewMsg = `📝 *ကြော်ငြာ Preview စမ်းသပ်ကြည့်ရှုခြင်း*\n\n-----------------\n${text || '_စာသားမပါဝင်ပါ_'}`;
    const inlineButtons = Markup.inlineKeyboard([
        [Markup.button.callback('🚀 သေချာပါသည်၊ လူတိုင်းဆီ ပို့မည်', 'bc_confirm'), Markup.button.callback('❌ ဖျက်သိမ်းမည်', 'bc_cancel')]
    ]);

    if (photoId) {
        ctx.replyWithPhoto(photoId, { caption: previewMsg, parse_mode: 'Markdown', ...inlineButtons });
    } else {
        ctx.replyWithMarkdown(previewMsg, inlineButtons);
    }
}

bot.action('bc_cancel', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    adminBroadcastState = {};
    ctx.editMessageText('❌ ကြော်ငြာအား ဖျက်သိမ်းလိုက်ပါပြီ။').catch(() => {});
});

bot.action('bc_confirm', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    ctx.editMessageText('🚀 ကြော်ငြာများကို လူတိုင်းထံသို့ စတင် ပို့ဆောင်နေပါပြီ...').catch(() => {});

    const allUsers = await User.find({});
    let successCount = 0;

    for (let user of allUsers) {
        try {
            if (adminBroadcastState.photo) {
                await bot.telegram.sendPhoto(user.telegramId, adminBroadcastState.photo, { caption: adminBroadcastState.text });
            } else {
                await bot.telegram.sendMessage(user.telegramId, adminBroadcastState.text);
            }
            successCount++;
        } catch (e) { console.error(`Failed to send to ${user.telegramId}`); }
    }

    ctx.reply(`🎉 ကြော်ငြာ ပို့ဆောင်မှု ပြီးဆုံးပါပြီ။ စုစုပေါင်း လူဦးရေ *${successCount}* ယောက်ထံသို့ ပေးပို့အောင်မြင်ခဲ့ပါတယ်ဗျာ။`);
    adminBroadcastState = {};
});

// Admin Panel Tools
bot.hears('📊 Dashboard (စာရင်းချုပ်)', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    const shop = await Shop.findOne();
    ctx.replyWithMarkdown(`📊 *AURA DIGITAL - စာရင်းဇယားချုပ်* 📊\n\n📝 စုစုပေါင်းအော်ဒါ: *${shop.totalOrders} ခု*\n💰 စုစုပေါင်း ရောင်းရငွေ: *${shop.totalRevenue.toLocaleString()} Ks*`);
});

bot.hears('🏪 ဆိုင် ဖွင့်/ပိတ် Panel', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    const shop = await Shop.findOne();
    const status = shop.shopOpen ? '🟢 ဆိုင်ဖွင့်ထားသည်' : '🔴 ဆိုင်ပိတ်ထားသည်';
    ctx.reply(`🏪 Aura Digital ဆိုင် ဖွင့်/ပိတ် ထိန်းချုပ်ခန်း\n\nလက်ရှိအခြေအနေ: ${status}`, Markup.inlineKeyboard([
        [Markup.button.callback('🟢 ဆိုင်ဖွင့်မည်', 'shop_open'), Markup.button.callback('🔴 ဆိုင်ပိတ်မည်', 'shop_close')]
    ]));
});

bot.action('shop_open', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    await Shop.findOneAndUpdate({}, { shopOpen: true });
    ctx.editMessageText('🏪 ဆိုင်အခြေအနေအား [ 🟢 ဖွင့်လှစ်သည် ] သို့ ပြောင်းလဲလိုက်ပါပြီ။').catch(() => {});
});

bot.action('shop_close', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    await Shop.findOneAndUpdate({}, { shopOpen: false });
    ctx.editMessageText('🏪 ဆိုင်အခြေအနေအား [ 🔴 ပိတ်သိမ်းသည် ] သို့ ပြောင်းလဲလိုက်ပါပြီ။').catch(() => {});
});

// Web Server for Render
const server = http.createServer((req, res) => { res.writeHead(200); res.end('Aura Digital Premium Engine is Running perfectly.'); });
server.listen(process.env.PORT || 3000, () => {
    bot.launch().then(() => console.log('🚀 Aura Digital Ultimate System Online!'));
});
