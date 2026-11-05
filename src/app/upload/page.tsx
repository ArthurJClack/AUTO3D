import PartForm from "@/components/PartForm";
import { requireUser } from "@/lib/auth";
import { listGenerations } from "@/lib/parts";

export default async function Upload() {
  await requireUser();
  return (
    <div className="stack">
      <h1>Upload a part</h1>
      <PartForm vehicles={listGenerations()} />
    </div>
  );
}
