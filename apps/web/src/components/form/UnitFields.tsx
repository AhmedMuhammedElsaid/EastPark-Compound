'use client';

import type { UseFormRegisterReturn } from 'react-hook-form';

import * as React from 'react';

import { FLAT_OPTIONS, getBuildingsByPhase, getFloorOptions } from '@/config/compound';
import { useTranslation } from '@/lib/i18n';

import { Combobox } from './Combobox';
import { CONTROL_CLASS, Field, controlBorder } from './Field';

type FloorControl = { value: string; onChange: (value: string) => void; onBlur?: () => void };

/**
 * The building / floor / flat inputs of `/register-unit`, shared with the super admin's "Add flat"
 * form so both offer exactly the same options from `src/config/compound.ts`.
 *
 * Building and flat are native selects wired with `register(...)`; the floor is a searchable
 * combobox driven by a controller. `idPrefix` keeps ids unique when two forms share a page.
 */
export function UnitFields({
  idPrefix = '',
  building,
  buildingField,
  floor,
  flatField,
  errors,
  className = 'grid gap-5 md:grid-cols-3',
}: {
  idPrefix?: string;
  /** The currently chosen building (watched), which decides the floor options. */
  building: string;
  buildingField: UseFormRegisterReturn;
  floor: FloorControl;
  flatField: UseFormRegisterReturn;
  /** Already-translated messages. */
  errors: { building?: string; floor?: string; flatNumber?: string };
  className?: string;
}) {
  const { t, lang } = useTranslation();
  const floorOptions = React.useMemo(() => getFloorOptions(building), [building]);
  const buildingGroups = getBuildingsByPhase();
  const labelKey = lang === 'ar' ? 'labelAr' : 'labelEn';
  const { value: floorValue, onChange: setFloor } = floor;

  // Floors are per-building: phases 2 and 3 have a ground floor, 1 and 4 do
  // not. If the chosen floor no longer exists in the newly-chosen building
  // (pick A2 -> "G", then switch to A1), clear it rather than submitting a
  // unit that cannot exist. The API would accept "G" for A1 — this is the
  // only guard.
  React.useEffect(() => {
    if (!floorValue) return;
    if (!floorOptions.some((option) => option.value === floorValue)) setFloor('');
  }, [floorOptions, floorValue, setFloor]);

  return (
    <div className={className}>
      <Field id={`${idPrefix}building`} label={t('register.fields.building')} required error={errors.building}>
        {(props) => (
          <select {...props} {...buildingField} className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.building))}`}>
            <option value="">{t('register.fields.building_placeholder')}</option>
            {buildingGroups.map(({ phase, buildings }) => (
              <optgroup key={phase.id} label={phase[labelKey]}>
                {buildings.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b[labelKey]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </Field>

      <Field
        id={`${idPrefix}floor`}
        label={t('register.fields.floor')}
        required
        error={errors.floor}
        hint={building ? t('a11y.combobox_hint') : undefined}
      >
        {(props) => (
          <Combobox
            id={props.id}
            options={floorOptions}
            value={floorValue}
            onChange={setFloor}
            onBlur={floor.onBlur}
            // Disabled until a building is chosen — the available
            // floors are not knowable before then.
            disabled={!building}
            placeholder={t('register.fields.floor_search')}
            disabledHint={t('register.fields.building_placeholder')}
            hasError={Boolean(errors.floor)}
            ariaDescribedBy={props['aria-describedby']}
            ariaRequired
            labelFor={lang}
          />
        )}
      </Field>

      <Field id={`${idPrefix}flatNumber`} label={t('register.fields.flat')} required error={errors.flatNumber}>
        {(props) => (
          <select {...props} {...flatField} className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.flatNumber))}`}>
            <option value="">{t('register.fields.flat_placeholder')}</option>
            {FLAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option[labelKey]}
              </option>
            ))}
          </select>
        )}
      </Field>
    </div>
  );
}
