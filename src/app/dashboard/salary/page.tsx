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
  const [formData, setFormData] = useState({
    employeeId: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    amount: '',
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

  const handleGeneratePayslip = async (record: SalaryRecord) => {
    const employee = employees.find((e) => e.employeeId === record.employeeId)
    if (!employee) {
      alert('Employee not found')
      return
    }
    downloadPayslip(employee, record)
  }

  const handlePreviewPayslip = async (record: SalaryRecord) => {
    const employee = employees.find((e) => e.employeeId === record.employeeId)
    if (!employee) {
      alert('Employee not found')
      return
    }
    previewPayslip(employee, record)
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

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
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Add Salary Record
        </button>
      </div>

      {/* Salary Records Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
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
              {salaryRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{record.employeeName}</div>
                    <div className="text-sm text-gray-500">{record.employeeId}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {monthNames[record.month - 1]} {record.year}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
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
                        onClick={() => handleGeneratePayslip(record)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        Download PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {salaryRecords.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No salary records found</p>
            </div>
          )}
        </div>
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
    </div>
  )
}

