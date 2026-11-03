import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// 8 товаров из оригинального data.js (точное соответствие полей фронтенда)
const baseProducts = [
  {
    name: 'Essential Oversize Tee',
    price: 3490,
    oldPrice: 4290,
    category: 'Топы',
    tags: ['oversize', 'black', 'cotton'],
    sizes: ['S', 'M', 'L', 'XL'],
    rating: 4.8,
    reviewsCount: 184,
    color: 'Черный',
    description: 'Свободная футболка из плотного хлопка 240 gsm. Опущенная линия плеча, удлиненный силуэт. Универсальная база для любого образа.',
    details: ['100% хлопок', 'Плотность 240 gsm', 'Свободный крой', 'Универсальная длина'],
    accent: '#111111',
  },
  {
    name: 'Structured Zip Hoodie',
    price: 7990,
    oldPrice: 0,
    category: 'Худи',
    tags: ['hoodie', 'zip', 'minimal'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    rating: 4.9,
    reviewsCount: 89,
    color: 'Темно-серый',
    description: 'Структурированное худи на молнии. Плотный футер, конструктивный капюшон, рельефные швы.',
    details: ['80% хлопок, 20% полиэстер', 'Плотный футер', 'Молния YKK', 'Конструктивный капюшон'],
    accent: '#2a2a2a',
  },
  {
    name: 'Wide Leg Tailored Pants',
    price: 6890,
    oldPrice: 0,
    category: 'Брюки',
    tags: ['wide', 'tailored', 'mono'],
    sizes: ['S', 'M', 'L', 'XL'],
    rating: 4.7,
    reviewsCount: 67,
    color: 'Графит',
    description: 'Широкие брюки с защипами. Высокая посадка, стрелки, пояс на кулиске.',
    details: ['65% полиэстер, 35% вискоза', 'Высокая посадка', 'Стрелки', 'Кулиска на поясе'],
    accent: '#3d3d3d',
  },
  {
    name: 'Boxy Cropped Jacket',
    price: 10490,
    oldPrice: 13900,
    category: 'Верхняя одежда',
    tags: ['jacket', 'boxy', 'new'],
    sizes: ['S', 'M', 'L', 'XL'],
    rating: 4.6,
    reviewsCount: 45,
    color: 'Хаки',
    description: 'Укороченная куртка свободного кроя. Воротник-стойка, утяжки, скрытые кнопки.',
    details: ['100% нейлон', 'Подкладка из сетки', 'Скрытые кнопки', 'Утяжка по низу'],
    accent: '#4a5a3a',
  },
  {
    name: 'Rib Longsleeve Top',
    price: 4290,
    oldPrice: 0,
    category: 'Топы',
    tags: ['rib', 'fitted', 'basic'],
    sizes: ['XS', 'S', 'M', 'L'],
    rating: 4.5,
    reviewsCount: 93,
    color: 'Молочный',
    description: 'Лонгслив в мелкий рубчик. Прилегающий силуэт, мягкий эластичный трикотаж.',
    details: ['95% хлопок, 5% эластан', 'Мелкий рубчик', 'Прилегающий крой', 'Эластичные манжеты'],
    accent: '#f0ece8',
  },
  {
    name: 'Minimal Carry Tote',
    price: 5290,
    oldPrice: 0,
    category: 'Аксессуары',
    tags: ['bag', 'tote', 'daily'],
    sizes: ['ONE SIZE'],
    rating: 4.4,
    reviewsCount: 38,
    color: 'Песочный',
    description: 'Минималистичная сумка-тоут из плотного канваса. Внутренний карман, магнитная застежка.',
    details: ['Плотный канвас', 'Внутренний карман', 'Магнитная застежка', '40 x 35 x 12 см'],
    accent: '#c8b8a0',
  },
  {
    name: 'Mono Sneakers',
    price: 9490,
    oldPrice: 0,
    category: 'Обувь',
    tags: ['sneakers', 'mono', 'street'],
    sizes: ['39', '40', '41', '42', '43', '44'],
    rating: 4.7,
    reviewsCount: 71,
    color: 'Белый',
    description: 'Монохромные кеды из гладкой кожи. Минимализм, вулканизированная подошва.',
    details: ['Натуральная кожа', 'Вулканизированная подошва', 'Ортопедическая стелька', 'Усиленный задник'],
    accent: '#e8e8e8',
  },
  {
    name: 'Contour Cap',
    price: 2590,
    oldPrice: 0,
    category: 'Аксессуары',
    tags: ['cap', 'street', 'light'],
    sizes: ['ONE SIZE'],
    rating: 4.3,
    reviewsCount: 52,
    color: 'Серый',
    description: 'Бейсболка с контурным логотипом. Изогнутый козырек, регулировка сзади.',
    details: ['100% хлопок', 'Изогнутый козырек', 'Регулируемый ремешок', 'Вышитый логотип'],
    accent: '#8a8a8a',
  },
];

// Цвета на русском для генерации
const colorNames = [
  'Черный', 'Белый', 'Серый', 'Темно-серый', 'Графит',
  'Молочный', 'Бежевый', 'Песочный', 'Хаки', 'Оливковый',
  'Синий', 'Темно-синий', 'Бордовый', 'Коричневый', 'Терракотовый',
];

const categories = ['Топы', 'Худи', 'Брюки', 'Верхняя одежда', 'Аксессуары', 'Обувь'];

const tagSets: Record<string, string[][]> = {
  'Топы': [['cotton', 'basic'], ['oversize', 'print'], ['slim', 'minimal'], ['rib', 'fitted']],
  'Худи': [['oversize', 'fleece'], ['zip', 'sport'], ['cotton', 'basic'], ['hoodie', 'minimal']],
  'Брюки': [['wide', 'tailored'], ['jogger', 'sport'], ['slim', 'casual'], ['cargo', 'street']],
  'Верхняя одежда': [['jacket', 'new'], ['coat', 'wool'], ['windbreaker', 'light'], ['bomber', 'street']],
  'Аксессуары': [['bag', 'daily'], ['cap', 'street'], ['scarf', 'wool'], ['tote', 'minimal']],
  'Обувь': [['sneakers', 'mono'], ['boots', 'leather'], ['loafers', 'classic'], ['runners', 'sport']],
};

const nameTemplates: Record<string, string[]> = {
  'Топы': ['Classic Cotton Tee', 'Boxy Print Tee', 'Slim Fit Top', 'Relaxed V-Neck', 'Mock Neck Tee', 'Pocket Tee', 'Crop Top Basic', 'Layered Tank', 'Henley Longsleeve', 'Striped Tee', 'Acid Wash Tee', 'Thermal Henley', 'Mesh Panel Top', 'Oversized Polo', 'Raw Edge Tee'],
  'Худи': ['Fleece Pullover Hoodie', 'Tech Zip Hoodie', 'Heavyweight Sweatshirt', 'Cropped Hoodie', 'Kangaroo Pocket Hood', 'Quarter Zip Fleece', 'Vintage Wash Hoodie', 'Oversized Crew Sweat', 'Waffle Knit Pullover', 'Color Block Hoodie', 'French Terry Crew', 'Graphic Print Hood', 'Anorak Hoodie', 'Funnel Neck Sweat', 'Raglan Sleeve Hood'],
  'Брюки': ['Relaxed Chinos', 'Cargo Joggers', 'Slim Fit Trousers', 'Pleated Wide Pants', 'Tech Cargo Pants', 'Drawstring Pants', 'Cropped Trousers', 'Tapered Joggers', 'Utility Cargo', 'Linen Blend Pants', 'Pinstripe Trousers', 'Sweatpants Classic', 'Track Pants', 'Corduroy Wide Leg', 'Workwear Pants'],
  'Верхняя одежда': ['Quilted Bomber', 'Wool Blend Coat', 'Windbreaker Shell', 'Puffer Vest', 'Trench Coat', 'Denim Jacket', 'Coach Jacket', 'Parka Long', 'Shacket Flannel', 'Rain Jacket', 'Varsity Bomber', 'Fleece Jacket', 'Field Jacket', 'Leather Biker', 'Kimono Wrap'],
  'Аксессуары': ['Canvas Crossbody', 'Knit Beanie', 'Leather Belt', 'Wool Scarf', 'Bucket Hat', 'Card Wallet', 'Laptop Sleeve', 'Weekend Duffle', 'Phone Pouch', 'Keychain Lanyard', 'Socks Pack 3', 'Bandana Print', 'Gloves Knit', 'Sunglasses Round', 'Watch Strap'],
  'Обувь': ['Chelsea Boots', 'Suede Loafers', 'Runner Sneakers', 'Slide Sandals', 'High Top Canvas', 'Desert Boots', 'Platform Sneakers', 'Mule Slippers', 'Trail Runners', 'Minimalist Oxfords', 'Chunky Trainers', 'Espadrilles', 'Hiking Boots', 'Flip Flops', 'Sock Sneakers'],
};

const descTemplates: Record<string, string> = {
  'Топы': 'Качественная вещь из коллекции Galenite. Мягкий хлопковый трикотаж, продуманный крой.',
  'Худи': 'Уютная вещь из коллекции Galenite. Плотный материал, комфортная посадка.',
  'Брюки': 'Стильные брюки из коллекции Galenite. Качественная ткань, современный силуэт.',
  'Верхняя одежда': 'Функциональная вещь из коллекции Galenite. Продуманные детали, актуальный крой.',
  'Аксессуары': 'Минималистичный аксессуар из коллекции Galenite. Качественные материалы.',
  'Обувь': 'Комфортная обувь из коллекции Galenite. Натуральные материалы, ортопедическая стелька.',
};

const accentColors = ['#111111', '#2a2a2a', '#3d3d3d', '#4a5a3a', '#f0ece8', '#c8b8a0', '#e8e8e8', '#8a8a8a', '#5c4a3a', '#3a4a5c'];

function generateProducts() {
  const generated = [];

  for (const category of categories) {
    const names = nameTemplates[category];
    const tags = tagSets[category];

    for (let i = 0; i < 15; i++) {
      const price = Math.round((Math.random() * 12000 + 1500) / 100) * 100;
      const hasOldPrice = Math.random() > 0.7;
      const sizes = category === 'Обувь'
        ? ['39', '40', '41', '42', '43', '44'].slice(0, 3 + Math.floor(Math.random() * 3))
        : category === 'Аксессуары'
          ? ['ONE SIZE']
          : ['XS', 'S', 'M', 'L', 'XL'].slice(0, 3 + Math.floor(Math.random() * 3));

      generated.push({
        name: names[i],
        price,
        oldPrice: hasOldPrice ? Math.round(price * (1.2 + Math.random() * 0.3) / 100) * 100 : 0,
        category,
        tags: tags[i % tags.length],
        sizes,
        rating: +(3.5 + Math.random() * 1.5).toFixed(1),
        reviewsCount: Math.floor(Math.random() * 200),
        color: colorNames[Math.floor(Math.random() * colorNames.length)],
        description: `${names[i]}. ${descTemplates[category]}`,
        details: ['Премиум материалы', 'Фирменная фурнитура', 'Аккуратные швы', 'Фирменный пакет'],
        accent: accentColors[Math.floor(Math.random() * accentColors.length)],
      });
    }
  }

  return generated;
}

async function seed() {
  console.log('Очистка БД...');
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.deliveryAddress.deleteMany();
  await prisma.discountRule.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.exchangeLog.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // Админ
  console.log('Создание админа...');
  const adminHash = await bcrypt.hash('admin123', 12);
  await prisma.user.create({
    data: {
      email: 'admin@psl.ru',
      passwordHash: adminHash,
      name: 'Администратор',
      role: 'ADMIN',
    },
  });

  // Тестовый пользователь
  const userHash = await bcrypt.hash('user123', 12);
  await prisma.user.create({
    data: {
      email: 'user@test.ru',
      passwordHash: userHash,
      name: 'Тестовый пользователь',
      phone: '+79001234567',
    },
  });

  // Товары
  console.log('Импорт товаров...');
  const allProducts = [...baseProducts, ...generateProducts()];

  for (const product of allProducts) {
    await prisma.product.create({ data: product });
  }

  console.log(`Создано ${allProducts.length} товаров`);

  // Тестовые скидки
  console.log('Создание скидочных правил...');
  await prisma.discountRule.createMany({
    data: [
      {
        name: 'Скидка 10% на базовые вещи',
        type: 'PERCENT',
        value: 10,
        targetTags: ['cotton', 'basic'],
        priority: 1,
        isActive: true,
      },
      {
        name: 'Промокод WELCOME - 500 руб',
        type: 'FIXED',
        value: 500,
        promoCode: 'WELCOME',
        priority: 5,
        isActive: true,
      },
      {
        name: 'Промокод SALE20 - 20%',
        type: 'PERCENT',
        value: 20,
        promoCode: 'SALE20',
        priority: 10,
        isActive: true,
      },
    ],
  });

  console.log('Сидинг завершен!');
}

seed()
  .catch((e) => {
    console.error('Ошибка сидинга:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
