import { redirect } from "next/navigation";
import { getSessionAccount } from "@/lib/session";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const account = await getSessionAccount();
  if (!account) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar email={account.email} plan={account.plan} isAdmin={account.role === "admin"} />
      <div className="flex min-h-screen flex-col lg:pl-60">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
