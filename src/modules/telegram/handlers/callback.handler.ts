import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { CategoryService } from '../../category/category.service';
import { ProductService } from '../../product/product.service';
import { UserService } from '../../user/user.service';
import { OrderService } from '../../order/order.service';
import { FeedbackService } from '../../feedback/feedback.service';
import { PromocodeService } from '../../promocode/promocode.service';
import { DeliveryService } from '../../delivery/delivery.service';
import { TelegramService } from '../telegram.service';
import { formatCategoryList, formatProductList, formatUserList, formatOrderList, formatFeedbackList, formatDeliveryList, formatStats } from '../utils/helpers';
import { getAdminKeyboard } from '../utils/keyboards';

@Injectable()
export class CallbackHandler {
  private logger = new Logger(CallbackHandler.name);

  constructor(
    private categoryService: CategoryService,
    private productService: ProductService,
    private userService: UserService,
    private orderService: OrderService,
    private feedbackService: FeedbackService,
    private promocodeService: PromocodeService,
    private deliveryService: DeliveryService,
    private telegramService: TelegramService,
  ) {}

  handle() {
    const bot = this.telegramService.getBotInstance();
    bot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const telegramId = query.from.id.toString();
      const data = query.data;
      let language = 'uz';

      try {
        this.logger.log(`Received callback: ${data}, telegramId: ${telegramId}`);
        const user = await this.userService.findByTelegramId(telegramId);
        language = user?.language || 'uz';
        this.logger.log(`User language set to: ${language}`);

        if (
          data.startsWith('add_') ||
          data.startsWith('edit_') ||
          data.startsWith('delete_') ||
          data.startsWith('view_') ||
          data.startsWith('stats_')
        ) {
          if (!user?.isAdmin) {
            const message = language === 'uz'
              ? '❌ Bu amal faqat adminlar uchun mavjud.'
              : '❌ Это действие доступно только администраторам.';
            await this.telegramService.sendMessage(chatId, message, {});
            return;
          }
        }

        if (data === 'add_category') {
          const message = language === 'uz' ? '📋 Kategoriya nomini kiriting (o‘zbekcha):' : '📋 Введите название категории (на узбекском):';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { force_reply: true } });
          bot.once('message', async (msgName) => {
            const name = msgName.text;
            const messageRu = language === 'uz' ? '📋 Kategoriya nomini kiriting (ruscha):' : '📋 Введите название категории (на русском):';
            await this.telegramService.sendMessage(chatId, messageRu, { reply_markup: { force_reply: true } });
            bot.once('message', async (msgNameRu) => {
              const nameRu = msgNameRu.text;
              const descMessage = language === 'uz' ? '📝 Kategoriya tavsifini kiriting (o‘zbekcha):' : '📝 Введите описание категории (на узбекском):';
              await this.telegramService.sendMessage(chatId, descMessage, { reply_markup: { force_reply: true } });
              bot.once('message', async (msgDesc) => {
                const descMessageRu = language === 'uz' ? '📝 Kategoriya tavsifini kiriting (ruscha, ixtiyoriy):' : '📝 Введите описание категории (на русском, необязательно):';
                await this.telegramService.sendMessage(chatId, descMessageRu, { reply_markup: { force_reply: true } });
                bot.once('message', async (msgDescRu) => {
                  try {
                    await this.categoryService.create({
                      name: name.trim(),
                      nameRu: nameRu.trim(),
                      description: msgDesc.text.trim(),
                      descriptionRu: msgDescRu.text.trim() || null,
                    });
                    const successMessage = language === 'uz' ? '✅ Kategoriya qo‘shildi!' : '✅ Категория добавлена!';
                    await this.telegramService.sendMessage(chatId, successMessage, {
                      reply_markup: getAdminKeyboard(language),
                    });
                  } catch (error) {
                    this.logger.error(`Error in add_category: ${error.message}`);
                    const errorMessage = language === 'uz' ? '❌ Kategoriya qo‘shishda xato yuz berdi.' : '❌ Ошибка при добавлении категории.';
                    await this.telegramService.sendMessage(chatId, errorMessage, {});
                  }
                });
              });
            });
          });
        } else if (data === 'view_categories') {
          const categories = await this.categoryService.findAll();
          await this.telegramService.sendMessage(chatId, formatCategoryList(categories, language), {
            parse_mode: 'HTML',
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'edit_category') {
          const categories = await this.categoryService.findAll();
          const keyboard = categories.map((cat) => [
            { text: language === 'uz' ? cat.name : cat.nameRu || cat.name, callback_data: `edit_cat_${cat.id}` },
          ]);
          const message = language === 'uz' ? '✏️ Tahrir qilinadigan kategoriyani tanlang:' : '✏️ Выберите категорию для редактирования:';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { inline_keyboard: keyboard } });
        } else if (data.startsWith('edit_cat_')) {
          const categoryId = parseInt(data.split('_')[2]);
          const message = language === 'uz' ? '📋 Yangi kategoriya nomini kiriting (o‘zbekcha):' : '📋 Введите новое название категории (на узбекском):';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { force_reply: true } });
          bot.once('message', async (msgName) => {
            const name = msgName.text;
            const messageRu = language === 'uz' ? '📋 Yangi kategoriya nomini kiriting (ruscha):' : '📋 Введите новое название категории (на русском):';
            await this.telegramService.sendMessage(chatId, messageRu, { reply_markup: { force_reply: true } });
            bot.once('message', async (msgNameRu) => {
              const nameRu = msgNameRu.text;
              const descMessage = language === 'uz' ? '📝 Yangi kategoriya tavsifini kiriting (o‘zbekcha):' : '📝 Введите новое описание категории (на узбекском):';
              await this.telegramService.sendMessage(chatId, descMessage, { reply_markup: { force_reply: true } });
              bot.once('message', async (msgDesc) => {
                const descMessageRu = language === 'uz' ? '📝 Yangi kategoriya tavsifini kiriting (ruscha, ixtiyoriy):' : '📝 Введите новое описание категории (на русском, необязательно):';
                await this.telegramService.sendMessage(chatId, descMessageRu, { reply_markup: { force_reply: true } });
                bot.once('message', async (msgDescRu) => {
                  try {
                    await this.categoryService.update(categoryId, {
                      name: name.trim(),
                      nameRu: nameRu.trim(),
                      description: msgDesc.text.trim(),
                      descriptionRu: msgDescRu.text.trim() || null,
                    });
                    const successMessage = language === 'uz' ? '✅ Kategoriya yangilandi!' : '✅ Категория обновлена!';
                    await this.telegramService.sendMessage(chatId, successMessage, {
                      reply_markup: getAdminKeyboard(language),
                    });
                  } catch (error) {
                    this.logger.error(`Error in edit_category: ${error.message}`);
                    const errorMessage = language === 'uz' ? '❌ Kategoriyani tahrirlashda xato yuz berdi.' : '❌ Ошибка при редактировании категории.';
                    await this.telegramService.sendMessage(chatId, errorMessage, {});
                  }
                });
              });
            });
          });
        } else if (data === 'delete_category') {
          const categories = await this.categoryService.findAll();
          const keyboard = categories.map((cat) => [
            { text: language === 'uz' ? cat.name : cat.nameRu || cat.name, callback_data: `delete_cat_${cat.id}` },
          ]);
          const message = language === 'uz' ? '🗑 O‘chiriladigan kategoriyani tanlang:' : '🗑 Выберите категорию для удаления:';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { inline_keyboard: keyboard } });
        } else if (data.startsWith('delete_cat_')) {
          const categoryId = parseInt(data.split('_')[2]);
          await this.categoryService.remove(categoryId);
          const message = language === 'uz' ? '✅ Kategoriya o‘chirildi.' : '✅ Категория удалена.';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'add_product') {
          const message = language === 'uz'
            ? '📦 Mahsulot ma‘lumotlarini kiriting (nomi o‘zbekcha;nom ruscha;narxi;tasviri o‘zbekcha;tasviri ruscha;rasm URL;kategoriya ID;ombordagi soni):'
            : '📦 Введите данные товара (название на узбекском;название на русском;цена;описание на узбекском;описание на русском;URL изображения;ID категории;кол-во на складе):';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { force_reply: true } });
          bot.once('message', async (msg) => {
            try {
              const [name, nameRu, price, description, descriptionRu, imageUrl, categoryId, stock] = msg.text.split(';');
              const parsedCategoryId = parseInt(categoryId.trim());
              const parsedStock = parseInt(stock.trim());
              if (isNaN(parsedCategoryId) || isNaN(parsedStock)) {
                const errorMessage = language === 'uz'
                  ? '❌ Kategoriya ID yoki ombor soni noto‘g‘ri.'
                  : '❌ Неверный ID категории или количество на складе.';
                await this.telegramService.sendMessage(chatId, errorMessage, {});
                return;
              }
              const category = await this.categoryService.findOne(parsedCategoryId);
              if (!category) {
                const errorMessage = language === 'uz'
                  ? `❌ Kategoriya ID ${parsedCategoryId} topilmadi.`
                  : `❌ Категория с ID ${parsedCategoryId} не найдена.`;
                await this.telegramService.sendMessage(chatId, errorMessage, {});
                return;
              }
              await this.productService.create({
                name: name.trim(),
                nameRu: nameRu.trim(),
                price: parseFloat(price.trim()),
                description: description.trim(),
                descriptionRu: descriptionRu.trim() || null,
                imageUrl: imageUrl.trim(),
                categoryId: parsedCategoryId,
                stock: parsedStock,
                isActive: true,
              });
              const successMessage = language === 'uz' ? '✅ Mahsulot qo‘shildi.' : '✅ Товар добавлен.';
              await this.telegramService.sendMessage(chatId, successMessage, {
                reply_markup: getAdminKeyboard(language),
              });
            } catch (error) {
              this.logger.error(`Error in add_product: ${error.message}`);
              const errorMessage = language === 'uz' ? '❌ Mahsulot qo‘shishda xato yuz berdi.' : '❌ Ошибка при добавлении товара.';
              await this.telegramService.sendMessage(chatId, errorMessage, {});
            }
          });
        } else if (data === 'view_products') {
          const products = await this.productService.findAll();
          await this.telegramService.sendMessage(chatId, formatProductList(products, language), {
            parse_mode: 'HTML',
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'edit_product') {
          const products = await this.productService.findAll();
          const keyboard = products.map((prod) => [
            { text: language === 'uz' ? prod.name : prod.nameRu || prod.name, callback_data: `edit_prod_${prod.id}` },
          ]);
          const message = language === 'uz' ? '✏️ Tahrir qilinadigan mahsulotni tanlang:' : '✏️ Выберите товар для редактирования:';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { inline_keyboard: keyboard } });
        } else if (data.startsWith('edit_prod_')) {
          const productId = parseInt(data.split('_')[2]);
          const message = language === 'uz'
            ? '📦 Yangi mahsulot ma‘lumotlarini kiriting (nomi o‘zbekcha;nom ruscha;narxi;tasviri o‘zbekcha;tasviri ruscha;rasm URL;kategoriya ID;ombordagi soni):'
            : '📦 Введите новые данные товара (название на узбекском;название на русском;цена;описание на узбекском;описание на русском;URL изображения;ID категории;кол-во на складе):';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { force_reply: true } });
          bot.once('message', async (msg) => {
            try {
              const [name, nameRu, price, description, descriptionRu, imageUrl, categoryId, stock] = msg.text.split(';');
              const parsedCategoryId = parseInt(categoryId.trim());
              const parsedStock = parseInt(stock.trim());
              if (isNaN(parsedCategoryId) || isNaN(parsedStock)) {
                const errorMessage = language === 'uz'
                  ? '❌ Kategoriya ID yoki ombor soni noto‘g‘ri.'
                  : '❌ Неверный ID категории или количество на складе.';
                await this.telegramService.sendMessage(chatId, errorMessage, {});
                return;
              }
              const category = await this.categoryService.findOne(parsedCategoryId);
              if (!category) {
                const errorMessage = language === 'uz'
                  ? `❌ Kategoriya ID ${parsedCategoryId} topilmadi.`
                  : `❌ Категория с ID ${parsedCategoryId} не найдена.`;
                await this.telegramService.sendMessage(chatId, errorMessage, {});
                return;
              }
              await this.productService.update(productId, {
                name: name.trim(),
                nameRu: nameRu.trim(),
                price: parseFloat(price.trim()),
                description: description.trim(),
                descriptionRu: descriptionRu.trim() || null,
                imageUrl: imageUrl.trim(),
                categoryId: parsedCategoryId,
                stock: parsedStock,
              });
              const successMessage = language === 'uz' ? '✅ Mahsulot yangilandi.' : '✅ Товар обновлен.';
              await this.telegramService.sendMessage(chatId, successMessage, {
                reply_markup: getAdminKeyboard(language),
              });
            } catch (error) {
              this.logger.error(`Error in edit_product: ${error.message}`);
              const errorMessage = language === 'uz' ? '❌ Mahsulotni tahrirlashda xato yuz berdi.' : '❌ Ошибка при редактировании товара.';
              await this.telegramService.sendMessage(chatId, errorMessage, {});
            }
          });
        } else if (data === 'delete_product') {
          const products = await this.productService.findAll();
          const keyboard = products.map((prod) => [
            { text: language === 'uz' ? prod.name : prod.nameRu || prod.name, callback_data: `delete_prod_${prod.id}` },
          ]);
          const message = language === 'uz' ? '🗑 O‘chiriladigan mahsulotni tanlang:' : '🗑 Выберите товар для удаления:';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { inline_keyboard: keyboard } });
        } else if (data.startsWith('delete_prod_')) {
          const productId = parseInt(data.split('_')[2]);
          await this.productService.remove(productId);
          const message = language === 'uz' ? '✅ Mahsulot o‘chirildi.' : '✅ Товар удален.';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'view_users') {
          const users = await this.userService.findAll();
          await this.telegramService.sendMessage(chatId, formatUserList(users, language), {
            parse_mode: 'HTML',
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'edit_user') {
          const users = await this.userService.findAll();
          const keyboard = users.map((user) => [
            { text: user.fullName || (language === 'uz' ? 'Kiritilmagan' : 'Не указано'), callback_data: `edit_user_${user.id}` },
          ]);
          const message = language === 'uz' ? '✏️ Tahrir qilinadigan foydalanuvchini tanlang:' : '✏️ Выберите пользователя для редактирования:';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { inline_keyboard: keyboard } });
        } else if (data.startsWith('edit_user_')) {
          const userId = parseInt(data.split('_')[2]);
          const message = language === 'uz'
            ? '👤 Yangi ism va telefon raqamini kiriting (ism;telefon):'
            : '👤 Введите новое имя и номер телефона (имя;телефон):';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { force_reply: true } });
          bot.once('message', async (msg) => {
            try {
              const [fullName, phone] = msg.text.split(';');
              await this.userService.update(userId, { fullName: fullName.trim(), phone: phone.trim() });
              const successMessage = language === 'uz' ? '✅ Foydalanuvchi ma‘lumotlari yangilandi.' : '✅ Данные пользователя обновлены.';
              await this.telegramService.sendMessage(chatId, successMessage, {
                reply_markup: getAdminKeyboard(language),
              });
            } catch (error) {
              this.logger.error(`Error in edit_user: ${error.message}`);
              const errorMessage = language === 'uz' ? '❌ Foydalanuvchini tahrirlashda xato yuz berdi.' : '❌ Ошибка при редактировании пользователя.';
              await this.telegramService.sendMessage(chatId, errorMessage, {});
            }
          });
        } else if (data === 'delete_user') {
          const users = await this.userService.findAll();
          const keyboard = users.map((user) => [
            { text: user.fullName || (language === 'uz' ? 'Kiritilmagan' : 'Не указано'), callback_data: `delete_user_${user.id}` },
          ]);
          const message = language === 'uz' ? '🗑 O‘chiriladigan foydalanuvchini tanlang:' : '🗑 Выберите пользователя для удаления:';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { inline_keyboard: keyboard } });
        } else if (data.startsWith('delete_user_')) {
          const userId = parseInt(data.split('_')[2]);
          await this.userService.remove(userId);
          const message = language === 'uz' ? '✅ Foydalanuvchi o‘chirildi.' : '✅ Пользователь удален.';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'view_orders') {
          const orders = await this.orderService.findAll(1, 10);
          const keyboard = orders.length === 10 ? [[{ text: language === 'uz' ? '➡️ Keyingi sahifa' : '➡️ Следующая страница', callback_data: 'view_orders_2' }]] : [];
          await this.telegramService.sendMessage(chatId, formatOrderList(orders, language), {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'HTML',
          });
        } else if (data.startsWith('view_orders_')) {
          const page = parseInt(data.split('_')[2]) || 1;
          const orders = await this.orderService.findAll(page, 10);
          const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
          if (orders.length === 10) {
            keyboard.push([{ text: language === 'uz' ? '➡️ Keyingi sahifa' : '➡️ Следующая страница', callback_data: `view_orders_${page + 1}` }]);
          }
          if (page > 1) {
            keyboard.push([{ text: language === 'uz' ? '⬅️ Oldingi sahifa' : '⬅️ Предыдущая страница', callback_data: `view_orders_${page - 1}` }]);
          }
          await this.telegramService.sendMessage(chatId, formatOrderList(orders, language), {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'HTML',
          });
        } else if (data === 'view_deliveries') {
          const deliveries = await this.deliveryService.findAll(1, 10);
          const keyboard = deliveries.length === 10 ? [[{ text: language === 'uz' ? '➡️ Keyingi sahifa' : '➡️ Следующая страница', callback_data: 'view_deliveries_2' }]] : [];
          await this.telegramService.sendMessage(chatId, formatDeliveryList(deliveries, language), {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'HTML',
          });
        } else if (data.startsWith('view_deliveries_')) {
          const page = parseInt(data.split('_')[2]) || 1;
          const deliveries = await this.deliveryService.findAll(page, 10);
          const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
          if (deliveries.length === 10) {
            keyboard.push([{ text: language === 'uz' ? '➡️ Keyingi sahifa' : '➡️ Следующая страница', callback_data: `view_deliveries_${page + 1}` }]);
          }
          if (page > 1) {
            keyboard.push([{ text: language === 'uz' ? '⬅️ Oldingi sahifa' : '⬅️ Предыдущая страница', callback_data: `view_deliveries_${page - 1}` }]);
          }
          await this.telegramService.sendMessage(chatId, formatDeliveryList(deliveries, language), {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'HTML',
          });
        } else if (data === 'edit_delivery') {
          const deliveries = await this.deliveryService.findAll(1, 10);
          const keyboard = deliveries.map((delivery) => [
            { text: `📋 ID: ${delivery.id}`, callback_data: `edit_delivery_${delivery.id}` },
          ]);
          const message = language === 'uz' ? '✏️ Tahrir qilinadigan yetkazib berishni tanlang:' : '✏️ Выберите доставку для редактирования:';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { inline_keyboard: keyboard } });
        } else if (data.startsWith('edit_delivery_')) {
          const deliveryId = parseInt(data.split('_')[2]);
          const message = language === 'uz'
            ? '📊 Yangi statusni kiriting (pending, in_transit, delivered, cancelled):'
            : '📊 Введите новый статус (pending, in_transit, delivered, cancelled):';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { force_reply: true } });
          bot.once('message', async (msg) => {
            try {
              await this.deliveryService.update(deliveryId, { status: msg.text });
              const successMessage = language === 'uz' ? '✅ Yetkazib berish statusi yangilandi.' : '✅ Статус доставки обновлен.';
              await this.telegramService.sendMessage(chatId, successMessage, {
                reply_markup: getAdminKeyboard(language),
              });
            } catch (error) {
              this.logger.error(`Error in edit_delivery: ${error.message}`);
              const errorMessage = language === 'uz' ? '❌ Yetkazib berish statusini yangilashda xato yuz berdi.' : '❌ Ошибка при обновлении статуса доставки.';
              await this.telegramService.sendMessage(chatId, errorMessage, {});
            }
          });
        } else if (data === 'view_feedback') {
          const feedbacks = await this.feedbackService.findAll();
          await this.telegramService.sendMessage(chatId, formatFeedbackList(feedbacks, language), {
            parse_mode: 'HTML',
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'delete_feedback') {
          const feedbacks = await this.feedbackService.findAll();
          const keyboard = feedbacks.map((fb) => [
            { text: `📋 ID: ${fb.id}, ${language === 'uz' ? 'Reyting' : 'Рейтинг'}: ${fb.rating}`, callback_data: `delete_fb_${fb.id}` },
          ]);
          const message = language === 'uz' ? '🗑 O‘chiriladigan feedbackni tanlang:' : '🗑 Выберите отзыв для удаления:';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { inline_keyboard: keyboard } });
        } else if (data.startsWith('delete_fb_')) {
          const feedbackId = parseInt(data.split('_')[2]);
          await this.feedbackService.remove(feedbackId);
          const message = language === 'uz' ? '✅ Feedback o‘chirildi.' : '✅ Отзыв удален.';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'create_promocode') {
          const message = language === 'uz'
            ? '🎟 Promo-kod ma‘lumotlarini kiriting (kod;foiz;amal qilish muddati yyyy-mm-dd):'
            : '🎟 Введите данные промокода (код;процент;срок действия yyyy-mm-dd):';
          await this.telegramService.sendMessage(chatId, message, { reply_markup: { force_reply: true } });
          bot.once('message', async (msg) => {
            try {
              const [code, discountPercent, validTill] = msg.text.split(';');
              await this.promocodeService.create({
                code: code.trim(),
                discountPercent: parseFloat(discountPercent.trim()),
                validTill: new Date(validTill.trim()),
              });
              const successMessage = language === 'uz' ? '✅ Promo-kod qo‘shildi.' : '✅ Промокод добавлен.';
              await this.telegramService.sendMessage(chatId, successMessage, {
                reply_markup: getAdminKeyboard(language),
              });
            } catch (error) {
              this.logger.error(`Error in create_promocode: ${error.message}`);
              const errorMessage = language === 'uz' ? '❌ Promo-kod qo‘shishda xato yuz berdi.' : '❌ Ошибка при добавлении промокода.';
              await this.telegramService.sendMessage(chatId, errorMessage, {});
            }
          });
        } else if (data === 'view_stats') {
          const stats = await this.orderService.getStats();
          await this.telegramService.sendMessage(chatId, formatStats(stats, language), {
            parse_mode: 'HTML',
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'my_profile') {
          const user = await this.userService.findByTelegramId(telegramId);
          const message = language === 'uz'
            ? `👤 Ismingiz: ${user.fullName || 'Kiritilmagan'}\n📞 Telefon: ${user.phone || 'Kiritilmagan'}`
            : `👤 Ваше имя: ${user.fullName || 'Не указано'}\n📞 Телефон: ${user.phone || 'Не указано'}`;
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'about_us') {
          const message = language === 'uz'
            ? 'ℹ️ Biz haqimizda: Bu bot sizga mahsulotlar, buyurtmalar va foydalanuvchilar bilan ishlashda yordam beradi.'
            : 'ℹ️ О нас: Этот бот помогает вам работать с товарами, заказами и пользователями.';
          await this.telegramService.sendMessage(chatId, message, {
            reply_markup: getAdminKeyboard(language),
          });
        } else if (data === 'order_history') {
          const orders = await this.orderService.findAll(1, 10);
          await this.telegramService.sendMessage(chatId, formatOrderList(orders, language), {
            parse_mode: 'HTML',
            reply_markup: getAdminKeyboard(language),
          });
        }

      } catch (error) {
        this.logger.error(`Error in callback: ${error.message}`);
        const message = language === 'uz'
          ? '❌ Xatolik yuz berdi, iltimos keyinroq urinib ko‘ring.'
          : '❌ Произошла ошибка, попробуйте позже.';
        await this.telegramService.sendMessage(chatId, message, {});
      } finally {
        try {
          await bot.answerCallbackQuery(query.id);
        } catch (err) {
          this.logger.error(`Error in answerCallbackQuery: ${err.message}`);
        }
      }
    });
  }
}