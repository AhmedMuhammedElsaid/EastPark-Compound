import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';

interface SendEmailOptions {
    to: string | string[];
    subject: string;
    template: string;
    context?: Record<string, unknown>;
}

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly transporter: nodemailer.Transporter;
    private readonly from: string;

    constructor(private readonly config: ConfigService) {
        this.from = config.getOrThrow<string>('email.from');

        this.transporter = nodemailer.createTransport({
            host: config.getOrThrow<string>('email.host'),
            port: config.getOrThrow<number>('email.port'),
            secure: false,
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
    }: SendEmailOptions): Promise<void> {
        try {
            const html = this.renderTemplate(template, context);
            await this.transporter.sendMail({
                from: this.from,
                to: Array.isArray(to) ? to.join(', ') : to,
                subject,
                html,
            });
            this.logger.log(
                `Email sent to ${JSON.stringify(to)} [${template}]`
            );
        } catch (error) {
            this.logger.error(
                `Failed to send email [${template}] to ${JSON.stringify(to)}`,
                error
            );
            throw error;
        }
    }

    // ── Convenience methods ──────────────────────────────────────────────────

    sendOtp(to: string, otp: string): Promise<void> {
        return this.send({
            to,
            subject: 'Your EastPark verification code',
            template: 'otp',
            context: { otp, appName: 'EastPark' },
        });
    }

    sendPasswordReset(to: string, resetUrl: string): Promise<void> {
        return this.send({
            to,
            subject: 'Reset your EastPark password',
            template: 'reset-password',
            context: { resetUrl, appName: 'EastPark' },
        });
    }

    sendInvitation(to: string, inviteUrl: string, role: string): Promise<void> {
        return this.send({
            to,
            subject: `You're invited to EastPark as ${role}`,
            template: 'invitation',
            context: { inviteUrl, role, appName: 'EastPark' },
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
        return template(context);
    }
}
