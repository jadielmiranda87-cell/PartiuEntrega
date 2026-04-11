import { Redirect } from 'expo-router';

/** Rota legada; a aba usa `sales`. Mantido para links antigos. */
export default function LegacySalesReportRedirect() {
  return <Redirect href="/(admin)/sales" />;
}
