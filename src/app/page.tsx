import PartCard from "@/components/PartCard";
import VehicleSelector from "@/components/VehicleSelector";
import { searchParts } from "@/lib/parts";

export default function Home() {
  const { fits: latest } = searchParts({});
  return (
    <>
      <section className="hero">
        <h1>3D-printable parts for your car</h1>
        <p>Pick your make, model and year and see everything that fits — plus universal parts that work on any car.</p>
        <form action="/search" className="finder">
          <VehicleSelector />
          <button>Find parts</button>
        </form>
      </section>
      <h2>Latest parts</h2>
      {latest.length === 0 ? (
        <p className="muted">Nothing here yet — be the first to upload a part.</p>
      ) : (
        <div className="grid">
          {latest.slice(0, 12).map((p) => (
            <PartCard key={p.id} part={p} />
          ))}
        </div>
      )}
    </>
  );
}
