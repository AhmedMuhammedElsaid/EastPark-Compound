import { registerAs } from '@nestjs/config';

export default registerAs('email', (): Record<string, unknown> => {
    const configuredPort = parseInt(process.env.SMTP_PORT ?? '1025', 10);
    const blockedRenderPorts = new Set([25, 465, 587]);
    const port =
        process.env.APP_ENV === 'production' &&
        blockedRenderPorts.has(configuredPort)
            ? 2525
            : configuredPort;

    return {
        host: process.env.SMTP_HOST ?? 'localhost',
        port,
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
        from:
            process.env.EMAIL_FROM ??
            'EastPark <eastpark.eg@gmail.com>',
        replyTo: process.env.EMAIL_REPLY_TO ?? 'eastpark.eg@gmail.com',
        supportTo: process.env.EMAIL_SUPPORT_TO ?? 'eastpark.eg@gmail.com',
    };
});
