import { FinanceFlats } from '@/components/finance/FinanceFlats';
import { parseFlatsParams } from '@/lib/finance/flats-params';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function FinanceFlatsPage({ searchParams }: Props) {
  return <FinanceFlats initial={parseFlatsParams(await searchParams)} />;
}
