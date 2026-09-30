import { ISendEmailParams } from './email.interface';

export interface IHelperEmailService {
    sendEmail(params: ISendEmailParams): Promise<void>;
}
