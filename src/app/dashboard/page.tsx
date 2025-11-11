'use client'

import { useEffect, useState } from 'react'
import { getEmployees, calculateDaysSinceJoined, getIncomeRecords } from '@/lib/firebase'
import { Employee, IncomeRecord } from '@/lib/firebase'
import Link from 'next/link'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function DashboardPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([])
  const [loading, setLoading] = useState(true)

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

  const stats = {
    totalEmployees: employees.length,
    activeEmployees: employees.filter((e) => e.status === 'active').length,
    contractsPending: employees.filter((e) => !e.contractSent).length,
    averageDays: employees.length > 0
      ? Math.round(
          employees.reduce(
            (sum, e) => sum + calculateDaysSinceJoined(e.joiningDate),
            0
          ) / employees.length
        )
      : 0,
  }

  // Prepare chart data for profit/loss
  const chartData = incomeRecords
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })
    .map(record => ({
      month: `${new Date(record.year, record.month - 1).toLocaleString('default', { month: 'short' })} ${record.year}`,
      profitLossNpr: record.profitLossNpr || 0,
      profitLossAud: record.profitLossAud || 0,
      profitLossUsd: record.profitLossUsd || 0,
    }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Overview of your employee management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Employees</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalEmployees}</p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Employees</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.activeEmployees}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Contracts Pending</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.contractsPending}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Days Since Joined</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.averageDays}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Profit/Loss Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Profit/Loss Trend (NPR)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value: number) => `Rs. ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="profitLossNpr" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Profit/Loss (NPR)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Profit/Loss Comparison</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value: number, name: string) => {
                  if (name === 'profitLossAud') return `$${value.toFixed(2)} AUD`
                  if (name === 'profitLossUsd') return `$${value.toFixed(2)} USD`
                  return `Rs. ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }} />
                <Legend />
                <Bar dataKey="profitLossAud" fill="#10b981" name="Profit/Loss (AUD)" />
                <Bar dataKey="profitLossUsd" fill="#f59e0b" name="Profit/Loss (USD)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Employees */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Recent Employees</h2>
            <Link
              href="/dashboard/employees"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View all →
            </Link>
          </div>
        </div>
        <div className="p-6">
          {employees.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No employees found</p>
          ) : (
            <div className="space-y-4">
              {employees.slice(0, 5).map((employee) => {
                const daysSinceJoined = calculateDaysSinceJoined(employee.joiningDate)
                return (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{employee.name}</p>
                      <p className="text-sm text-gray-600">{employee.position}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Joined {daysSinceJoined} days ago
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        Rs. {employee.basicSalary.toLocaleString()}
                      </p>
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded-full ${
                          employee.contractSent
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {employee.contractSent ? 'Contract Sent' : 'Pending'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

