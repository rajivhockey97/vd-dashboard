import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vehicle Dynamics Analytics — Maruti YY8 EV Gen 3",
  description: "Three-team CAN bus analytics dashboard: Quality, Engineering, After Sales",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0e17] text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
