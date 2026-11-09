import Link from "next/link";
import type { Part } from "@/lib/parts";

export default function PartCard({ part }: { part: Part }) {
  return (
    <Link href={`/parts/${part.id}`} className="card part">
      {part.image_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/images/${part.id}`} alt="" className="thumb" loading="lazy" />
      ) : (
        <div className="thumb placeholder">{part.file_name ? "STL" : "🔗"}</div>
      )}
      <h3>{part.title}</h3>
      <p className="muted">
        {part.category}
        {part.material && ` · ${part.material}`} · by {part.creator_name || part.username}
      </p>
      <p className="tags">
        {part.file_name ? <span className="tag">STL hosted</span> : <span className="tag alt">External link</span>}
        {part.universal ? <span className="tag alt">Universal</span> : null}
        {part.up > 0 && <span className="tag good">✓ {part.up} confirmed fit</span>}
        {part.down > part.up && <span className="tag bad">Reported not fitting</span>}
      </p>
    </Link>
  );
}
