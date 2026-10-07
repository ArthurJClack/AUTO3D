import fs from "node:fs/promises";
import { getDb, uploadPath } from "@/lib/db";

export async function GET(req: Request, ctx: RouteContext<"/files/[id]">) {
  const { id } = await ctx.params;
  const row = getDb()
    .prepare("SELECT file_name, file_path FROM parts WHERE id = ? AND file_path IS NOT NULL")
    .get(Number(id)) as { file_name: string; file_path: string } | undefined;
  if (!row) return new Response("Not found", { status: 404 });
  const data = await fs.readFile(uploadPath(row.file_path));
  const inline = new URL(req.url).searchParams.has("view");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "model/stl",
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${row.file_name}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
