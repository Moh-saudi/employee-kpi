export type UserRole = 'admin' | 'evaluator' | 'employee';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  createdAt: Date;
}

export type EmployeeCategory = 'doctor' | 'pharmacist' | 'dentist' | 'physiotherapist' | 'administrative' | 'other';
export type EmployeeGrade = 'excellent' | 'senior' | 'first' | 'second' | 'third';
export type EmployeeAppointment = 'permanent' | 'delegated' | 'mission' | 'assignment' | 'other';

export interface Employee {
  id: string;
  name: string;
  nationalId: string;
  category: EmployeeCategory;
  grade: EmployeeGrade;
  appointment: EmployeeAppointment;
  joinDate: Date;
  assignedFiles: string[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Evaluation {
  id: string;
  employeeId: string;
  evaluatorId: string;
  date: Date;
  period: string | { month: number; year: number };
  criteria: {
    [key: string]: number; // 1-5 rating
  };
  comments?: string;
  strengths?: string;
  improvements?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  totalEmployees: number;
  totalEvaluations: number;
  averageRating: number;
  topPerformers: {
    employeeId: string;
    name: string;
    rating: number;
    department: string;
  }[];
  evaluationDistribution: {
    [key: string]: number;
  };
  ratingsByCategory: {
    [key: string]: number;
  };
  ratingsTrend: number[];
  evaluationsThisPeriod: number;
} 