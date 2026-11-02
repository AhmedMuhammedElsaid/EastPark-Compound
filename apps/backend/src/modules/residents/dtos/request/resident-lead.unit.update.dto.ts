import { PickType } from '@nestjs/swagger';

import { ResidentLeadCreateDto } from './resident-lead.create.dto';

/**
 * `PATCH /admin/residents/leads/:id` body: the corrected unit. Same validators
 * as a new submission, so the key must be one of the compound's 690 flats.
 */
export class ResidentLeadUnitUpdateDto extends PickType(
    ResidentLeadCreateDto,
    ['building', 'floor', 'flatNumber'] as const
) {}
