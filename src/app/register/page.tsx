import { redirect } from "next/navigation";

// Registration happens through the magic-link flow on /login.
export default function RegisterPage() {
  redirect("/login");
}
