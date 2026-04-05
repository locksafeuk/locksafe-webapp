import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default function AttributionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminSidebar>
      <div className="p-4 md:p-6 lg:p-8">{children}</div>
    </AdminSidebar>
  );
}
