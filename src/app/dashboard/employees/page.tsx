'use client'

import { useEffect, useState } from 'react'
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, updateContractStatus, addPromotion, calculateDaysSinceJoined, updateEmployeeStatus } from '@/lib/firebase'
import { Employee, Promotion } from '@/lib/firebase'
import { format } from 'date-fns'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPromotionModal, setShowPromotionModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showPromotionHistoryModal, setShowPromotionHistoryModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    address: '',
    position: '',
    basicSalary: '',
    currency: 'Rs',
    joiningDate: format(new Date(), 'yyyy-MM-dd'),
    email: '',
    phone: '',
  })

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    setLoading(true)
    const result = await getEmployees()
    if (result.success && result.data) {
      setEmployees(result.data)
    }
    setLoading(false)
  }

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await createEmployee({
      ...formData,
      basicSalary: parseFloat(formData.basicSalary),
      status: 'probation', // Default status for new employees
      contractSent: false,
    })

    if (result.success) {
      setShowAddModal(false)
      resetForm()
      loadEmployees()
    } else {
      alert(result.error || 'Failed to add employee')
    }
  }

  const handleStatusChange = async (employeeId: string, newStatus: 'probation' | 'parttime' | 'fulltime' | 'on notice' | 'fired' | 'resigned') => {
    const result = await updateEmployeeStatus(employeeId, newStatus)
    if (result.success) {
      loadEmployees()
    } else {
      alert(result.error || 'Failed to update employee status')
    }
  }

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmployee?.id) return

    const result = await updateEmployee(selectedEmployee.id, {
      ...formData,
      basicSalary: parseFloat(formData.basicSalary),
    })

    if (result.success) {
      setShowEditModal(false)
      resetForm()
      loadEmployees()
    } else {
      alert(result.error || 'Failed to update employee')
    }
  }

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return

    const result = await deleteEmployee(id)
    if (result.success) {
      loadEmployees()
    } else {
      alert(result.error || 'Failed to delete employee')
    }
  }

  const handleToggleContract = async (employee: Employee) => {
    const result = await updateContractStatus(employee.id!, !employee.contractSent)
    if (result.success) {
      loadEmployees()
    } else {
      alert(result.error || 'Failed to update contract status')
    }
  }

  const handlePromotion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmployee?.id) return

    const form = e.target as HTMLFormElement
    const promotionData: Omit<Promotion, 'id'> = {
      date: (form.querySelector('[name="date"]') as HTMLInputElement).value,
      fromPosition: selectedEmployee.position, // Explicitly store current position as "from"
      toPosition: (form.querySelector('[name="toPosition"]') as HTMLInputElement).value,
      fromSalary: selectedEmployee.basicSalary, // Explicitly store current salary as "from"
      toSalary: parseFloat((form.querySelector('[name="toSalary"]') as HTMLInputElement).value),
      notes: (form.querySelector('[name="notes"]') as HTMLInputElement).value,
    }

    const result = await addPromotion(selectedEmployee.id, promotionData)
    if (result.success) {
      setShowPromotionModal(false)
      setSelectedEmployee(null)
      loadEmployees()
    } else {
      alert(result.error || 'Failed to add promotion')
    }
  }

  const handleImportEmployees = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      const jsonData = JSON.parse(text)
      const employeesToImport = Array.isArray(jsonData) ? jsonData : jsonData.employees || []

      let successCount = 0
      let errorCount = 0

      for (const emp of employeesToImport) {
        // Map old format to new format
        let status: Employee['status'] = 'probation' // Default
        if (emp.status) {
          // Map old statuses to new ones
          if (emp.status === 'active') {
            status = 'fulltime'
          } else if (emp.status === 'inactive') {
            status = 'resigned'
          } else if (['probation', 'parttime', 'fulltime', 'on notice', 'fired', 'resigned'].includes(emp.status)) {
            status = emp.status as Employee['status']
          }
        }
        
        const employeeData = {
          employeeId: emp.employeeId || emp.id || emp.employee_id,
          name: emp.name,
          address: emp.address,
          position: emp.position,
          basicSalary: emp.basicSalary || emp.basic_salary,
          currency: emp.currency || 'Rs',
          joiningDate: emp.joiningDate || emp.joining_date,
          status: status,
          contractSent: emp.contractSent || false,
          email: emp.email || '',
          phone: emp.phone || '',
        }

        const result = await createEmployee(employeeData)
        if (result.success) {
          successCount++
        } else {
          errorCount++
          console.error(`Failed to import ${employeeData.name}:`, result.error)
        }
      }

      alert(`Import completed!\nSuccess: ${successCount}\nFailed: ${errorCount}`)
      setShowImportModal(false)
      loadEmployees()
    } catch (error: any) {
      alert(`Import failed: ${error.message}`)
    } finally {
      setImporting(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const handleLoadDefaultEmployees = async () => {
    setImporting(true)
    try {
      const response = await fetch('/employees-import.json')
      const employeesToImport = await response.json()

      let successCount = 0
      let errorCount = 0

      for (const emp of employeesToImport) {
        const result = await createEmployee(emp)
        if (result.success) {
          successCount++
        } else {
          errorCount++
        }
      }

      alert(`Import completed!\nSuccess: ${successCount}\nFailed: ${errorCount}`)
      setShowImportModal(false)
      loadEmployees()
    } catch (error: any) {
      alert(`Import failed: ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      employeeId: '',
      name: '',
      address: '',
      position: '',
      basicSalary: '',
      currency: 'Rs',
      joiningDate: format(new Date(), 'yyyy-MM-dd'),
      email: '',
      phone: '',
    })
    setSelectedEmployee(null)
  }

  const openEditModal = (employee: Employee) => {
    setSelectedEmployee(employee)
    setFormData({
      employeeId: employee.employeeId,
      name: employee.name,
      address: employee.address,
      position: employee.position,
      basicSalary: employee.basicSalary.toString(),
      currency: employee.currency,
      joiningDate: employee.joiningDate,
      email: employee.email || '',
      phone: employee.phone || '',
    })
    setShowEditModal(true)
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
          <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-600 mt-2">Manage employee information and onboarding</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Import
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Add Employee
          </button>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
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
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days Since Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Salary
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contract
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Promotions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => {
                const daysSinceJoined = calculateDaysSinceJoined(employee.joiningDate)
                return (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                        <div className="text-sm text-gray-500">{employee.employeeId}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{employee.position}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={employee.status}
                        onChange={(e) => handleStatusChange(employee.id!, e.target.value as Employee['status'])}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border-none focus:ring-2 focus:ring-primary-500 cursor-pointer ${
                          employee.status === 'probation'
                            ? 'bg-yellow-100 text-yellow-800'
                            : employee.status === 'parttime'
                            ? 'bg-blue-100 text-blue-800'
                            : employee.status === 'fulltime'
                            ? 'bg-green-100 text-green-800'
                            : employee.status === 'on notice'
                            ? 'bg-orange-100 text-orange-800'
                            : employee.status === 'fired'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <option value="probation">Probation</option>
                        <option value="parttime">Part Time</option>
                        <option value="fulltime">Full Time</option>
                        <option value="on notice">On Notice</option>
                        <option value="fired">Fired</option>
                        <option value="resigned">Resigned</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{daysSinceJoined} days</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {employee.currency} {employee.basicSalary.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleContract(employee)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          employee.contractSent
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {employee.contractSent ? 'Sent' : 'Not Sent'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee)
                          setShowPromotionHistoryModal(true)
                        }}
                        className="text-sm text-primary-600 hover:text-primary-900 font-medium"
                      >
                        {employee.promotions?.length || 0} {employee.promotions?.length === 1 ? 'promotion' : 'promotions'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setSelectedEmployee(employee)
                            setShowPromotionModal(true)
                          }}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          Promote
                        </button>
                        <button
                          onClick={() => openEditModal(employee)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(employee.id!)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add Employee</h2>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input
                  type="text"
                  required
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <input
                  type="text"
                  required
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary</label>
                <input
                  type="number"
                  required
                  value={formData.basicSalary}
                  onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date</label>
                <input
                  type="date"
                  required
                  value={formData.joiningDate}
                  onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
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
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Edit Employee</h2>
            <form onSubmit={handleUpdateEmployee} className="space-y-4">
              {/* Same form fields as Add Modal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input
                  type="text"
                  required
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <input
                  type="text"
                  required
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary</label>
                <input
                  type="number"
                  required
                  value={formData.basicSalary}
                  onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
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
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Promotion Modal */}
      {showPromotionModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add Promotion</h2>
            <form onSubmit={handlePromotion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Position</label>
                <input
                  type="text"
                  value={selectedEmployee.position}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">Current position</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Position</label>
                <input
                  type="text"
                  name="toPosition"
                  required
                  placeholder="Enter new position"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Salary</label>
                <input
                  type="number"
                  value={selectedEmployee.basicSalary}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">Current salary</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Salary</label>
                <input
                  type="number"
                  name="toSalary"
                  required
                  min={selectedEmployee.basicSalary}
                  placeholder="Enter new salary"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPromotionModal(false)
                    setSelectedEmployee(null)
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Add Promotion
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
            <h2 className="text-xl font-bold mb-4">Import Employees</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload JSON File
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportEmployees}
                  disabled={importing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Select a JSON file with employee data
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
                onClick={handleLoadDefaultEmployees}
                disabled={importing}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Importing...</span>
                  </>
                ) : (
                  <span>Load Default Employees</span>
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

      {/* Promotion History Modal */}
      {showPromotionHistoryModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Promotion History</h2>
              <button
                onClick={() => {
                  setShowPromotionHistoryModal(false)
                  setSelectedEmployee(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-700">Employee: {selectedEmployee.name}</p>
              <p className="text-sm text-gray-500">{selectedEmployee.employeeId}</p>
            </div>
            {selectedEmployee.promotions && selectedEmployee.promotions.length > 0 ? (
              <div className="space-y-4">
                {selectedEmployee.promotions
                  .sort((a, b) => {
                    // Sort by date, newest first
                    let dateA: Date
                    let dateB: Date
                    
                    if (a.date) {
                      dateA = new Date(a.date)
                    } else if (a.createdAt) {
                      dateA = typeof a.createdAt === 'object' && 'toDate' in a.createdAt
                        ? (a.createdAt as any).toDate()
                        : new Date(a.createdAt as any)
                    } else {
                      dateA = new Date(0)
                    }
                    
                    if (b.date) {
                      dateB = new Date(b.date)
                    } else if (b.createdAt) {
                      dateB = typeof b.createdAt === 'object' && 'toDate' in b.createdAt
                        ? (b.createdAt as any).toDate()
                        : new Date(b.createdAt as any)
                    } else {
                      dateB = new Date(0)
                    }
                    
                    return dateB.getTime() - dateA.getTime()
                  })
                  .map((promotion, index) => {
                    // Handle date conversion - support both string dates and Firestore timestamps
                    let promotionDate: Date
                    if (promotion.date) {
                      promotionDate = new Date(promotion.date)
                    } else if (promotion.createdAt) {
                      // Handle Firestore timestamp
                      if (typeof promotion.createdAt === 'object' && 'toDate' in promotion.createdAt) {
                        promotionDate = (promotion.createdAt as any).toDate()
                      } else {
                        promotionDate = new Date(promotion.createdAt as any)
                      }
                    } else {
                      promotionDate = new Date()
                    }
                    
                    return (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                                Promotion #{selectedEmployee.promotions!.length - index}
                              </span>
                              <span className="text-sm text-gray-500">
                                {format(promotionDate, 'MMM dd, yyyy')}
                              </span>
                            </div>
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="text-xs text-gray-500 block mb-1">From Position</span>
                                  <span className="text-sm font-medium text-gray-700">{promotion.fromPosition}</span>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 block mb-1">To Position</span>
                                  <span className="text-sm font-medium text-primary-600">{promotion.toPosition}</span>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="text-xs text-gray-500 block mb-1">From Salary</span>
                                  <span className="text-sm font-medium text-gray-700">
                                    Rs. {promotion.fromSalary.toLocaleString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 block mb-1">To Salary</span>
                                  <span className="text-sm font-medium text-green-600">
                                    Rs. {promotion.toSalary.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                              {promotion.notes && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <span className="text-xs text-gray-500">Notes:</span>
                                  <p className="text-sm text-gray-700 mt-1">{promotion.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-4 text-sm text-gray-500">No promotions recorded yet</p>
                <button
                  onClick={() => {
                    setShowPromotionHistoryModal(false)
                    setShowPromotionModal(true)
                  }}
                  className="mt-4 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Add First Promotion
                </button>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowPromotionHistoryModal(false)
                  setSelectedEmployee(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

