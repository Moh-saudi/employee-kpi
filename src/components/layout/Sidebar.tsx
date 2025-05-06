'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaHome, FaUsers, FaClipboardList, FaChartBar } from 'react-icons/fa';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  const menuItems = [
    { href: '/dashboard', icon: <FaHome />, label: 'الرئيسية' },
    { href: '/employees', icon: <FaUsers />, label: 'الموظفين' },
    { href: '/evaluations', icon: <FaClipboardList />, label: 'التقييمات' },
    { href: '/reports', icon: <FaChartBar />, label: 'التقارير' },
  ];

  return (
    <div className="fixed right-0 top-0 h-screen w-64 bg-white shadow-lg z-50">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-800">نظام تقييم KPI</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center p-3 rounded-lg transition-colors ${
                    pathname === item.href
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="ml-3">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Info */}
        {user && (
          <div className="p-4 border-t">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-600">👤</span>
              </div>
              <div className="mr-3">
                <p className="text-sm font-medium text-gray-800">
                  {user.displayName || user.email?.split('@')[0] || 'المستخدم'}
                </p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 