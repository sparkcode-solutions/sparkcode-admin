'use client'

import { useEffect, useState } from 'react'
import { getSalaryRecords, createSalaryRecord, getEmployees, getEmployeeById } from '@/lib/firebase'
import { SalaryRecord, Employee } from '@/lib/firebase'
import { downloadPayslip, previewPayslip } from '@/lib/payslip'
import { format } from 'date-fns'

export default function SalaryPage() {
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showBackfillModal, setShowBackfillModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [formData, setFormData] = useState({
    employeeId: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    amount: '',
    paymentDate: format(new Date(), 'yyyy-MM-dd'),
  })
  const [backfillData, setBackfillData] = useState({
    employeeId: '',
    startMonth: 1,
    endMonth: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    paymentDate: format(new Date(), 'yyyy-MM-dd'),
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [recordsResult, employeesResult] = await Promise.all([
      getSalaryRecords(),
      getEmployees(),
    ])

    if (recordsResult.success && recordsResult.data) {
      setSalaryRecords(recordsResult.data)
    }
    if (employeesResult.success && employeesResult.data) {
      setEmployees(employeesResult.data)
    }
    setLoading(false)
  }

  const handleAddSalaryRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    const employee = employees.find((e) => e.employeeId === formData.employeeId)
    if (!employee) {
      alert('Employee not found')
      return
    }

    const result = await createSalaryRecord({
      employeeId: formData.employeeId,
      employeeName: employee.name,
      month: formData.month,
      year: formData.year,
      amount: parseFloat(formData.amount),
      paymentDate: formData.paymentDate,
      status: 'paid',
    })

    if (result.success) {
      setShowAddModal(false)
      setFormData({
        employeeId: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        amount: '',
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
      })
      loadData()
    } else {
      alert(result.error || 'Failed to add salary record')
    }
  }

  const handlePreviewPayslip = async (record: SalaryRecord) => {
    const employee = employees.find((e) => e.employeeId === record.employeeId)
    if (!employee) {
      alert('Employee not found')
      return
    }
    previewPayslip(employee, record)
  }

  const handleCreatePayslip = async (record: SalaryRecord) => {
    const employee = employees.find((e) => e.employeeId === record.employeeId)
    if (!employee) {
      alert('Employee not found')
      return
    }
    downloadPayslip(employee, record)
  }

  const handleImportSalaryRecords = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      const jsonData = JSON.parse(text)
      const recordsToImport = Array.isArray(jsonData) ? jsonData : jsonData.payments || []

      let successCount = 0
      let errorCount = 0

      for (const record of recordsToImport) {
        const salaryData = {
          employeeId: record.employeeId || record.employee_id,
          employeeName: record.employeeName || record.employee_name,
          month: record.month,
          year: record.year,
          amount: record.amount,
          paymentDate: record.paymentDate || record.payment_date || new Date().toISOString().split('T')[0],
          status: record.status || 'paid',
        }

        // Check if record already exists
        const exists = salaryRecords.some(
          (r) => r.employeeId === salaryData.employeeId &&
                 r.month === salaryData.month &&
                 r.year === salaryData.year
        )

        if (exists) {
          errorCount++
          continue
        }

        const result = await createSalaryRecord(salaryData)
        if (result.success) {
          successCount++
        } else {
          errorCount++
          console.error(`Failed to import record:`, result.error)
        }
      }

      alert(`Import completed!\nSuccess: ${successCount}\nFailed: ${errorCount}`)
      setShowImportModal(false)
      loadData()
    } catch (error: any) {
      alert(`Import failed: ${error.message}`)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleLoadDefaultSalaryRecords = async () => {
    setImporting(true)
    try {
      const response = await fetch('/salary-import.json')
      const recordsToImport = await response.json()

      let successCount = 0
      let errorCount = 0

      for (const record of recordsToImport) {
        // Check if record already exists
        const exists = salaryRecords.some(
          (r) => r.employeeId === record.employeeId &&
                 r.month === record.month &&
                 r.year === record.year
        )

        if (exists) {
          errorCount++
          continue
        }

        const result = await createSalaryRecord(record)
        if (result.success) {
          successCount++
        } else {
          errorCount++
        }
      }

      alert(`Import completed!\nSuccess: ${successCount}\nFailed: ${errorCount}`)
      setShowImportModal(false)
      loadData()
    } catch (error: any) {
      alert(`Import failed: ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  const handleBackfill = async (e: React.FormEvent) => {
    e.preventDefault()
    const employee = employees.find((e) => e.employeeId === backfillData.employeeId)
    if (!employee) {
      alert('Employee not found')
      return
    }

    setBackfilling(true)
    try {
      const startMonth = backfillData.startMonth
      const endMonth = backfillData.endMonth
      const year = backfillData.year

      let successCount = 0
      let errorCount = 0

      for (let month = startMonth; month <= endMonth; month++) {
        // Check if record already exists
        const exists = salaryRecords.some(
          (r) => r.employeeId === employee.employeeId &&
                 r.month === month &&
                 r.year === year
        )

        if (exists) {
          errorCount++
          continue
        }

        const result = await createSalaryRecord({
          employeeId: employee.employeeId,
          employeeName: employee.name,
          month: month,
          year: year,
          amount: employee.basicSalary,
          paymentDate: backfillData.paymentDate,
          status: 'paid',
        })

        if (result.success) {
          successCount++
        } else {
          errorCount++
        }
      }

      alert(`Backfill completed!\nSuccess: ${successCount}\nFailed: ${errorCount}`)
      setShowBackfillModal(false)
      setBackfillData({
        employeeId: '',
        startMonth: 1,
        endMonth: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
      })
      loadData()
    } catch (error: any) {
      alert(`Backfill failed: ${error.message}`)
    } finally {
      setBackfilling(false)
    }
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  // Group salary records by employee
  const groupedByEmployee = employees.reduce((acc, employee) => {
    const employeeRecords = salaryRecords
      .filter(record => record.employeeId === employee.employeeId)
      .sort((a, b) => {
        // Sort by payment date, newest first
        const dateA = new Date(a.paymentDate).getTime()
        const dateB = new Date(b.paymentDate).getTime()
        return dateB - dateA
      })
    
    // Include all employees, even if they have no records
    acc[employee.employeeId] = {
      employee,
      records: employeeRecords
    }
    
    return acc
  }, {} as Record<string, { employee: Employee; records: SalaryRecord[] }>)

  const handleCreatePayslip = async (record: SalaryRecord) => {
    const employee = employees.find((e) => e.employeeId === record.employeeId)
    if (!employee) {
      alert('Employee not found')
      return
    }
    downloadPayslip(employee, record)
  }

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
          <h1 className="text-3xl font-bold text-gray-900">Salary Records</h1>
          <p className="text-gray-600 mt-2">Manage employee salary payments and generate payslips</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Import
          </button>
          <button
            onClick={() => setShowBackfillModal(true)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Backfill
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Add Salary Record
          </button>
        </div>
      </div>

      {/* Employees and Salary Breakdown */}
      <div className="space-y-4">
        {Object.values(groupedByEmployee).map(({ employee, records }) => (
          <div key={employee.id} className="bg-white rounded-lg shadow overflow-hidden">
            {/* Employee Header */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{employee.name}</h3>
                  <p className="text-sm text-gray-600">{employee.employeeId} • {employee.position}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Records</p>
                  <p className="text-lg font-semibold text-gray-900">{records.length}</p>
                </div>
              </div>
            </div>

            {/* Salary Records */}
            {records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Period
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {monthNames[record.month - 1]} {record.year}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            Rs. {record.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {format(new Date(record.paymentDate), 'MMM dd, yyyy')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              record.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {record.status === 'paid' ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handlePreviewPayslip(record)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Preview
                            </button>
                            <button
                              onClick={() => handleCreatePayslip(record)}
                              className="px-3 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs"
                            >
                              Create Payslip
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-8 text-center">
                <p className="text-gray-500">No salary records found for this employee</p>
              </div>
            )}
          </div>
        ))}

        {Object.keys(groupedByEmployee).length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No employees with salary records found</p>
          </div>
        )}
      </div>

      {/* Add Salary Record Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add Salary Record</h2>
            <form onSubmit={handleAddSalaryRecord} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <select
                  required
                  value={formData.employeeId}
                  onChange={(e) => {
                    const employee = employees.find((emp) => emp.employeeId === e.target.value)
                    setFormData({
                      ...formData,
                      employeeId: e.target.value,
                      amount: employee?.basicSalary.toString() || '',
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.employeeId}>
                      {employee.name} ({employee.employeeId})
                    </option>
                  ))}
                </select>
              </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Add Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Import Salary Records</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload JSON File
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportSalaryRecords}
                  disabled={importing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Select a JSON file with salary records
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>
              <button
                onClick={handleLoadDefaultSalaryRecords}
                disabled={importing}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Importing...</span>
                  </>
                ) : (
                  <span>Load Default Salary Records</span>
                )}
              </button>
              <button
                onClick={() => setShowImportModal(false)}
                disabled={importing}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backfill Modal */}
      {showBackfillModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Backfill Salary Records</h2>
            <p className="text-sm text-gray-600 mb-4">
              Create salary records for multiple months for an employee. Records that already exist will be skipped.
            </p>
            <form onSubmit={handleBackfill} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <select
                  required
                  value={backfillData.employeeId}
                  onChange={(e) => setBackfillData({ ...backfillData, employeeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.employeeId}>
                      {employee.name} ({employee.employeeId})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input
                  type="number"
                  required
                  value={backfillData.year}
                  onChange={(e) => setBackfillData({ ...backfillData, year: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Month</label>
                  <select
                    required
                    value={backfillData.startMonth}
                    onChange={(e) => setBackfillData({ ...backfillData, startMonth: parseInt(e.target.value) })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Month</label>
                  <select
                    required
                    value={backfillData.endMonth}
                    onChange={(e) => setBackfillData({ ...backfillData, endMonth: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {monthNames.map((month, index) => (
                      <option key={index} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={backfillData.paymentDate}
                  onChange={(e) => setBackfillData({ ...backfillData, paymentDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowBackfillModal(false)}
                  disabled={backfilling}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={backfilling}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {backfilling ? (
                    <>
                      <div className="w-4 h-4 mr-2 animate-spin border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Backfilling...</span>
                    </>
                  ) : (
                    <span>Backfill</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

