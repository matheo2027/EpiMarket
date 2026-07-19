import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ConfirmProvider } from "@/lib/confirm-context";
import { Header } from "@/components/header";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const THEME_STORAGE_KEY = "epimarket-theme";
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t="dark";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export const metadata: Metadata = {
  title: "EpiMarket",
  description: "Marchés de prédiction — pariez sur ce qui va se passer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-ink text-paper" suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <div className="bg-orbs" aria-hidden="true" />
        <AuthProvider>
          <ThemeProvider>
            <ConfirmProvider>
              <Header />
              <main className="flex-1">{children}</main>
            </ConfirmProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
