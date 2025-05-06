'use client';

import { Tajawal } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { usePathname } from 'next/navigation';
import Image from 'next/image';

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["200", "300", "400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/auth/login';
  const isLandingPage = pathname === '/';

  return (
    <html lang="ar" dir="rtl">
      <body className={`${tajawal.variable} font-tajawal`}>
        {isAuthPage || isLandingPage ? (
          <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50">
            <Image
              src="/logo.png"
              alt="Logo"
              width={200}
              height={80}
              className="h-20 w-auto"
            />
          </div>
        ) : (
          <div className="fixed top-4 right-4 z-50">
            <Image
              src="/logo.png"
              alt="Logo"
              width={120}
              height={48}
              className="h-12 w-auto"
            />
          </div>
        )}
        {isAuthPage || isLandingPage ? (
          <main className="pt-32">{children}</main>
        ) : (
          <div className="flex">
            <Sidebar />
            <main className="flex-1 mr-64">
              {children}
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
