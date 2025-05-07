'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, firestore } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, addDoc, doc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { Employee } from '@/types';
import { Header } from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Card from '@/components/ui/Card';

type FormData = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>;

const categoryOptions = [
  { value: 'doctor', label: 'طبيب' },
  { value: 'pharmacist', label: 'صيدلي' },
  { value: 'dentist', label: 'أسنان' },
  { value: 'physiotherapist', label: 'علاج طبيعي' },
  { value: 'administrative', label: 'إداري' },
  { value: 'other', label: 'أخرى' }
];

const gradeOptions = [
  { value: 'excellent', label: 'ممتازة' },
  { value: 'senior', label: 'كبير' },
  { value: 'first', label: 'الأولى' },
  { value: 'second', label: 'الثانية' },
  { value: 'third', label: 'الثالثة' }
];

const appointmentOptions = [
  { value: 'permanent', label: 'معين' },
  { value: 'delegated', label: 'منتدب' },
  { value: 'mission', label: 'مأمورية' },
  { value: 'assignment', label: 'تكليف' },
  { value: 'other', label: 'أخرى' }
];

const filterOptions = [
  { value: 'all', label: 'جميع الفئات' },
  { value: 'doctor', label: 'أطباء' },
  { value: 'pharmacist', label: 'صيادلة' },
  { value: 'dentist', label: 'أسنان' },
  { value: 'physiotherapist', label: 'علاج طبيعي' },
  { value: 'administrative', label: 'إداريين' },
  { value: 'other', label: 'أخرى' }
];

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
    
    if (!newEmployee.nationalId || newEmployee.nationalId.length !== 14) {
      alert('الرقم القومي يجب أن يكون 14 رقمًا بالضبط');
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
    
    if (!editingEmployee.nationalId || editingEmployee.nationalId.length !== 14) {
      alert('الرقم القومي يجب أن يكون 14 رقمًا بالضبط');
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
      
      // التحقق من الرقم القومي
      if (name === 'nationalId') {
        // السماح فقط بالأرقام
        const numericValue = value.replace(/[^0-9]/g, '');
        // تحديد الحد الأقصى بـ 14 رقم
        const truncatedValue = numericValue.slice(0, 14);
        
        setFormData((prev: Partial<FormData>) => ({
          ...prev,
          [name]: truncatedValue
        }));
        return;
      }
      
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
                onChange={handleInputChange}
                required
                maxLength={14}
                pattern="[0-9]{14}"
                title="الرقم القومي يجب أن يكون 14 رقمًا بالضبط"
                placeholder="أدخل 14 رقمًا"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
              <Select
                name="category"
                value={formData?.category || 'doctor'}
                onChange={handleSelectChange}
                options={categoryOptions}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الدرجة</label>
              <Select
                name="grade"
                value={formData?.grade || 'excellent'}
                onChange={handleSelectChange}
                options={gradeOptions}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نوع التعيين</label>
              <Select
                name="appointment"
                value={formData?.appointment || 'permanent'}
                onChange={handleSelectChange}
                options={appointmentOptions}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ التعيين</label>
              <Input
                type="date"
                name="joinDate"
                value={formData?.joinDate ? new Date(formData.joinDate).toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  setFormData((prev: Partial<FormData>) => ({
                    ...prev,
                    joinDate: date
                  }));
                }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الملفات الموكلة</label>
              <div className="space-y-2">
                {formData?.assignedFiles?.map((file, index) => (
                  <div key={index} className="flex items-center space-x-2 space-x-reverse">
                    <Input
                      type="text"
                      value={file}
                      onChange={(e) => {
                        const newFiles = [...(formData.assignedFiles || [])];
                        newFiles[index] = e.target.value;
                        setFormData((prev: Partial<FormData>) => ({
                          ...prev,
                          assignedFiles: newFiles
                        }));
                      }}
                      placeholder="اسم الملف"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const newFiles = formData.assignedFiles?.filter((_, i) => i !== index) || [];
                        setFormData((prev: Partial<FormData>) => ({
                          ...prev,
                          assignedFiles: newFiles
                        }));
                      }}
                    >
                      حذف
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setFormData((prev: Partial<FormData>) => ({
                      ...prev,
                      assignedFiles: [...(prev.assignedFiles || []), '']
                    }));
                  }}
                >
                  إضافة ملف
                </Button>
              </div>
            </div>

            <div className="flex justify-end space-x-4 space-x-reverse">
              <Button
                type="button"
                variant="secondary"
                onClick={() => isEdit ? setEditingEmployee(null) : setShowAddForm(false)}
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
              <h1 className="text-2xl font-bold text-gray-900">الموظفين</h1>
              <Button
                variant="primary"
                onClick={() => setShowAddForm(true)}
              >
                إضافة موظف جديد
              </Button>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="بحث عن موظف..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="w-full md:w-48">
                  <Select
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value)}
                    options={filterOptions}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
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
                        تاريخ التعيين
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الملفات الموكلة
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEmployees.map((employee) => (
                      <tr key={employee.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {employee.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {employee.nationalId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getCategoryLabel(employee.category)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getGradeLabel(employee.grade)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getAppointmentTypeLabel(employee.appointment)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {employee.joinDate ? new Date(employee.joinDate).toLocaleDateString('en-GB', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          }) : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex space-x-2 space-x-reverse">
                            <Button
                              variant="secondary"
                              onClick={() => openEditForm(employee)}
                            >
                              تعديل
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => handleDeleteEmployee(employee.id)}
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

      {showAddForm && renderEmployeeForm()}
      {editingEmployee && renderEmployeeForm(true)}
    </div>
  );
}