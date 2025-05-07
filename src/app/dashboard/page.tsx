'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, firestore } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Employee, Evaluation } from '@/types';
import { Header } from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import Card from '@/components/ui/Card';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Bar } from 'react-chartjs-2';

// تسجيل مكونات Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement);

export default function DashboardPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeOfWeek, setEmployeeOfWeek] = useState<Employee | null>(null);
  const [employeeOfMonth, setEmployeeOfMonth] = useState<Employee | null>(null);
  const [completedEvaluations, setCompletedEvaluations] = useState(0);
  const [pendingEvaluations, setPendingEvaluations] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // جلب الموظفين النشطين
      const employeesRef = collection(firestore, 'employees');
      const employeesQuery = query(employeesRef, where('isActive', '==', true));
      const employeesSnapshot = await getDocs(employeesQuery);
      
      const employeesData = employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        joinDate: doc.data().joinDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Employee[];
      
      setEmployees(employeesData);

      // جلب التقييمات
      const evaluationsRef = collection(firestore, 'evaluations');
      const evaluationsQuery = query(evaluationsRef, orderBy('date', 'desc'));
      const evaluationsSnapshot = await getDocs(evaluationsQuery);
      
      const evaluationsData = evaluationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Evaluation[];
      
      setEvaluations(evaluationsData);

      // حساب الموظف المتميز في الأسبوع
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const recentEvaluations = evaluationsData.filter(e => e.date >= oneWeekAgo);
      const weeklyScores = new Map<string, { total: number; count: number }>();
      
      recentEvaluations.forEach(evaluation => {
        const avgScore = calculateAverageRating(evaluation.criteria);
        if (!weeklyScores.has(evaluation.employeeId)) {
          weeklyScores.set(evaluation.employeeId, { total: 0, count: 0 });
        }
        const current = weeklyScores.get(evaluation.employeeId)!;
        weeklyScores.set(evaluation.employeeId, {
          total: current.total + avgScore,
          count: current.count + 1
        });
      });

      let bestWeeklyEmployee = null;
      let bestWeeklyScore = 0;
      weeklyScores.forEach((score, employeeId) => {
        const avgScore = score.total / score.count;
        if (avgScore > bestWeeklyScore) {
          bestWeeklyScore = avgScore;
          bestWeeklyEmployee = employeesData.find(e => e.id === employeeId) || null;
        }
      });
      setEmployeeOfWeek(bestWeeklyEmployee);

      // حساب الموظف المتميز في الشهر
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const monthlyEvaluations = evaluationsData.filter(e => e.date >= oneMonthAgo);
      const monthlyScores = new Map<string, { total: number; count: number }>();
      
      monthlyEvaluations.forEach(evaluation => {
        const avgScore = calculateAverageRating(evaluation.criteria);
        if (!monthlyScores.has(evaluation.employeeId)) {
          monthlyScores.set(evaluation.employeeId, { total: 0, count: 0 });
        }
        const current = monthlyScores.get(evaluation.employeeId)!;
        monthlyScores.set(evaluation.employeeId, {
          total: current.total + avgScore,
          count: current.count + 1
        });
      });

      let bestMonthlyEmployee = null;
      let bestMonthlyScore = 0;
      monthlyScores.forEach((score, employeeId) => {
        const avgScore = score.total / score.count;
        if (avgScore > bestMonthlyScore) {
          bestMonthlyScore = avgScore;
          bestMonthlyEmployee = employeesData.find(e => e.id === employeeId) || null;
        }
      });
      setEmployeeOfMonth(bestMonthlyEmployee);

      // حساب التقييمات المكتملة والمتبقية
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyEvaluationsCount = evaluationsData.filter(e => 
        e.date.getMonth() === currentMonth && 
        e.date.getFullYear() === currentYear
      ).length;
      
      setCompletedEvaluations(monthlyEvaluationsCount);
      setPendingEvaluations(employeesData.length - monthlyEvaluationsCount);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/auth/login');
      } else {
        fetchData();
      }
    });

    return () => unsubscribe();
  }, [router, fetchData]);

  const calculateAverageRating = (criteria: { [key: string]: number }) => {
    const values = Object.values(criteria);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  };

  const getCategoryLabel = (category: string): string => {
    const categories: Record<string, string> = {
      doctor: 'طبيب',
      pharmacist: 'صيدلي',
      dentist: 'أسنان',
      physiotherapist: 'علاج طبيعي',
      administrative: 'إداري',
      other: 'أخرى'
    };
    return categories[category] || category;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <div className="flex flex-1">
        <Sidebar />
        
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">لوحة التحكم</h1>

            {/* إحصائيات سريعة */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-blue-600">إجمالي الموظفين</h3>
                  <p className="text-2xl font-bold text-blue-800">{employees.length}</p>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-50 to-green-100">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-green-600">التقييمات المكتملة</h3>
                  <p className="text-2xl font-bold text-green-800">{completedEvaluations}</p>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-yellow-600">التقييمات المتبقية</h3>
                  <p className="text-2xl font-bold text-yellow-800">{pendingEvaluations}</p>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-purple-600">متوسط التقييمات</h3>
                  <p className="text-2xl font-bold text-purple-800">
                    {evaluations.length > 0 
                      ? (evaluations.reduce((sum, e) => sum + calculateAverageRating(e.criteria), 0) / evaluations.length).toFixed(1)
                      : '0.0'}
                  </p>
                </div>
              </Card>
            </div>

            {/* الموظف المتميز */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100">
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-amber-800 mb-4">موظف الأسبوع المتميز</h3>
                  {employeeOfWeek ? (
                    <div className="flex items-center space-x-4 space-x-reverse">
                      <div className="flex-1">
                        <h4 className="text-xl font-bold text-amber-900">{employeeOfWeek.name}</h4>
                        <p className="text-sm text-amber-700">{getCategoryLabel(employeeOfWeek.category)}</p>
                        <p className="text-sm text-amber-700">الرقم القومي: {employeeOfWeek.nationalId?.toString().slice(0, 10)}</p>
                      </div>
                      <div className="bg-amber-200 text-amber-900 px-3 py-1 rounded-full text-sm font-medium">
                        متميز
                      </div>
                    </div>
                  ) : (
                    <p className="text-amber-700">لا يوجد بيانات كافية لتحديد موظف الأسبوع</p>
                  )}
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100">
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-emerald-800 mb-4">موظف الشهر المتميز</h3>
                  {employeeOfMonth ? (
                    <div className="flex items-center space-x-4 space-x-reverse">
                      <div className="flex-1">
                        <h4 className="text-xl font-bold text-emerald-900">{employeeOfMonth.name}</h4>
                        <p className="text-sm text-emerald-700">{getCategoryLabel(employeeOfMonth.category)}</p>
                        <p className="text-sm text-emerald-700">الرقم القومي: {employeeOfMonth.nationalId?.toString().slice(0, 10)}</p>
                      </div>
                      <div className="bg-emerald-200 text-emerald-900 px-3 py-1 rounded-full text-sm font-medium">
                        متميز
                      </div>
                    </div>
                  ) : (
                    <p className="text-emerald-700">لا يوجد بيانات كافية لتحديد موظف الشهر</p>
                  )}
                </div>
              </Card>
            </div>

            {/* توزيع التقييمات حسب الفئة */}
            <Card className="mb-6 bg-gradient-to-br from-slate-50 to-slate-100">
              <div className="p-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">توزيع التقييمات حسب الفئة</h3>
                <div className="h-80">
                  <Bar
                    data={{
                      labels: ['طبيب', 'صيدلي', 'أسنان', 'علاج طبيعي', 'إداري'],
                      datasets: [{
                        label: 'متوسط التقييم',
                        data: ['doctor', 'pharmacist', 'dentist', 'physiotherapist', 'administrative'].map(category => {
                          const categoryEvaluations = evaluations.filter(e => {
                            const employee = employees.find(emp => emp.id === e.employeeId);
                            return employee?.category === category;
                          });
                          return categoryEvaluations.length > 0
                            ? categoryEvaluations.reduce((sum, e) => sum + calculateAverageRating(e.criteria), 0) / categoryEvaluations.length
                            : 0;
                        }),
                        backgroundColor: 'rgba(59, 130, 246, 0.5)',
                        borderColor: 'rgb(59, 130, 246)',
                        borderWidth: 2,
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 5,
                          grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                          },
                          ticks: {
                            color: 'rgb(51, 65, 85)'
                          }
                        },
                        x: {
                          grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                          },
                          ticks: {
                            color: 'rgb(51, 65, 85)'
                          }
                        }
                      },
                      plugins: {
                        legend: {
                          display: false,
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}