import { Transform } from 'class-transformer';
import { ValidateBy, ValidationOptions } from 'class-validator';

import { isDateOnly, isPeriod } from 'src/common/finance/cairo-date';

/** Trims a string body/query field; other values pass through to the validators. */
export function TrimString(): PropertyDecorator {
    return Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value
    );
}

/** A real calendar date written `YYYY-MM-DD`. */
export function IsDateOnly(options?: ValidationOptions): PropertyDecorator {
    return ValidateBy(
        {
            name: 'isDateOnly',
            validator: {
                validate: (value: unknown) =>
                    typeof value === 'string' && isDateOnly(value),
                defaultMessage: () => '$property must be a date (YYYY-MM-DD)',
            },
        },
        options
    );
}

/** An accounting period written `YYYY-MM`. */
export function IsPeriod(options?: ValidationOptions): PropertyDecorator {
    return ValidateBy(
        {
            name: 'isPeriod',
            validator: {
                validate: (value: unknown) =>
                    typeof value === 'string' && isPeriod(value),
                defaultMessage: () => '$property must be a period (YYYY-MM)',
            },
        },
        options
    );
}
