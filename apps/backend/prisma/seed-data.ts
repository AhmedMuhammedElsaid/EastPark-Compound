import 'dotenv/config';
import * as argon2 from 'argon2';
import {
    PrismaClient,
    Role,
    ShopCategory,
    OrderStatus,
    PaymentMethod,
    AnnouncementCategory,
    FeedbackCategory,
    FeedbackStatus,
    NotificationType,
    ElectionVisibilityMode,
} from '@prisma/client';

const db = new PrismaClient();

async function main() {
    const merchantCount = await db.user.count({
        where: { role: Role.MERCHANT },
    });
    if (merchantCount > 0) {
        console.log('Already seeded — skipping.');
        return;
    }

    // ── Admin ──────────────────────────────────────────────────────────────────
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@eastpark.app';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!adminPassword) {
        throw new Error(
            'SEED_ADMIN_PASSWORD env var is required. Set it in your .env file.'
        );
    }
    let admin = await db.user.findUnique({ where: { email: adminEmail } });
    if (!admin) {
        admin = await db.user.create({
            data: {
                name: process.env.SEED_ADMIN_NAME ?? 'EastPark Admin',
                email: adminEmail,
                passwordHash: await argon2.hash(adminPassword),
                role: Role.ADMIN,
                isVerified: true,
                unitNumber: 'ADMIN-01',
            },
        });
        console.log(`✓ Admin: ${admin.email}`);
    } else {
        console.log(`· Admin already exists: ${admin.email}`);
    }

    const merchantPassword = process.env.SEED_MERCHANT_PASSWORD;
    if (!merchantPassword) {
        throw new Error(
            'SEED_MERCHANT_PASSWORD env var is required. Set it in your .env file.'
        );
    }
    const residentPassword = process.env.SEED_RESIDENT_PASSWORD;
    if (!residentPassword) {
        throw new Error(
            'SEED_RESIDENT_PASSWORD env var is required. Set it in your .env file.'
        );
    }
    const mp = await argon2.hash(merchantPassword);
    const rp = await argon2.hash(residentPassword);

    // ── Merchants ──────────────────────────────────────────────────────────────
    const [m1, m2, m3, m4, m5] = await Promise.all([
        db.user.create({
            data: {
                name: 'Youssef Kamal',
                email: 'merchant1@eastpark.app',
                phone: '+201010000001',
                passwordHash: mp,
                role: Role.MERCHANT,
                isVerified: true,
            },
        }),
        db.user.create({
            data: {
                name: 'Nadia Hassan',
                email: 'merchant2@eastpark.app',
                phone: '+201010000002',
                passwordHash: mp,
                role: Role.MERCHANT,
                isVerified: true,
            },
        }),
        db.user.create({
            data: {
                name: 'Khaled Samir',
                email: 'merchant3@eastpark.app',
                phone: '+201010000003',
                passwordHash: mp,
                role: Role.MERCHANT,
                isVerified: true,
            },
        }),
        db.user.create({
            data: {
                name: 'Amira Fathy',
                email: 'merchant4@eastpark.app',
                phone: '+201010000004',
                passwordHash: mp,
                role: Role.MERCHANT,
                isVerified: true,
            },
        }),
        db.user.create({
            data: {
                name: 'Tarek Mansour',
                email: 'merchant5@eastpark.app',
                phone: '+201010000005',
                passwordHash: mp,
                role: Role.MERCHANT,
                isVerified: true,
            },
        }),
    ]);

    // ── Residents ──────────────────────────────────────────────────────────────
    const [r1, r2, r3, r4, r5, r6, r7, r8] = await Promise.all([
        db.user.create({
            data: {
                name: 'Omar Sherif',
                email: 'resident1@eastpark.app',
                phone: '+201001234001',
                unitNumber: 'A101',
                passwordHash: rp,
                role: Role.RESIDENT,
                isVerified: true,
            },
        }),
        db.user.create({
            data: {
                name: 'Salma Ibrahim',
                email: 'resident2@eastpark.app',
                phone: '+201001234002',
                unitNumber: 'A102',
                passwordHash: rp,
                role: Role.RESIDENT,
                isVerified: true,
            },
        }),
        db.user.create({
            data: {
                name: 'Hassan Ali',
                email: 'resident3@eastpark.app',
                phone: '+201001234003',
                unitNumber: 'B201',
                passwordHash: rp,
                role: Role.RESIDENT,
                isVerified: true,
            },
        }),
        db.user.create({
            data: {
                name: 'Dina Mostafa',
                email: 'resident4@eastpark.app',
                phone: '+201001234004',
                unitNumber: 'B202',
                passwordHash: rp,
                role: Role.RESIDENT,
                isVerified: true,
            },
        }),
        db.user.create({
            data: {
                name: 'Karim Nabil',
                email: 'resident5@eastpark.app',
                phone: '+201001234005',
                unitNumber: 'C301',
                passwordHash: rp,
                role: Role.RESIDENT,
                isVerified: true,
            },
        }),
        db.user.create({
            data: {
                name: 'Layla Mansour',
                email: 'resident6@eastpark.app',
                phone: '+201001234006',
                unitNumber: 'D401',
                passwordHash: rp,
                role: Role.RESIDENT,
                isVerified: true,
            },
        }),
        db.user.create({
            data: {
                name: 'Tarek Badawi',
                email: 'resident7@eastpark.app',
                phone: '+201001234007',
                unitNumber: 'D402',
                passwordHash: rp,
                role: Role.RESIDENT,
                isVerified: true,
            },
        }),
        db.user.create({
            data: {
                name: 'Rana Fouad',
                email: 'resident8@eastpark.app',
                phone: '+201001234008',
                unitNumber: 'E501',
                passwordHash: rp,
                role: Role.RESIDENT,
                isVerified: true,
            },
        }),
    ]);

    console.log('✓ Users created');

    const wh = {
        mon: { open: '08:00', close: '22:00', closed: false },
        tue: { open: '08:00', close: '22:00', closed: false },
        wed: { open: '08:00', close: '22:00', closed: false },
        thu: { open: '08:00', close: '22:00', closed: false },
        fri: { open: '10:00', close: '23:00', closed: false },
        sat: { open: '10:00', close: '23:00', closed: false },
        sun: { open: '08:00', close: '22:00', closed: false },
    };

    // ── Shops ──────────────────────────────────────────────────────────────────
    const cafe = await db.shop.create({
        data: {
            name: 'The Brew Corner',
            nameAr: 'ركن القهوة',
            description: 'Specialty coffee & fresh pastries',
            descriptionAr: 'قهوة مميزة ومعجنات طازجة',
            category: ShopCategory.CAFE_AND_FOOD,
            workingHours: wh,
            isOpen: true,
            phone: '+201010000001',
            whatsapp: '+201010000001',
            deliveryTime: 25,
            merchantId: m1.id,
        },
    });
    const grocery = await db.shop.create({
        data: {
            name: 'Al Baraka Grocery',
            nameAr: 'بقالة البركة',
            description: 'Daily essentials & fresh produce',
            descriptionAr: 'احتياجات يومية ومنتجات طازجة',
            category: ShopCategory.GROCERY,
            workingHours: wh,
            isOpen: true,
            phone: '+201010000002',
            whatsapp: '+201010000002',
            deliveryTime: 20,
            merchantId: m2.id,
        },
    });
    const butcher = await db.shop.create({
        data: {
            name: 'Al Salam Butcher',
            nameAr: 'جزارة السلام',
            description: 'Fresh halal meat & poultry',
            descriptionAr: 'لحوم ودواجن حلال طازجة',
            category: ShopCategory.BUTCHER,
            workingHours: wh,
            isOpen: true,
            phone: '+201010000003',
            whatsapp: '+201010000003',
            deliveryTime: 30,
            merchantId: m3.id,
        },
    });
    const services = await db.shop.create({
        data: {
            name: 'East Fix Services',
            nameAr: 'خدمات إيست فيكس',
            description: 'Home maintenance & repairs',
            descriptionAr: 'صيانة وإصلاح المنازل',
            category: ShopCategory.SERVICES,
            workingHours: wh,
            isOpen: true,
            phone: '+201010000004',
            whatsapp: '+201010000004',
            deliveryTime: 60,
            merchantId: m4.id,
        },
    });
    const health = await db.shop.create({
        data: {
            name: 'Green Basket',
            nameAr: 'السلة الخضراء',
            description: 'Organic & health foods',
            descriptionAr: 'أغذية عضوية وصحية',
            category: ShopCategory.OTHER,
            workingHours: wh,
            isOpen: true,
            phone: '+201010000005',
            whatsapp: '+201010000005',
            deliveryTime: 35,
            merchantId: m5.id,
        },
    });

    // ── Shop Photos ────────────────────────────────────────────────────────────
    await db.shopPhoto.createMany({
        data: [
            {
                shopId: cafe.id,
                url: 'https://picsum.photos/seed/cafe1/800/600',
                order: 0,
            },
            {
                shopId: cafe.id,
                url: 'https://picsum.photos/seed/cafe2/800/600',
                order: 1,
            },
            {
                shopId: cafe.id,
                url: 'https://picsum.photos/seed/cafe3/800/600',
                order: 2,
            },
            {
                shopId: grocery.id,
                url: 'https://picsum.photos/seed/groc1/800/600',
                order: 0,
            },
            {
                shopId: grocery.id,
                url: 'https://picsum.photos/seed/groc2/800/600',
                order: 1,
            },
            {
                shopId: butcher.id,
                url: 'https://picsum.photos/seed/butch1/800/600',
                order: 0,
            },
            {
                shopId: butcher.id,
                url: 'https://picsum.photos/seed/butch2/800/600',
                order: 1,
            },
            {
                shopId: services.id,
                url: 'https://picsum.photos/seed/svc1/800/600',
                order: 0,
            },
            {
                shopId: health.id,
                url: 'https://picsum.photos/seed/health1/800/600',
                order: 0,
            },
            {
                shopId: health.id,
                url: 'https://picsum.photos/seed/health2/800/600',
                order: 1,
            },
        ],
    });

    console.log('✓ Shops created');

    // ── Products ───────────────────────────────────────────────────────────────
    const [
        espresso,
        cappuccino,
        croissant,
        latte,
        cheesecake,
        matchaLatte,
        coldBrew,
        clubSandwich,
        belgianWaffle,
        icedAmericano,
    ] = await Promise.all([
        db.product.create({
            data: {
                name: 'Espresso',
                nameAr: 'إسبريسو',
                description: 'Double shot espresso',
                descriptionAr: 'إسبريسو مزدوج',
                price: 15,
                imageUrl: 'https://picsum.photos/seed/esp/400/400',
                shopId: cafe.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Cappuccino',
                nameAr: 'كابوتشينو',
                description: 'Classic cappuccino with foam',
                descriptionAr: 'كابوتشينو كلاسيكي',
                price: 25,
                imageUrl: 'https://picsum.photos/seed/cap/400/400',
                shopId: cafe.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Croissant',
                nameAr: 'كرواسان',
                description: 'Buttery flaky croissant',
                descriptionAr: 'كرواسان زبدي',
                price: 20,
                imageUrl: 'https://picsum.photos/seed/croi/400/400',
                shopId: cafe.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Latte',
                nameAr: 'لاتيه',
                description: 'Smooth milk latte',
                descriptionAr: 'لاتيه بالحليب',
                price: 28,
                imageUrl: 'https://picsum.photos/seed/lat/400/400',
                shopId: cafe.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Cheesecake Slice',
                nameAr: 'تشيزكيك',
                description: 'New York style cheesecake',
                descriptionAr: 'تشيزكيك على الطريقة الأمريكية',
                price: 45,
                imageUrl: 'https://picsum.photos/seed/cake/400/400',
                shopId: cafe.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Matcha Latte',
                nameAr: 'ماتشا لاتيه',
                description: 'Premium Japanese matcha',
                descriptionAr: 'ماتشا ياباني فاخر',
                price: 35,
                imageUrl: 'https://picsum.photos/seed/match/400/400',
                shopId: cafe.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Cold Brew',
                nameAr: 'قهوة باردة',
                description: '18-hour cold steeped coffee',
                descriptionAr: 'قهوة منقوعة 18 ساعة',
                price: 32,
                imageUrl: 'https://picsum.photos/seed/cbrew/400/400',
                shopId: cafe.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Club Sandwich',
                nameAr: 'كلاب ساندويتش',
                description: 'Triple-decker chicken club',
                descriptionAr: 'ساندويتش دجاج ثلاثي الطوابق',
                price: 65,
                imageUrl: 'https://picsum.photos/seed/club/400/400',
                shopId: cafe.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Belgian Waffle',
                nameAr: 'وافل بلجيكي',
                description: 'Crispy waffle with cream & berries',
                descriptionAr: 'وافل مقرمش مع كريمة وتوت',
                price: 55,
                imageUrl: 'https://picsum.photos/seed/waff/400/400',
                shopId: cafe.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Iced Americano',
                nameAr: 'أمريكانو بارد',
                description: 'Double espresso over ice',
                descriptionAr: 'إسبريسو مزدوج على الثلج',
                price: 22,
                imageUrl: 'https://picsum.photos/seed/iamer/400/400',
                shopId: cafe.id,
            },
        }),
    ]);
    const [
        milk,
        bread,
        eggs,
        rice,
        oliveoil,
        pasta,
        yogurt,
        tomatoes,
        butter,
        orangeJuice,
    ] = await Promise.all([
        db.product.create({
            data: {
                name: 'Full Cream Milk 1L',
                nameAr: 'حليب كامل الدسم 1 لتر',
                price: 18,
                imageUrl: 'https://picsum.photos/seed/milk/400/400',
                shopId: grocery.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Bread Loaf',
                nameAr: 'رغيف خبز',
                price: 8,
                imageUrl: 'https://picsum.photos/seed/bread/400/400',
                shopId: grocery.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Eggs 12 pcs',
                nameAr: 'بيض 12 حبة',
                price: 55,
                imageUrl: 'https://picsum.photos/seed/eggs/400/400',
                shopId: grocery.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Rice 1kg',
                nameAr: 'أرز 1 كيلو',
                price: 25,
                imageUrl: 'https://picsum.photos/seed/rice/400/400',
                shopId: grocery.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Olive Oil 750ml',
                nameAr: 'زيت زيتون 750 مل',
                price: 120,
                imageUrl: 'https://picsum.photos/seed/oil/400/400',
                shopId: grocery.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Pasta 500g',
                nameAr: 'مكرونة 500 جم',
                price: 22,
                imageUrl: 'https://picsum.photos/seed/pasta/400/400',
                shopId: grocery.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Yogurt 500g',
                nameAr: 'زبادي 500 جم',
                price: 20,
                imageUrl: 'https://picsum.photos/seed/yogurt/400/400',
                shopId: grocery.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Fresh Tomatoes 1kg',
                nameAr: 'طماطم طازجة 1 كيلو',
                price: 15,
                imageUrl: 'https://picsum.photos/seed/tom/400/400',
                shopId: grocery.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Butter 200g',
                nameAr: 'زبدة 200 جم',
                price: 35,
                imageUrl: 'https://picsum.photos/seed/butt/400/400',
                shopId: grocery.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Orange Juice 1L',
                nameAr: 'عصير برتقال 1 لتر',
                price: 28,
                imageUrl: 'https://picsum.photos/seed/oj/400/400',
                shopId: grocery.id,
            },
        }),
    ]);
    const [
        chicken,
        beef,
        lamb,
        wings,
        beefSteak,
        wholeChicken,
        sausages,
        liver,
    ] = await Promise.all([
        db.product.create({
            data: {
                name: 'Chicken Breast 1kg',
                nameAr: 'صدر دجاج 1 كيلو',
                price: 95,
                imageUrl: 'https://picsum.photos/seed/chick/400/400',
                shopId: butcher.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Ground Beef 500g',
                nameAr: 'لحم مفروم 500 جم',
                price: 180,
                imageUrl: 'https://picsum.photos/seed/beef/400/400',
                shopId: butcher.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Lamb Chops 1kg',
                nameAr: 'ريش خروف 1 كيلو',
                price: 250,
                imageUrl: 'https://picsum.photos/seed/lamb/400/400',
                shopId: butcher.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Chicken Wings 1kg',
                nameAr: 'أجنحة دجاج 1 كيلو',
                price: 70,
                imageUrl: 'https://picsum.photos/seed/wings/400/400',
                shopId: butcher.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Beef Steak 500g',
                nameAr: 'ستيك لحم 500 جم',
                price: 220,
                imageUrl: 'https://picsum.photos/seed/steak/400/400',
                shopId: butcher.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Whole Chicken',
                nameAr: 'دجاجة كاملة',
                price: 85,
                imageUrl: 'https://picsum.photos/seed/wchick/400/400',
                shopId: butcher.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Beef Sausages 500g',
                nameAr: 'سجق لحم 500 جم',
                price: 95,
                imageUrl: 'https://picsum.photos/seed/saus/400/400',
                shopId: butcher.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Calf Liver 500g',
                nameAr: 'كبدة عجل 500 جم',
                price: 120,
                imageUrl: 'https://picsum.photos/seed/liver/400/400',
                shopId: butcher.id,
            },
        }),
    ]);
    const [
        acClean,
        plumbing,
        electrical,
        deepClean,
        painting,
        furnitureAssembly,
    ] = await Promise.all([
        db.product.create({
            data: {
                name: 'AC Cleaning',
                nameAr: 'تنظيف مكيف',
                description: 'Full AC unit cleaning & service',
                descriptionAr: 'تنظيف وصيانة وحدة التكييف',
                price: 350,
                shopId: services.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Plumbing Fix',
                nameAr: 'إصلاح سباكة',
                description: 'Leak detection & repair',
                descriptionAr: 'كشف وإصلاح التسربات',
                price: 200,
                shopId: services.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Electrical Check',
                nameAr: 'فحص كهربائي',
                description: 'Electrical safety inspection',
                descriptionAr: 'فحص أمان كهربائي',
                price: 150,
                shopId: services.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Deep Cleaning',
                nameAr: 'تنظيف شامل',
                description: 'Full apartment deep clean',
                descriptionAr: 'تنظيف شامل للشقة',
                price: 500,
                shopId: services.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Room Painting',
                nameAr: 'دهان غرفة',
                description: 'Professional room painting service',
                descriptionAr: 'خدمة دهان غرفة احترافية',
                price: 800,
                shopId: services.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Furniture Assembly',
                nameAr: 'تركيب أثاث',
                description: 'IKEA & flatpack furniture assembly',
                descriptionAr: 'تركيب أثاث إيكيا والمجمعات',
                price: 250,
                shopId: services.id,
            },
        }),
    ]);
    const [
        quinoa,
        honey,
        nuts,
        chia,
        greentea,
        proteinPowder,
        almondButter,
        medjoolDates,
    ] = await Promise.all([
        db.product.create({
            data: {
                name: 'Quinoa 500g',
                nameAr: 'كينوا 500 جم',
                price: 85,
                imageUrl: 'https://picsum.photos/seed/quin/400/400',
                shopId: health.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Organic Honey 500g',
                nameAr: 'عسل طبيعي 500 جم',
                price: 120,
                imageUrl: 'https://picsum.photos/seed/honey/400/400',
                shopId: health.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Mixed Nuts 250g',
                nameAr: 'مكسرات مشكلة 250 جم',
                price: 95,
                imageUrl: 'https://picsum.photos/seed/nuts/400/400',
                shopId: health.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Chia Seeds 300g',
                nameAr: 'بذور شيا 300 جم',
                price: 65,
                imageUrl: 'https://picsum.photos/seed/chia/400/400',
                shopId: health.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Green Tea 100 bags',
                nameAr: 'شاي أخضر 100 كيس',
                price: 45,
                imageUrl: 'https://picsum.photos/seed/tea/400/400',
                shopId: health.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Whey Protein 1kg',
                nameAr: 'بروتين واي 1 كيلو',
                price: 450,
                imageUrl: 'https://picsum.photos/seed/prot/400/400',
                shopId: health.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Almond Butter 300g',
                nameAr: 'زبدة لوز 300 جم',
                price: 180,
                imageUrl: 'https://picsum.photos/seed/albut/400/400',
                shopId: health.id,
            },
        }),
        db.product.create({
            data: {
                name: 'Medjool Dates 500g',
                nameAr: 'تمر مجدول 500 جم',
                price: 130,
                imageUrl: 'https://picsum.photos/seed/dates/400/400',
                shopId: health.id,
            },
        }),
    ]);

    console.log('✓ Products created');

    // ── Orders ─────────────────────────────────────────────────────────────────
    const mk = (
        productId: string,
        quantity: number,
        unitPrice: number,
        name: string,
        nameAr: string
    ) => ({
        productId,
        quantity,
        unitPrice,
        productNameSnapshot: name,
        productNameArSnapshot: nameAr,
    });

    const order1 = await db.order.create({
        data: {
            residentId: r1.id,
            shopId: cafe.id,
            status: OrderStatus.DELIVERED,
            totalAmount: 50,
            deliveryUnit: 'A101',
            paymentMethod: PaymentMethod.CASH,
            isPaid: false,
            notes: 'Please knock softly',
            items: {
                create: [
                    mk(espresso.id, 2, 15, 'Espresso', 'إسبريسو'),
                    mk(croissant.id, 1, 20, 'Croissant', 'كرواسان'),
                ],
            },
        },
    });
    const order2 = await db.order.create({
        data: {
            residentId: r2.id,
            shopId: grocery.id,
            status: OrderStatus.PREPARING,
            totalAmount: 70,
            deliveryUnit: 'A102',
            paymentMethod: PaymentMethod.CASH,
            isPaid: false,
            items: {
                create: [
                    mk(
                        milk.id,
                        3,
                        18,
                        'Full Cream Milk 1L',
                        'حليب كامل الدسم 1 لتر'
                    ),
                    mk(bread.id, 2, 8, 'Bread Loaf', 'رغيف خبز'),
                ],
            },
        },
    });
    const order3 = await db.order.create({
        data: {
            residentId: r3.id,
            shopId: butcher.id,
            status: OrderStatus.PLACED,
            totalAmount: 190,
            deliveryUnit: 'B201',
            paymentMethod: PaymentMethod.CASH,
            isPaid: false,
            notes: 'Leave at the door',
            items: {
                create: [
                    mk(
                        chicken.id,
                        2,
                        95,
                        'Chicken Breast 1kg',
                        'صدر دجاج 1 كيلو'
                    ),
                ],
            },
        },
    });
    const order4 = await db.order.create({
        data: {
            residentId: r4.id,
            shopId: cafe.id,
            status: OrderStatus.CONFIRMED,
            totalAmount: 73,
            deliveryUnit: 'B202',
            paymentMethod: PaymentMethod.CASH,
            isPaid: false,
            items: {
                create: [
                    mk(latte.id, 1, 28, 'Latte', 'لاتيه'),
                    mk(cheesecake.id, 1, 45, 'Cheesecake Slice', 'تشيزكيك'),
                ],
            },
        },
    });
    const order5 = await db.order.create({
        data: {
            residentId: r5.id,
            shopId: health.id,
            status: OrderStatus.ON_THE_WAY,
            totalAmount: 300,
            deliveryUnit: 'C301',
            paymentMethod: PaymentMethod.CASH,
            isPaid: false,
            items: {
                create: [
                    mk(quinoa.id, 1, 85, 'Quinoa 500g', 'كينوا 500 جم'),
                    mk(
                        honey.id,
                        1,
                        120,
                        'Organic Honey 500g',
                        'عسل طبيعي 500 جم'
                    ),
                    mk(
                        nuts.id,
                        1,
                        95,
                        'Mixed Nuts 250g',
                        'مكسرات مشكلة 250 جم'
                    ),
                ],
            },
        },
    });
    const order6 = await db.order.create({
        data: {
            residentId: r6.id,
            shopId: cafe.id,
            status: OrderStatus.DELIVERED,
            totalAmount: 87,
            deliveryUnit: 'D401',
            paymentMethod: PaymentMethod.CASH,
            isPaid: false,
            notes: 'Ring bell twice',
            items: {
                create: [
                    mk(matchaLatte.id, 1, 35, 'Matcha Latte', 'ماتشا لاتيه'),
                    mk(
                        belgianWaffle.id,
                        1,
                        55,
                        'Belgian Waffle',
                        'وافل بلجيكي'
                    ),
                ],
            },
        },
    });
    const order7 = await db.order.create({
        data: {
            residentId: r7.id,
            shopId: grocery.id,
            status: OrderStatus.DELIVERED,
            totalAmount: 148,
            deliveryUnit: 'D402',
            paymentMethod: PaymentMethod.CASH,
            isPaid: false,
            items: {
                create: [
                    mk(eggs.id, 1, 55, 'Eggs 12 pcs', 'بيض 12 حبة'),
                    mk(
                        oliveoil.id,
                        1,
                        120,
                        'Olive Oil 750ml',
                        'زيت زيتون 750 مل'
                    ),
                    mk(bread.id, 2, 8, 'Bread Loaf', 'رغيف خبز'),
                    mk(butter.id, 1, 35, 'Butter 200g', 'زبدة 200 جم'),
                ],
            },
        },
    });
    const order8 = await db.order.create({
        data: {
            residentId: r8.id,
            shopId: butcher.id,
            status: OrderStatus.CONFIRMED,
            totalAmount: 440,
            deliveryUnit: 'E501',
            paymentMethod: PaymentMethod.CASH,
            isPaid: false,
            items: {
                create: [
                    mk(
                        beefSteak.id,
                        2,
                        220,
                        'Beef Steak 500g',
                        'ستيك لحم 500 جم'
                    ),
                ],
            },
        },
    });
    const order9 = await db.order.create({
        data: {
            residentId: r1.id,
            shopId: grocery.id,
            status: OrderStatus.DELIVERED,
            totalAmount: 118,
            deliveryUnit: 'A101',
            paymentMethod: PaymentMethod.CASH,
            isPaid: false,
            items: {
                create: [
                    mk(pasta.id, 2, 22, 'Pasta 500g', 'مكرونة 500 جم'),
                    mk(
                        tomatoes.id,
                        2,
                        15,
                        'Fresh Tomatoes 1kg',
                        'طماطم طازجة 1 كيلو'
                    ),
                    mk(yogurt.id, 2, 20, 'Yogurt 500g', 'زبادي 500 جم'),
                    mk(
                        orangeJuice.id,
                        1,
                        28,
                        'Orange Juice 1L',
                        'عصير برتقال 1 لتر'
                    ),
                ],
            },
        },
    });
    const order10 = await db.order.create({
        data: {
            residentId: r2.id,
            shopId: health.id,
            status: OrderStatus.DELIVERED,
            totalAmount: 260,
            deliveryUnit: 'A102',
            paymentMethod: PaymentMethod.CASH,
            isPaid: false,
            items: {
                create: [
                    mk(
                        proteinPowder.id,
                        1,
                        450,
                        'Whey Protein 1kg',
                        'بروتين واي 1 كيلو'
                    ),
                    mk(
                        greentea.id,
                        1,
                        45,
                        'Green Tea 100 bags',
                        'شاي أخضر 100 كيس'
                    ),
                ],
            },
        },
    });
    const order11 = await db.order.create({
        data: {
            residentId: r3.id,
            shopId: services.id,
            status: OrderStatus.DELIVERED,
            totalAmount: 350,
            deliveryUnit: 'B201',
            paymentMethod: PaymentMethod.CASH,
            isPaid: false,
            notes: 'AC in living room',
            items: {
                create: [mk(acClean.id, 1, 350, 'AC Cleaning', 'تنظيف مكيف')],
            },
        },
    });
    const order12 = await db.order.create({
        data: {
            residentId: r4.id,
            shopId: butcher.id,
            status: OrderStatus.CANCELLED,
            totalAmount: 180,
            deliveryUnit: 'B202',
            paymentMethod: PaymentMethod.CASH,
            isPaid: false,
            items: {
                create: [
                    mk(beef.id, 1, 180, 'Ground Beef 500g', 'لحم مفروم 500 جم'),
                ],
            },
        },
    });
    const order13 = await db.order.create({
        data: {
            residentId: r5.id,
            shopId: cafe.id,
            status: OrderStatus.DELIVERED,
            totalAmount: 77,
            deliveryUnit: 'C301',
            paymentMethod: PaymentMethod.CASH,
            isPaid: false,
            items: {
                create: [
                    mk(coldBrew.id, 1, 32, 'Cold Brew', 'قهوة باردة'),
                    mk(
                        clubSandwich.id,
                        1,
                        65,
                        'Club Sandwich',
                        'كلاب ساندويتش'
                    ),
                ],
            },
        },
    });
    const order14 = await db.order.create({
        data: {
            residentId: r6.id,
            shopId: services.id,
            status: OrderStatus.ON_THE_WAY,
            totalAmount: 500,
            deliveryUnit: 'D401',
            paymentMethod: PaymentMethod.CASH,
            isPaid: false,
            notes: 'All 3 bedrooms',
            items: {
                create: [
                    mk(deepClean.id, 1, 500, 'Deep Cleaning', 'تنظيف شامل'),
                ],
            },
        },
    });

    console.log('✓ 14 orders created');

    // ── Reviews ────────────────────────────────────────────────────────────────
    await db.review.createMany({
        data: [
            // Café (4 reviews)
            {
                userId: r1.id,
                shopId: cafe.id,
                rating: 5,
                comment:
                    'Amazing coffee and fast delivery! The matcha latte is a must-try.',
            },
            {
                userId: r4.id,
                shopId: cafe.id,
                rating: 4,
                comment:
                    'Great latte, cheesecake was perfect. Delivery was a bit slow.',
            },
            {
                userId: r6.id,
                shopId: cafe.id,
                rating: 5,
                comment:
                    'The Belgian waffle is incredible! Best café in the compound by far.',
            },
            {
                userId: r7.id,
                shopId: cafe.id,
                rating: 4,
                comment:
                    'Cold brew is excellent, exactly what I needed on a hot day.',
            },
            // Grocery (4 reviews)
            {
                userId: r2.id,
                shopId: grocery.id,
                rating: 4,
                comment:
                    'Good selection of products, always fresh. Will definitely order again.',
            },
            {
                userId: r1.id,
                shopId: grocery.id,
                rating: 5,
                comment:
                    'Very convenient, olive oil and pasta are top quality. Fast delivery!',
            },
            {
                userId: r5.id,
                shopId: grocery.id,
                rating: 3,
                comment:
                    'Decent selection but some items were out of stock during my order.',
            },
            {
                userId: r8.id,
                shopId: grocery.id,
                rating: 4,
                comment:
                    'Fresh produce, good prices. The orange juice is really fresh.',
            },
            // Butcher (3 reviews)
            {
                userId: r3.id,
                shopId: butcher.id,
                rating: 5,
                comment:
                    'Incredibly fresh meat. Best butcher in the compound, hands down!',
            },
            {
                userId: r8.id,
                shopId: butcher.id,
                rating: 5,
                comment:
                    'The beef steak was restaurant quality. Perfectly cut and very fresh.',
            },
            {
                userId: r5.id,
                shopId: butcher.id,
                rating: 4,
                comment:
                    'Lamb chops were excellent, will order again. Quick delivery too.',
            },
            // Services (2 reviews)
            {
                userId: r3.id,
                shopId: services.id,
                rating: 5,
                comment:
                    'AC cleaning was thorough and professional. Very happy with the result.',
            },
            {
                userId: r4.id,
                shopId: services.id,
                rating: 4,
                comment:
                    'Furniture assembly was done well and quickly. Good value for money.',
            },
            // Health (3 reviews)
            {
                userId: r5.id,
                shopId: health.id,
                rating: 5,
                comment:
                    'Love the organic selection. Quinoa and honey are top quality.',
            },
            {
                userId: r2.id,
                shopId: health.id,
                rating: 5,
                comment:
                    'The protein powder is great quality and cheaper than outside. Love it!',
            },
            {
                userId: r6.id,
                shopId: health.id,
                rating: 4,
                comment:
                    'Medjool dates are the best I have had. Almond butter is delicious too.',
            },
        ],
    });

    // ── Saved Shops ────────────────────────────────────────────────────────────
    await db.savedShop.createMany({
        data: [
            { userId: r1.id, shopId: cafe.id },
            { userId: r1.id, shopId: grocery.id },
            { userId: r2.id, shopId: health.id },
            { userId: r2.id, shopId: grocery.id },
            { userId: r3.id, shopId: butcher.id },
            { userId: r4.id, shopId: cafe.id },
            { userId: r5.id, shopId: health.id },
            { userId: r5.id, shopId: cafe.id },
            { userId: r6.id, shopId: cafe.id },
            { userId: r6.id, shopId: health.id },
            { userId: r7.id, shopId: grocery.id },
            { userId: r8.id, shopId: butcher.id },
        ],
    });

    console.log('✓ Reviews & saved shops created');

    // ── Announcements ──────────────────────────────────────────────────────────
    const ann1 = await db.announcement.create({
        data: {
            title: 'Welcome to EastPark App!',
            titleAr: 'مرحباً بكم في تطبيق إيست بارك!',
            body: 'We are thrilled to launch the EastPark residential super-app. Order from local shops, stay informed about compound news, participate in polls and elections — all in one place.',
            bodyAr: 'يسعدنا إطلاق تطبيق إيست بارك. اطلب من المتاجر المحلية، وابقَ على اطلاع بأخبار المجمع، وشارك في الاستطلاعات والانتخابات — كل ذلك في مكان واحد.',
            category: AnnouncementCategory.GENERAL,
        },
    });
    const ann2 = await db.announcement.create({
        data: {
            title: 'Eid Al-Fitr Celebration Party',
            titleAr: 'حفل احتفال عيد الفطر المبارك',
            body: 'Join us for a grand Eid celebration at the compound clubhouse on the first day of Eid. Activities for all ages, food stations, and live entertainment. All residents are welcome!',
            bodyAr: 'انضموا إلينا للاحتفال بعيد الفطر المبارك في نادي المجمع في أول أيام العيد. أنشطة لجميع الأعمار ومحطات طعام وترفيه حي. كل السكان مدعوون!',
            category: AnnouncementCategory.EVENT,
        },
    });
    const ann3 = await db.announcement.create({
        data: {
            title: 'Scheduled Water Pump Maintenance',
            titleAr: 'صيانة مجدولة لطلمبة المياه',
            body: 'Water supply will be interrupted on Thursday from 10:00 AM to 2:00 PM for routine pump maintenance. Please store sufficient water. We apologize for any inconvenience.',
            bodyAr: 'سيتم انقطاع المياه يوم الخميس من 10 صباحاً حتى 2 ظهراً لإجراء صيانة دورية للطلمبة. يرجى تخزين الكمية الكافية من الماء. نعتذر عن أي إزعاج.',
            category: AnnouncementCategory.MAINTENANCE,
        },
    });
    const ann4 = await db.announcement.create({
        data: {
            title: 'New Security System Installed',
            titleAr: 'تركيب نظام أمني جديد',
            body: 'We have upgraded the compound security with a state-of-the-art CCTV system covering all entry points, parking areas, and common spaces. Your safety is our priority.',
            bodyAr: 'قمنا بترقية أمن المجمع بنظام كاميرات مراقبة متطور يغطي جميع نقاط الدخول والمواقف والمناطق المشتركة. سلامتكم أولويتنا.',
            category: AnnouncementCategory.NEWS,
        },
    });
    const ann5 = await db.announcement.create({
        data: {
            title: 'Extended Summer Pool Hours',
            titleAr: 'توسيع مواعيد المسبح الصيفية',
            body: 'Great news for residents! The compound pool will now be open from 7:00 AM to 11:00 PM daily throughout the summer season. Enjoy the extended hours with your family!',
            bodyAr: 'أخبار رائعة للسكان! سيكون مسبح المجمع مفتوحاً الآن من 7 صباحاً حتى 11 مساءً يومياً طوال موسم الصيف.',
            category: AnnouncementCategory.PROMOTION,
        },
    });

    const ann6 = await db.announcement.create({
        data: {
            title: 'Parking Rules Reminder',
            titleAr: 'تذكير بقواعد انتظار السيارات',
            body: "Please be reminded that parking in fire lanes, blocking emergency exits, or occupying another resident's designated spot is strictly prohibited. Violating vehicles will be towed at the owner's expense.",
            bodyAr: 'نذكركم بأن وقوف السيارات في ممرات الحريق وحجب مخارج الطوارئ واحتلال مواقف الآخرين محظور تماماً. ستُسحب المركبات المخالفة على نفقة صاحبها.',
            category: AnnouncementCategory.GENERAL,
            publishedAt: new Date('2026-03-10'),
        },
    });
    const ann7 = await db.announcement.create({
        data: {
            title: 'New Playground Equipment Installed',
            titleAr: 'تركيب معدات ملعب جديدة',
            body: 'We are excited to announce that brand-new playground equipment has been installed in the central garden area. The new play area features swings, slides, climbing frames, and a sandpit, suitable for children aged 2–12.',
            bodyAr: 'يسعدنا الإعلان عن تركيب معدات ملعب جديدة تماماً في منطقة الحديقة المركزية. تشمل المنطقة الجديدة أراجيح وزحليقات وأطر للتسلق وصندوق رمل، مناسبة للأطفال من 2 إلى 12 سنة.',
            category: AnnouncementCategory.NEWS,
            publishedAt: new Date('2026-03-20'),
        },
    });
    const ann8 = await db.announcement.create({
        data: {
            title: 'Eid Al-Adha Holiday Arrangements',
            titleAr: 'ترتيبات إجازة عيد الأضحى المبارك',
            body: 'During the Eid Al-Adha holiday, compound maintenance and management offices will operate on reduced hours (10 AM – 2 PM). All shops in the EastPark marketplace will maintain their normal hours. Eid Mubarak to all our residents!',
            bodyAr: 'خلال إجازة عيد الأضحى المبارك، ستعمل مكاتب صيانة وإدارة المجمع بساعات مخفضة (10 صباحاً – 2 ظهراً). ستحافظ جميع متاجر إيست بارك على مواعيدها المعتادة. عيد مبارك لجميع سكاننا الكرام!',
            category: AnnouncementCategory.EVENT,
            publishedAt: new Date('2026-04-01'),
        },
    });

    // ── Comments ───────────────────────────────────────────────────────────────
    await db.comment.createMany({
        data: [
            {
                body: 'Great news! This will make compound life so much easier!',
                userId: r1.id,
                announcementId: ann1.id,
            },
            {
                body: 'Finally! A proper app for our compound. Very well designed.',
                userId: r2.id,
                announcementId: ann1.id,
            },
            {
                body: 'Just downloaded it. The ordering system is seamless!',
                userId: r5.id,
                announcementId: ann1.id,
            },
            {
                body: 'Love the Arabic support. Very thoughtful!',
                userId: r8.id,
                announcementId: ann1.id,
            },
            {
                body: 'So excited for the Eid celebration! Will bring the whole family.',
                userId: r3.id,
                announcementId: ann2.id,
            },
            {
                body: 'Will there be traditional food stalls? That would be amazing.',
                userId: r6.id,
                announcementId: ann2.id,
            },
            {
                body: "Can't wait! The last Eid party was fantastic.",
                userId: r7.id,
                announcementId: ann2.id,
            },
            {
                body: 'Thanks for the advance notice about the water. Very considerate.',
                userId: r4.id,
                announcementId: ann3.id,
            },
            {
                body: 'I will make sure to fill up water bottles the night before. Thanks!',
                userId: r2.id,
                announcementId: ann3.id,
            },
            {
                body: 'Great upgrade! Feeling safer with the new camera coverage.',
                userId: r1.id,
                announcementId: ann4.id,
            },
            {
                body: 'This is long overdue. Thank you management!',
                userId: r3.id,
                announcementId: ann4.id,
            },
            {
                body: 'Perfect timing for summer. The kids will love the extended pool hours!',
                userId: r5.id,
                announcementId: ann5.id,
            },
            {
                body: 'This is great news for working parents like me. Thank you!',
                userId: r2.id,
                announcementId: ann5.id,
            },
            {
                body: 'About time someone addressed the parking issue seriously!',
                userId: r4.id,
                announcementId: ann6.id,
            },
            {
                body: 'The playground looks amazing! My kids were so excited when they saw it.',
                userId: r6.id,
                announcementId: ann7.id,
            },
            {
                body: 'Finally a proper play area for the little ones. Wonderful addition!',
                userId: r8.id,
                announcementId: ann7.id,
            },
            {
                body: 'Eid Mubarak to all! Great to know shops will be open as normal.',
                userId: r7.id,
                announcementId: ann8.id,
            },
        ],
    });

    // ── Reports ────────────────────────────────────────────────────────────────
    await db.report.createMany({
        data: [
            {
                title: 'Q1 2026 Financial Report',
                titleAr: 'التقرير المالي للربع الأول 2026',
                pdfUrl: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf',
                publishedAt: new Date('2026-04-01'),
            },
            {
                title: 'Q4 2025 Financial Report',
                titleAr: 'التقرير المالي للربع الرابع 2025',
                pdfUrl: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf',
                publishedAt: new Date('2026-01-10'),
            },
            {
                title: 'Q3 2025 Financial Report',
                titleAr: 'التقرير المالي للربع الثالث 2025',
                pdfUrl: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf',
                publishedAt: new Date('2025-10-05'),
            },
            {
                title: 'Annual Maintenance Plan 2026',
                titleAr: 'خطة الصيانة السنوية 2026',
                pdfUrl: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf',
                publishedAt: new Date('2026-01-20'),
            },
            {
                title: 'Security Audit Report 2025',
                titleAr: 'تقرير تدقيق الأمن 2025',
                pdfUrl: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf',
                publishedAt: new Date('2025-12-31'),
            },
        ],
    });

    console.log('✓ Announcements, comments & reports created');

    // ── Polls ──────────────────────────────────────────────────────────────────
    const poll1 = await db.poll.create({
        data: {
            question: 'What is the best day for compound cleaning?',
            questionAr: 'ما هو أفضل يوم لتنظيف المجمع؟',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            options: {
                create: [
                    { label: 'Friday', labelAr: 'الجمعة' },
                    { label: 'Saturday', labelAr: 'السبت' },
                    { label: 'Sunday', labelAr: 'الأحد' },
                ],
            },
        },
        include: { options: true },
    });
    const poll2 = await db.poll.create({
        data: {
            question: 'What are your preferred pool hours?',
            questionAr: 'ما هي مواعيد المسبح المفضلة لديك؟',
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            options: {
                create: [
                    { label: 'Morning (7AM–12PM)', labelAr: 'الصباح (7ص–12م)' },
                    {
                        label: 'Afternoon (12PM–6PM)',
                        labelAr: 'بعد الظهر (12م–6م)',
                    },
                    { label: 'Evening (6PM–10PM)', labelAr: 'المساء (6م–10م)' },
                ],
            },
        },
        include: { options: true },
    });

    const poll3 = await db.poll.create({
        data: {
            question: 'Should we add a rooftop garden to the compound?',
            questionAr: 'هل نضيف حديقة على السطح للمجمع؟',
            expiresAt: new Date('2026-03-01'),
            options: {
                create: [
                    { label: 'Yes, great idea!', labelAr: 'نعم، فكرة رائعة!' },
                    { label: 'No, not needed', labelAr: 'لا، ليست ضرورية' },
                    {
                        label: 'Yes, but after the gym',
                        labelAr: 'نعم، لكن بعد الجيم',
                    },
                ],
            },
        },
        include: { options: true },
    });

    await db.vote.createMany({
        data: [
            // Poll 1 — cleaning day (6 votes)
            { userId: r1.id, pollId: poll1.id, optionId: poll1.options[0]!.id },
            { userId: r2.id, pollId: poll1.id, optionId: poll1.options[1]!.id },
            { userId: r3.id, pollId: poll1.id, optionId: poll1.options[0]!.id },
            { userId: r4.id, pollId: poll1.id, optionId: poll1.options[2]!.id },
            { userId: r5.id, pollId: poll1.id, optionId: poll1.options[1]!.id },
            { userId: r6.id, pollId: poll1.id, optionId: poll1.options[0]!.id },
            // Poll 2 — pool hours (5 votes)
            { userId: r1.id, pollId: poll2.id, optionId: poll2.options[2]!.id },
            { userId: r2.id, pollId: poll2.id, optionId: poll2.options[0]!.id },
            { userId: r3.id, pollId: poll2.id, optionId: poll2.options[2]!.id },
            { userId: r7.id, pollId: poll2.id, optionId: poll2.options[1]!.id },
            { userId: r8.id, pollId: poll2.id, optionId: poll2.options[2]!.id },
            // Poll 3 — rooftop garden (7 votes)
            { userId: r1.id, pollId: poll3.id, optionId: poll3.options[0]!.id },
            { userId: r2.id, pollId: poll3.id, optionId: poll3.options[0]!.id },
            { userId: r3.id, pollId: poll3.id, optionId: poll3.options[2]!.id },
            { userId: r4.id, pollId: poll3.id, optionId: poll3.options[1]!.id },
            { userId: r5.id, pollId: poll3.id, optionId: poll3.options[0]!.id },
            { userId: r6.id, pollId: poll3.id, optionId: poll3.options[0]!.id },
            { userId: r7.id, pollId: poll3.id, optionId: poll3.options[2]!.id },
        ],
    });

    console.log('✓ Polls & votes created');

    // ── Election ───────────────────────────────────────────────────────────────
    const election = await db.election.create({
        data: {
            title: 'Residents Committee Election 2025',
            titleAr: 'انتخابات مجلس السكان 2025',
            description:
                'Vote for your representatives on the compound residents committee.',
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            resultsOpen: false,
            visibilityMode: ElectionVisibilityMode.SEALED_UNTIL_DEADLINE,
            candidates: {
                create: [
                    {
                        name: 'Mohamed Hassan',
                        nameAr: 'محمد حسن',
                        statement:
                            'I will work hard to improve compound services and communication.',
                        statementAr:
                            'سأعمل بجد على تحسين خدمات المجمع والتواصل.',
                        photoUrl: 'https://picsum.photos/seed/cand1/200/200',
                    },
                    {
                        name: 'Sara Ahmed',
                        nameAr: 'سارة أحمد',
                        statement:
                            'Committed to transparency, fair decision-making, and resident wellbeing.',
                        statementAr:
                            'ملتزمة بالشفافية واتخاذ القرارات العادلة ورفاهية السكان.',
                        photoUrl: 'https://picsum.photos/seed/cand2/200/200',
                    },
                    {
                        name: 'Khaled Ibrahim',
                        nameAr: 'خالد إبراهيم',
                        statement:
                            'My focus is on security upgrades, maintenance response times, and cleanliness.',
                        statementAr:
                            'تركيزي على تحسين الأمن وأوقات الاستجابة للصيانة والنظافة.',
                        photoUrl: 'https://picsum.photos/seed/cand3/200/200',
                    },
                ],
            },
        },
        include: { candidates: true },
    });

    await db.electionVote.createMany({
        data: [
            {
                userId: r1.id,
                electionId: election.id,
                candidateId: election.candidates[0]!.id,
            },
            {
                userId: r2.id,
                electionId: election.id,
                candidateId: election.candidates[1]!.id,
            },
            {
                userId: r3.id,
                electionId: election.id,
                candidateId: election.candidates[2]!.id,
            },
            {
                userId: r4.id,
                electionId: election.id,
                candidateId: election.candidates[0]!.id,
            },
            {
                userId: r5.id,
                electionId: election.id,
                candidateId: election.candidates[1]!.id,
            },
            {
                userId: r6.id,
                electionId: election.id,
                candidateId: election.candidates[0]!.id,
            },
        ],
    });

    console.log('✓ Election & votes created');

    // ── Feedback ───────────────────────────────────────────────────────────────
    const fb1 = await db.feedback.create({
        data: {
            category: FeedbackCategory.MAINTENANCE,
            body: 'The elevator in Building A is making a strange grinding noise. It feels unsafe and needs urgent inspection.',
            isAnonymous: false,
            status: FeedbackStatus.IN_PROGRESS,
            attachments: [],
            userId: r1.id,
        },
    });
    const fb2 = await db.feedback.create({
        data: {
            category: FeedbackCategory.CLEANLINESS,
            body: 'The stairwell on floor 3 in Building B has not been cleaned in over a week. There is visible dust and debris.',
            isAnonymous: true,
            status: FeedbackStatus.SUBMITTED,
            attachments: [],
            userId: r2.id,
        },
    });
    const fb3 = await db.feedback.create({
        data: {
            category: FeedbackCategory.SECURITY,
            body: 'The parking gate was left open all night on Tuesday. Anyone could enter the compound.',
            isAnonymous: false,
            status: FeedbackStatus.RESOLVED,
            attachments: [],
            userId: r3.id,
        },
    });
    const fb4 = await db.feedback.create({
        data: {
            category: FeedbackCategory.NOISE,
            body: 'Loud construction noise starting at 6 AM from unit B305. This is below the allowed hours.',
            isAnonymous: false,
            status: FeedbackStatus.ACKNOWLEDGED,
            attachments: [],
            userId: r4.id,
        },
    });

    const fb5 = await db.feedback.create({
        data: {
            category: FeedbackCategory.SUGGESTION,
            body: 'Can we add a dedicated bicycle parking rack near the main entrance? Many residents cycle and there is no safe place to lock bikes.',
            isAnonymous: false,
            status: FeedbackStatus.ACKNOWLEDGED,
            attachments: [],
            userId: r5.id,
        },
    });
    const fb6 = await db.feedback.create({
        data: {
            category: FeedbackCategory.CLEANLINESS,
            body: 'The swimming pool changing rooms need more frequent cleaning. The floors are often wet and slippery, which is a safety hazard.',
            isAnonymous: true,
            status: FeedbackStatus.IN_PROGRESS,
            attachments: [],
            userId: r6.id,
        },
    });
    const fb7 = await db.feedback.create({
        data: {
            category: FeedbackCategory.MAINTENANCE,
            body: 'The hallway lights on the 4th floor of Building D have been flickering for two weeks. This needs urgent attention as it is a safety concern at night.',
            isAnonymous: false,
            status: FeedbackStatus.SUBMITTED,
            attachments: [],
            userId: r7.id,
        },
    });
    const fb8 = await db.feedback.create({
        data: {
            category: FeedbackCategory.SUGGESTION,
            body: 'It would be great to have a communal BBQ area in the garden. Many residents would love a designated outdoor cooking space for family gatherings.',
            isAnonymous: false,
            status: FeedbackStatus.SUBMITTED,
            attachments: [],
            userId: r8.id,
        },
    });

    await db.feedbackReply.createMany({
        data: [
            {
                body: 'Thank you for reporting this. Our maintenance team has been dispatched and will inspect the elevator tomorrow morning.',
                feedbackId: fb1.id,
                authorId: admin.id,
            },
            {
                body: 'We have resolved this issue. The security team has updated the gate protocol and added a nightly inspection routine.',
                feedbackId: fb3.id,
                authorId: admin.id,
            },
            {
                body: 'We acknowledge your report. A formal warning notice has been sent to the unit in question.',
                feedbackId: fb4.id,
                authorId: admin.id,
            },
            {
                body: 'Great suggestion! We are evaluating a bicycle rack installation near the main entrance and will update you soon.',
                feedbackId: fb5.id,
                authorId: admin.id,
            },
            {
                body: 'We have scheduled daily cleaning of the pool changing rooms effective immediately. Thank you for bringing this to our attention.',
                feedbackId: fb6.id,
                authorId: admin.id,
            },
        ],
    });

    console.log('✓ Feedback & replies created');

    // ── Notification Preferences ───────────────────────────────────────────────
    const allUserIds = [
        admin.id,
        r1.id,
        r2.id,
        r3.id,
        r4.id,
        r5.id,
        r6.id,
        r7.id,
        r8.id,
        m1.id,
        m2.id,
        m3.id,
        m4.id,
        m5.id,
    ];
    const prefTypes = Object.values(NotificationType);
    for (const userId of allUserIds) {
        await db.notificationPreference.createMany({
            data: prefTypes.map(type => ({ userId, type, enabled: true })),
        });
    }

    // ── Notifications ──────────────────────────────────────────────────────────
    await db.notification.createMany({
        data: [
            {
                userId: r1.id,
                type: NotificationType.ORDER_UPDATE,
                title: 'Order Delivered!',
                titleAr: 'تم تسليم طلبك!',
                body: 'Your order from The Brew Corner has been delivered.',
                bodyAr: 'تم تسليم طلبك من ركن القهوة.',
                isRead: true,
                data: { orderId: order1.id },
            },
            {
                userId: r1.id,
                type: NotificationType.ORDER_UPDATE,
                title: 'Order Delivered!',
                titleAr: 'تم تسليم طلبك!',
                body: 'Your order from Al Baraka Grocery has been delivered.',
                bodyAr: 'تم تسليم طلبك من بقالة البركة.',
                isRead: false,
                data: { orderId: order9.id },
            },
            {
                userId: r1.id,
                type: NotificationType.FEEDBACK_UPDATE,
                title: 'Feedback Update',
                titleAr: 'تحديث على بلاغك',
                body: 'The admin responded to your elevator maintenance report.',
                bodyAr: 'رد المسؤول على بلاغك المتعلق بالمصعد.',
                isRead: false,
                data: { feedbackId: fb1.id },
            },
            {
                userId: r2.id,
                type: NotificationType.ANNOUNCEMENT,
                title: 'New Announcement',
                titleAr: 'إعلان جديد',
                body: 'Eid Al-Fitr celebration party details have been posted.',
                bodyAr: 'تم نشر تفاصيل حفل عيد الفطر.',
                isRead: true,
                data: { announcementId: ann2.id },
            },
            {
                userId: r2.id,
                type: NotificationType.ORDER_UPDATE,
                title: 'Order is Preparing',
                titleAr: 'طلبك قيد التحضير',
                body: 'Al Baraka Grocery is preparing your order.',
                bodyAr: 'بقالة البركة تحضّر طلبك الآن.',
                isRead: false,
                data: { orderId: order2.id },
            },
            {
                userId: r3.id,
                type: NotificationType.ORDER_UPDATE,
                title: 'Order Placed',
                titleAr: 'تم استلام طلبك',
                body: 'Al Salam Butcher has received your order.',
                bodyAr: 'استلمت جزارة السلام طلبك.',
                isRead: true,
                data: { orderId: order3.id },
            },
            {
                userId: r3.id,
                type: NotificationType.ELECTION,
                title: 'Election Opens Soon',
                titleAr: 'الانتخابات تبدأ قريباً',
                body: 'The Residents Committee Election 2025 is now open for voting.',
                bodyAr: 'انتخابات مجلس السكان 2025 مفتوحة الآن للتصويت.',
                isRead: false,
                data: {},
            },
            {
                userId: r4.id,
                type: NotificationType.POLL,
                title: 'New Poll Available',
                titleAr: 'استطلاع جديد',
                body: 'Vote on the best day for compound cleaning!',
                bodyAr: 'صوّت على أفضل يوم لتنظيف المجمع!',
                isRead: true,
                data: { pollId: poll1.id },
            },
            {
                userId: r4.id,
                type: NotificationType.ORDER_UPDATE,
                title: 'Order Confirmed',
                titleAr: 'تم تأكيد طلبك',
                body: 'The Brew Corner confirmed your order.',
                bodyAr: 'ركن القهوة أكّد طلبك.',
                isRead: false,
                data: { orderId: order4.id },
            },
            {
                userId: r5.id,
                type: NotificationType.ORDER_UPDATE,
                title: 'Order On the Way!',
                titleAr: 'طلبك في الطريق إليك!',
                body: 'Green Basket is on the way to deliver your order.',
                bodyAr: 'السلة الخضراء في طريقها لتوصيل طلبك.',
                isRead: false,
                data: { orderId: order5.id },
            },
            {
                userId: r6.id,
                type: NotificationType.ORDER_UPDATE,
                title: 'Order Delivered!',
                titleAr: 'تم تسليم طلبك!',
                body: 'Your order from The Brew Corner has been delivered.',
                bodyAr: 'تم تسليم طلبك من ركن القهوة.',
                isRead: false,
                data: { orderId: order6.id },
            },
            {
                userId: r6.id,
                type: NotificationType.FEEDBACK_UPDATE,
                title: 'Feedback Update',
                titleAr: 'تحديث على بلاغك',
                body: 'The admin responded to your pool cleaning report.',
                bodyAr: 'رد المسؤول على بلاغك المتعلق بالمسبح.',
                isRead: false,
                data: { feedbackId: fb6.id },
            },
            {
                userId: r7.id,
                type: NotificationType.ORDER_UPDATE,
                title: 'Order Delivered!',
                titleAr: 'تم تسليم طلبك!',
                body: 'Your order from Al Baraka Grocery has been delivered.',
                bodyAr: 'تم تسليم طلبك من بقالة البركة.',
                isRead: true,
                data: { orderId: order7.id },
            },
            {
                userId: r8.id,
                type: NotificationType.ORDER_UPDATE,
                title: 'Order Confirmed',
                titleAr: 'تم تأكيد طلبك',
                body: 'Al Salam Butcher confirmed your order.',
                bodyAr: 'جزارة السلام أكّدت طلبك.',
                isRead: false,
                data: { orderId: order8.id },
            },
            {
                userId: r8.id,
                type: NotificationType.ANNOUNCEMENT,
                title: 'New Playground Ready!',
                titleAr: 'الملعب الجديد جاهز!',
                body: 'The new playground equipment has been installed in the garden.',
                bodyAr: 'تم تركيب معدات الملعب الجديدة في الحديقة.',
                isRead: false,
                data: { announcementId: ann7.id },
            },
        ],
    });

    console.log('✓ Notifications & preferences created');

    // ── Audit Logs ─────────────────────────────────────────────────────────────
    await db.auditLog.createMany({
        data: [
            {
                userId: admin.id,
                action: 'CREATE_ANNOUNCEMENT',
                entity: 'Announcement',
                entityId: ann1.id,
                meta: { category: 'GENERAL' },
            },
            {
                userId: admin.id,
                action: 'CREATE_ANNOUNCEMENT',
                entity: 'Announcement',
                entityId: ann2.id,
                meta: { category: 'EVENT' },
            },
            {
                userId: admin.id,
                action: 'CREATE_ANNOUNCEMENT',
                entity: 'Announcement',
                entityId: ann7.id,
                meta: { category: 'NEWS' },
            },
            {
                userId: admin.id,
                action: 'CREATE_POLL',
                entity: 'Poll',
                entityId: poll1.id,
                meta: {},
            },
            {
                userId: admin.id,
                action: 'CREATE_POLL',
                entity: 'Poll',
                entityId: poll2.id,
                meta: {},
            },
            {
                userId: admin.id,
                action: 'CREATE_POLL',
                entity: 'Poll',
                entityId: poll3.id,
                meta: {},
            },
            {
                userId: admin.id,
                action: 'CREATE_ELECTION',
                entity: 'Election',
                entityId: election.id,
                meta: {},
            },
        ],
    });

    console.log('\n✅ Seed complete!');
    console.log(
        '   5 merchants | 8 residents | 5 shops | 42 products | 14 orders'
    );
    console.log('   16 reviews | 12 saved shops');
    console.log('   8 announcements | 17 comments | 5 reports');
    console.log(
        '   3 polls (18 votes) | 1 election with 3 candidates (6 votes)'
    );
    console.log('   8 feedback items (5 replies) | 15 notifications');
    console.log('   Notification preferences set for all 14 users');
    console.log('\n   Admin:    admin@eastpark.app');
    console.log('   Merchant: merchant1–5@eastpark.app');
    console.log('   Resident: resident1–8@eastpark.app');
    console.log('   (Passwords set via SEED_*_PASSWORD env vars)');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => db.$disconnect());
