'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, firestore } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Employee, Evaluation } from '@/types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Header } from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { FaDownload, FaPrint, FaFilter } from 'react-icons/fa';

// تسجيل مكونات Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// معايير التقييم
const evaluationCriteria = [
  { id: 'quality', name: 'جودة العمل' },
  { id: 'efficiency', name: 'الكفاءة' },
  { id: 'teamwork', name: 'العمل الجماعي' },
  { id: 'communication', name: 'التواصل' },
  { id: 'initiative', name: 'المبادرة' },
  { id: 'punctuality', name: 'الالتزام بالمواعيد' },
  { id: 'infection_control', name: 'الالتزام بإجراءات مكافحة العدوى' },
];

// فئات الموظفين
const categoryMap: Record<string, string> = {
  'doctor': 'طبيب',
  'pharmacist': 'صيدلي',
  'dentist': 'أسنان',
  'physiotherapist': 'علاج طبيعي',
  'administrative': 'إداري',
  'other': 'أخرى'
};

export default function ReportsPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'evaluations' | 'employees' | 'statistics'>('evaluations');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (!user) {
        router.push('/auth/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
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
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  const getPeriodString = (period: string | { month: number; year: number } | undefined): string => {
    if (!period) return '';
    if (typeof period === 'object' && period.year && period.month) {
      return `${period.year}-${period.month.toString().padStart(2, '0')}`;
    }
    if (typeof period === 'string') {
      return period;
    }
    return '';
  };

  const getPeriodDisplay = (period: string | { month: number; year: number } | undefined): string => {
    if (!period) return '-';
    const periodStr = getPeriodString(period);
    if (!periodStr) return '-';
    
    // التأكد من أن periodStr هو سلسلة نصية
    if (typeof periodStr !== 'string') return '-';
    
    const [year, month] = periodStr.split('-');
    if (!year || !month) return '-';
    
    const monthNames = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    
    const monthNum = parseInt(month);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return '-';
    
    return `${monthNames[monthNum - 1]} ${year}`;
  };

  const getAvailablePeriods = () => {
    const periods = new Set<string>();
    evaluations.forEach(evaluation => {
      const periodStr = getPeriodString(evaluation.period);
      if (periodStr) periods.add(periodStr);
    });
    return Array.from(periods).sort().reverse();
  };

  const calculateAverageRating = (criteria: { [key: string]: number }) => {
    const values = Object.values(criteria);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  };

  const filteredEvaluations = evaluations.filter((evaluation) => {
    if (selectedEmployee && evaluation.employeeId !== selectedEmployee) return false;
    if (startDate && new Date(evaluation.date) < new Date(startDate)) return false;
    if (endDate && new Date(evaluation.date) > new Date(endDate)) return false;
    if (selectedPeriod && selectedPeriod !== 'all') {
      const periodStr = getPeriodString(evaluation.period);
      if (periodStr !== selectedPeriod) return false;
    }
    return true;
  });

  const filteredEmployees = employees.filter((employee) => {
    if (selectedCategory && employee.category !== selectedCategory) return false;
    return true;
  });

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee?.name || 'غير محدد';
  };

  const exportToExcel = () => {
    if (activeTab === 'evaluations') {
      const data = filteredEvaluations.map((evaluation) => {
        const employee = employees.find((emp) => emp.id === evaluation.employeeId);
        return {
          'الموظف': employee?.name || '',
          'الرقم القومي': employee?.nationalId || '',
          'الفئة': categoryMap[employee?.category || ''] || '',
          'تاريخ التقييم': evaluation.date.toLocaleDateString('ar-EG'),
          'الفترة': evaluation.period || '',
          'إجمالي التقييم': calculateAverageRating(evaluation.criteria).toFixed(1),
          'نقاط القوة': evaluation.strengths || '',
          'نقاط التحسين': evaluation.improvements || '',
          'ملاحظات': evaluation.comments || '',
          'الملفات الموكلة': employee?.assignedFiles?.join(', ') || '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'تقييمات');
      XLSX.writeFile(wb, 'تقرير_التقييمات.xlsx');
    } else if (activeTab === 'employees') {
      const data = filteredEmployees.map((employee) => {
        const employeeEvaluations = evaluations.filter(e => e.employeeId === employee.id);
        const avgRating = employeeEvaluations.length > 0 
          ? employeeEvaluations.reduce((sum, evaluation) => sum + calculateAverageRating(evaluation.criteria), 0) / employeeEvaluations.length 
          : 0;
        
        return {
          'الاسم': employee.name,
          'الرقم القومي': employee.nationalId,
          'الفئة': categoryMap[employee.category] || employee.category,
          'الدرجة الوظيفية': employee.grade,
          'نوع التعيين': employee.appointment,
          'تاريخ الدخول': employee.joinDate.toLocaleDateString('ar-EG'),
          'عدد التقييمات': employeeEvaluations.length,
          'متوسط التقييمات': avgRating.toFixed(1),
          'الملفات الموكلة': (employee.assignedFiles || []).join(', '),
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'موظفين');
      XLSX.writeFile(wb, 'تقرير_الموظفين.xlsx');
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    
    // إضافة عنوان التقرير
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    const title = activeTab === 'evaluations' ? 'تقرير التقييمات' : 'تقرير الموظفين';
    const textWidth = doc.getTextWidth(title);
    doc.text(title, (doc.internal.pageSize.width - textWidth) / 2, 20);
    
    // إضافة التاريخ
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const today = new Date().toLocaleDateString('ar-EG');
    doc.text(`تاريخ التقرير: ${today}`, 15, 30);
    
    // إضافة معلومات التصفية
    let filterText = '';
    if (activeTab === 'evaluations') {
      if (selectedEmployee) {
        const employee = employees.find(e => e.id === selectedEmployee);
        filterText += `الموظف: ${employee?.name || ''}, `;
      }
      
      if (startDate || endDate) {
        filterText += `الفترة: ${startDate ? new Date(startDate).toLocaleDateString('ar-EG') : 'البداية'} إلى ${endDate ? new Date(endDate).toLocaleDateString('ar-EG') : 'النهاية'}`;
      }
    } else if (activeTab === 'employees') {
      if (selectedCategory) {
        filterText += `الفئة: ${categoryMap[selectedCategory] || selectedCategory}`;
      }
    }
    
    if (filterText) {
      doc.text(`معايير التصفية: ${filterText}`, 15, 35);
    }

    if (activeTab === 'evaluations') {
      // تحضير بيانات الجدول
      const tableData = filteredEvaluations.map(evaluation => [
        getEmployeeName(evaluation.employeeId),
        evaluation.date.toLocaleDateString('ar-EG'),
        getPeriodDisplay(evaluation.period),
        calculateAverageRating(evaluation.criteria).toFixed(1),
        evaluation.strengths || '-',
        evaluation.improvements || '-',
        evaluation.comments || '-'
      ]);
      
      // إنشاء الجدول
      autoTable(doc, {
        startY: 45,
        head: [['الموظف', 'تاريخ التقييم', 'الفترة', 'متوسط التقييم', 'نقاط القوة', 'نقاط التحسين', 'ملاحظات']],
        body: tableData,
        theme: 'grid',
        styles: { halign: 'right', font: 'helvetica', fontSize: 10 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        alternateRowStyles: { fillColor: [240, 240, 240] }
      });
    } else if (activeTab === 'employees') {
      // تحضير بيانات الجدول
      const tableData = filteredEmployees.map(employee => {
        const employeeEvaluations = evaluations.filter(e => e.employeeId === employee.id);
        const avgRating = employeeEvaluations.length > 0 
          ? employeeEvaluations.reduce((sum, evaluation) => sum + calculateAverageRating(evaluation.criteria), 0) / employeeEvaluations.length 
          : 0;
        
        return [
          employee.name,
          categoryMap[employee.category] || employee.category,
          employee.grade,
          employee.joinDate.toLocaleDateString('ar-EG'),
          employeeEvaluations.length.toString(),
          avgRating.toFixed(1)
        ];
      });
      
      // إنشاء الجدول
      autoTable(doc, {
        startY: 45,
        head: [['الاسم', 'الفئة', 'الدرجة', 'تاريخ الدخول', 'عدد التقييمات', 'متوسط التقييمات']],
        body: tableData,
        theme: 'grid',
        styles: { halign: 'right', font: 'helvetica', fontSize: 10 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        alternateRowStyles: { fillColor: [240, 240, 240] }
      });
    }
    
    // إضافة معلومات الإحصائيات
    if (activeTab === 'evaluations' && filteredEvaluations.length > 0) {
      const avgRating = filteredEvaluations.reduce((sum, evaluation) => sum + calculateAverageRating(evaluation.criteria), 0) / filteredEvaluations.length;
      doc.text(`متوسط التقييمات: ${avgRating.toFixed(2)}`, 15, doc.internal.pageSize.height - 20);
      doc.text(`عدد التقييمات: ${filteredEvaluations.length}`, 15, doc.internal.pageSize.height - 15);
    }
    
    doc.save(activeTab === 'evaluations' ? 'تقرير_التقييمات.pdf' : 'تقرير_الموظفين.pdf');
  };

  // إحصائيات متوسط التقييم حسب الفئة
  const getCategoryAverages = () => {
    const categoryScores: Record<string, { total: number; count: number }> = {};
    
    evaluations.forEach(evaluation => {
      const employee = employees.find(e => e.id === evaluation.employeeId);
      if (employee) {
        const category = employee.category;
        const avgScore = calculateAverageRating(evaluation.criteria);
        
        if (!categoryScores[category]) {
          categoryScores[category] = { total: 0, count: 0 };
        }
        
        categoryScores[category].total += avgScore;
        categoryScores[category].count += 1;
      }
    });
    
    const categories = Object.keys(categoryScores);
    const averages = categories.map(category => 
      categoryScores[category].total / categoryScores[category].count
    );
    
    return {
      labels: categories.map(cat => categoryMap[cat] || cat),
      data: averages
    };
  };
  
  // إحصائيات توزيع التقييمات
  const getRatingDistribution = () => {
    const distribution = { 
      'ممتاز (4.5-5)': 0, 
      'جيد جدًا (3.5-4.5)': 0, 
      'جيد (2.5-3.5)': 0, 
      'مقبول (1.5-2.5)': 0,
      'ضعيف (1-1.5)': 0
    };
    
    evaluations.forEach(evaluation => {
      const avgRating = calculateAverageRating(evaluation.criteria);
      
      if (avgRating >= 4.5) distribution['ممتاز (4.5-5)']++;
      else if (avgRating >= 3.5) distribution['جيد جدًا (3.5-4.5)']++;
      else if (avgRating >= 2.5) distribution['جيد (2.5-3.5)']++;
      else if (avgRating >= 1.5) distribution['مقبول (1.5-2.5)']++;
      else distribution['ضعيف (1-1.5)']++;
    });
    
    return {
      labels: Object.keys(distribution),
      data: Object.values(distribution)
    };
  };
  
  const categoryAverages = getCategoryAverages();
  const ratingDistribution = getRatingDistribution();
  
  const categoryChartData = {
    labels: categoryAverages.labels,
    datasets: [
      {
        label: 'متوسط التقييم',
        data: categoryAverages.data,
        backgroundColor: [
          'rgba(54, 162, 235, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(255, 99, 132, 0.6)',
          'rgba(153, 102, 255, 0.6)'
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1,
      }
    ]
  };
  
  const distributionChartData = {
    labels: ratingDistribution.labels,
    datasets: [
      {
        label: 'عدد التقييمات',
        data: ratingDistribution.data,
        backgroundColor: [
          'rgba(75, 192, 192, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(255, 99, 132, 0.6)'
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(255, 99, 132, 1)'
        ],
        borderWidth: 1,
      }
    ]
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
              <h1 className="text-2xl font-bold text-gray-900">التقارير والإحصائيات</h1>
            </div>

            {/* تبويبات التقارير */}
            <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
              <div className="flex border-b border-gray-200">
                <button
                  className={`flex-1 py-3 px-4 text-center ${activeTab === 'evaluations' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500' : 'text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => setActiveTab('evaluations')}
                >
                  تقارير التقييمات
                </button>
                <button
                  className={`flex-1 py-3 px-4 text-center ${activeTab === 'employees' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500' : 'text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => setActiveTab('employees')}
                >
                  تقارير الموظفين
                </button>
                <button
                  className={`flex-1 py-3 px-4 text-center ${activeTab === 'statistics' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500' : 'text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => setActiveTab('statistics')}
                >
                  الإحصائيات
                </button>
              </div>
            </div>

            {/* محتوى التقارير حسب التبويب النشط */}
            {activeTab === 'evaluations' && (
              <>
                {/* أدوات التصفية */}
                <Card className="mb-6">
                  <h2 className="text-lg font-semibold mb-4">تصفية تقارير التقييمات</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">الموظف</label>
                      <select
                        value={selectedEmployee}
                        onChange={(e) => setSelectedEmployee(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                      >
                        <option value="">جميع الموظفين</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">الفترة</label>
                      <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                      >
                        <option value="all">جميع الفترات</option>
                        {getAvailablePeriods().map(period => (
                          <option key={`period-${period}`} value={period}>
                            {getPeriodDisplay(period)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                      >
                        <option value="">جميع الفئات</option>
                        <option value="doctor">طبيب</option>
                        <option value="pharmacist">صيدلي</option>
                        <option value="dentist">أسنان</option>
                        <option value="physiotherapist">علاج طبيعي</option>
                        <option value="administrative">إداري</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>
                  </div>
                </Card>

                {/* أزرار التصدير */}
                <div className="flex justify-end gap-4 mb-6">
                  <Button
                    variant="primary"
                    onClick={exportToExcel}
                    icon={
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    }
                  >
                    تصدير إلى Excel
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={exportToPDF}
                    icon={
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    }
                  >
                    تصدير إلى PDF
                  </Button>
                </div>

                {/* جدول البيانات */}
                <Card>
                  {filteredEvaluations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      لا توجد بيانات تقييمات متطابقة مع معايير البحث
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              الموظف
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              الفئة
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
                              نقاط القوة
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              نقاط التحسين
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              ملاحظات
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredEvaluations.map((evaluation) => {
                            const employee = employees.find((emp) => emp.id === evaluation.employeeId);
                            const avgRating = calculateAverageRating(evaluation.criteria);
                            return (
                              <tr key={evaluation.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-medium text-gray-900">{employee?.name || ''}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {categoryMap[employee?.category || ''] || employee?.category || ''}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {evaluation.date.toLocaleDateString('ar-EG')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {getPeriodDisplay(evaluation.period)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      avgRating >= 4.5 ? 'bg-green-100 text-green-800' :
                                      avgRating >= 3.5 ? 'bg-blue-100 text-blue-800' :
                                      avgRating >= 2.5 ? 'bg-yellow-100 text-yellow-800' :
                                      avgRating >= 1.5 ? 'bg-orange-100 text-orange-800' :
                                      'bg-red-100 text-red-800'
                                    }`}>
                                      {avgRating.toFixed(1)}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                  <div className="max-w-xs">
                                    {evaluation.strengths || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                  <div className="max-w-xs">
                                    {evaluation.improvements || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                  {evaluation.comments || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {filteredEvaluations.length > 0 && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-md">
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">إجمالي التقييمات:</span> {filteredEvaluations.length}
                      </div>
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">متوسط التقييمات:</span> {
                          (filteredEvaluations.reduce((sum, evaluation) => sum + calculateAverageRating(evaluation.criteria), 0) / filteredEvaluations.length).toFixed(2)
                        }
                      </div>
                    </div>
                  )}
                </Card>
              </>
            )}

            {activeTab === 'employees' && (
              <>
                {/* أدوات التصفية */}
                <Card className="mb-6">
                  <h2 className="text-lg font-semibold mb-4">تصفية تقارير الموظفين</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                      >
                        <option value="">جميع الفئات</option>
                        <option value="doctor">طبيب</option>
                        <option value="pharmacist">صيدلي</option>
                        <option value="dentist">أسنان</option>
                        <option value="physiotherapist">علاج طبيعي</option>
                        <option value="administrative">إداري</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>
                  </div>
                </Card>

                {/* أزرار التصدير */}
                <div className="flex justify-end gap-4 mb-6">
                  <Button
                    variant="primary"
                    onClick={exportToExcel}
                    icon={
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    }
                  >
                    تصدير إلى Excel
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={exportToPDF}
                    icon={
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    }
                  >
                    تصدير إلى PDF
                  </Button>
                </div>

                {/* جدول البيانات */}
                <Card>
                  {filteredEmployees.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      لا توجد بيانات موظفين متطابقة مع معايير البحث
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              الاسم
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              الرقم القومي
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              الفئة
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              الدرجة
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              نوع التعيين
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              تاريخ الدخول
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              عدد التقييمات
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              متوسط التقييم
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              الملفات الموكلة
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredEmployees.map((employee) => {
                            const employeeEvaluations = evaluations.filter(e => e.employeeId === employee.id);
                            const avgRating = employeeEvaluations.length > 0 
                              ? employeeEvaluations.reduce((sum, evaluation) => sum + calculateAverageRating(evaluation.criteria), 0) / employeeEvaluations.length 
                              : 0;
                              
                            return (
                              <tr key={employee.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-medium text-gray-900">{employee.name}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {employee.nationalId}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                    {categoryMap[employee.category] || employee.category}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {employee.grade}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {employee.appointment}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {employee.joinDate.toLocaleDateString('ar-EG')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {employeeEvaluations.length}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {employeeEvaluations.length > 0 ? (
                                    <div className="flex items-center">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        avgRating >= 4.5 ? 'bg-green-100 text-green-800' :
                                        avgRating >= 3.5 ? 'bg-blue-100 text-blue-800' :
                                        avgRating >= 2.5 ? 'bg-yellow-100 text-yellow-800' :
                                        avgRating >= 1.5 ? 'bg-orange-100 text-orange-800' :
                                        'bg-red-100 text-red-800'
                                      }`}>
                                        {avgRating.toFixed(1)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                  {employee.assignedFiles && employee.assignedFiles.length > 0 ? (
                                    <div className="space-y-1">
                                      {employee.assignedFiles.map((file, index) => (
                                        <div key={index} className="bg-gray-50 px-2 py-1 rounded text-gray-700">
                                          {file}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">لا توجد ملفات</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {filteredEmployees.length > 0 && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-md">
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">إجمالي الموظفين:</span> {filteredEmployees.length}
                      </div>
                    </div>
                  )}
                </Card>
              </>
            )}

            {activeTab === 'statistics' && (
              <>
                <h2 className="text-xl font-semibold mb-6">الإحصائيات والتحليلات</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* متوسط التقييم حسب الفئة */}
                  <Card title="متوسط التقييم حسب الفئة">
                    <div className="h-80">
                      <Bar
                        data={categoryChartData}
                        options={{
                          indexAxis: 'y' as const,
                          responsive: true,
                          scales: {
                            x: {
                              beginAtZero: true,
                              max: 5,
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
                  </Card>
                  
                  {/* توزيع التقييمات */}
                  <Card title="توزيع التقييمات حسب المستوى">
                    <div className="h-80 flex items-center justify-center">
                      <Pie
                        data={distributionChartData}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              position: 'bottom' as const,
                            }
                          }
                        }}
                      />
                    </div>
                  </Card>
                </div>
                
                {/* إحصائيات عامة */}
                <Card title="ملخص الإحصائيات">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4">
                    <div className="bg-blue-50 p-4 rounded-md">
                      <h3 className="text-sm font-medium text-gray-500 mb-1">إجمالي الموظفين</h3>
                      <p className="text-2xl font-bold text-blue-700">{employees.length}</p>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-md">
                      <h3 className="text-sm font-medium text-gray-500 mb-1">إجمالي التقييمات</h3>
                      <p className="text-2xl font-bold text-green-700">{evaluations.length}</p>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded-md">
                      <h3 className="text-sm font-medium text-gray-500 mb-1">متوسط التقييمات</h3>
                      <p className="text-2xl font-bold text-purple-700">
                        {(evaluations.reduce((sum, evaluation) => sum + calculateAverageRating(evaluation.criteria), 0) / evaluations.length).toFixed(2)}
                      </p>
                    </div>
                    
                    <div className="bg-amber-50 p-4 rounded-md">
                      <h3 className="text-sm font-medium text-gray-500 mb-1">أعلى فئة تقييماً</h3>
                      <p className="text-2xl font-bold text-amber-700">
                        {categoryAverages.labels[categoryAverages.data.indexOf(Math.max(...categoryAverages.data))]}
                      </p>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}