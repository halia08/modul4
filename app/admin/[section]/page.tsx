import { notFound } from "next/navigation";
import ManagementModule from "@/app/ui/management-module";

const sections = ["produk", "pesanan", "transaksi"] as const;

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.some((allowedSection) => allowedSection === section)) {
    notFound();
  }

  return <ManagementModule role="Admin" section={section} />;
}
