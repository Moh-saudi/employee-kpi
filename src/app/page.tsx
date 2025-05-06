'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Button from '@/components/ui/Button';

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-20">
            <h1 className="text-4xl font-bold text-gray-900 mb-12">
              حلول تقييم أداء الموظفين
            </h1>
            
            <div className="space-y-8 mb-16">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">تقييم الأداء</h2>
                <p className="text-gray-600">
                  نظام تقييم شامل ومتكامل لقياس أداء الموظفين بشكل موضوعي وعادل
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">تحليل البيانات</h2>
                <p className="text-gray-600">
                  تقارير وإحصائيات دقيقة تساعد في اتخاذ القرارات وتطوير الأداء
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">تطوير الموظفين</h2>
                <p className="text-gray-600">
                  خطط تطوير شخصية لتحسين أداء الموظفين وزيادة الإنتاجية
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-3 text-lg"
              onClick={() => router.push('/auth/login')}
            >
              تسجيل الدخول
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
