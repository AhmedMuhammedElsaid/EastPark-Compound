import { FinancePaymentNew } from '@/components/finance/FinancePaymentNew';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function FinanceNewPaymentPage({ searchParams }: Props) {
  const { flatId } = await searchParams;
  return <FinancePaymentNew initialFlatId={typeof flatId === 'string' && flatId.length <= 64 ? flatId : undefined} />;
}
