'use client';

import React from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export const Header: React.FC = () => {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="flex items-center">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-12 w-auto"
            />
          </Link>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    </header>
  );
}; 