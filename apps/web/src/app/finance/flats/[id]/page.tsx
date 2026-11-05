import { FinanceFlatDetail } from '@/components/finance/FinanceFlatDetail';

type Props = { params: Promise<{ id: string }> };

export default async function FinanceFlatPage({ params }: Props) {
  const { id } = await params;
  return <FinanceFlatDetail key={id} flatId={id} />;
}
