import { FinanceFlats, type FlatsFilters } from '@/components/finance/FinanceFlats';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function FinanceFlatsPage({ searchParams }: Props) {
  const params = await searchParams;
  const initial: FlatsFilters = {
    hasBalance: params.hasBalance === 'true' || params.hasBalance === 'false' ? params.hasBalance : undefined,
    overdueDays: typeof params.overdueDays === 'string' ? params.overdueDays : undefined,
  };
  return <FinanceFlats initial={initial} />;
}
