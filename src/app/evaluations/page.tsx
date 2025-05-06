'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, firestore } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { Evaluation, Employee } from '@/types';
import { Header } from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

// معايير التقييم
const evaluationCriteria = [
  { id: 'quality', name: 'جودة العمل', description: 'مدى جودة العمل المنجز ودقته' },
  { id: 'efficiency', name: 'الكفاءة', description: 'القدرة على إنجاز المهام بكفاءة وفي الوقت المحدد' },
  { id: 'teamwork', name: 'العمل الجماعي', description: 'القدرة على العمل ضمن فريق والتعاون مع الزملاء' },
  { id: 'communication', name: 'التواصل', description: 'مهارات التواصل مع الزملاء والمرضى' },
  { id: 'initiative', name: 'المبادرة', description: 'القدرة على اتخاذ المبادرة وحل المشكلات' },
  { id: 'punctuality', name: 'الالتزام بالمواعيد', description: 'الحضور في الموعد المحدد والالتزام بالمواعيد' },
  { id: 'infection_control', name: 'الالتزام بإجراءات مكافحة العدوى', description: 'مدى الالتزام بإجراءات مكافحة العدوى بالإدارة' },
];

// تسميات لمستويات التقييم
const ratingLabels: Record<number, string> = {
  1: 'ضعيف',
  2: 'مقبول',
  3: 'جيد',
  4: 'جيد جداً',
  5: 'ممتاز'
};

