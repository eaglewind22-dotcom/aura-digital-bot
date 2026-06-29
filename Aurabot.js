const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const http = require('http');

// ==========================================
// 1. CONFIGURATIONS
// ==========================================
const BOT_TOKEN = '8953970980:AAG-8uV8P9ni_vlmXVGdTZfdVrSFHuosX3Y';
const ADMIN_CHAT_ID = '7534742589';
const MONGO_URI = 'mongodb+srv://eaglewind22_db:2232003wunna@cluster0.qqgs4ef.mongodb.net/aura_digital?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
    .then(() => console.log('🟢 DB Connected'))
    .catch(err => console.error('🔴 DB Error:', err));

const bot = new Telegraf(BOT_TOKEN);
const userSessions = new Map();
const adminState = new Map();
const userPromoState = new Map();

function isAdmin(ctx) {
    if (!ctx || !ctx.from) return false;
    return ctx.from.id.toString() === ADMIN_CHAT_ID.toString();
}

// ==========================================
// 2. SCHEMAS
// ==========================================
const User = mongoose.model('User', new mongoose.Schema({ telegramId: String, username: String, name: String, savedGameId: String, points: { type: Number, default: 0 }, couponsCount: { type: Number, default: 0 }, totalSpent: { type: Number, default: 0 }, lastCheckIn: Date, hasPurchased: { type: Boolean, default: false }, referredBy: String, createdAt: { type: Date, default: Date.now } }));
const Order = mongoose.model('Order', new mongoose.Schema({ orderId: String, telegramId: String, itemName: String, itemKey: String, gameId: String, price: Number, cost: Number, status: { type: String, default: 'Pending' }, paymentMethod: String, usedCoupon: { type: Boolean, default: false }, isGift: { type: Boolean, default: false }, pendingBalance: { type: Number, default: 0 }, receiptFileId: String, balanceReceiptFileId: String, createdAt: { type: Date, default: Date.now } }));
const Shop = mongoose.model('Shop', new mongoose.Schema({ shopOpen: { type: Boolean, default: true }, kpayNumber: { type: String, default: '09692272242' }, kpayName: { type: String, default: 'Aura Topup' }, kpayQrId: String, waveNumber: { type: String, default: '09400266700' }, waveName: { type: String, default: 'Wunna Myo Oo' }, waveQrId: String, totalOrders: { type: Number, default: 0 }, totalRevenue: { type: Number, default: 0 }, totalProfit: { type: Number, default: 0 }, prices: { type: Map, of: Number }, costs: { type: Map, of: Number }, promo: Object }));

// ==========================================
// 3. BOT LOGIC (အပြည့်အစုံ)
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
        await User.findOneAndUpdate({ telegramId: o.telegramId }, { $inc: { totalSpent: o.price, points: baseRewardPoints }, $set: { hasPurchased: true } });
        if (o.usedCoupon) await User.findOneAndUpdate({ telegramId: o.telegramId }, { $inc: { couponsCount: -1 } });
        await ctx.editMessageCaption(`✅ အောင်မြင်စွာ ဖြည့်သွင်းပြီးပါပြီ။\nအမြတ်: +${profit} Ks`).catch(() => {});
        bot.telegram.sendMessage(o.telegramId, `⚡ လူကြီးမင်း၏ အော်ဒါ #${oid} (${o.itemName}) အား အောင်မြင်စွာ ဖြည့်သွင်းပေးပြီးပါပြီဗျာ။`);
    } catch(e) { console.error(e); }
});

bot.action(/^acxl_opt_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    try {
        await ctx.answerCbQuery();
        const oid = ctx.match[1];
        ctx.editMessageReplyMarkup({ inline_keyboard: [
            [Markup.button.callback('❌ ပြေစာမှားယွင်းမှု တောင်းရန်', `cxr_receipt_${oid}`)],
            [Markup.button.callback('❌ ဂိမ်း ID ပြန်ပြင်ခိုင်းရန်', `cxr_id_${oid}`)],
            [Markup.button.callback('❌ Ngwe မပြည့်၍ လက်ကျန်တောင်းရန်', `cxr_bal_${oid}`)]
        ]}).catch(()=>{});
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
            bot.telegram.sendMessage(o.telegramId, `⚠️ လူကြီးမင်း၏ အော်ဒါ #${oid} အတွက် ပေးပို့လာသော ပြေစာပုံမှာ မှားယွင်းနေပါသည်ဗျာ။`, { ...Markup.inlineKeyboard([[Markup.button.callback('📷 ပြေစာပုံအမှန် ပြန်ပို့မည်', `send_rec_${oid}`)]]) });
        } else if (type === 'id') {
            await Order.findOneAndUpdate({ orderId: oid }, { status: 'Cancelled_ID' });
            ctx.editMessageCaption(`❌ ဂိမ်း ID မှားယွင်းကြောင်း User ဆီသို့ အကြောင်းကြားပြီးပါပြီ။`).catch(() => {});
            bot.telegram.sendMessage(o.telegramId, `⚠️ ဂိမ်း ID မှားယွင်းနေပါသည်၊ အမှန်ပြန်ပေးပို့ပါ။`, { ...Markup.inlineKeyboard([[Markup.button.callback('🎮 ဂိမ်း ID အမှန် ပြန်ရိုက်မည်', `send_id_${oid}`)]]) });
        } else if (type === 'bal') {
            adminState.set(ctx.from.id.toString(), { step: 'REQ_BALANCE_AMT', targetOid: oid });
            ctx.reply(`📝 အော်ဒါ #${oid} အတွက် User ထံမှ တောင်းခံမည့် 'လက်ကျန်ငွေပမာဏ' ကို ဂဏန်းသီးသန့် ရိုက်ထည့်ပေးပါဗျာ။`);
        }
    } catch(e) { console.error(e); }
});

// ==========================================
// 4. WEBHOOK SETUP
// ==========================================
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL}/bot${BOT_TOKEN}`;

bot.telegram.setWebhook(WEBHOOK_URL).then(() => {
    console.log(`✅ Webhook set successfully to: ${WEBHOOK_URL}`);
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
