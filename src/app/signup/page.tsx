import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { signup } from "../actions";

export default function Signup() {
  return (
    <div className="stack">
      <h1>Create an account</h1>
      <AuthForm action={signup} submitLabel="Sign up" newPassword />
      <p className="muted">
        Already have one? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
