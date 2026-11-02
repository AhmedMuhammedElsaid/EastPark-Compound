/**
 * EastPark privacy policy: the single source of truth for the web page (`/privacy`) and, through
 * its public URL, the mobile app and both app-store listings. Edit the text here only; the page
 * renders both languages from this module and a test keeps the two versions structurally in sync.
 *
 * Every statement was derived from the code (Prisma schema, auth/upload/notification modules, the
 * web BFF and the mobile app config). Do not add a claim that cannot be verified there.
 */

export const PRIVACY_EFFECTIVE_DATE = '2026-11-02';
export const PRIVACY_PATH = '/privacy';
export const PRIVACY_CONTACT_EMAIL = 'info@benayat-eg.com';
export const PRIVACY_SUPPORT_EMAIL = 'eastpark.eg@gmail.com';

export type PolicySection = {
  id: string;
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

export type PolicyDocument = {
  title: string;
  effectiveLabel: string;
  effectiveDate: string;
  intro: string[];
  sections: PolicySection[];
};

export type PolicyLanguage = 'ar' | 'en';

const en: PolicyDocument = {
  title: 'Privacy Policy',
  effectiveLabel: 'Effective date',
  effectiveDate: '2 November 2026',
  intro: [
    'EastPark is a residential compound app for the EastPark community. It offers a local marketplace of shops, listings of flats for sale or rent, community features such as announcements, polls, elections and feedback, and the compound accounts for service charges. This policy explains what personal data the EastPark mobile app and website collect, why, who we share it with, how long we keep it, and the choices you have.',
    'By using EastPark you confirm that you have read this policy. If you do not agree with it, please do not use the service.',
  ],
  sections: [
    {
      id: 'who-we-are',
      heading: '1. Who we are',
      paragraphs: [
        `EastPark is operated for the EastPark compound community. For any privacy question or request, contact us at ${PRIVACY_CONTACT_EMAIL}. Our support inbox and the sender of our service emails is ${PRIVACY_SUPPORT_EMAIL}.`,
      ],
    },
    {
      id: 'data-we-collect',
      heading: '2. Data we collect',
      paragraphs: ['We collect only what the features you use need.'],
      items: [
        'Unit registration request (before you have an account): name, email, phone number, building, floor and flat number, and optionally parking details, job title, marital status, and national ID or passport number.',
        'Account data: name, email address, password (stored only as a one-way hash, never in readable form), phone number, the flat or flats linked to your account, your role (resident, merchant, accountant or administrator), your profile photo if you add one, and whether your account is verified.',
        'Orders and marketplace activity: the orders you place (items, total, delivery unit, the free-text notes you write, payment method, status and timestamps), shop reviews and ratings, and the shops you save. Card payments are not available in this release; orders are paid in cash on delivery.',
        'Flat listings: if you list your flat for sale or rent, the listing details (flat, sale or rent, price, size, rooms, description, photos and the contact phone number you enter), its review status and a history of your edits.',
        'Compound accounts: the charges, payments, receipts and ownership periods recorded for each flat, described in section 3.',
        'Community activity: comments you post, your votes in polls and elections (your vote is stored against your account so that each resident can vote once), and your feedback submissions with any photos you attach (up to 3), the replies you receive, and whether you chose to submit anonymously.',
        'Notifications: your notification preferences, the in-app notifications we send you, and, if you allow push notifications on the mobile app, your device push token.',
        'Technical data: your IP address is used for abuse and rate limiting (for example, limiting login attempts) and is kept only in short-lived counters. Our hosting providers may also record standard connection logs. We keep session tokens that keep you signed in.',
        'Web usage statistics: the website uses Vercel Web Analytics for aggregated page-view statistics. The mobile app does not include an analytics or advertising SDK.',
        'Administrative records: actions taken by administrators, accountants and merchants are recorded in an audit log together with the account that performed them.',
      ],
    },
    {
      id: 'compound-accounts',
      heading: '3. Compound accounts (service charges and payments)',
      paragraphs: [
        'The compound administration keeps an account for every flat to collect service charges and maintenance-fund contributions. These records belong to the flat. They are kept by administrators and by accountants named by the administration.',
      ],
      items: [
        'What is recorded for each flat: the charges raised, the payments received (amount, date, method, reference and, for a cheque, its status), receipt numbers, any credit and the balance, and the ownership periods that show which account owned the flat, from when and until when.',
        'Data about other people: when someone other than the owner pays, the payer name written on the payment. Photos of payment slips or cheques may show names, bank names and account numbers.',
        'Audit: every finance entry and every opening of a payment slip or cheque photo is recorded together with the account that did it.',
        'Corrections: a finance entry is never edited or deleted. A mistake is corrected with a reversing entry, so the history stays complete.',
      ],
    },
    {
      id: 'device-permissions',
      heading: '4. Mobile app permissions',
      items: [
        'Camera and photo library: only when you choose to attach a photo, for example to feedback, to a flat listing or as a profile photo. Accountants and administrators may also photograph payment slips or cheques; those photos are stored privately (see section 8). The selected image is uploaded to our storage; we do not access your other photos.',
        'Face ID, fingerprint or device unlock: optional. If you enable it, the check is done by your device. EastPark never receives or stores your biometric data; the device only tells the app that the check succeeded so that it can unlock a sign-in token stored securely on your phone.',
        'Push notifications: optional. If you allow them, the app registers a push token with us so we can send order and community notifications. You can turn notifications off in the app or in your device settings.',
      ],
    },
    {
      id: 'why-we-use-it',
      heading: '5. Why we use your data',
      items: [
        'To verify that you are a resident or merchant of the compound, review your unit registration, and send you an invitation to create your account.',
        'To create and secure your account, sign you in, keep you signed in, and reset your password.',
        'To run the marketplace: place, prepare, deliver and track orders, show reviews, and let you save shops.',
        'To publish flat listings for sale or rent after an administrator has reviewed them.',
        'To keep the compound accounts: record service charges and maintenance-fund contributions, issue receipts, and resolve disputes about payments (see section 3).',
        'To run community governance: show announcements, count polls and elections fairly with one vote per resident, and handle feedback.',
        'To send you service emails (invitations, password reset, support replies) and notifications you have enabled.',
        'To protect the service: prevent abuse and fraud, enforce limits, investigate problems and keep the audit log.',
        'To meet legal obligations and respond to lawful requests.',
      ],
      paragraphs: ['We do not sell your personal data and we do not use it for advertising.'],
    },
    {
      id: 'legal-basis',
      heading: '6. Legal basis and consent',
      paragraphs: [
        'We process your data because it is needed to provide the service you asked for (your registration, account, orders and community participation), because you consent to optional features (push notifications, biometric sign-in, photo attachments, anonymous feedback), and because we have a legitimate interest in keeping the service secure. Where we rely on consent you can withdraw it at any time, for example by turning off notifications or biometric sign-in; withdrawing does not affect the processing done before.',
        'Compound account records (section 3) are kept because they are needed to manage each owner\'s obligations to the compound and to meet accounting and legal duties. They do not rest on consent, so they cannot be switched off or withdrawn.',
        'We handle personal data with regard to the Egyptian Personal Data Protection Law No. 151 of 2020 and its executive regulations. This policy is an explanation of our practices and is not a statement that every provision has been independently certified.',
      ],
    },
    {
      id: 'who-sees-it',
      heading: '7. Who can see your data',
      items: [
        'Compound administrators can see resident registrations, resident accounts and flats, orders, votes cast as needed to run governance, and feedback. Administrators can see the author of a feedback submission even when you choose to submit it anonymously; other residents and merchants cannot.',
        'Accountants named by the administration, and the administrators, can see the compound account records of every flat (section 3) together with the owner\'s name and phone number. Accountants cannot see owners\' email addresses or national ID or passport numbers. Residents do not see finance records in the app today. If owner statements are added, an owner will see only their own flat for the time they owned it, and a new owner will see one opening figure, never the previous owner\'s payments. Anything about the accounts published to residents will show totals only.',
        'Merchants see the orders placed with their shop, including the order contents, your delivery unit and your notes, and the name needed to deliver.',
        'If you publish a flat listing, once an administrator approves it, signed-in residents and administrators can see it with your name and the contact phone number you entered. Administrators also see listings waiting for review.',
        'Other residents can see your comments and, where a review shows a name, your reviews. They cannot see your email, your phone number (unless you put it in a flat listing), your orders or your votes.',
        'Please do not put sensitive information in free-text fields such as order notes, comments or feedback, because the people above can read it.',
      ],
    },
    {
      id: 'processors',
      heading: '8. Service providers and international transfers',
      paragraphs: [
        'We use the following third-party providers to run EastPark. They process data on our behalf and only to provide their service. We do not share your data with advertisers or data brokers.',
      ],
      items: [
        'Render: hosts our backend server and API.',
        'Vercel: hosts the website, including its server side, and provides the web analytics.',
        'Supabase: hosts our PostgreSQL database and file storage (profile photos, feedback photos, flat listing photos, official PDF reports and, in a separate private storage area, payment slip and cheque photos).',
        'Upstash: provides the Redis cache we use for short-lived data such as password reset tokens, sign-in attempt counters and session revocation.',
        'Brevo (SMTP email relay) and the EastPark sender mailbox: deliver our service emails, so your email address and the content of those emails pass through them.',
        'Expo push notification service (and the Apple and Google push services behind it): deliver push notifications to your device if you enable them.',
        'Apple and Google: distribute the mobile app and provide the on-device biometric check; we do not receive biometric data from them.',
        'Public image links: images you upload (for example profile, feedback and flat listing photos) are served from public links, so anyone who has a link can open that image. Payment slip and cheque photos are the exception: they are kept in private storage, are never given to residents, and open for staff only through links that expire after 60 seconds.',
        'These providers operate data centers outside Egypt, so your data may be transferred to and stored in other countries, including in Europe and the United States. We choose established providers and rely on their security and contractual safeguards for those transfers.',
      ],
    },
    {
      id: 'retention',
      heading: '9. How long we keep data',
      items: [
        'Account, order, vote, review, comment and feedback data is kept while your account is active and afterwards as described below. We do not currently run an automatic job that permanently erases old records.',
        'When you delete your account, it is deactivated: you are signed out of every device, you can no longer sign in, your push token is removed, and your account is hidden from the app. The record is not erased immediately; it is held in an administrator recycle bin so that it can be restored if you ask. Your orders, votes, comments, reviews, feedback and audit entries are kept as they are, because other people and the compound rely on those records. Your email address stays reserved so it cannot be reused by a different account.',
        'Compound account records (section 3) are kept for 7 years, then archived or deleted. Deleting your account ends your ownership period but does not remove these records, because they belong to the flat; they then show you as a former owner.',
        'Unit registration requests, including the optional national ID or passport number, are kept as an administrative record and are not automatically removed when an account is deleted.',
        'Short-lived data expires on its own: password reset tokens after 30 minutes, access tokens after 15 minutes, sign-in sessions after 7 days, and rate-limit counters after their window.',
        'You can ask us to permanently erase your data, see section 11. Some records may have to be kept where the law or an open dispute requires it, or may remain in backups for a limited time.',
      ],
    },
    {
      id: 'security',
      heading: '10. How we protect your data',
      items: [
        'Connections to the app and website use HTTPS.',
        'Passwords are stored only as salted one-way hashes. Reset links and sign-in tokens are short-lived and single-use where applicable, and every session is revoked when you reset your password or delete your account.',
        'On the website, sign-in tokens are kept in HttpOnly, Secure, SameSite=Strict cookies that browser scripts cannot read. On the mobile app, they are kept in the device secure storage.',
        'Access is limited by role, sign-in attempts are rate limited, and uploads are checked for file type and size.',
        'No system is perfectly secure. If you believe your account has been compromised, change your password and contact us immediately.',
      ],
    },
    {
      id: 'your-rights',
      heading: '11. Your rights and how to use them',
      paragraphs: [
        'You may ask to access the personal data we hold about you, correct it, withdraw consent, object to or restrict processing, and have it deleted, subject to the limits in section 9.',
      ],
      items: [
        'Correct your data: edit your name, phone number, photo and other details in your profile.',
        'Compound account records: you can ask to see the records about your flat and to have a mistake corrected. Corrections are made with reversing entries, not edits, and these records cannot be erased during the 7-year retention period.',
        'Delete your account: in the app or website open Profile and choose Delete account. A merchant who still owns a shop must first have the shop removed.',
        'Access, full erasure, restoring a deactivated account, or any other request: email us at ' +
          `${PRIVACY_CONTACT_EMAIL} from the email address on your account. We may ask you to confirm your identity before acting, and we will reply within a reasonable time.`,
        'Notifications and biometrics: turn them off in the app settings or your device settings at any time.',
        'If you are unhappy with our response you may complain to the competent authority in Egypt.',
      ],
    },
    {
      id: 'children',
      heading: '12. Children',
      paragraphs: [
        'EastPark is intended for adults aged 18 or older. Accounts are created only for residents and merchants approved by the compound administration. We do not knowingly collect personal data from children under 18. If you believe a child has provided data, contact us and we will remove it.',
      ],
    },
    {
      id: 'cookies',
      heading: '13. Cookies and local storage on the website',
      items: [
        'Essential cookies: two HttpOnly cookies keep you signed in on the website (an access token and a refresh token). They are required for the service and are removed when you sign out.',
        'Local storage on your browser: your chosen language, light or dark theme, and your shopping cart. These stay on your device and are not sent to us.',
        'Analytics: Vercel Web Analytics collects aggregated page-view statistics. We do not use advertising cookies or cross-site tracking.',
        'The mobile app stores your sign-in tokens in secure storage and a limited cache of non-sensitive content and your preferences on the device.',
      ],
    },
    {
      id: 'changes',
      heading: '14. Changes to this policy',
      paragraphs: [
        'We may update this policy as the service changes. The effective date at the top shows the latest version. If a change is significant we will tell you in the app or by email before it applies.',
      ],
    },
    {
      id: 'contact',
      heading: '15. Contact',
      paragraphs: [
        `Questions, requests or complaints about privacy: ${PRIVACY_CONTACT_EMAIL}. Support: ${PRIVACY_SUPPORT_EMAIL}.`,
      ],
    },
  ],
};

const ar: PolicyDocument = {
  title: 'سياسة الخصوصية',
  effectiveLabel: 'تاريخ السريان',
  effectiveDate: '2 نوفمبر 2026',
  intro: [
    'إيست بارك تطبيق لمجمع سكني يخدم مجتمع إيست بارك. يوفّر سوقًا محليًا للمتاجر، وإعلانات بيع وإيجار الشقق، وخدمات مجتمعية مثل الإعلانات والاستطلاعات والانتخابات والملاحظات، وحسابات المجمع الخاصة برسوم الخدمات. توضّح هذه السياسة البيانات الشخصية التي يجمعها تطبيق إيست بارك وموقعه، ولماذا نجمعها، ومع من نشاركها، ومدة الاحتفاظ بها، والخيارات المتاحة لك.',
    'باستخدامك إيست بارك فإنك تقرّ بأنك قرأت هذه السياسة. وإذا لم توافق عليها فيرجى عدم استخدام الخدمة.',
  ],
  sections: [
    {
      id: 'who-we-are',
      heading: '1. من نحن',
      paragraphs: [
        `يُدار إيست بارك لخدمة مجتمع مجمع إيست بارك السكني. لأي سؤال أو طلب يخص الخصوصية تواصل معنا على ${PRIVACY_CONTACT_EMAIL}. بريد الدعم والبريد المُرسِل لرسائل الخدمة هو ${PRIVACY_SUPPORT_EMAIL}.`,
      ],
    },
    {
      id: 'data-we-collect',
      heading: '2. البيانات التي نجمعها',
      paragraphs: ['نجمع فقط ما تحتاجه الميزات التي تستخدمها.'],
      items: [
        'طلب تسجيل الوحدة (قبل أن يكون لديك حساب): الاسم والبريد الإلكتروني ورقم الهاتف والمبنى والدور ورقم الشقة، واختياريًا بيانات موقف السيارة والمسمى الوظيفي والحالة الاجتماعية ورقم الهوية الوطنية أو جواز السفر.',
        'بيانات الحساب: الاسم والبريد الإلكتروني وكلمة المرور (تُحفظ فقط في صورة مشفّرة أحادية الاتجاه ولا تُحفظ مقروءة أبدًا) ورقم الهاتف والشقة أو الشقق المرتبطة بحسابك ودورك (مقيم أو تاجر أو محاسب أو مسؤول) وصورة ملفك الشخصي إن أضفتها وحالة توثيق الحساب.',
        'الطلبات ونشاط السوق: الطلبات التي تنفّذها (الأصناف والإجمالي ووحدة التسليم والملاحظات النصية التي تكتبها وطريقة الدفع والحالة والتواريخ) وتقييمات المتاجر ومراجعاتها والمتاجر التي تحفظها. الدفع بالبطاقة غير متاح في هذا الإصدار، والدفع عند الاستلام نقدًا.',
        'إعلانات بيع وإيجار الشقق: إذا عرضت شقتك للبيع أو الإيجار، تُحفظ بيانات الإعلان (الشقة وكونها للبيع أو للإيجار والسعر والمساحة وعدد الغرف والوصف والصور ورقم هاتف التواصل الذي تكتبه) وحالة مراجعته وسجل تعديلاتك عليه.',
        'حسابات المجمع: المطالبات والمدفوعات والإيصالات وفترات الملكية المسجّلة لكل شقة، كما هو موضّح في البند 3.',
        'النشاط المجتمعي: التعليقات التي تنشرها وأصواتك في الاستطلاعات والانتخابات (يُسجَّل صوتك على حسابك ليصوّت كل مقيم مرة واحدة) وملاحظاتك المرسلة مع الصور التي ترفقها (حتى 3 صور) والردود التي تصلك وما إذا اخترت الإرسال دون ذكر اسمك.',
        'الإشعارات: تفضيلات الإشعارات والإشعارات داخل التطبيق التي نرسلها إليك، وعند السماح بالإشعارات في تطبيق الجوال، رمز الإشعارات الخاص بجهازك.',
        'بيانات تقنية: يُستخدم عنوان IP الخاص بك لمنع إساءة الاستخدام وتحديد معدل الطلبات (مثل الحد من محاولات تسجيل الدخول) ويُحفظ فقط في عدّادات قصيرة العمر. وقد يسجّل مزوّدو الاستضافة سجلات اتصال اعتيادية. كما نحتفظ برموز الجلسة التي تُبقيك مسجّلًا للدخول.',
        'إحصاءات استخدام الموقع: يستخدم الموقع Vercel Web Analytics لإحصاءات مجمّعة عن مشاهدات الصفحات. لا يتضمن تطبيق الجوال أي حزمة تحليلات أو إعلانات.',
        'السجلات الإدارية: تُسجَّل الإجراءات التي ينفذها المسؤولون والمحاسبون والتجار في سجل تدقيق مع الحساب الذي نفّذها.',
      ],
    },
    {
      id: 'compound-accounts',
      heading: '3. حسابات المجمع (رسوم الخدمات والمدفوعات)',
      paragraphs: [
        'تحتفظ إدارة المجمع بحساب لكل شقة لتحصيل رسوم الخدمات ومساهمات صندوق الصيانة. هذه السجلات تخص الشقة، ويتولاها المسؤولون والمحاسبون الذين تسمّيهم الإدارة.',
      ],
      items: [
        'ما يُسجَّل لكل شقة: المطالبات المقيّدة عليها، والمدفوعات المستلمة (المبلغ والتاريخ وطريقة الدفع والمرجع، وحالة الشيك إن كان الدفع بشيك)، وأرقام الإيصالات، وأي رصيد دائن والرصيد المستحق، وفترات الملكية التي تبيّن الحساب المالك للشقة ومن متى وإلى متى.',
        'بيانات أشخاص آخرين: إذا دفع شخص غير المالك يُسجَّل اسم الدافع كما ورد في الدفعة. وقد تظهر في صور إيصالات الدفع أو الشيكات أسماء وأسماء بنوك وأرقام حسابات.',
        'التدقيق: يُسجَّل كل قيد مالي وكل فتح لصورة إيصال دفع أو شيك مع الحساب الذي قام به.',
        'التصحيح: لا يُعدَّل القيد المالي ولا يُحذف. يُصحَّح الخطأ بقيد عكسي حتى يبقى السجل كاملًا.',
      ],
    },
    {
      id: 'device-permissions',
      heading: '4. أذونات تطبيق الجوال',
      items: [
        'الكاميرا ومكتبة الصور: فقط عندما تختار إرفاق صورة، مثل ملاحظاتك أو إعلان بيع أو إيجار شقتك أو صورة ملفك الشخصي. وقد يصوّر المحاسبون والمسؤولون أيضًا إيصالات الدفع أو الشيكات، وتُحفظ هذه الصور بشكل خاص (راجع البند 8). تُرفع الصورة التي تختارها إلى مساحة التخزين لدينا، ولا نصل إلى بقية صورك.',
        'بصمة الوجه أو الإصبع أو قفل الجهاز: اختياري. إذا فعّلته فإن التحقق يتم على جهازك. لا يستلم إيست بارك بياناتك الحيوية ولا يحفظها؛ يخبر الجهاز التطبيق فقط بنجاح التحقق ليفتح رمز تسجيل دخول محفوظًا بأمان على هاتفك.',
        'الإشعارات الفورية: اختيارية. إذا سمحت بها يسجّل التطبيق رمز الإشعارات لدينا لنرسل إشعارات الطلبات والمجتمع. يمكنك إيقافها من التطبيق أو من إعدادات جهازك.',
      ],
    },
    {
      id: 'why-we-use-it',
      heading: '5. لماذا نستخدم بياناتك',
      items: [
        'للتحقق من أنك مقيم أو تاجر في المجمع ومراجعة طلب تسجيل وحدتك وإرسال دعوة لإنشاء حسابك.',
        'لإنشاء حسابك وتأمينه وتسجيل دخولك وإبقائك مسجّلًا للدخول وإعادة تعيين كلمة المرور.',
        'لتشغيل السوق: تنفيذ الطلبات وتجهيزها وتوصيلها وتتبعها وعرض المراجعات وحفظ المتاجر.',
        'لنشر إعلانات بيع وإيجار الشقق بعد أن يراجعها المسؤول.',
        'لإدارة حسابات المجمع: تسجيل رسوم الخدمات ومساهمات صندوق الصيانة وإصدار الإيصالات وحل الخلافات المتعلقة بالمدفوعات (راجع البند 3).',
        'لتشغيل الحوكمة المجتمعية: عرض الإعلانات وإحصاء الاستطلاعات والانتخابات بعدالة بصوت واحد لكل مقيم والتعامل مع الملاحظات.',
        'لإرسال رسائل الخدمة (الدعوات وإعادة تعيين كلمة المرور وردود الدعم) والإشعارات التي فعّلتها.',
        'لحماية الخدمة: منع إساءة الاستخدام والاحتيال وتطبيق الحدود وفحص المشكلات والاحتفاظ بسجل التدقيق.',
        'للوفاء بالالتزامات القانونية والرد على الطلبات المشروعة.',
      ],
      paragraphs: ['لا نبيع بياناتك الشخصية ولا نستخدمها في الإعلانات.'],
    },
    {
      id: 'legal-basis',
      heading: '6. الأساس القانوني والموافقة',
      paragraphs: [
        'نعالج بياناتك لأنها لازمة لتقديم الخدمة التي طلبتها (التسجيل والحساب والطلبات والمشاركة المجتمعية)، ولأنك توافق على الميزات الاختيارية (الإشعارات وتسجيل الدخول بالبصمة وإرفاق الصور والملاحظات دون اسم)، ولأن لنا مصلحة مشروعة في إبقاء الخدمة آمنة. وحيث نعتمد على موافقتك يمكنك سحبها في أي وقت، مثل إيقاف الإشعارات أو تسجيل الدخول بالبصمة، ولا يؤثر السحب على ما تمت معالجته قبله.',
        'نحتفظ بسجلات حسابات المجمع (البند 3) لأنها لازمة لإدارة التزامات كل مالك تجاه المجمع وللوفاء بالالتزامات المحاسبية والقانونية. ولا تقوم على الموافقة، لذا لا يمكن إيقافها أو سحبها.',
        'نتعامل مع البيانات الشخصية مع مراعاة قانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020 ولائحته التنفيذية. هذه السياسة شرح لممارساتنا وليست إقرارًا بأن كل حكم من أحكامه قد جرى اعتماده من جهة مستقلة.',
      ],
    },
    {
      id: 'who-sees-it',
      heading: '7. من يمكنه الاطلاع على بياناتك',
      items: [
        'يطّلع مسؤولو المجمع على طلبات تسجيل المقيمين وحسابات المقيمين والشقق والطلبات والأصوات بالقدر اللازم لإدارة الحوكمة والملاحظات. ويستطيع المسؤولون رؤية كاتب الملاحظة حتى إذا اخترت إرسالها دون اسم، ولا يستطيع المقيمون الآخرون ولا التجار ذلك.',
        'يطّلع المحاسبون الذين تسمّيهم الإدارة والمسؤولون على سجلات حسابات المجمع لكل شقة (البند 3) مع اسم المالك ورقم هاتفه. ولا يرى المحاسبون البريد الإلكتروني للملاك ولا أرقام الهوية الوطنية أو جوازات السفر. ولا يرى المقيمون السجلات المالية في التطبيق حاليًا؛ وإذا أُضيفت كشوف حساب للملاك فسيرى المالك شقته فقط عن مدة ملكيته، ويرى المالك الجديد رقمًا افتتاحيًا واحدًا دون مدفوعات المالك السابق. وكل ما يُنشر للمقيمين عن الحسابات يقتصر على الإجماليات.',
        'يرى التاجر الطلبات المقدّمة إلى متجره بما فيها محتوى الطلب ووحدة التسليم وملاحظاتك والاسم اللازم للتوصيل.',
        'إذا نشرت إعلان بيع أو إيجار لشقتك، فبعد موافقة المسؤول عليه يراه المقيمون المسجّلون والمسؤولون مع اسمك ورقم هاتف التواصل الذي كتبته. ويرى المسؤولون أيضًا الإعلانات التي تنتظر المراجعة.',
        'يرى المقيمون الآخرون تعليقاتك، ومراجعاتك حيث يظهر فيها الاسم. ولا يرون بريدك الإلكتروني أو رقم هاتفك (إلا إذا كتبته في إعلان شقة) أو طلباتك أو أصواتك.',
        'يرجى عدم كتابة معلومات حساسة في الحقول النصية الحرة مثل ملاحظات الطلب والتعليقات والملاحظات، لأن الأطراف المذكورة أعلاه تستطيع قراءتها.',
      ],
    },
    {
      id: 'processors',
      heading: '8. مزوّدو الخدمة ونقل البيانات دوليًا',
      paragraphs: [
        'نستعين بمزوّدي الخدمات التالية لتشغيل إيست بارك. يعالجون البيانات نيابةً عنا ولغرض تقديم خدمتهم فقط. ولا نشارك بياناتك مع المعلنين أو وسطاء البيانات.',
      ],
      items: [
        'Render: يستضيف خادم الواجهة الخلفية وواجهة البرمجة.',
        'Vercel: يستضيف الموقع بما في ذلك جانب الخادم، ويوفّر تحليلات الويب.',
        'Supabase: يستضيف قاعدة بيانات PostgreSQL ومساحة تخزين الملفات (صور الملف الشخصي وصور الملاحظات وصور إعلانات الشقق وملفات التقارير الرسمية، وفي مساحة تخزين خاصة منفصلة صور إيصالات الدفع والشيكات).',
        'Upstash: يوفّر ذاكرة Redis التي نستخدمها للبيانات قصيرة العمر مثل رموز إعادة تعيين كلمة المرور وعدّادات محاولات الدخول وإلغاء الجلسات.',
        'Brevo (ناقل بريد SMTP) وصندوق بريد إيست بارك المُرسِل: يوصّلان رسائل الخدمة، لذا يمر بريدك الإلكتروني ومحتوى تلك الرسائل عبرهما.',
        'خدمة إشعارات Expo (وخدمات إشعارات Apple وGoogle خلفها): توصّل الإشعارات إلى جهازك إذا فعّلتها.',
        'Apple وGoogle: توزّعان تطبيق الجوال وتوفّران التحقق الحيوي على الجهاز، ولا نتلقى منهما بيانات حيوية.',
        'روابط الصور العامة: الصور التي ترفعها (مثل صور الملف الشخصي وصور الملاحظات وصور إعلانات الشقق) تُعرض عبر روابط عامة، لذا يستطيع أي شخص يملك الرابط فتح تلك الصورة. وتُستثنى صور إيصالات الدفع والشيكات: فهي تُحفظ في تخزين خاص ولا تُعطى للمقيمين أبدًا، ولا يفتحها إلا الموظفون عبر روابط تنتهي صلاحيتها بعد 60 ثانية.',
        'تعمل هذه الجهات من مراكز بيانات خارج مصر، لذا قد تُنقل بياناتك وتُخزَّن في دول أخرى منها دول في أوروبا والولايات المتحدة. نختار مزوّدين معروفين ونعتمد على ضماناتهم الأمنية والتعاقدية لهذه التحويلات.',
      ],
    },
    {
      id: 'retention',
      heading: '9. مدة الاحتفاظ بالبيانات',
      items: [
        'تُحفظ بيانات الحساب والطلبات والأصوات والمراجعات والتعليقات والملاحظات ما دام حسابك نشطًا وبعد ذلك وفق ما يلي. لا يوجد حاليًا إجراء تلقائي يمسح السجلات القديمة نهائيًا.',
        'عند حذف حسابك يُعطَّل الحساب: يُسجَّل خروجك من كل الأجهزة ولا يمكنك الدخول مجددًا ويُزال رمز الإشعارات ويُخفى الحساب من التطبيق. لا يُمحى السجل فورًا بل يُحفظ في سلة محذوفات لدى المسؤولين ليمكن استرجاعه إذا طلبت ذلك. وتبقى طلباتك وأصواتك وتعليقاتك ومراجعاتك وملاحظاتك وإدخالات سجل التدقيق كما هي، لأن آخرين والمجمع يعتمدون على هذه السجلات. ويبقى بريدك الإلكتروني محجوزًا فلا يستخدمه حساب آخر.',
        'تُحفظ سجلات حسابات المجمع (البند 3) لمدة 7 سنوات ثم تُؤرشف أو تُحذف. وحذف حسابك يُنهي فترة ملكيتك لكنه لا يزيل هذه السجلات لأنها تخص الشقة، وتظهر بعد ذلك باعتبارك مالكًا سابقًا.',
        'تُحفظ طلبات تسجيل الوحدات، بما فيها رقم الهوية الوطنية أو جواز السفر الاختياري، كسجل إداري ولا تُزال تلقائيًا عند حذف الحساب.',
        'تنتهي البيانات قصيرة العمر من تلقاء نفسها: رموز إعادة تعيين كلمة المرور بعد 30 دقيقة ورموز الوصول بعد 15 دقيقة وجلسات الدخول بعد 7 أيام وعدّادات تحديد المعدل بعد انتهاء نافذتها.',
        'يمكنك أن تطلب محو بياناتك نهائيًا، راجع البند 11. وقد نضطر إلى الاحتفاظ ببعض السجلات إذا اقتضى القانون أو نزاع قائم ذلك، وقد تبقى في النسخ الاحتياطية لفترة محدودة.',
      ],
    },
    {
      id: 'security',
      heading: '10. كيف نحمي بياناتك',
      items: [
        'تستخدم الاتصالات بالتطبيق والموقع بروتوكول HTTPS.',
        'تُحفظ كلمات المرور فقط في صورة مشفّرة أحادية الاتجاه مع ملح. وروابط إعادة التعيين ورموز الدخول قصيرة العمر وأحادية الاستخدام حيثما ينطبق، وتُلغى كل الجلسات عند إعادة تعيين كلمة المرور أو حذف الحساب.',
        'في الموقع تُحفظ رموز الدخول في ملفات تعريف ارتباط من نوع HttpOnly وSecure وSameSite=Strict لا تستطيع نصوص المتصفح قراءتها. وفي تطبيق الجوال تُحفظ في التخزين الآمن للجهاز.',
        'يُقيَّد الوصول بحسب الدور، وتُحدَّد معدلات محاولات الدخول، وتُفحص الملفات المرفوعة من حيث النوع والحجم.',
        'لا يوجد نظام آمن تمامًا. إذا اعتقدت أن حسابك تعرّض للاختراق فغيّر كلمة المرور وتواصل معنا فورًا.',
      ],
    },
    {
      id: 'your-rights',
      heading: '11. حقوقك وكيفية ممارستها',
      paragraphs: [
        'يحق لك طلب الاطلاع على بياناتك الشخصية لدينا وتصحيحها وسحب الموافقة والاعتراض على المعالجة أو تقييدها وحذفها، مع مراعاة الحدود المذكورة في البند 9.',
      ],
      items: [
        'تصحيح بياناتك: عدّل اسمك ورقم هاتفك وصورتك وبقية بياناتك من ملفك الشخصي.',
        'سجلات حسابات المجمع: يمكنك طلب الاطلاع على سجلات شقتك وتصحيح أي خطأ فيها. يتم التصحيح بقيود عكسية لا بالتعديل، ولا يمكن محو هذه السجلات خلال مدة الاحتفاظ البالغة 7 سنوات.',
        'حذف حسابك: من التطبيق أو الموقع افتح الملف الشخصي واختر حذف الحساب. التاجر الذي ما زال يملك متجرًا يلزم أولًا إزالة المتجر.',
        'الاطلاع أو المحو الكامل أو استرجاع حساب معطّل أو أي طلب آخر: راسلنا على ' +
          `${PRIVACY_CONTACT_EMAIL} من البريد الإلكتروني المسجّل في حسابك. قد نطلب منك تأكيد هويتك قبل التنفيذ، وسنرد خلال مدة معقولة.`,
        'الإشعارات والبصمة: أوقفها في أي وقت من إعدادات التطبيق أو الجهاز.',
        'إذا لم تقتنع بردّنا فيحق لك التقدم بشكوى إلى الجهة المختصة في مصر.',
      ],
    },
    {
      id: 'children',
      heading: '12. الأطفال',
      paragraphs: [
        'إيست بارك مخصص للبالغين من عمر 18 سنة فأكثر. تُنشأ الحسابات فقط للمقيمين والتجار الذين تعتمدهم إدارة المجمع. ولا نجمع عمدًا بيانات شخصية من أطفال دون 18 سنة. وإذا اعتقدت أن طفلًا قدّم بيانات فتواصل معنا لنزيلها.',
      ],
    },
    {
      id: 'cookies',
      heading: '13. ملفات تعريف الارتباط والتخزين المحلي في الموقع',
      items: [
        'ملفات أساسية: ملفا ارتباط من نوع HttpOnly يُبقيانك مسجّلًا للدخول في الموقع (رمز وصول ورمز تجديد). هما لازمان للخدمة ويُزالان عند تسجيل الخروج.',
        'التخزين المحلي في متصفحك: اللغة التي اخترتها والمظهر الفاتح أو الداكن وسلة التسوق. تبقى على جهازك ولا تُرسل إلينا.',
        'التحليلات: يجمع Vercel Web Analytics إحصاءات مجمّعة عن مشاهدات الصفحات. ولا نستخدم ملفات ارتباط إعلانية ولا تتبعًا عبر المواقع.',
        'يحفظ تطبيق الجوال رموز دخولك في التخزين الآمن، وذاكرة مؤقتة محدودة للمحتوى غير الحساس وتفضيلاتك على الجهاز.',
      ],
    },
    {
      id: 'changes',
      heading: '14. التغييرات على هذه السياسة',
      paragraphs: [
        'قد نحدّث هذه السياسة مع تطور الخدمة. يبيّن تاريخ السريان في أعلى الصفحة أحدث نسخة. وإذا كان التغيير جوهريًا فسنخبرك داخل التطبيق أو بالبريد الإلكتروني قبل سريانه.',
      ],
    },
    {
      id: 'contact',
      heading: '15. التواصل',
      paragraphs: [
        `للأسئلة أو الطلبات أو الشكاوى المتعلقة بالخصوصية: ${PRIVACY_CONTACT_EMAIL}. الدعم: ${PRIVACY_SUPPORT_EMAIL}.`,
      ],
    },
  ],
};

export const PRIVACY_POLICY: Record<PolicyLanguage, PolicyDocument> = { ar, en };
