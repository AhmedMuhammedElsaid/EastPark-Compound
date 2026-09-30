// Checks the Brevo SMTP setup in .env.
//
//   node scripts/brevo-check.js          auth only (safe, sends nothing)
//   node scripts/brevo-check.js --send   also sends one real test email
//
// Credentials are read from the commented-out Brevo block in .env so the key
// is never typed on a command line. Nothing is printed but pass/fail.
// Safe to delete; nothing imports it.
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');

// The Mailpit defaults above the Brevo block set SMTP_USER/SMTP_PASS to "",
// so take the first occurrence that actually has a value.
const pick = (key) => {
    const re = new RegExp(`^#?\\s*${key}=\"?([^\"\\n]*)\"?`, 'gm');
    for (const m of env.matchAll(re)) {
        if (m[1]) return m[1];
    }
    return null;
};

const user = pick('SMTP_USER');
const pass = pick('SMTP_PASS');

if (!user || !pass) {
    console.log('FAIL: no SMTP_USER / SMTP_PASS found in .env');
    process.exit(1);
}
console.log(`login: ${user}`);

// Host/port are pinned rather than read from .env: the active values there are
// still Mailpit's localhost:1025, and this script only ever tests Brevo.
const transport = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user, pass },
});

// Candidate senders, in preference order. Brevo rejects mail from an
// unverified sender at send time — verify() does NOT catch this, which is
// why --send exists.
const RECIPIENT = 'ahmed.muhammed.elsaid@gmail.com';
const SENDERS = ['noreply@eastpark.app', 'ahmed.muhammed.elsaid@gmail.com'];

async function main() {
    await transport.verify();
    console.log('AUTH OK — Brevo accepted the credentials in .env');

    if (!process.argv.includes('--send')) {
        console.log('(auth only — pass --send to also send a real test email)');
        return;
    }

    for (const from of SENDERS) {
        try {
            await transport.sendMail({
                from,
                to: RECIPIENT,
                subject: `EastPark SMTP test — from ${from}`,
                text:
                    `This is an automated deliverability test for the EastPark backend.\n\n` +
                    `Sender under test: ${from}\n` +
                    `If you received this, that address is verified in Brevo and is ` +
                    `usable as EMAIL_FROM.`,
            });
            console.log(`SEND OK   from ${from}  → verified sender`);
        } catch (e) {
            console.log(`SEND FAIL from ${from}  → ${e.message}`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.log(`FAIL — ${e.message}`);
        process.exit(1);
    });
