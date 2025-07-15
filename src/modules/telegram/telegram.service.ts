import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { UserService } from '../user/user.service';
import { CategoryService } from '../category/category.service';
import { ProductService } from '../product/product.service';
import { CartService } from '../cart/cart.service';
import { OrderService } from '../order/order.service';
import { FeedbackService } from '../feedback/feedback.service';
import { PromocodeService } from '../promocode/promocode.service';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class TelegramService {
  private bot: TelegramBot;
  private logger = new Logger(TelegramService.name);

  constructor(
    private userService: UserService,
    private categoryService: CategoryService,
    private productService: ProductService,
    private cartService: CartService,
    private orderService: OrderService,
    private feedbackService: FeedbackService,
    private promocodeService: PromocodeService,
    private paymentService: PaymentService,
  ) {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN || "7942071036:AAFz_o_p2p2o-Gq-1C1YZMQSdODCHJiu2dY", {
      polling: true,
    });
    this.setupWebhook();
    this.setupCommands();
  }

  private async setupWebhook() {
    if (process.env.NODE_ENV === 'production') {
      const webhookUrl = process.env.WEBHOOK_URL || "https://telegram-shop-bot-production.up.railway.app/telegram/webhook";
      try {
        await this.bot.setWebHook(webhookUrl);
        this.logger.log(`Webhook set to ${webhookUrl}`);
      } catch (error) {
        this.logger.error(`Failed to set webhook: ${error.message}`, error.stack);
      }
    } else {
      this.logger.log('Polling mode enabled for development');
    }
  }

  private setupCommands() {
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      const fullName = `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();
      try {
        this.logger.log(`Processing /start for telegramId: ${telegramId}`);
        await this.userService.registerUser({ telegramId, fullName });
        this.bot.sendMessage(chatId, `Xush kelibsiz, ${fullName}! 🛒 Do‘konimizga xush kelibsiz!`, {
          reply_markup: {
            keyboard: [[{ text: '📁 Kategoriyalar' }, { text: '🛒 Savatcha' }], [{ text: '👤 Profilim' }, { text: '🕘 Buyurtma tarixi' }]],
            resize_keyboard: true,
          },
        });
      } catch (error) {
        this.logger.error(`Error in /start for telegramId: ${telegramId}: ${error.message}`, error.stack);
        this.bot.sendMessage(chatId, 'Xatolik yuz berdi, iltimos keyinroq urinib ko‘ring.');
      }
    });

    this.bot.onText(/\/admin/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      try {
        this.logger.log(`Processing /admin for telegramId: ${telegramId}`);
        const user = await this.userService.findByTelegramId(telegramId);
        if (!user || !user.isAdmin) {
          this.bot.sendMessage(chatId, 'Sizda admin huquqlari yo‘q.');
          return;
        }
        this.bot.sendMessage(chatId, 'Admin paneli', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Kategoriya qo‘shish', callback_data: 'add_category' }],
              [{ text: '➕ Mahsulot qo‘shish', callback_data: 'add_product' }],
              [{ text: '📦 Buyurtmalar', callback_data: 'view_orders' }],
              [{ text: '🗒️ Feedbacklar', callback_data: 'view_feedback' }],
              [{ text: '🎟️ Promo-kod yaratish', callback_data: 'create_promocode' }],
              [{ text: '📊 Statistika', callback_data: 'view_stats' }],
            ],
          },
        });
      } catch (error) {
        this.logger.error(`Error in /admin for telegramId: ${telegramId}: ${error.message}`, error.stack);
        this.bot.sendMessage(chatId, 'Xatolik yuz berdi, iltimos keyinroq urinib ko‘ring.');
      }
    });

    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      try {
        this.logger.log(`Processing message: ${msg.text} from telegramId: ${telegramId}`);
        if (msg.text === '📁 Kategoriyalar') {
          const categories = await this.categoryService.findAll();
          this.logger.log(`Fetched ${categories.length} categories`);
          const keyboard = categories.map((cat) => [{ text: cat.name, callback_data: `category_${cat.id}` }]);
          this.bot.sendMessage(chatId, 'Kategoriyalarni tanlang:', {
            reply_markup: { inline_keyboard: keyboard },
          });
        } else if (msg.text === '🛒 Savatcha') {
          const cartItems = await this.cartService.getCartItems(telegramId);
          this.logger.log(`Fetched ${cartItems.length} cart items for telegramId: ${telegramId}`);
          if (!cartItems.length) {
            this.bot.sendMessage(chatId, 'Savatchangiz bo‘sh.');
            return;
          }
          let message = 'Savatchangiz:\n';
          let total = 0;
          cartItems.forEach((item) => {
            message += `${item.product.name} - ${item.quantity} dona, Narxi: ${item.product.price * item.quantity} so‘m\n`;
            total += item.product.price * item.quantity;
          });
          message += `Jami: ${total} so‘m`;
          this.bot.sendMessage(chatId, message, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '✅ Buyurtma berish', callback_data: 'place_order' }],
                [{ text: '🗑️ Savatchani tozalash', callback_data: 'clear_cart' }],
              ],
            },
          });
        } else if (msg.text === '👤 Profilim') {
          const user = await this.userService.findByTelegramId(telegramId);
          this.logger.log(`Fetched user profile for telegramId: ${telegramId}`);
          this.bot.sendMessage(chatId, `Ism: ${user.fullName}\nTelefon: ${user.phone || 'Kiritilmagan'}\nBuyurtmalar soni: ${user.orders.length}`);
        } else if (msg.text === '🕘 Buyurtma tarixi') {
          const orders = await this.orderService.getUserOrders(telegramId);
          this.logger.log(`Fetched ${orders.length} orders for telegramId: ${telegramId}`);
          if (!orders.length) {
            this.bot.sendMessage(chatId, 'Sizda hali buyurtmalar yo‘q.');
            return;
          }
          let message = 'Buyurtma tarixingiz:\n';
          orders.forEach((order) => {
            message += `ID: ${order.id}, Jami: ${order.totalAmount} so‘m, Status: ${order.status}\n`;
          });
          this.bot.sendMessage(chatId, message);
        } else if (msg.text.startsWith('/promocode')) {
          const code = msg.text.split(' ')[1];
          if (!code) {
            this.bot.sendMessage(chatId, 'Iltimos, promo-kodni kiriting. Masalan: /promocode ABC123');
            return;
          }
          this.logger.log(`Applying promocode: ${code} for telegramId: ${telegramId}`);
          const promocode = await this.promocodeService.applyPromocode(code);
          this.bot.sendMessage(chatId, `Promo-kod qo‘llanildi! ${promocode.discountPercent}% chegirma.`);
        }
      } catch (error) {
        this.logger.error(`Error in message handler for telegramId: ${telegramId}: ${error.message}`, error.stack);
        this.bot.sendMessage(chatId, 'Xatolik yuz berdi, iltimos keyinroq urinib ko‘ring.');
      }
    });

    this.bot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const telegramId = query.from.id.toString();
      const data = query.data;
      try {
        this.logger.log(`Processing callback_query: ${data} from telegramId: ${telegramId}`);
        if (data.startsWith('category_')) {
          const categoryId = parseInt(data.split('_')[1]);
          const products = await this.productService.findByCategory(categoryId);
          this.logger.log(`Fetched ${products.length} products for categoryId: ${categoryId}`);
          const keyboard = products.map((prod) => [
            { text: `${prod.name} - ${prod.price} so‘m`, callback_data: `product_${prod.id}` },
          ]);
          this.bot.sendMessage(chatId, 'Mahsulotlar:', { reply_markup: { inline_keyboard: keyboard } });
        } else if (data.startsWith('product_')) {
          const productId = parseInt(data.split('_')[1]);
          const product = await this.productService.findOne(productId);
          this.logger.log(`Fetched productId: ${productId}`);
          this.bot.sendPhoto(chatId, product.imageUrl, {
            caption: `${product.name}\n${product.description}\nNarxi: ${product.price} so‘m`,
            reply_markup: {
              inline_keyboard: [
                [{ text: '➕ Savatchaga qo‘shish', callback_data: `addtocart_${productId}` }],
                [{ text: '⭐ Feedback qoldirish', callback_data: `feedback_${productId}` }],
              ],
            },
          });
        } else if (data.startsWith('addtocart_')) {
          const productId = parseInt(data.split('_')[1]);
          this.logger.log(`Adding to cart productId: ${productId} for telegramId: ${telegramId}`);
          await this.cartService.addToCart({ telegramId, productId, quantity: 1 });
          this.bot.sendMessage(chatId, 'Mahsulot savatchaga qo‘shildi.');
        } else if (data === 'place_order') {
          this.logger.log(`Creating order for telegramId: ${telegramId}`);
          const order = await this.orderService.createOrder(telegramId);
          this.bot.sendMessage(chatId, `Buyurtma yaratildi. ID: ${order.id}`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '💵 Click orqali to‘lash', callback_data: `pay_${order.id}_click` }],
                [{ text: '💵 Payme orqali to‘lash', callback_data: `pay_${order.id}_payme` }],
              ],
            },
          });
        } else if (data.startsWith('pay_')) {
          const [_, orderId, paymentType] = data.split('_');
          this.logger.log(`Generating payment link for orderId: ${orderId}, paymentType: ${paymentType}`);
          const paymentLink = await this.paymentService.generatePaymentLink(parseInt(orderId), paymentType);
          this.bot.sendMessage(chatId, `To‘lov havolasi: ${paymentLink}`);
        } else if (data.startsWith('feedback_')) {
          const productId = parseInt(data.split('_')[1]);
          this.bot.sendMessage(chatId, 'Feedback qoldiring (1-5 yulduz va izoh):', {
            reply_markup: { force_reply: true },
          });
          this.bot.once('message', async (msg) => {
            try {
              const [rating, ...comment] = msg.text.split(' ');
              this.logger.log(`Creating feedback for productId: ${productId}, telegramId: ${telegramId}`);
              await this.feedbackService.create({
                telegramId: msg.from.id.toString(),
                productId,
                rating: parseInt(rating),
                comment: comment.join(' '),
              });
              this.bot.sendMessage(chatId, 'Feedback qabul qilindi!');
            } catch (error) {
              this.logger.error(`Error in feedback for productId: ${productId}: ${error.message}`, error.stack);
              this.bot.sendMessage(chatId, 'Feedback qoldirishda xato yuz berdi.');
            }
          });
        } else if (data === 'clear_cart') {
          this.logger.log(`Clearing cart for telegramId: ${telegramId}`);
          await this.cartService.clearCart(telegramId);
          this.bot.sendMessage(chatId, 'Savatcha tozalandi.');
        } else if (data === 'add_category') {
          this.bot.sendMessage(chatId, 'Yangi kategoriya nomini kiriting:', { reply_markup: { force_reply: true } });
          this.bot.once('message', async (msg) => {
            try {
              this.logger.log(`Creating category with name: ${msg.text}`);
              await this.categoryService.create({ name: msg.text, description: '' });
              this.bot.sendMessage(chatId, 'Kategoriya qo‘shildi.');
            } catch (error) {
              this.logger.error(`Error in add_category: ${error.message}`, error.stack);
              this.bot.sendMessage(chatId, 'Kategoriya qo‘shishda xato yuz berdi.');
            }
          });
        } else if (data === 'add_product') {
          this.bot.sendMessage(
            chatId,
            'Mahsulot ma‘lumotlarini kiriting (nomi;narxi;tasviri;rasm URL;kategoriya ID). Vergul (,) ishlatmang, o‘rniga nuqta-vergul (;) ishlating:',
            { reply_markup: { force_reply: true } },
          );
          this.bot.once('message', async (msg) => {
            try {
              const [name, price, description, imageUrl, categoryId] = msg.text.split(';');
              const parsedCategoryId = parseInt(categoryId.trim());
              if (isNaN(parsedCategoryId)) {
                this.bot.sendMessage(chatId, 'Kategoriya ID noto‘g‘ri. Iltimos, raqam kiriting.');
                return;
              }
              this.logger.log(`Creating product with categoryId: ${parsedCategoryId}`);
              const category = await this.categoryService.findOne(parsedCategoryId);
              if (!category) {
                this.bot.sendMessage(chatId, `Kategoriya ID ${parsedCategoryId} topilmadi.`);
                return;
              }
              await this.productService.create({
                name: name.trim(),
                price: parseFloat(price.trim()),
                description: description.trim(),
                imageUrl: imageUrl.trim(),
                categoryId: parsedCategoryId,
                stock: 10,
                isActive: true,
              });
              this.bot.sendMessage(chatId, 'Mahsulot qo‘shildi.');
            } catch (error) {
              this.logger.error(`Error in add_product: ${error.message}`, error.stack);
              this.bot.sendMessage(chatId, 'Mahsulot qo‘shishda xato yuz berdi: ' + error.message);
            }
          });
        } else if (data === 'view_orders') {
          const orders = await this.orderService.findAll();
          this.logger.log(`Fetched ${orders.length} orders`);
          let message = 'Buyurtmalar:\n';
          orders.forEach((order) => {
            message += `ID: ${order.id}, Jami: ${order.totalAmount} so‘m, Status: ${order.status}\n`;
          });
          this.bot.sendMessage(chatId, message);
        } else if (data === 'view_feedback') {
          const feedbacks = await this.feedbackService.findAll();
          this.logger.log(`Fetched ${feedbacks.length} feedbacks`);
          let message = 'Feedbacklar:\n';
          feedbacks.forEach((fb) => {
            message += `Mahsulot ID: ${fb.product.id}, Reyting: ${fb.rating}, Izoh: ${fb.comment}\n`;
          });
          this.bot.sendMessage(chatId, message);
        } else if (data === 'create_promocode') {
          this.bot.sendMessage(chatId, 'Promo-kod ma‘lumotlarini kiriting (kod;foiz;amal qilish muddati yyyy-mm-dd):', {
            reply_markup: { force_reply: true },
          });
          this.bot.once('message', async (msg) => {
            try {
              const [code, discountPercent, validTill] = msg.text.split(';');
              this.logger.log(`Creating promocode: ${code}`);
              await this.promocodeService.create({
                code: code.trim(),
                discountPercent: parseInt(discountPercent.trim()),
                validTill: new Date(validTill.trim()),
              });
              this.bot.sendMessage(chatId, 'Promo-kod yaratildi.');
            } catch (error) {
              this.logger.error(`Error in create_promocode: ${error.message}`, error.stack);
              this.bot.sendMessage(chatId, 'Promo-kod yaratishda xato yuz berdi: ' + error.message);
            }
          });
        } else if (data === 'view_stats') {
          const stats = await this.orderService.getStats();
          this.logger.log(`Fetched stats: totalOrders=${stats.totalOrders}, totalAmount=${stats.totalAmount}`);
          this.bot.sendMessage(chatId, `Jami buyurtmalar: ${stats.totalOrders}\nJami summa: ${stats.totalAmount} so‘m`);
        }
      } catch (error) {
        this.logger.error(`Error in callback_query for telegramId: ${telegramId}: ${error.message}`, error.stack);
        this.bot.sendMessage(chatId, 'Xatolik yuz berdi, iltimos keyinroq urinib ko‘ring.');
      }
    });
  }

  async handleWebhookUpdate(update: TelegramBot.Update) {
    try {
      this.logger.log(`Processing webhook update: ${JSON.stringify(update, null, 2)}`);
      await this.bot.processUpdate(update);
      this.logger.log('Webhook update processed successfully');
    } catch (error) {
      this.logger.error(`Webhook update failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}