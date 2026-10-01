import 'dotenv/config';

import * as argon2 from 'argon2';
import {
    AnnouncementCategory,
    ElectionVisibilityMode,
    FeedbackCategory,
    FeedbackStatus,
    PrismaClient,
    Role,
    ShopCategory,
} from '@prisma/client';

const db = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1000;

const workingHours = {
    mon: { open: '08:00', close: '23:00', closed: false },
    tue: { open: '08:00', close: '23:00', closed: false },
    wed: { open: '08:00', close: '23:00', closed: false },
    thu: { open: '08:00', close: '23:00', closed: false },
    fri: { open: '10:00', close: '00:00', closed: false },
    sat: { open: '09:00', close: '00:00', closed: false },
    sun: { open: '08:00', close: '23:00', closed: false },
};

type ProductSeed = {
    name: string;
    nameAr: string;
    description: string;
    descriptionAr: string;
    price: number;
    imageUrl: string;
};

type ShopSeed = {
    slug: string;
    name: string;
    nameAr: string;
    description: string;
    descriptionAr: string;
    category: ShopCategory;
    deliveryTime: number;
    phone: string;
    photos: string[];
    products: ProductSeed[];
};

const shops: ShopSeed[] = [
    {
        slug: 'adam-cafe',
        name: 'Adam Cafe',
        nameAr: 'آدم كافيه',
        description:
            'Specialty coffee, fresh breakfast, and handcrafted desserts delivered inside EastPark.',
        descriptionAr:
            'قهوة مختصة وفطور طازج وحلويات محضرة بعناية مع توصيل داخل إيست بارك.',
        category: ShopCategory.CAFE_AND_FOOD,
        deliveryTime: 25,
        phone: '+201100000101',
        photos: [
            'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1400&q=85',
            'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1400&q=85',
        ],
        products: [
            product(
                'Spanish Latte',
                'سبانيش لاتيه',
                'Double espresso with silky sweet milk.',
                'إسبريسو مزدوج مع حليب كريمي محلى.',
                95,
                'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'Iced Americano',
                'أمريكانو مثلج',
                'Bright espresso served over ice.',
                'إسبريسو غني يقدم مع الثلج.',
                75,
                'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'Turkey Croissant',
                'كرواسون تركي',
                'Buttery croissant with smoked turkey and cheese.',
                'كرواسون بالزبدة مع تركي مدخن وجبن.',
                120,
                'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'Lotus Cheesecake',
                'تشيز كيك لوتس',
                'Creamy cheesecake with Lotus biscuit spread.',
                'تشيز كيك كريمي بطبقة من بسكويت اللوتس.',
                135,
                'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=85'
            ),
        ],
    },
    {
        slug: 'nature-market',
        name: 'Nature',
        nameAr: 'طبيعي',
        description:
            'Your neighborhood grocery for pantry staples, dairy, fresh food, and household essentials.',
        descriptionAr:
            'بقالة الحي للمواد التموينية ومنتجات الألبان والأطعمة الطازجة واحتياجات المنزل.',
        category: ShopCategory.GROCERY,
        deliveryTime: 20,
        phone: '+201100000102',
        photos: [
            'https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&w=1400&q=85',
            'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1400&q=85',
        ],
        products: [
            product(
                'Fresh Milk 1L',
                'حليب طازج 1 لتر',
                'Full-cream fresh milk.',
                'حليب طازج كامل الدسم.',
                48,
                'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'Farm Eggs - 12',
                'بيض بلدي - 12 بيضة',
                'A dozen fresh farm eggs.',
                'دستة بيض بلدي طازج.',
                110,
                'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'Seasonal Fruit Box',
                'صندوق فاكهة موسمية',
                'A hand-picked mix of seasonal fruit.',
                'تشكيلة مختارة من فاكهة الموسم.',
                220,
                'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'Egyptian Rice 1kg',
                'أرز مصري 1 كجم',
                'Premium short-grain Egyptian rice.',
                'أرز مصري فاخر قصير الحبة.',
                52,
                'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=85'
            ),
        ],
    },
    {
        slug: 'al-rayan-butcher',
        name: 'Al-Rayan Butcher',
        nameAr: 'جزارة الريان',
        description:
            'Fresh halal beef, lamb, and poultry prepared to order by experienced butchers.',
        descriptionAr:
            'لحوم بقري وضأن ودواجن حلال طازجة تجهز حسب الطلب بأيدي جزارين متخصصين.',
        category: ShopCategory.BUTCHER,
        deliveryTime: 35,
        phone: '+201100000103',
        photos: [
            'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=1400&q=85',
            'https://images.unsplash.com/photo-1588347818036-558601350947?auto=format&fit=crop&w=1400&q=85',
        ],
        products: [
            product(
                'Beef Cubes 1kg',
                'مكعبات لحم بقري 1 كجم',
                'Lean local beef cut for stews.',
                'لحم بقري بلدي قليل الدهن مناسب للطواجن.',
                520,
                'https://images.unsplash.com/photo-1603048297172-c92544798d5a?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'Minced Beef 1kg',
                'لحم مفروم 1 كجم',
                'Fresh beef minced on demand.',
                'لحم بقري طازج يفرم عند الطلب.',
                490,
                'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'Lamb Chops 1kg',
                'ريش ضاني 1 كجم',
                'Tender lamb chops ready for grilling.',
                'ريش ضاني طرية جاهزة للشوي.',
                690,
                'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'Whole Chicken',
                'دجاجة كاملة',
                'Fresh cleaned whole chicken.',
                'دجاجة كاملة طازجة ومنظفة.',
                210,
                'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=800&q=85'
            ),
        ],
    },
    {
        slug: 'al-mustafa-spices',
        name: 'Al-Mustafa Spices',
        nameAr: 'عطارة المصطفى',
        description:
            'Freshly ground spices, herbs, nuts, dates, and traditional Egyptian pantry staples.',
        descriptionAr:
            'توابل مطحونة طازجاً وأعشاب ومكسرات وتمور ومستلزمات العطارة المصرية.',
        category: ShopCategory.GROCERY,
        deliveryTime: 25,
        phone: '+201100000104',
        photos: [
            'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1400&q=85',
            'https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&w=1400&q=85',
        ],
        products: [
            product(
                'Seven Spice Blend 250g',
                'سبع بهارات 250 جم',
                'House blend, ground fresh in store.',
                'خلطة المحل الخاصة مطحونة طازجاً.',
                85,
                'https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'Premium Cumin 250g',
                'كمون فاخر 250 جم',
                'Aromatic whole cumin, freshly ground.',
                'كمون عطري فاخر يطحن طازجاً.',
                70,
                'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'Mixed Nuts 500g',
                'مكسرات مشكلة 500 جم',
                'Roasted premium mixed nuts.',
                'تشكيلة مكسرات فاخرة محمصة.',
                360,
                'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'Siwa Dates 1kg',
                'تمر سيوة 1 كجم',
                'Soft naturally sweet dates from Siwa.',
                'تمر سيوي طري وحلو طبيعياً.',
                190,
                'https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&w=800&q=85'
            ),
        ],
    },
    {
        slug: 'dr-fady-pharmacy',
        name: 'Dr. Fady Pharmacy',
        nameAr: 'صيدلية د. فادي',
        description:
            'Trusted pharmacy essentials, personal care, mother and baby products, and wellness support.',
        descriptionAr:
            'أدوية ومستلزمات صيدلية موثوقة وعناية شخصية ومنتجات الأم والطفل ودعم للصحة العامة.',
        category: ShopCategory.OTHER,
        deliveryTime: 20,
        phone: '+201100000105',
        photos: [
            'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?auto=format&fit=crop&w=1400&q=85',
            'https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=1400&q=85',
        ],
        products: [
            product(
                'Digital Thermometer',
                'ترمومتر رقمي',
                'Fast and accurate digital thermometer.',
                'ترمومتر رقمي سريع ودقيق.',
                165,
                'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'First Aid Kit',
                'حقيبة إسعافات أولية',
                'Compact home first-aid essentials.',
                'مستلزمات إسعافات أولية أساسية للمنزل.',
                320,
                'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'SPF 50 Sunscreen',
                'واقي شمس SPF 50',
                'Broad-spectrum daily sun protection.',
                'حماية يومية واسعة المدى من الشمس.',
                390,
                'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'Baby Care Set',
                'مجموعة عناية بالطفل',
                'Gentle wash, lotion, and diaper cream.',
                'غسول ولوشن وكريم حفاض لطيف للطفل.',
                450,
                'https://images.unsplash.com/photo-1519689373023-dd07c7988603?auto=format&fit=crop&w=800&q=85'
            ),
        ],
    },
    {
        slug: 'al-kawthar-gold',
        name: 'Al-Kawthar Gold',
        nameAr: 'الكوثر للذهب والمجوهرات',
        description:
            'Elegant gold jewelry, gifts, and made-to-order pieces with transparent daily pricing.',
        descriptionAr:
            'مشغولات ذهبية راقية وهدايا وتصميمات حسب الطلب مع أسعار يومية واضحة.',
        category: ShopCategory.OTHER,
        deliveryTime: 60,
        phone: '+201100000106',
        photos: [
            'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1400&q=85',
            'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1400&q=85',
        ],
        products: [
            product(
                '18K Initial Pendant',
                'تعليقة حرف عيار 18',
                'Personalized 18K gold initial pendant.',
                'تعليقة حرف مخصصة من ذهب عيار 18.',
                6850,
                'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                '18K Classic Bracelet',
                'سوار كلاسيك عيار 18',
                'Fine everyday 18K gold bracelet.',
                'سوار يومي رقيق من ذهب عيار 18.',
                12400,
                'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                '21K Gold Ring',
                'خاتم ذهب عيار 21',
                'Polished 21K gold band.',
                'خاتم مصقول من ذهب عيار 21.',
                9800,
                'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=85'
            ),
            product(
                'Gold Gift Coin',
                'جنيه ذهب هدية',
                'Gift-ready certified gold coin.',
                'جنيه ذهب معتمد ومجهز كهدية.',
                27600,
                'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=800&q=85'
            ),
        ],
    },
];

