import fs from "node:fs/promises";
import { getDb, uploadPath } from "@/lib/db";
import { IMAGE_TYPES } from "@/lib/storage";

export async function GET(_req: Request, ctx: RouteContext<"/images/[id]">) {
  const { id } = await ctx.params;
  const row = getDb()
    .prepare("SELECT image_path FROM parts WHERE id = ? AND image_path IS NOT NULL")
    .get(Number(id)) as { image_path: string } | undefined;
  const type = row && IMAGE_TYPES[row.image_path.split(".").pop() ?? ""];
  if (!row || !type) return new Response("Not found", { status: 404 });
  const data = await fs.readFile(uploadPath(row.image_path));
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(data.length),
      // Filename is unique per upload, so the image behind this URL changes only via edits.
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
