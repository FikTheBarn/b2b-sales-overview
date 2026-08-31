import OrdersDashboard from "@/components/orders-dashboard";

export const dynamic = "force-dynamic";

function getDefaultDateRange() {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const startDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);

  return { startDate, endDate };
}

export default function Home() {
  const { startDate, endDate } = getDefaultDateRange();

  return (
    <OrdersDashboard initialStartDate={startDate} initialEndDate={endDate} />
  );
}
