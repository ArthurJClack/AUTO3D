import Link from "next/link";
import type { Part } from "@/lib/parts";

export default function PartCard({ part }: { part: Part }) {
  return (
    <Link href={`/parts/${part.id}`} className="card part">
      <h3>{part.title}</h3>
      <p className="muted">
        {part.category}
        {part.material && ` · ${part.material}`} · by {part.creator_name || part.username}
      </p>
      <p className="tags">
        {part.file_name ? <span className="tag">STL hosted</span> : <span className="tag alt">External link</span>}
        {part.universal ? <span className="tag alt">Universal</span> : null}
      </p>
    </Link>
  );
}