function product(
    name: string,
    nameAr: string,
    description: string,
    descriptionAr: string,
    price: number,
    imageUrl: string
): ProductSeed {
    return { name, nameAr, description, descriptionAr, price, imageUrl };
}

async function upsertMerchant(shop: ShopSeed, passwordHash: string) {
    const email = `showcase.${shop.slug}@eastpark.app`;
    return db.user.upsert({
        where: { email },
        create: {
            name: `${shop.name} Merchant`,
            email,
            phone: shop.phone,
            passwordHash,
            role: Role.MERCHANT,
            isVerified: true,
        },
        update: {
            name: `${shop.name} Merchant`,
            phone: shop.phone,
            role: Role.MERCHANT,
            isVerified: true,
        },
    });
}

async function upsertShopCatalog(seed: ShopSeed, passwordHash: string) {
    const merchant = await upsertMerchant(seed, passwordHash);
    const data = {
        name: seed.name,
        nameAr: seed.nameAr,
        description: seed.description,
        descriptionAr: seed.descriptionAr,
        category: seed.category,
        workingHours,
        isOpen: true,
        phone: seed.phone,
        whatsapp: seed.phone,
        deliveryTime: seed.deliveryTime,
        merchantId: merchant.id,
    };
    const existing = await db.shop.findFirst({
        where: { merchantId: merchant.id },
    });
    const shop = existing
        ? await db.shop.update({ where: { id: existing.id }, data })
        : await db.shop.create({ data });

    await db.shopPhoto.deleteMany({ where: { shopId: shop.id } });
    await db.shopPhoto.createMany({
        data: seed.photos.map((url, order) => ({
            shopId: shop.id,
            url,
            order,
        })),
    });

    for (const item of seed.products) {
        const current = await db.product.findFirst({
            where: { shopId: shop.id, name: item.name },
        });
        const productData = {
            ...item,
            shopId: shop.id,
            isAvailable: true,
            isDeleted: false,
        };
        if (current) {
            await db.product.update({
                where: { id: current.id },
                data: productData,
            });
        } else {
            await db.product.create({ data: productData });
        }
    }

    return shop;
}

