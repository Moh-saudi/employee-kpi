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
  { id: 'quality', name: 'جودة العمل' },
  { id: 'efficiency', name: 'الكفاءة' },
  { id: 'teamwork', name: 'العمل الجماعي' },
  { id: 'communication', name: 'التواصل' },
  { id: 'initiative', name: 'المبادرة' },
  { id: 'punctuality', name: 'الالتزام بالمواعيد' }
];

type Period = string | { month: number; year: number };

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

  const formatPeriod = (period: Period | undefined) => {
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev: Partial<Evaluation>) => ({
        ...prev,
        [name]: value
      }));
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData((prev: Partial<Evaluation>) => ({
        ...prev,
        [name]: value
      }));
    };

    const handleCriteriaChange = (criterionId: string, value: number) => {
      setFormData((prev: Partial<Evaluation>) => ({
        ...prev,
        criteria: {
          ...prev.criteria,
          [criterionId]: value
        }
      }));
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-4xl overflow-auto max-h-[90vh]">
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الموظف</label>
              <select
                name="employeeId"
                value={formData?.employeeId || ''}
                onChange={handleSelectChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                required
              >
                <option value="">اختر الموظف</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
              <input
                type="date"
                name="date"
                value={formData?.date ? new Date(formData.date).toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  setFormData((prev: Partial<Evaluation>) => ({
                    ...prev,
                    date
                  }));
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">معايير التقييم</label>
              <div className="space-y-4">
                {evaluationCriteria.map(criterion => (
                  <div key={criterion.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">{criterion.name}</h3>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        {[1, 2, 3, 4, 5].map(rating => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => handleCriteriaChange(criterion.id, rating)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                              formData?.criteria?.[criterion.id] === rating
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
              <textarea
                name="comments"
                value={formData?.comments || ''}
                onChange={handleInputChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نقاط القوة</label>
              <textarea
                name="strengths"
                value={formData?.strengths || ''}
                onChange={handleInputChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نقاط التحسين</label>
              <textarea
                name="improvements"
                value={formData?.improvements || ''}
                onChange={handleInputChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-4 space-x-reverse">
              <Button
                type="button"
                variant="secondary"
                onClick={() => isEdit ? setEditingEvaluation(null) : setShowAddForm(false)}
              >
                إلغاء
              </Button>
              <Button type="submit" variant="primary">
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
      <Header />
      
      <div className="flex flex-1">
        <Sidebar />
        
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">التقييمات</h1>
              <Button
                variant="primary"
                onClick={() => setShowAddForm(true)}
              >
                إضافة تقييم جديد
              </Button>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="بحث عن تقييم..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                  />
                </div>
                <div className="w-full md:w-48">
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                  >
                    <option value="all">جميع الفترات</option>
                    {getAvailablePeriods().map(period => (
                      <option key={period} value={period}>
                        {formatPeriod(period)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الموظف
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الفترة
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        إجمالي التقييم
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        نقاط القوة
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        نقاط التحسين
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
                    {filteredEvaluations.map((evaluation) => (
                      <tr key={evaluation.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getEmployeeName(evaluation.employeeId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatPeriod(evaluation.period)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRatingClassName(calculateAverageRating(evaluation.criteria))}`}>
                            {calculateAverageRating(evaluation.criteria).toFixed(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="max-w-xs truncate">
                            {evaluation.strengths || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="max-w-xs truncate">
                            {evaluation.improvements || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="max-w-xs truncate">
                            {evaluation.comments || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex space-x-2 space-x-reverse">
                            <Button
                              variant="secondary"
                              onClick={() => openEditForm(evaluation)}
                            >
                              تعديل
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => handleDeleteEvaluation(evaluation.id)}
                            >
                              حذف
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {showAddForm && renderEvaluationForm()}
      {editingEvaluation && renderEvaluationForm(true)}
    </div>
  );
}