export default function EvaluationsPage() {
  const router = useRouter();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<Partial<Evaluation> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  
  // نموذج التقييم الجديد
  const [newEvaluation, setNewEvaluation] = useState<Partial<Evaluation>>({
    employeeId: '',
    criteria: Object.fromEntries(evaluationCriteria.map(c => [c.id, 3])),
    comments: '',
    strengths: '',
    improvements: '',
    date: new Date(),
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/auth/login');
      } else {
        fetchData();
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchData = async () => {
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

      // جلب التقييمات مرتبة حسب التاريخ
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
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEvaluation.employeeId) {
      alert('الرجاء اختيار الموظف');
      return;
    }
    
    try {
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const period = `${year}-${month.toString().padStart(2, '0')}`;
      
      const evaluationsRef = collection(firestore, 'evaluations');
      const evaluationData = {
        ...newEvaluation,
        evaluatorId: auth.currentUser?.uid,
        period,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      await addDoc(evaluationsRef, evaluationData);
      setShowAddForm(false);
      resetEvaluationForm();
      fetchData();
    } catch (error) {
      console.error('Error adding evaluation:', error);
    }
  };

  const handleUpdateEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingEvaluation || !editingEvaluation.id) return;
    
    try {
      const evaluationRef = doc(firestore, 'evaluations', editingEvaluation.id);
      await updateDoc(evaluationRef, {
        ...editingEvaluation,
        updatedAt: serverTimestamp(),
      });
      
      setEditingEvaluation(null);
      fetchData();
    } catch (error) {
      console.error('Error updating evaluation:', error);
    }
  };

  const handleDeleteEvaluation = async (id: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذا التقييم؟')) {
      try {
        const evaluationRef = doc(firestore, 'evaluations', id);
        await deleteDoc(evaluationRef);
        fetchData();
      } catch (error) {
        console.error('Error deleting evaluation:', error);
      }
    }
  };

  const openEditForm = (evaluation: Evaluation) => {
    setEditingEvaluation(evaluation);
  };

  const resetEvaluationForm = () => {
    setNewEvaluation({
      employeeId: '',
      criteria: Object.fromEntries(evaluationCriteria.map(c => [c.id, 3])),
      comments: '',
      strengths: '',
      improvements: '',
      date: new Date(),
    });
  };

  const calculateAverageRating = (criteria: { [key: string]: number }) => {
    const values = Object.values(criteria);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  };

  const getRatingClassName = (rating: number) => {
    if (rating >= 4.5) return 'bg-green-100 text-green-800';
    if (rating >= 3.5) return 'bg-blue-100 text-blue-800';
    if (rating >= 2.5) return 'bg-yellow-100 text-yellow-800';
    if (rating >= 1.5) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee?.name || 'غير محدد';
  };

  const getAvailablePeriods = () => {
    const periods = new Set<string>();
    evaluations.forEach(evaluation => {
      if (evaluation.period) {
        let periodStr = '';
        if (typeof evaluation.period === 'object' && evaluation.period.year && evaluation.period.month) {
          periodStr = `${evaluation.period.year}-${evaluation.period.month.toString().padStart(2, '0')}`;
        } else if (typeof evaluation.period === 'string') {
          periodStr = evaluation.period;
        }
        if (periodStr) periods.add(periodStr);
      }
    });
    return Array.from(periods).sort().reverse();
  };

  const formatPeriod = (period: string | { month: number; year: number } | undefined) => {
    if (!period) return '-';
    const monthNames = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    if (typeof period === 'string') {
      const [year, month] = period.split('-');
      if (!year || !month) return '-';
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    if (period.year && period.month) {
      return `${monthNames[period.month - 1]} ${period.year}`;
    }
    return '-';
  };

  const filteredEvaluations = evaluations.filter(evaluation => {
    // تصفية حسب البحث
    const matchesSearch = 
      getEmployeeName(evaluation.employeeId).includes(searchTerm) || 
      evaluation.comments?.includes(searchTerm) ||
      (typeof evaluation.period === 'string' && evaluation.period.includes(searchTerm));
    
    // تصفية حسب الفترة
    let periodStr = '';
    if (evaluation.period) {
      if (typeof evaluation.period === 'object' && evaluation.period.year && evaluation.period.month) {
        periodStr = `${evaluation.period.year}-${evaluation.period.month.toString().padStart(2, '0')}`;
      } else if (typeof evaluation.period === 'string') {
        periodStr = evaluation.period;
      }
    }
    const matchesPeriod = selectedPeriod === 'all' || periodStr === selectedPeriod;
    
    return matchesSearch && matchesPeriod;
  });

  const renderEvaluationForm = (isEdit: boolean = false) => {
    const formData = isEdit ? editingEvaluation : newEvaluation;
    const setFormData = isEdit ? setEditingEvaluation : setNewEvaluation;
    const handleSubmit = isEdit ? handleUpdateEvaluation : handleAddEvaluation;
    const formTitle = isEdit ? 'تعديل التقييم' : 'إضافة تقييم جديد';
    const buttonText = isEdit ? 'حفظ التغييرات' : 'إضافة';

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-xl overflow-auto max-h-[90vh]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{formTitle}</h2>
            <button 
              onClick={() => isEdit ? setEditingEvaluation(null) : setShowAddForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الموظف</label>
              <select
                value={formData?.employeeId || ''}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value } as any)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                required
                disabled={isEdit}
              >
                <option value="">اختر الموظف</option>
                {employees.map((employee) => (
                  <option key={`employee-${employee.id}`} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ التقييم</label>
              <input
                type="date"
                value={formData?.date instanceof Date ? formData.date.toISOString().split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, date: new Date(e.target.value) } as any)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                required
              />
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">معايير التقييم</h3>
              <div className="space-y-6">
                {evaluationCriteria.map((criterion) => (
                  <div key={`criterion-${criterion.id}`} className="bg-gray-50 p-4 rounded-md">
                    <div className="flex justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{criterion.name}</h4>
                        <p className="text-sm text-gray-500">{criterion.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">
                          {formData?.criteria?.[criterion.id] || 3}
                        </span>
                        <span className="text-sm text-gray-500 mr-1">
                          ({ratingLabels[formData?.criteria?.[criterion.id] || 3]})
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-center space-x-1 space-x-reverse">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={`rating-${criterion.id}-${value}`}
                          type="button"
                          className={`w-10 h-10 rounded-full ${
                            (formData?.criteria?.[criterion.id] || 3) === value
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                          onClick={() => 
                            setFormData({
                              ...formData,
                              criteria: {
                                ...(formData?.criteria || {}),
                                [criterion.id]: value
                              }
                            } as any)
                          }
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نقاط القوة</label>
              <textarea
                value={formData?.strengths || ''}
                onChange={(e) => setFormData({ ...formData, strengths: e.target.value } as any)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                rows={2}
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">مجالات التحسين</label>
              <textarea
                value={formData?.improvements || ''}
                onChange={(e) => setFormData({ ...formData, improvements: e.target.value } as any)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                rows={2}
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات إضافية</label>
              <textarea
                value={formData?.comments || ''}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value } as any)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                rows={3}
              ></textarea>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button
                variant="secondary"
                onClick={() => isEdit ? setEditingEvaluation(null) : setShowAddForm(false)}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
              >
                {buttonText}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
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
      {/* الهيدر */}
      <Header />
      
      <div className="flex flex-1">
        {/* القائمة الجانبية */}
        <Sidebar />
        
        {/* المحتوى الرئيسي */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">تقييمات الموظفين</h1>
              <Button
                variant="primary"
                onClick={() => setShowAddForm(true)}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                إضافة تقييم جديد
              </Button>
            </div>

            {/* أدوات البحث والتصفية */}
            <Card className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-7">
                  <label className="block text-sm font-medium text-gray-700 mb-1">بحث</label>
                  <input
                    type="text"
                    placeholder="ابحث باسم الموظف أو محتوى التقييم..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                  />
                </div>
                
                <div className="md:col-span-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">تصفية حسب الفترة</label>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                  >
                    <option value="all">جميع الفترات</option>
                    {getAvailablePeriods().map(period => (
                      <option key={`period-${period}`} value={period}>
                        {formatPeriod(period)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            {/* عرض البيانات */}
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الموظف
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        تاريخ التقييم
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الفترة
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        متوسط التقييم
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ملاحظات
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEvaluations.length === 0 ? (
                      <tr key="no-data">
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          لا توجد بيانات متطابقة مع معايير البحث
                        </td>
                      </tr>
                    ) : (
                      filteredEvaluations.map((evaluation) => {
                        const avgRating = calculateAverageRating(evaluation.criteria);
                        return (
                          <tr key={`evaluation-${evaluation.id}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-gray-900">
                                {getEmployeeName(evaluation.employeeId)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {evaluation.date.toLocaleDateString('ar-EG')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatPeriod(evaluation.period)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span key={`rating-badge-${evaluation.id}`} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRatingClassName(avgRating)}`}>
                                  {avgRating.toFixed(1)}
                                </span>
                                
                                <div key={`rating-bar-${evaluation.id}`} className="ml-4 w-24 bg-gray-200 rounded-full h-2.5">
                                  <div 
                                    className="bg-blue-600 h-2.5 rounded-full" 
                                    style={{ width: `${(avgRating / 5) * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                              {evaluation.comments}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 space-x-reverse">
                              <button 
                                key={`edit-${evaluation.id}`}
                                onClick={() => openEditForm(evaluation)}
                                className="text-blue-600 hover:text-blue-900 ml-4"
                              >
                                تعديل
                              </button>
                              <button 
                                key={`delete-${evaluation.id}`}
                                onClick={() => handleDeleteEvaluation(evaluation.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                حذف
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </main>
      </div>

      {/* نموذج إضافة تقييم جديد */}
      {showAddForm && renderEvaluationForm()}

      {/* نموذج تعديل التقييم */}
      {editingEvaluation && renderEvaluationForm(true)}
    </div>
  );
}