async function upsertAnnouncement() {
    const title = 'Owners’ Association Election Now Open';
    const data = {
        title,
        titleAr: 'بدء انتخابات اتحاد الشاغلين',
        body: 'Voting is now open to form EastPark’s first Owners’ Association. Review both candidates’ statements and cast one confidential vote before the deadline. Results remain sealed until voting closes.',
        bodyAr: 'بدأ التصويت لتشكيل أول اتحاد شاغلين في إيست بارك. يرجى مراجعة برامج المرشحين والإدلاء بصوت سري واحد قبل الموعد النهائي. تظل النتائج مغلقة حتى انتهاء التصويت.',
        category: AnnouncementCategory.NEWS,
    };
    const existing = await db.announcement.findFirst({ where: { title } });
    return existing
        ? db.announcement.update({ where: { id: existing.id }, data })
        : db.announcement.create({
              data: { ...data, publishedAt: new Date() },
          });
}

async function upsertPoll() {
    const question =
        'Which shared-area improvement should be prioritized next?';
    const questionAr =
        'ما التحسين الذي يجب إعطاؤه الأولوية في المناطق المشتركة؟';
    const options = [
        {
            previousLabel: 'Landscape and garden upgrades',
            label: 'Repaint the residential buildings',
            labelAr: 'تجديد المباني عن طريق طلائها مجددًا',
        },
        {
            previousLabel: 'Additional security cameras',
            label: 'Add security cameras to the elevators',
            labelAr: 'إضافة كاميرات مراقبة للمصاعد',
        },
        {
            previousLabel: 'Children’s play area improvements',
            label: 'Hire more security personnel',
            labelAr: 'تعيين المزيد من أفراد الأمن',
        },
    ];
    let poll = await db.poll.findFirst({
        where: { question },
        include: { options: true },
    });
    if (!poll) {
        poll = await db.poll.create({
            data: {
                question,
                questionAr,
                expiresAt: new Date(Date.now() + 21 * DAY_MS),
                options: {
                    create: options.map(({ label, labelAr }) => ({
                        label,
                        labelAr,
                    })),
                },
            },
            include: { options: true },
        });
    } else {
        const pollId = poll.id;
        const existingOptions = poll.options;
        await db.poll.update({
            where: { id: pollId },
            data: { questionAr },
        });
        await Promise.all(
            options.map(async ({ previousLabel, label, labelAr }) => {
                const existing = existingOptions.find(
                    option =>
                        option.label === previousLabel || option.label === label
                );
                return existing
                    ? db.pollOption.update({
                          where: { id: existing.id },
                          data: { label, labelAr },
                      })
                    : db.pollOption.create({
                          data: { pollId, label, labelAr },
                      });
            })
        );
    }
    return poll;
}

