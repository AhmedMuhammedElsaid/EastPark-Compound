import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions,
} from 'class-validator';

import { isKnownFlat } from './compound-layout';

/**
 * Property decorator for the `building` field of a DTO that also carries
 * `floor` and `flatNumber`: the whole key must be one of the compound's 690
 * flats. Reads the sibling fields from the object, so it works under
 * `PickType` as long as all three are picked. Non-string siblings are left to
 * their own validators (no duplicate error); a floor or flat number that
 * fails its own format check is reported there, not here.
 */
export function IsKnownFlat(options?: ValidationOptions): PropertyDecorator {
    return (target, propertyName) => {
        registerDecorator({
            name: 'isKnownFlat',
            target: target.constructor,
            propertyName: propertyName as string,
            options: {
                message:
                    'building, floor and flatNumber must be a flat of the compound (e.g. A1, 3, 2)',
                ...options,
            },
            validator: {
                validate(value: unknown, args?: ValidationArguments): boolean {
                    const { floor, flatNumber } = (args?.object ?? {}) as Record<
                        string,
                        unknown
                    >;
                    if (
                        typeof value !== 'string' ||
                        typeof floor !== 'string' ||
                        typeof flatNumber !== 'string'
                    )
                        return true;
                    if (!/^(G|[1-9]|1[01])$/i.test(floor.trim())) return true;
                    if (!/^[1-5]$/.test(flatNumber.trim())) return true;
                    return isKnownFlat({ building: value, floor, flatNumber });
                },
            },
        });
    };
}
