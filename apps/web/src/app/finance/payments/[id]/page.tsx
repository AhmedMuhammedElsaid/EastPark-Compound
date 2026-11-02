import { FinancePaymentDetail } from '@/components/finance/FinancePaymentDetail';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinancePaymentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { slip } = await searchParams;
  return <FinancePaymentDetail key={id} paymentId={id} slipError={typeof slip === 'string' ? slip.slice(0, 64) : undefined} />;
}
