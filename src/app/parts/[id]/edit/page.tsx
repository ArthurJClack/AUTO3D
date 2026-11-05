import { notFound, redirect } from "next/navigation";
import PartForm from "@/components/PartForm";
import { canManage, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getPart, listGenerations } from "@/lib/parts";

export default async function EditPart({ params }: PageProps<"/parts/[id]/edit">) {
  const user = await requireUser();
  const { id } = await params;
  const data = /^\d+$/.test(id) ? getPart(Number(id)) : null;
  if (!data) notFound();
  if (!canManage(user, data.part.user_id)) redirect(`/parts/${id}`);
  const selected = getDb()
    .prepare("SELECT vehicle_id FROM fitments WHERE part_id = ?")
    .all(data.part.id)
    .map((r) => Number(r.vehicle_id));
  return (
    <div className="stack">
      <h1>Edit part</h1>
      <PartForm vehicles={listGenerations()} part={data.part} selected={selected} />
    </div>
  );
}
