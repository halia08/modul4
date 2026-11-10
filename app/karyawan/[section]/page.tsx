import { notFound } from "next/navigation";
import ManagementModule from "@/app/ui/management-module";

const sections = ["bahan-baku", "proses-produksi", "hasil-produksi"] as const;

export default async function EmployeeSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.some((allowedSection) => allowedSection === section)) {
    notFound();
  }

  return <ManagementModule role="Karyawan" section={section} />;
}
