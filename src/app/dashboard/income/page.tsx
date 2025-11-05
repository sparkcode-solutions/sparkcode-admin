'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { 
  getEmployees, 
  getSalaryRecords, 
  getIncomeRecords,
  getIncomeRecordsByMonths,
  createIncomeRecord,
  deleteIncomeRecord,
  Employee, 
  SalaryRecord,
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
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([])
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
    totalAudReceived: '',
    founderSalaryAud: '',
    conversionRate: '',
    bankCuts: '',
  })

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [employeesResult, salaryResult, incomeResult] = await Promise.all([
      getEmployees(),
      getSalaryRecords(),
      getIncomeRecords(),
    ])

    if (employeesResult.success && employeesResult.data) {
      setEmployees(employeesResult.data)
    }
    if (salaryResult.success && salaryResult.data) {
      setSalaryRecords(salaryResult.data)
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
    
    // Get employee salaries for this month
    const monthSalaries = salaryRecords.filter(
      r => r.month === formData.month && r.year === formData.year
    )
    const totalEmployeeSalariesNpr = monthSalaries.reduce((sum, r) => sum + r.amount, 0)
    
    // Calculate profit/loss
    const totalAud = parseFloat(formData.totalAudReceived)
    const founderSalary = parseFloat(formData.founderSalaryAud)
    const bankCuts = parseFloat(formData.bankCuts)
    const conversionRate = parseFloat(formData.conversionRate)
    
    const availableAud = totalAud - founderSalary - bankCuts
    const availableNpr = availableAud * conversionRate
    const profitLossAud = (availableNpr - totalEmployeeSalariesNpr) / conversionRate

    const incomeRecord: Omit<IncomeRecord, 'id'> = {
      month: formData.month,
      year: formData.year,
      totalAudReceived: totalAud,
      founderSalaryAud: founderSalary,
      conversionRate: conversionRate,
      bankCuts: bankCuts,
      totalEmployeeSalariesNpr: totalEmployeeSalariesNpr,
      profitLossAud: profitLossAud,
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
      totalAudReceived: '',
      founderSalaryAud: '',
      conversionRate: '',
      bankCuts: '',
    })
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
    if (!formData.totalAudReceived || !formData.founderSalaryAud || !formData.conversionRate || !formData.bankCuts) {
      return null
    }

    const totalAud = parseFloat(formData.totalAudReceived)
    const founderSalary = parseFloat(formData.founderSalaryAud)
    const bankCuts = parseFloat(formData.bankCuts)
    const conversionRate = parseFloat(formData.conversionRate)
    
    const availableAud = totalAud - founderSalary - bankCuts
    const availableNpr = availableAud * conversionRate
    
    const monthSalaries = salaryRecords.filter(
      r => r.month === formData.month && r.year === formData.year
    )
    const totalEmployeeSalariesNpr = monthSalaries.reduce((sum, r) => sum + r.amount, 0)
    const profitLossAud = (availableNpr - totalEmployeeSalariesNpr) / conversionRate

    return {
      availableAud,
      availableNpr,
      totalEmployeeSalariesNpr,
      profitLossAud,
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
    const monthSalaries = salaryRecords.filter(
      r => r.month === incomeRecord.month && r.year === incomeRecord.year
    )
    
    const employeesWithSalaries = employees.map(emp => {
      const salary = monthSalaries.find(s => s.employeeId === emp.employeeId)
      return { employee: emp, salary }
    }).filter(item => item.salary)

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
                    <p className="text-sm text-gray-600 mt-1">
                      Conversion Rate: 1 AUD = {incomeRecord.conversionRate} NPR
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Profit/Loss</p>
                    <p className={`text-2xl font-bold ${
                      incomeRecord.profitLossAud >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {incomeRecord.profitLossAud >= 0 ? '+' : ''} 
                      ${incomeRecord.profitLossAud.toFixed(2)} AUD
                    </p>
                  </div>
                </div>
              </div>

              {/* Founder Section */}
              {isFounder && (
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
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Total Received</p>
                    <p className="text-lg font-semibold text-gray-900">
                      ${incomeRecord.totalAudReceived.toFixed(2)} AUD
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Bank Cuts</p>
                    <p className="text-lg font-semibold text-red-600">
                      -${incomeRecord.bankCuts.toFixed(2)} AUD
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Available for Employees</p>
                    <p className="text-lg font-semibold text-blue-600">
                      Rs. {((incomeRecord.totalAudReceived - incomeRecord.founderSalaryAud - incomeRecord.bankCuts) * incomeRecord.conversionRate).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Employee Salaries</p>
                    <p className="text-lg font-semibold text-gray-900">
                      Rs. {incomeRecord.totalEmployeeSalariesNpr.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

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
                              Rs. {salary!.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              ${(salary!.amount / incomeRecord.conversionRate).toFixed(2)} AUD
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-8 text-center">
                  <p className="text-gray-500">No employee salaries recorded for this month</p>
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
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total AUD Received from Clients</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.totalAudReceived}
                  onChange={(e) => setFormData({ ...formData, totalAudReceived: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., 15000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Salary (AUD)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.founderSalaryAud}
                  onChange={(e) => setFormData({ ...formData, founderSalaryAud: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., 5000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Cuts/Fees (AUD)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.bankCuts}
                  onChange={(e) => setFormData({ ...formData, bankCuts: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., 200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conversion Rate (AUD to NPR)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.conversionRate}
                  onChange={(e) => setFormData({ ...formData, conversionRate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., 88.50"
                />
                <p className="text-xs text-gray-500 mt-1">1 AUD = ? NPR</p>
              </div>

              {/* Preview Calculation */}
              {calculatePreview() && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Preview</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Available for Employees:</span>
                      <span className="font-medium">
                        ${calculatePreview()!.availableAud.toFixed(2)} AUD = 
                        Rs. {calculatePreview()!.availableNpr.toFixed(2)} NPR
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Employee Salaries Total:</span>
                      <span className="font-medium">Rs. {calculatePreview()!.totalEmployeeSalariesNpr.toFixed(2)} NPR</span>
                    </div>
                    <div className="flex justify-between border-t border-blue-200 pt-2">
                      <span className="text-gray-900 font-semibold">Profit/Loss:</span>
                      <span className={`font-bold ${
                        calculatePreview()!.profitLossAud >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {calculatePreview()!.profitLossAud >= 0 ? '+' : ''}
                        ${calculatePreview()!.profitLossAud.toFixed(2)} AUD
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
                className={`px-4 py-2 rounded-lg ${
                  !useRangeSelector
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Individual Months
              </button>
              <button
                onClick={() => setUseRangeSelector(true)}
                className={`px-4 py-2 rounded-lg ${
                  useRangeSelector
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
                            className={`px-3 py-2 rounded-lg text-sm ${
                              isSelected
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

