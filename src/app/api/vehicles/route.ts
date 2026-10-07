import { listMakes, listModels, listYears } from "@/lib/parts";

// GET /api/vehicles                    -> { makes }
// GET /api/vehicles?make=Honda         -> { models }
// GET /api/vehicles?make=..&model=..   -> { years }
export function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const make = p.get("make");
  const model = p.get("model");
  if (make && model) return Response.json({ years: listYears(make, model) });
  if (make) return Response.json({ models: listModels(make) });
  return Response.json({ makes: listMakes() });
}
