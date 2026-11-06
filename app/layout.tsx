import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raíces · Tu historia familiar",
  description: "Cada vida, una historia. Conserva tu árbol genealógico y la memoria de tu familia.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
