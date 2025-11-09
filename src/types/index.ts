import { Employee, Promotion, SalaryRecord, IncomeRecord } from '@/lib/firebase'

export type { Employee, Promotion, SalaryRecord, IncomeRecord }

export interface CompanyInfo {
  name: string
  address: string
  panNo: string
  email: string
  phone: string
  logoPath?: string
}

export const COMPANY_INFO: CompanyInfo = {
  name: 'Sparkcode Solutions',
  address: 'Suryabinayak-5, Bhaktapur',
  panNo: '130302052',
  email: 'office@sparkcode.tech',
  phone: '+9779869195575',
  logoPath: '/icon-small.png'
}

