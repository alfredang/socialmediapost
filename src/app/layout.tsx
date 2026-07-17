import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jbmono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "SocialPost — One API to post on every social platform",
    template: "%s · SocialPost",
  },
  description:
    "Post videos, photos and text to TikTok, Instagram, YouTube, LinkedIn, X and 17 more platforms with one API call. Schedule, automate, analyze and whitelabel your social publishing.",
  keywords: [
    "social media API", "post to all platforms", "social media scheduler",
    "social media automation", "TikTok API", "Instagram API", "YouTube API",
  ],
  openGraph: {
    title: "SocialPost — One API to post on every social platform",
    description: "Upload once, publish everywhere. Scheduling, analytics and whitelabel included.",
    type: "website",
    siteName: "SocialPost",
  },
};

// Dark-first: default to dark unless the user explicitly chose light.
const themeScript = `(function(){try{var t=localStorage.getItem("sp-theme");if(t!=="light"){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${grotesk.variable} ${jbmono.variable} antialiased min-h-screen flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
