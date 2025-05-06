'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, firestore } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { Employee, EmployeeCategory, EmployeeGrade, EmployeeAppointment } from '@/types';
import { Header } from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Card from '@/components/ui/Card';

type FormData = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>;

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({
    name: '',
    nationalId: '',
    category: 'doctor',
    grade: 'excellent',
    appointment: 'permanent',
    joinDate: new Date(),
    assignedFiles: [],
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/auth/login');
      } else {
        fetchEmployees();
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const employeesRef = collection(firestore, 'employees');
      const q = query(employeesRef, where('isActive', '==', true));
      const snapshot = await getDocs(q);
      
      const employeesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        joinDate: doc.data().joinDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Employee[];
      
      setEmployees(employeesData);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newEmployee.nationalId && newEmployee.nationalId.length !== 14) {
      alert('الرقم القومي يجب أن يكون 14 رقمًا');
      return;
    }
    
    try {
      const employeesRef = collection(firestore, 'employees');
      const employeeData = {
        ...newEmployee,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
      };
      
      await addDoc(employeesRef, employeeData);
      setShowAddForm(false);
      resetEmployeeForm();
      fetchEmployees();
    } catch (error) {
      console.error('Error adding employee:', error);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingEmployee || !editingEmployee.id) return;
    
    if (editingEmployee.nationalId && editingEmployee.nationalId.length !== 14) {
      alert('الرقم القومي يجب أن يكون 14 رقمًا');
      return;
    }
    
    try {
      const employeeRef = doc(firestore, 'employees', editingEmployee.id);
      await updateDoc(employeeRef, {
        ...editingEmployee,
        updatedAt: serverTimestamp(),
      });
      
      setEditingEmployee(null);
      fetchEmployees();
    } catch (error) {
      console.error('Error updating employee:', error);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذا الموظف؟')) {
      try {
        const employeeRef = doc(firestore, 'employees', id);
        await updateDoc(employeeRef, {
          isActive: false,
          updatedAt: serverTimestamp(),
        });
        
        fetchEmployees();
      } catch (error) {
        console.error('Error deleting employee:', error);
      }
    }
  };

  const resetEmployeeForm = () => {
    setNewEmployee({
      name: '',
      nationalId: '',
      category: 'doctor',
      grade: 'excellent',
      appointment: 'permanent',
      joinDate: new Date(),
      assignedFiles: [],
    });
  };

  const openEditForm = (employee: Employee) => {
    setEditingEmployee(employee);
  };

  const filteredEmployees = employees.filter(employee => {
    // تصفية حسب البحث
    const matchesSearch = employee.name.includes(searchTerm) || 
                        employee.nationalId.includes(searchTerm);
    
    // تصفية حسب الفئة
    const matchesFilter = activeFilter === 'all' || employee.category === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

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

  const getGradeLabel = (grade: string): string => {
    const grades: Record<string, string> = {
      excellent: 'ممتازة',
      senior: 'كبير',
      first: 'الأولى',
      second: 'الثانية',
      third: 'الثالثة'
    };
    return grades[grade] || grade;
  };

  const getAppointmentTypeLabel = (type: string): string => {
    const types: Record<string, string> = {
      permanent: 'معين',
      delegated: 'منتدب',
      mission: 'مأمورية',
      assignment: 'تكليف',
      other: 'أخرى'
    };
    return types[type] || type;
  };

  const renderEmployeeForm = (isEdit: boolean = false) => {
    const formData = isEdit ? editingEmployee : newEmployee;
    const setFormData = isEdit ? setEditingEmployee : setNewEmployee;
    const handleSubmit = isEdit ? handleUpdateEmployee : handleAddEmployee;
    const formTitle = isEdit ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد';
    const buttonText = isEdit ? 'حفظ التغييرات' : 'إضافة';

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData((prev: Partial<FormData>) => ({
        ...prev,
        [name]: value
      }));
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData((prev: Partial<FormData>) => ({
        ...prev,
        [name]: value
      }));
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-xl overflow-auto max-h-[90vh]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{formTitle}</h2>
            <button 
              onClick={() => isEdit ? setEditingEmployee(null) : setShowAddForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
              <Input
                type="text"
                name="name"
                value={formData?.name || ''}
                onChange={handleInputChange}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الرقم القومي</label>
              <Input
                type="text"
                name="nationalId"
                value={formData?.nationalId || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 14) {
                    handleInputChange(e);
                  }
                }}
                maxLength={14}
                pattern="[0-9]*"
                inputMode="numeric"
                required
              />
              <p className="text-xs text-gray-500 mt-1">يجب أن يكون الرقم القومي 14 رقمًا</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
              <Select
                name="category"
                value={formData?.category || 'doctor'}
                onChange={handleSelectChange}
                options={[
                  { value: 'doctor', label: 'طبيب' },
                  { value: 'pharmacist', label: 'صيدلي' },
                  { value: 'dentist', label: 'طبيب أسنان' },
                  { value: 'physiotherapist', label: 'علاج طبيعي' },
                  { value: 'administrative', label: 'إداري' }
                ]}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الدرجة</label>
              <Select
                name="grade"
                value={formData?.grade || 'excellent'}
                onChange={handleSelectChange}
                options={[
                  { value: 'excellent', label: 'ممتاز' },
                  { value: 'senior', label: 'كبير' },
                  { value: 'first', label: 'أول' },
                  { value: 'second', label: 'ثاني' },
                  { value: 'third', label: 'ثالث' }
                ]}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نوع التعيين</label>
              <Select
                name="appointment"
                value={formData?.appointment || 'permanent'}
                onChange={handleSelectChange}
                options={[
                  { value: 'permanent', label: 'دائم' },
                  { value: 'delegated', label: 'منتدب' },
                  { value: 'mission', label: 'مأمورية' },
                  { value: 'assignment', label: 'تكليف' }
                ]}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الدخول</label>
              <input
                type="date"
                name="joinDate"
                value={formData?.joinDate instanceof Date ? formData.joinDate.toISOString().split('T')[0] : ''}
                onChange={handleInputChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الملفات الموكلة</label>
              <textarea
                name="assignedFiles"
                value={(formData?.assignedFiles || []).join(', ')}
                onChange={(e) => setFormData({ ...formData, assignedFiles: e.target.value.split(', ').filter(Boolean) } as any)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                rows={3}
                placeholder="أدخل الملفات مفصولة بفواصل"
              />
              <p className="text-xs text-gray-500 mt-1">أدخل الملفات الموكلة مفصولة بفواصل</p>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button
                variant="secondary"
                onClick={() => isEdit ? setEditingEmployee(null) : setShowAddForm(false)}
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
              <h1 className="text-2xl font-bold text-gray-900">إدارة الموظفين</h1>
              <Button
                variant="primary"
                onClick={() => setShowAddForm(true)}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                إضافة موظف جديد
              </Button>
            </div>

            {/* أدوات البحث والتصفية */}
            <Card className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-7">
                  <label className="block text-sm font-medium text-gray-700 mb-1">بحث</label>
                  <input
                    type="text"
                    placeholder="ابحث بالاسم أو الرقم القومي..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                  />
                </div>
                
                <div className="md:col-span-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">تصفية حسب الفئة</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setActiveFilter('all')}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${activeFilter === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                      الكل
                    </button>
                    <button
                      onClick={() => setActiveFilter('doctor')}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${activeFilter === 'doctor' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                      طبيب
                    </button>
                    <button
                      onClick={() => setActiveFilter('pharmacist')}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${activeFilter === 'pharmacist' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                      صيدلي
                    </button>
                    <button
                      onClick={() => setActiveFilter('dentist')}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${activeFilter === 'dentist' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                      أسنان
                    </button>
                    <button
                      onClick={() => setActiveFilter('administrative')}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${activeFilter === 'administrative' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                      إداري
                    </button>
                  </div>
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
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                          لا توجد بيانات متطابقة مع معايير البحث
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((employee) => (
                        <tr key={employee.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{employee.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {employee.nationalId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {getCategoryLabel(employee.category)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {getGradeLabel(employee.grade)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {getAppointmentTypeLabel(employee.appointment)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {employee.joinDate.toLocaleDateString('ar-EG')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 space-x-reverse">
                            <button 
                              onClick={() => openEditForm(employee)}
                              className="text-blue-600 hover:text-blue-900 ml-4"
                            >
                              تعديل
                            </button>
                            <button 
                              onClick={() => handleDeleteEmployee(employee.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              حذف
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </main>
      </div>

      {/* نموذج إضافة موظف جديد */}
      {showAddForm && renderEmployeeForm()}

      {/* نموذج تعديل بيانات الموظف */}
      {editingEmployee && renderEmployeeForm(true)}
    </div>
  );
}