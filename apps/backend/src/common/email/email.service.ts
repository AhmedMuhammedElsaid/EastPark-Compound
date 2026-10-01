import * as fs from 'fs';
import * as path from 'path';

import {
    Injectable,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';

interface SendEmailOptions {
    to: string | string[];
    subject: string;
    template: string;
    context?: Record<string, unknown>;
    text: string;
    replyTo?: string;
}

interface EmailTransportError {
    code?: unknown;
    responseCode?: unknown;
    command?: unknown;
}

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly transporter: nodemailer.Transporter;
    private readonly from: string;
    private readonly replyTo: string;
    private readonly supportTo: string;

    constructor(private readonly config: ConfigService) {
        this.from = config.getOrThrow<string>('email.from');
        this.replyTo = config.getOrThrow<string>('email.replyTo');
        this.supportTo = config.getOrThrow<string>('email.supportTo');

        this.transporter = nodemailer.createTransport({
            host: config.getOrThrow<string>('email.host'),
            port: config.getOrThrow<number>('email.port'),
            secure: false,
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 20_000,
            auth: config.get<string>('email.user')
                ? {
                      user: config.getOrThrow<string>('email.user'),
                      pass: config.getOrThrow<string>('email.pass'),
                  }
                : undefined,
        });
    }

    async send({
        to,
        subject,
        template,
        context = {},
        text,
        replyTo,
    }: SendEmailOptions): Promise<void> {
        try {
            const html = this.renderTemplate(template, context);
            await this.transporter.sendMail({
                from: this.from,
                replyTo: replyTo ?? this.replyTo,
                to: Array.isArray(to) ? to.join(', ') : to,
                subject,
                html,
                text,
                attachments: [
                    {
                        filename: 'eastpark-mark.png',
                        path: path.join(
                            __dirname,
                            'assets',
                            'eastpark-mark.png'
                        ),
                        cid: 'eastpark-logo',
                    },
                ],
            });
            this.logger.log(
                `Email sent to ${JSON.stringify(to)} [${template}]`
            );
        } catch (error) {
            const transportError = error as EmailTransportError;
            this.logger.error(
                JSON.stringify({
                    message: `Failed to send email [${template}]`,
                    code:
                        typeof transportError.code === 'string'
                            ? transportError.code
                            : undefined,
                    responseCode:
                        typeof transportError.responseCode === 'number'
                            ? transportError.responseCode
                            : undefined,
                    command:
                        typeof transportError.command === 'string'
                            ? transportError.command
                            : undefined,
                })
            );
            throw new ServiceUnavailableException('common.serviceUnavailable');
        }
    }

    // ── Convenience methods ──────────────────────────────────────────────────

    sendOtp(to: string, otp: string): Promise<void> {
        return this.send({
            to,
            subject: 'رمز التحقق الخاص بك من إيست بارك',
            template: 'otp',
            context: { otp, appName: 'EastPark' },
            text: `رمز التحقق الخاص بك من إيست بارك هو ${otp}. تنتهي صلاحية الرمز خلال 10 دقائق. لا تشارك هذا الرمز مع أي شخص.`,
        });
    }

    sendPasswordReset(to: string, resetUrl: string): Promise<void> {
        return this.send({
            to,
            subject: 'إعادة تعيين كلمة مرور إيست بارك',
            template: 'reset-password',
            context: { resetUrl, appName: 'EastPark' },
            text: `لإعادة تعيين كلمة مرور إيست بارك، استخدم الرابط التالي: ${resetUrl}\n\nتنتهي صلاحية الرابط خلال 30 دقيقة. إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة.`,
        });
    }

    sendInvitation(to: string, inviteUrl: string, role: string): Promise<void> {
        const roleAr =
            role === 'ADMIN' ? 'مشرف' : role === 'MERCHANT' ? 'تاجر' : 'ساكن';

        return this.send({
            to,
            subject: `دعوة للانضمام إلى إيست بارك بصفتك ${roleAr}`,
            template: 'invitation',
            context: { inviteUrl, role: roleAr, appName: 'EastPark' },
            text: `تمت دعوتك للانضمام إلى إيست بارك بصفتك ${roleAr}. أنشئ حسابك باستخدام الرابط التالي: ${inviteUrl}\n\nتنتهي صلاحية الدعوة خلال 48 ساعة.`,
        });
    }

    sendSupportIssue(issue: {
        name: string;
        email: string;
        category: string;
        subject: string;
        message: string;
        pageUrl?: string;
    }): Promise<void> {
        const pageLine = issue.pageUrl ? `\nالصفحة: ${issue.pageUrl}` : '';
        const categoryAr: Record<string, string> = {
            ACCESS: 'تسجيل الدخول أو الوصول',
            ACCOUNT: 'بيانات الحساب',
            BUG: 'مشكلة في التطبيق',
            SUGGESTION: 'اقتراح',
            OTHER: 'أخرى',
        };

        return this.send({
            to: this.supportTo,
            replyTo: issue.email,
            subject: `[دعم إيست بارك] ${issue.subject}`,
            template: 'support-issue',
            context: {
                ...issue,
                category: categoryAr[issue.category] ?? issue.category,
                appName: 'EastPark',
            },
            text: `بلاغ جديد إلى دعم إيست بارك\n\nالمرسل: ${issue.name} <${issue.email}>\nالتصنيف: ${categoryAr[issue.category] ?? issue.category}\nالموضوع: ${issue.subject}${pageLine}\n\n${issue.message}`,
        });
    }

    // ── Template renderer ────────────────────────────────────────────────────

    private renderTemplate(
        name: string,
        context: Record<string, unknown>
    ): string {
        const templatePath = path.join(__dirname, 'templates', `${name}.hbs`);
        const source = fs.readFileSync(templatePath, 'utf-8');
        const template = Handlebars.compile(source);
        const content = template(context);
        const layoutPath = path.join(__dirname, 'templates', 'layout.hbs');
        const layoutSource = fs.readFileSync(layoutPath, 'utf-8');
        const layout = Handlebars.compile(layoutSource);
        return layout({ ...context, content });
    }
}
