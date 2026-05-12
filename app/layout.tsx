import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prompter.com",
  description:
    "Generate a customized phone assistant prompt and factual knowledge base from a business website.",
  icons: {
    icon: "/prompter-icon.png",
    apple: "/prompter-icon.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
