import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { login } from "../actions";

export default function Login() {
  return (
    <div className="stack">
      <h1>Log in</h1>
      <AuthForm action={login} submitLabel="Log in" />
      <p className="muted">
        No account? <Link href="/signup">Sign up</Link>
      </p>
    </div>
  );
}