async function upsertElection() {
    const title = 'First Owners’ Association Election';
    const titleAr = 'انتخابات أول اتحاد شاغلين';
    let election = await db.election.findFirst({
        where: { title },
        include: { candidates: true },
    });
    const electionContent = {
        title,
        titleAr,
        description:
            'Choose the resident representative who will help establish EastPark’s first Owners’ Association. Each verified resident may cast one confidential vote.',
        descriptionAr:
            'اختر ممثل السكان الذي سيساهم في تأسيس أول اتحاد شاغلين في إيست بارك. يحق لكل ساكن موثق الإدلاء بصوت سري واحد.',
        visibilityMode: ElectionVisibilityMode.SEALED_UNTIL_DEADLINE,
    };
    election = election
        ? await db.election.update({
              where: { id: election.id },
              data: electionContent,
              include: { candidates: true },
          })
        : await db.election.create({
              data: {
                  ...electionContent,
                  expiresAt: new Date(Date.now() + 30 * DAY_MS),
                  resultsOpen: false,
              },
              include: { candidates: true },
          });

    const candidates = [
        {
            name: 'Mahmoud Medhat',
            nameAr: 'محمود مدحت',
            statement:
                'Improving maintenance transparency, resident communication, and responsible use of community funds.',
            statementAr:
                'تحسين شفافية أعمال الصيانة والتواصل مع السكان والاستخدام المسؤول لأموال المجتمع.',
            photoUrl: null,
        },
        {
            name: 'Amr Mohey',
            nameAr: 'عمرو محيي',
            statement:
                'Building a safer, more inclusive community with better services and regular resident participation.',
            statementAr:
                'بناء مجتمع أكثر أماناً وتعاوناً مع خدمات أفضل ومشاركة منتظمة من السكان.',
            photoUrl: null,
        },
    ];

    for (const candidate of candidates) {
        const existing = election.candidates.find(
            item => item.name === candidate.name
        );
        if (existing) {
            await db.candidate.update({
                where: { id: existing.id },
                data: candidate,
            });
        } else {
            await db.candidate.create({
                data: { ...candidate, electionId: election.id },
            });
        }
    }

    return election;
}

