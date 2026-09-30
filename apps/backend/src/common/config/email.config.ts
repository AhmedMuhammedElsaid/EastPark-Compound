import { registerAs } from '@nestjs/config';

export default registerAs(
    'email',
    (): Record<string, unknown> => ({
        host: process.env.SMTP_HOST ?? 'localhost',
        port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
        from: process.env.EMAIL_FROM ?? 'noreply@eastpark.app',
    })
);
