import type { Metadata } from "next";

// Sign-in screen: keep it out of Google's index (it inherited the landing
// page's title and was reported as "Duplicate without user-selected canonical").
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