async function upsertResidentComplaints() {
    const residentEmail = process.env.SHOWCASE_RESIDENT_EMAIL;
    const residents = await db.user.findMany({
        where: {
            role: Role.RESIDENT,
            isVerified: true,
            ...(residentEmail ? { email: residentEmail } : {}),
        },
        select: { id: true },
        take: 2,
    });

    if (residents.length !== 1) {
        console.log(
            '• Complaints skipped: set SHOWCASE_RESIDENT_EMAIL when more than one verified resident exists.'
        );
        return 0;
    }
    const resident = residents[0]!;

    const complaints = [
        {
            category: FeedbackCategory.MAINTENANCE,
            body: 'يوجد عطل متكرر في إنارة مدخل العمارة ويحتاج إلى فحص وصيانة.',
            status: FeedbackStatus.IN_PROGRESS,
        },
        {
            category: FeedbackCategory.CLEANLINESS,
            body: 'نرجو زيادة عدد مرات تنظيف المنطقة المحيطة بصناديق القمامة.',
            status: FeedbackStatus.ACKNOWLEDGED,
        },
        {
            category: FeedbackCategory.SECURITY,
            body: 'بوابة المشاة الجانبية لا تغلق بإحكام خلال ساعات المساء.',
            status: FeedbackStatus.SUBMITTED,
        },
    ];

    for (const complaint of complaints) {
        const existing = await db.feedback.findFirst({
            where: { userId: resident.id, body: complaint.body },
            select: { id: true },
        });
        const data = {
            ...complaint,
            isAnonymous: false,
            attachments: [],
            userId: resident.id,
        };

        if (existing) {
            await db.feedback.update({ where: { id: existing.id }, data });
        } else {
            await db.feedback.create({ data });
        }
    }

    return complaints.length;
}

async function main() {
    const password = process.env.SEED_MERCHANT_PASSWORD;
    if (!password) {
        throw new Error(
            'SEED_MERCHANT_PASSWORD is required for showcase merchant accounts.'
        );
    }
    const passwordHash = await argon2.hash(password);

    for (const shop of shops) {
        await upsertShopCatalog(shop, passwordHash);
        console.log(`✓ ${shop.name}: ${shop.products.length} products`);
    }

    const [, , , complaintCount] = await Promise.all([
        upsertAnnouncement(),
        upsertPoll(),
        upsertElection(),
        upsertResidentComplaints(),
    ]);
    console.log('✓ Election, announcement, and community poll');
    if (complaintCount > 0) {
        console.log(`✓ ${complaintCount} resident complaints`);
    }
    console.log(
        `\n✅ Showcase seed complete: ${shops.length} shops, ${shops.reduce((sum, shop) => sum + shop.products.length, 0)} products`
    );
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.$disconnect();
    });
