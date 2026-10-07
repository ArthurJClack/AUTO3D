import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getPart } from "@/lib/parts";
import StlViewer from "@/components/StlViewer";
import { deletePart } from "@/app/actions";

const formatSize = (b: number) =>
  b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

export default async function PartPage({ params }: PageProps<"/parts/[id]">) {
  const { id } = await params;
  const data = /^\d+$/.test(id) ? getPart(Number(id)) : null;
  if (!data) notFound();
  const { part, vehicles } = data;
  const user = await getUser();
  const owner = user?.username === part.username;

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
        <ul>
          {vehicles.map((v) => (
            <li key={v.id}>
              {v.make} {v.model} — {v.generation} ({v.year_start}–{v.year_end})
            </li>
          ))}
        </ul>
      </div>

      {owner && (
        <form action={deletePart}>
          <input type="hidden" name="id" value={part.id} />
          <button className="danger">Delete this part</button>
        </form>
      )}
    </div>
  );
}
