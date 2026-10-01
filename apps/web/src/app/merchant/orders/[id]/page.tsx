import { MerchantOrderDetail } from '@/components/merchant/MerchantOrderDetail';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <MerchantOrderDetail orderId={(await params).id} />;
}
