import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { logout } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "AUTO3D — 3D-printable car parts",
  description: "Find 3D-printable parts that fit your car by make, model and year.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  return (
    <html lang="en">
      <body>
        <header className="nav">
          <Link href="/" className="brand">
            AUTO<span>3D</span>
          </Link>
          <nav>
            <Link href="/search">Browse</Link>
            <Link href="/upload">Upload</Link>
            {user ? (
              <form action={logout}>
                <span className="muted">{user.username}</span>
                <button className="link">Log out</button>
              </form>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link href="/signup" className="btn">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
