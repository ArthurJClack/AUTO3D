import UploadForm from "@/components/UploadForm";
import { requireUser } from "@/lib/auth";
import { listGenerations } from "@/lib/parts";

export default async function Upload() {
  await requireUser();
  return (
    <div className="stack">
      <h1>Upload a part</h1>
      <UploadForm vehicles={listGenerations()} />
    </div>
  );
}
