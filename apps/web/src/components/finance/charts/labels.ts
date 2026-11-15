'use client';

import * as React from 'react';

import { useTranslation } from '@/lib/i18n';

/** Builds every chart's `labels` prop from the `finance.charts.*` translations (AR + EN). */
export function useChartLabels() {
  const { t, lang } = useTranslation();
  return React.useMemo(() => {
    const c = (key: string) => t(`finance.charts.${key}`);
    return {
      lang,
      sparkline: { label: c('spark_aria'), columns: [c('month'), c('rate')] as [string, string] },
      ring: { caption: c('ring_caption') },
      bars: {
        title: c('bars_title'),
        billed: c('billed'),
        collected: c('collected'),
        month: c('month'),
        rate: c('rate'),
        empty: c('empty'),
      },
      donut: {
        title: c('donut_title'),
        currency: c('egp'),
        reversed: c('reversed'),
        net: c('net'),
        item: c('method'),
        gross: c('gross'),
        empty: c('no_receipts'),
        method: {
          CASH: c('method_CASH'),
          BANK_TRANSFER: c('method_BANK_TRANSFER'),
          INSTAPAY: c('method_INSTAPAY'),
          CHEQUE: c('method_CHEQUE'),
        },
      },
      aging: {
        title: c('aging_title'),
        currency: c('egp'),
        empty: c('empty'),
        item: c('aging_bucket'),
        amount: c('amount'),
        current: c('aging_current'),
        d31_60: c('aging_d31_60'),
        d61_90: c('aging_d61_90'),
        over90: c('aging_over90'),
      },
      floors: { title: c('floors_title'), label: c('floor'), value: c('outstanding'), empty: c('empty'), ground: c('floor_ground') },
      map: {
        title: c('map_title'),
        aria: c('map_aria'),
        gate: c('map_gate'),
        flats: c('flats'),
        currency: c('egp'),
        building: c('building'),
        outstanding: c('outstanding'),
        owing: c('owing'),
        empty: c('empty'),
        less: c('map_less'),
        more: c('map_more'),
        hint: c('map_hint'),
      },
    };
  }, [t, lang]);
}
