import Link from "next/link";
import {
  adminDeletePart,
  adminDeleteUser,
  adminToggleAdmin,
  resolveReport,
} from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { allParts, listUsers, openReports } from "@/lib/parts";

export default async function Admin() {
  const me = await requireAdmin();
  const reports = openReports();
  const users = listUsers();
  const parts = allParts();
  return (
    <div className="stack">
      <h1>Admin</h1>

      <h2>Open reports ({reports.length})</h2>
      {reports.length === 0 && <p className="muted">Nothing to review.</p>}
      {reports.map((r) => (
        <div key={r.id} className="card stack">
          <div>
            <Link href={`/parts/${r.part_id}`}>{r.part_title}</Link>
            <p className="muted">
              reported by {r.reporter} · {r.created_at}
            </p>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{r.reason}</p>
          </div>
          <div className="row">
            <form action={resolveReport}>
              <input type="hidden" name="id" value={r.id} />
              <button>Dismiss</button>
            </form>
            <form action={adminDeletePart}>
              <input type="hidden" name="id" value={r.part_id} />
              <button className="danger">Delete part</button>
            </form>
          </div>
        </div>
      ))}

      <h2>Users ({users.length})</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Parts</th>
              <th>Joined</th>
              <th>Role</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.part_count}</td>
                <td>{u.created_at}</td>
                <td>{u.is_admin ? "Admin" : "User"}</td>
                <td>
                  {u.id !== me.id && (
                    <div className="row">
                      <form action={adminToggleAdmin}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="link">{u.is_admin ? "Remove admin" : "Make admin"}</button>
                      </form>
                      <form action={adminDeleteUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="link danger-text">Delete user + parts</button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>All parts ({parts.length})</h2>
      <div className="card">
        <table>
          <tbody>
            {parts.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/parts/${p.id}`}>{p.title}</Link>
                </td>
                <td className="muted">{p.username}</td>
                <td>
                  <div className="row">
                    <Link href={`/parts/${p.id}/edit`}>Edit</Link>
                    <form action={adminDeletePart}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="link danger-text">Delete</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
