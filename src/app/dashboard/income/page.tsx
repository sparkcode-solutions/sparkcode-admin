'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getEmployees,
  getIncomeRecords,
  getIncomeRecordsByMonths,
  createIncomeRecord,
  deleteIncomeRecord,
  Employee,
  IncomeRecord
} from '@/lib/firebase'
import { format } from 'date-fns'

// Hardcoded founder email - replace with your actual email
const FOUNDER_EMAIL = 'bisheshbhattarai0@gmail.com'

interface MonthYear {
  month: number
  year: number
}

export default function IncomePage() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showMonthSelector, setShowMonthSelector] = useState(false)

  // Month selection state
  const [selectedMonths, setSelectedMonths] = useState<MonthYear[]>([])
  const [useRangeSelector, setUseRangeSelector] = useState(false)
  const [rangeStart, setRangeStart] = useState({ month: 1, year: new Date().getFullYear() })
  const [rangeEnd, setRangeEnd] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() })

  // Form data for adding income
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    originalAudSalary: '',
    usdAmount: '',
    usdRate: '',
    nprReceived: '',
    bankCutsKnown: '',
    employeePayments: [] as Array<{ employeeName: string; amount: string; charges: string }>,
  })

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  // Helper function to check if employee joined on or before the target month
  const didEmployeeJoinBeforeMonth = (employee: Employee, month: number, year: number): boolean => {
    const joinDate = new Date(employee.joiningDate)
    const joinMonth = joinDate.getMonth() + 1
    const joinYear = joinDate.getFullYear()

    // Employee joined before the target month/year
    if (joinYear < year) return true
    if (joinYear === year && joinMonth <= month) return true
    return false
  }

  // Helper function to get the salary for an employee for a specific month based on promotion dates
  const getEmployeeSalaryForMonth = (employee: Employee, month: number, year: number): number => {
    // If no promotions, use basic salary
    if (!employee.promotions || employee.promotions.length === 0) {
      return employee.basicSalary
    }

    // Sort promotions by date (oldest first)
    const sortedPromotions = [...employee.promotions].sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateA - dateB
    })

    // Start with the original salary (from the first promotion's fromSalary)
    // This ensures we use the salary before any promotions
    const originalSalary = sortedPromotions.length > 0
      ? sortedPromotions[0].fromSalary
      : employee.basicSalary

    let activeSalary = originalSalary

    // Find the most recent promotion that happened before the target month
    // Promotion date determines when new salary takes effect
    // If promotion is in September, September uses old salary (fromSalary), October uses new salary (toSalary)
    for (const promotion of sortedPromotions) {
      const promoDate = new Date(promotion.date)
      const promoMonth = promoDate.getMonth() + 1
      const promoYear = promoDate.getFullYear()

      // If promotion happened before the target month, new salary is active
      if (promoYear < year || (promoYear === year && promoMonth < month)) {
        // Promotion happened before target month, so new salary is active
        activeSalary = promotion.toSalary
      } else if (promoYear === year && promoMonth === month) {
        // Promotion happened in the same month, so old salary (fromSalary) is still active
        // Use the fromSalary for this promotion
        activeSalary = promotion.fromSalary
        break
      } else {
        // Promotion happened after target month, stop looking
        break
      }
    }

    return activeSalary
  }

  // Calculate total employee salaries for a specific month
  const calculateEmployeeSalariesForMonth = (month: number, year: number): number => {
    let total = 0

    employees.forEach(employee => {
      // Only include employees who joined on or before this month
      if (didEmployeeJoinBeforeMonth(employee, month, year)) {
        const salary = getEmployeeSalaryForMonth(employee, month, year)
        total += salary
      }
    })

    return total
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [employeesResult, incomeResult] = await Promise.all([
      getEmployees(),
      getIncomeRecords(),
    ])

    if (employeesResult.success && employeesResult.data) {
      setEmployees(employeesResult.data)
    }
    if (incomeResult.success && incomeResult.data) {
      setIncomeRecords(incomeResult.data)
    }
    setLoading(false)
  }

  const loadSelectedMonths = async () => {
    if (selectedMonths.length === 0) {
      // Load all records
      const result = await getIncomeRecords()
      if (result.success && result.data) {
        setIncomeRecords(result.data)
      }
    } else {
      // Load selected months
      const result = await getIncomeRecordsByMonths(selectedMonths)
      if (result.success && result.data) {
        setIncomeRecords(result.data)
      }
    }
  }

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault()

    const originalAudSalary = parseFloat(formData.originalAudSalary)
    const usdAmount = parseFloat(formData.usdAmount)
    const usdRate = parseFloat(formData.usdRate)
    const nprReceived = parseFloat(formData.nprReceived)
    const bankCutsKnown = parseFloat(formData.bankCutsKnown)

    // Calculate actual converted NPR (USD amount * USD rate)
    const actualConvertedNpr = usdAmount * usdRate

    // Calculate hidden bank cuts (actual converted NPR - received NPR)
    const bankCutsHidden = actualConvertedNpr - nprReceived

    // Calculate total employee payments (sum of amount + charges for each employee)
    const totalEmployeePayments = formData.employeePayments.reduce((sum, payment) => {
      return sum + parseFloat(payment.amount || '0') + parseFloat(payment.charges || '0')
    }, 0)

    // Calculate profit/loss in NPR
    // Profit = NPR Received - Bank Cuts Known - Bank Cuts Hidden - Total Employee Payments
    const profitLossNpr = nprReceived - bankCutsKnown - bankCutsHidden - totalEmployeePayments

    // Calculate profit/loss in AUD (assuming AUD to NPR conversion rate from originalAudSalary)
    // We need to estimate AUD conversion rate. If originalAudSalary converts to usdAmount * usdRate NPR,
    // then 1 AUD = (usdAmount * usdRate) / originalAudSalary NPR
    const audToNprRate = originalAudSalary > 0 ? (actualConvertedNpr / originalAudSalary) : 0
    const profitLossAud = audToNprRate > 0 ? profitLossNpr / audToNprRate : 0

    // Calculate profit/loss in USD
    const profitLossUsd = usdRate > 0 ? profitLossNpr / usdRate : 0

    // Convert employee payments to proper format
    const employeePayments = formData.employeePayments
      .filter(p => p.employeeName.trim() && (p.amount || p.charges))
      .map(p => ({
        employeeName: p.employeeName.trim(),
        amount: parseFloat(p.amount || '0'),
        charges: parseFloat(p.charges || '0'),
      }))

    const incomeRecord: Omit<IncomeRecord, 'id'> = {
      month: formData.month,
      year: formData.year,
      originalAudSalary,
      usdAmount,
      usdRate,
      nprReceived,
      bankCutsKnown,
      bankCutsHidden,
      employeePayments,
      profitLossNpr,
      profitLossAud,
      profitLossUsd,
    }

    const result = await createIncomeRecord(incomeRecord)
    if (result.success) {
      setShowAddModal(false)
      resetForm()
      loadData()
    } else {
      alert(result.error || 'Failed to add income record')
    }
  }

  const handleDeleteIncome = async (id: string) => {
    if (!confirm('Are you sure you want to delete this income record?')) return
    const result = await deleteIncomeRecord(id)
    if (result.success) {
      loadData()
    } else {
      alert(result.error || 'Failed to delete income record')
    }
  }

  const resetForm = () => {
    setFormData({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      originalAudSalary: '',
      usdAmount: '',
      usdRate: '',
      nprReceived: '',
      bankCutsKnown: '',
      employeePayments: [],
    })
  }

  const addEmployeePayment = () => {
    setFormData({
      ...formData,
      employeePayments: [...formData.employeePayments, { employeeName: '', amount: '', charges: '' }],
    })
  }

  const removeEmployeePayment = (index: number) => {
    setFormData({
      ...formData,
      employeePayments: formData.employeePayments.filter((_, i) => i !== index),
    })
  }

  const updateEmployeePayment = (index: number, field: 'employeeName' | 'amount' | 'charges', value: string) => {
    const newPayments = [...formData.employeePayments]
    newPayments[index] = { ...newPayments[index], [field]: value }
    setFormData({ ...formData, employeePayments: newPayments })
  }

  const toggleMonthSelection = (month: number, year: number) => {
    const key = `${year}-${month}`
    const exists = selectedMonths.some(m => m.month === month && m.year === year)

    if (exists) {
      setSelectedMonths(selectedMonths.filter(m => !(m.month === month && m.year === year)))
    } else {
      setSelectedMonths([...selectedMonths, { month, year }])
    }
  }

  const applyRangeSelection = () => {
    const months: MonthYear[] = []
    let currentYear = rangeStart.year
    let currentMonth = rangeStart.month

    const endDate = rangeEnd.year * 12 + rangeEnd.month

    while (currentYear * 12 + currentMonth <= endDate) {
      months.push({ month: currentMonth, year: currentYear })
      currentMonth++
      if (currentMonth > 12) {
        currentMonth = 1
        currentYear++
      }
    }

    setSelectedMonths(months)
  }

  const applyMonthFilter = async () => {
    await loadSelectedMonths()
    setShowMonthSelector(false)
  }

  const clearMonthFilter = async () => {
    setSelectedMonths([])
    const result = await getIncomeRecords()
    if (result.success && result.data) {
      setIncomeRecords(result.data)
    }
  }

  // Calculate available values for form preview
  const calculatePreview = () => {
    if (!formData.originalAudSalary || !formData.usdAmount || !formData.usdRate || !formData.nprReceived || !formData.bankCutsKnown) {
      return null
    }

    const originalAudSalary = parseFloat(formData.originalAudSalary)
    const usdAmount = parseFloat(formData.usdAmount)
    const usdRate = parseFloat(formData.usdRate)
    const nprReceived = parseFloat(formData.nprReceived)
    const bankCutsKnown = parseFloat(formData.bankCutsKnown)

    // Calculate actual converted NPR
    const actualConvertedNpr = usdAmount * usdRate

    // Calculate hidden bank cuts
    const bankCutsHidden = actualConvertedNpr - nprReceived

    // Calculate total employee payments
    const totalEmployeePayments = formData.employeePayments.reduce((sum, payment) => {
      return sum + parseFloat(payment.amount || '0') + parseFloat(payment.charges || '0')
    }, 0)

    // Calculate profit/loss
    const profitLossNpr = nprReceived - bankCutsKnown - bankCutsHidden - totalEmployeePayments
    const audToNprRate = originalAudSalary > 0 ? (actualConvertedNpr / originalAudSalary) : 0
    const profitLossAud = audToNprRate > 0 ? profitLossNpr / audToNprRate : 0
    const profitLossUsd = usdRate > 0 ? profitLossNpr / usdRate : 0

    return {
      actualConvertedNpr,
      bankCutsHidden,
      totalEmployeePayments,
      profitLossNpr,
      profitLossAud,
      profitLossUsd,
    }
  }

  // Filter income records by selected months
  const filteredIncomeRecords = selectedMonths.length > 0
    ? incomeRecords.filter(record =>
      selectedMonths.some(m => m.month === record.month && m.year === record.year)
    )
    : incomeRecords

  // Group data by month/year
  const groupedData = filteredIncomeRecords.map(incomeRecord => {
    // Get employees who joined on or before this month with their calculated salaries
    const employeesWithSalaries = employees
      .filter(emp => didEmployeeJoinBeforeMonth(emp, incomeRecord.month, incomeRecord.year))
      .map(emp => {
        const salary = getEmployeeSalaryForMonth(emp, incomeRecord.month, incomeRecord.year)
        return { employee: emp, salary }
      })

    return {
      incomeRecord,
      employeesWithSalaries,
    }
  })

  const isFounder = user?.email?.toLowerCase() === FOUNDER_EMAIL.toLowerCase()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Income Tracking</h1>
          <p className="text-gray-600 mt-2">Track client payments and salary distribution</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowMonthSelector(true)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {selectedMonths.length > 0 ? `${selectedMonths.length} Month(s) Selected` : 'Select Months'}
          </button>
          {selectedMonths.length > 0 && (
            <button
              onClick={clearMonthFilter}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-red-600"
            >
              Clear Filter
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Add Income Record
          </button>
        </div>
      </div>

      {/* Income Records */}
      <div className="space-y-6">
        {groupedData.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No income records found</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add First Income Record
            </button>
          </div>
        ) : (
          groupedData.map(({ incomeRecord, employeesWithSalaries }) => (
            <div key={incomeRecord.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Month Header */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {monthNames[incomeRecord.month - 1]} {incomeRecord.year}
                    </h3>
                    {incomeRecord.usdRate && (
                      <p className="text-sm text-gray-600 mt-1">
                        USD Rate: 1 USD = {incomeRecord.usdRate} NPR
                      </p>
                    )}
                    {incomeRecord.conversionRate && !incomeRecord.usdRate && (
                      <p className="text-sm text-gray-600 mt-1">
                        Conversion Rate: 1 AUD = {incomeRecord.conversionRate} NPR
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Profit/Loss</p>
                    <div className="space-y-1">
                      {incomeRecord.profitLossNpr !== undefined && (
                        <p className={`text-lg font-bold ${incomeRecord.profitLossNpr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {incomeRecord.profitLossNpr >= 0 ? '+' : ''}
                          Rs. {incomeRecord.profitLossNpr.toFixed(2)} NPR
                        </p>
                      )}
                      {incomeRecord.profitLossAud !== undefined && (
                        <p className={`text-lg font-bold ${incomeRecord.profitLossAud >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {incomeRecord.profitLossAud >= 0 ? '+' : ''}
                          ${incomeRecord.profitLossAud.toFixed(2)} AUD
                        </p>
                      )}
                      {incomeRecord.profitLossUsd !== undefined && (
                        <p className={`text-lg font-bold ${incomeRecord.profitLossUsd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {incomeRecord.profitLossUsd >= 0 ? '+' : ''}
                          ${incomeRecord.profitLossUsd.toFixed(2)} USD
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Founder Section */}
              {isFounder && incomeRecord.founderSalaryAud && (
                <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-lg font-semibold text-gray-900">{user.displayName || 'Founder'}</h4>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Founder
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Salary</p>
                      <p className="text-xl font-bold text-gray-900">
                        ${incomeRecord.founderSalaryAud.toFixed(2)} AUD
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Income Summary */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                {incomeRecord.originalAudSalary !== undefined ? (
                  // New format
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Original AUD Salary</p>
                      <p className="text-lg font-semibold text-gray-900">
                        ${incomeRecord.originalAudSalary.toFixed(2)} AUD
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">USD Amount</p>
                      <p className="text-lg font-semibold text-gray-900">
                        ${incomeRecord.usdAmount.toFixed(2)} USD
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">NPR Received</p>
                      <p className="text-lg font-semibold text-green-600">
                        Rs. {incomeRecord.nprReceived.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Bank Cuts (Known)</p>
                      <p className="text-lg font-semibold text-red-600">
                        -Rs. {incomeRecord.bankCutsKnown.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Bank Cuts (Hidden)</p>
                      <p className="text-lg font-semibold text-red-600">
                        -Rs. {incomeRecord.bankCutsHidden.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total Employee Payments</p>
                      <p className="text-lg font-semibold text-orange-600">
                        -Rs. {incomeRecord.employeePayments?.reduce((sum, p) => sum + p.amount + p.charges, 0).toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                ) : (
                  // Legacy format
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Total Received</p>
                      <p className="text-lg font-semibold text-gray-900">
                        ${incomeRecord.totalAudReceived?.toFixed(2) || '0.00'} AUD
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Bank Cuts (NPR)</p>
                      <p className="text-lg font-semibold text-red-600">
                        -Rs. {incomeRecord.bankCutsNpr?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Available for Employees</p>
                      <p className="text-lg font-semibold text-blue-600">
                        Rs. {incomeRecord.totalAudReceived && incomeRecord.founderSalaryAud && incomeRecord.conversionRate && incomeRecord.bankCutsNpr
                          ? (((incomeRecord.totalAudReceived - incomeRecord.founderSalaryAud) * incomeRecord.conversionRate) - incomeRecord.bankCutsNpr).toFixed(2)
                          : '0.00'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Employee Salaries</p>
                      <p className="text-lg font-semibold text-gray-900">
                        Rs. {incomeRecord.totalEmployeeSalariesNpr?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Employee Payments List */}
              {incomeRecord.employeePayments && incomeRecord.employeePayments.length > 0 && (
                <div className="px-6 py-4 bg-orange-50 border-b border-orange-100">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Employee Payments</h4>
                  <div className="space-y-2">
                    {incomeRecord.employeePayments.map((payment, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-700">{payment.employeeName}</span>
                        <span className="text-gray-900 font-medium">
                          Rs. {(payment.amount + payment.charges).toFixed(2)} 
                          <span className="text-gray-500 ml-1">
                            (Amount: {payment.amount.toFixed(2)}, Charges: {payment.charges.toFixed(2)})
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Employees */}
              {employeesWithSalaries.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Employee
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Position
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Salary (NPR)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Equivalent (AUD)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {employeesWithSalaries.map(({ employee, salary }) => (
                        <tr key={employee.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                            <div className="text-sm text-gray-500">{employee.employeeId}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{employee.position}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              Rs. {salary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              ${(salary / incomeRecord.conversionRate).toFixed(2)} AUD
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-8 text-center">
                  <p className="text-gray-500">No employees joined on or before this month</p>
                </div>
              )}

              {/* Delete button */}
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => handleDeleteIncome(incomeRecord.id!)}
                  className="text-sm text-red-600 hover:text-red-900"
                >
                  Delete Record
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Income Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add Income Record</h2>
            <form onSubmit={handleAddIncome} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                  <select
                    required
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {monthNames.map((month, index) => (
                      <option key={index} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    required
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">1. Original AUD Salary</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={formData.originalAudSalary}
                    onChange={(e) => setFormData({ ...formData, originalAudSalary: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., 10000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">2. USD Amount</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={formData.usdAmount}
                    onChange={(e) => setFormData({ ...formData, usdAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., 6500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">3. USD Rate</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={formData.usdRate}
                    onChange={(e) => setFormData({ ...formData, usdRate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., 133.50"
                  />
                  <p className="text-xs text-gray-500 mt-1">1 USD = ? NPR</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">4. NPR Received Money</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={formData.nprReceived}
                    onChange={(e) => setFormData({ ...formData, nprReceived: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., 850000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">5. Bank Cuts (Known)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.bankCutsKnown}
                  onChange={(e) => setFormData({ ...formData, bankCutsKnown: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., 2500"
                />
                <p className="text-xs text-gray-500 mt-1">Known bank fees/cuts in NPR</p>
              </div>

              {/* Employee Payments Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">6. Employee Payments</label>
                  <button
                    type="button"
                    onClick={addEmployeePayment}
                    className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                  >
                    + Add Employee Payment
                  </button>
                </div>
                <div className="space-y-3 border border-gray-200 rounded-lg p-4">
                  {formData.employeePayments.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-2">No employee payments added yet</p>
                  ) : (
                    formData.employeePayments.map((payment, index) => (
                      <div key={index} className="grid grid-cols-12 gap-3 items-start">
                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder="Employee Name"
                            value={payment.employeeName}
                            onChange={(e) => updateEmployeePayment(index, 'employeeName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Amount"
                            value={payment.amount}
                            onChange={(e) => updateEmployeePayment(index, 'amount', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Charges"
                            value={payment.charges}
                            onChange={(e) => updateEmployeePayment(index, 'charges', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <button
                            type="button"
                            onClick={() => removeEmployeePayment(index)}
                            className="w-full px-3 py-2 text-red-600 hover:text-red-800 text-sm"
                          >
                            × Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                  {formData.employeePayments.length > 0 && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Total Employee Payments:</span>
                        <span className="text-lg font-bold text-gray-900">
                          Rs. {formData.employeePayments
                            .reduce((sum, payment) => sum + parseFloat(payment.amount || '0') + parseFloat(payment.charges || '0'), 0)
                            .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Calculation */}
              {calculatePreview() && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Preview & Calculations</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Actual Converted NPR (USD × Rate):</span>
                      <span className="font-medium">
                        Rs. {calculatePreview()!.actualConvertedNpr.toFixed(2)} NPR
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bank Cuts (Hidden):</span>
                      <span className="font-medium text-red-600">
                        -Rs. {calculatePreview()!.bankCutsHidden.toFixed(2)} NPR
                      </span>
                      <span className="text-xs text-gray-500">(Actual NPR - Received NPR)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Employee Payments:</span>
                      <span className="font-medium text-orange-600">
                        -Rs. {calculatePreview()!.totalEmployeePayments.toFixed(2)} NPR
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-blue-200 pt-2">
                      <span className="text-gray-900 font-semibold">Profit/Loss (NPR):</span>
                      <span className={`font-bold ${calculatePreview()!.profitLossNpr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {calculatePreview()!.profitLossNpr >= 0 ? '+' : ''}
                        Rs. {calculatePreview()!.profitLossNpr.toFixed(2)} NPR
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-900 font-semibold">Profit/Loss (AUD):</span>
                      <span className={`font-bold ${calculatePreview()!.profitLossAud >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {calculatePreview()!.profitLossAud >= 0 ? '+' : ''}
                        ${calculatePreview()!.profitLossAud.toFixed(2)} AUD
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-900 font-semibold">Profit/Loss (USD):</span>
                      <span className={`font-bold ${calculatePreview()!.profitLossUsd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {calculatePreview()!.profitLossUsd >= 0 ? '+' : ''}
                        ${calculatePreview()!.profitLossUsd.toFixed(2)} USD
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Add Income Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Month Selector Modal */}
      {showMonthSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Select Months</h2>

            {/* Toggle between individual and range */}
            <div className="mb-4 flex space-x-2">
              <button
                onClick={() => setUseRangeSelector(false)}
                className={`px-4 py-2 rounded-lg ${!useRangeSelector
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700'
                  }`}
              >
                Individual Months
              </button>
              <button
                onClick={() => setUseRangeSelector(true)}
                className={`px-4 py-2 rounded-lg ${useRangeSelector
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700'
                  }`}
              >
                Date Range
              </button>
            </div>

            {!useRangeSelector ? (
              /* Individual Month Selector */
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Select individual months to view</p>
                {[2025, 2024, 2023].map(year => (
                  <div key={year}>
                    <h3 className="font-semibold text-gray-900 mb-2">{year}</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {monthNames.map((month, index) => {
                        const isSelected = selectedMonths.some(
                          m => m.month === index + 1 && m.year === year
                        )
                        return (
                          <button
                            key={index}
                            onClick={() => toggleMonthSelection(index + 1, year)}
                            className={`px-3 py-2 rounded-lg text-sm ${isSelected
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                          >
                            {month}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Range Selector */
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Select a date range</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Month</label>
                    <select
                      value={rangeStart.month}
                      onChange={(e) => setRangeStart({ ...rangeStart, month: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {monthNames.map((month, index) => (
                        <option key={index} value={index + 1}>{month}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Year</label>
                    <input
                      type="number"
                      value={rangeStart.year}
                      onChange={(e) => setRangeStart({ ...rangeStart, year: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Month</label>
                    <select
                      value={rangeEnd.month}
                      onChange={(e) => setRangeEnd({ ...rangeEnd, month: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {monthNames.map((month, index) => (
                        <option key={index} value={index + 1}>{month}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Year</label>
                    <input
                      type="number"
                      value={rangeEnd.year}
                      onChange={(e) => setRangeEnd({ ...rangeEnd, year: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <button
                  onClick={applyRangeSelection}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Apply Range
                </button>
              </div>
            )}

            {/* Selected months preview */}
            {selectedMonths.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Selected: {selectedMonths.length} month(s)
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedMonths.slice(0, 10).map((m, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 bg-primary-100 text-primary-800 rounded">
                      {monthNames[m.month - 1]} {m.year}
                    </span>
                  ))}
                  {selectedMonths.length > 10 && (
                    <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">
                      +{selectedMonths.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setShowMonthSelector(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={applyMonthFilter}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

