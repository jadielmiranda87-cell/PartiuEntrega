import { Redirect, useLocalSearchParams } from 'expo-router';

/** Deep link: fastfood://order-payment?id=... */
export default function OrderPaymentDeepLink() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!id) {
    return <Redirect href="/(customer)" />;
  }
  return <Redirect href={`/(customer)/order-payment?id=${encodeURIComponent(id)}`} />;
}
