import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePart, voteFit } from "@/app/actions";
import ReportForm from "@/components/ReportForm";
import StlViewer from "@/components/StlViewer";
import { canManage, getUser } from "@/lib/auth";
import { formatSize, vehicleLabel } from "@/lib/format";
import { getFitVotes, getPart } from "@/lib/parts";

export default async function PartPage({ params }: PageProps<"/parts/[id]">) {
  const { id } = await params;
  const data = /^\d+$/.test(id) ? getPart(Number(id)) : null;
  if (!data) notFound();
  const { part, vehicles } = data;
  const user = await getUser();
  const manage = canManage(user, part.user_id);
  const votes = getFitVotes(part.id, user?.id);
  const canVote = !!user && user.id !== part.user_id;

  return (
    <div className="stack">
      <div>
        <h1>{part.title}</h1>
        <p className="muted">
          {part.category}
          {part.material && ` · ${part.material}`} · by {part.creator_name || part.username}
          {part.creator_name && ` (posted by ${part.username})`}
        </p>
      </div>

      {part.image_path && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/images/${part.id}`} alt={part.title} className="photo" />
      )}
      {part.file_name && <StlViewer url={`/files/${part.id}?view`} />}

      <div className="row">
        {part.file_name && (
          <a className="btn" href={`/files/${part.id}`}>
            Download STL ({formatSize(part.file_size ?? 0)})
          </a>
        )}
        {part.source_url && (
          <a className="btn" href={part.source_url} target="_blank" rel="noopener noreferrer nofollow">
            {part.file_name ? "View original" : "Get it at the original site"} ↗
          </a>
        )}
      </div>

      {part.description && (
        <div className="card">
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{part.description}</p>
        </div>
      )}

      <div className="card">
        <h3>Fits</h3>
        {part.universal ? <p className="muted">Universal — works on any car.</p> : null}
        <ul className="fits">
          {vehicles.map((v) => {
            const vote = votes.get(v.id);
            const choose = (works: "1" | "0") => (vote?.mine === Number(works) ? "clear" : works);
            return (
              <li key={v.id} className="vote">
                <span>{vehicleLabel(v)}</span>
                <span className="muted">
                  ✓ {vote?.up ?? 0} · ✗ {vote?.down ?? 0}
                </span>
                {canVote && (
                  <>
                    {(["1", "0"] as const).map((w) => (
                      <form key={w} action={voteFit}>
                        <input type="hidden" name="part_id" value={part.id} />
                        <input type="hidden" name="vehicle_id" value={v.id} />
                        <input type="hidden" name="works" value={choose(w)} />
                        <button className={vote?.mine === Number(w) ? (w === "1" ? "on-good" : "on-bad") : ""}>
                          {w === "1" ? "✓ Fits my car" : "✗ Doesn't fit"}
                        </button>
                      </form>
                    ))}
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {!user && (
          <p className="hint" style={{ marginTop: 12 }}>
            <Link href="/login">Log in</Link> to confirm whether it fits your car.
          </p>
        )}
      </div>

      {manage && (
        <div className="row">
          <Link className="btn" href={`/parts/${part.id}/edit`}>
            Edit
          </Link>
          <form action={deletePart}>
            <input type="hidden" name="id" value={part.id} />
            <button className="danger">Delete</button>
          </form>
        </div>
      )}
      {user && !manage && <ReportForm partId={part.id} />}
      {!user && (
        <p className="hint">
          <Link href="/login">Log in</Link> to report a problem with this part.
        </p>
      )}
    </div>
  );
}
