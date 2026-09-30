export interface ISendEmailParams {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
}
