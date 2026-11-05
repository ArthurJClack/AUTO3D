import Link from "next/link";
import { deletePart } from "@/app/actions";
import PartCard from "@/components/PartCard";
import { requireUser } from "@/lib/auth";
import { recentPartsByUser } from "@/lib/parts";

export default async function MyParts() {
  const user = await requireUser();
  const parts = recentPartsByUser(user.id);
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>My parts</h1>
        <Link className="btn" href="/upload">
          Upload a part
        </Link>
      </div>
      {parts.length === 0 ? (
        <p className="muted">You haven&apos;t posted anything yet.</p>
      ) : (
        <div className="grid">
          {parts.map((p) => (
            <div key={p.id} className="stack">
              <PartCard part={p} />
              <div className="row">
                <Link href={`/parts/${p.id}/edit`}>Edit</Link>
                <form action={deletePart}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="link danger-text">Delete</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
