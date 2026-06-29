const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const http = require('http');

// --- CONFIGURATIONS ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = '7534742589'; // အစ်ကို့ Telegram ID
const BOT_USERNAME = 'Digital_mlbb_bot'; // အသစ်ပြင်ထားတဲ့ Username
const MONGO_URI = process.env.MONGO_URI;

const bot = new Telegraf(BOT_TOKEN);

// --- DATABASE MODELS ---
mongoose.connect(MONGO_URI).then(() => console.log('🟢 DB Connected')).catch(err => console.error('🔴 DB Error:', err));

const User = mongoose.model('User', new mongoose.Schema({ telegramId: String, username: String, name: String, referredBy: String, points: { type: Number, default: 0 }, couponsCount: { type: Number, default: 0 }, savedGameId: String, lastCheckIn: Date, hasPurchased: { type: Boolean, default: false } }));
const Order = mongoose.model('Order', new mongoose.Schema({ orderId: String, telegramId: String, itemName: String, itemKey: String, gameId: String, price: Number, cost: Number, paymentMethod: String, usedCoupon: Boolean, isGift: Boolean, receiptFileId: String, status: { type: String, default: 'Pending' }, createdAt: { type: Date, default: Date.now } }));
const Shop = mongoose.model('Shop', new mongoose.Schema({ shopOpen: { type: Boolean, default: true }, prices: { type: Map, of: Number }, costs: { type: Map, of: Number }, totalOrders: Number, totalRevenue: Number, totalProfit: Number, kpayNumber: String, kpayName: String, kpayQrId: String, waveNumber: String, waveName: String, waveQrId: String, promo: Object }));

const userSessions = new Map();
const adminState = new Map();
const userPromoState = new Map();
const ITEM_NAMES = { 'ml1': '77 Diamonds', 'ml2': '219 Diamonds' }; // လိုအပ်သလို ထပ်ဖြည့်ပါ
const ITEM_COUPONS = { 'ml1': '3%', 'ml2': '5%' };

function isAdmin(ctx) { return ctx.from.id.toString() === ADMIN_CHAT_ID; }
function getMainMenu(ctx) { return Markup.keyboard([['🎮 မိတ်ဆွေဖျော်ဖြေရေး (Top-Up Store)'], ['🎁 Daily Check-In', '💰 My Points & Coupons'], ['📜 ဝယ်ယူမှုမှတ်တမ်း', '💡 အသုံးပြုပုံလမ်းညွှန်'], ['📞 Contact Admin']]).resize(); }

// --- MIDDLEWARES & HANDLERS ---
async function checkForcedJoinAndShop(ctx, next) { return next(); } // လွယ်ကူအောင် ယာယီဖြုတ်ထားသည်
function handleMenuInterruption(ctx, type, callback) { return callback(); }

bot.start(async (ctx) => {
    const uid = ctx.from.id.toString();
    let user = await User.findOne({ telegramId: uid });
    if (!user) {
        let rId = (ctx.startPayload && ctx.startPayload.startsWith('ref_')) ? ctx.startPayload.replace('ref_', '') : null;
        user = await User.create({ telegramId: uid, username: ctx.from.username, name: ctx.from.first_name, referredBy: rId });
    }
    ctx.reply(`✨ Aura Digital မှ ကြိုဆိုပါတယ်ဗျာ။`, getMainMenu(ctx));
});

bot.hears('🎮 မိတ်ဆွေဖျော်ဖြေရေး (Top-Up Store)', async (ctx) => {
    let shop = await Shop.findOne() || await Shop.create({});
    const kb = Object.keys(ITEM_NAMES).map(k => [Markup.button.callback(`🔹 ${ITEM_NAMES[k]}`, `buy_${k}`)]);
    ctx.reply('💎 ပစ္စည်းစာရင်းများ -', Markup.inlineKeyboard(kb));
});

// --- WEBHOOK SERVER ---
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL}/bot${BOT_TOKEN}`;

bot.telegram.setWebhook(WEBHOOK_URL).then(() => console.log(`✅ Webhook Set`));

const server = http.createServer((req, res) => {
    if (req.url === `/bot${BOT_TOKEN}`) { bot.handleUpdate(req, res); }
    else { res.end('Aura Digital Bot is Online.'); }
});

server.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
