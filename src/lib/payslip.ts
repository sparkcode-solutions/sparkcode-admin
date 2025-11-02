import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Employee, SalaryRecord } from '@/lib/firebase'
import { COMPANY_INFO } from '@/types'

export const generatePayslip = (employee: Employee, salaryRecord: SalaryRecord) => {
  const doc = new jsPDF()
  
  // Page setup
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  
  let yPos = margin
  
  // Header
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text(COMPANY_INFO.name, margin, yPos)
  
  yPos += 10
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(COMPANY_INFO.address, margin, yPos)
  yPos += 5
  doc.text(`PAN No: ${COMPANY_INFO.panNo}`, margin, yPos)
  yPos += 5
  doc.text(`Email: ${COMPANY_INFO.email}`, margin, yPos)
  yPos += 5
  doc.text(`Phone: ${COMPANY_INFO.phone}`, margin, yPos)
  
  // Title
  yPos += 15
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('SALARY SLIP', pageWidth / 2, yPos, { align: 'center' })
  
  // Employee and Period Info
  yPos += 15
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const paymentDate = new Date(salaryRecord.paymentDate)
  const monthName = monthNames[salaryRecord.month - 1]
  
  // Employee Info Box
  doc.setFillColor(245, 245, 245)
  doc.rect(margin, yPos, contentWidth / 2 - 5, 40, 'F')
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Employee Information:', margin + 5, yPos + 8)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Name: ${employee.name}`, margin + 5, yPos + 15)
  doc.text(`Address: ${employee.address}`, margin + 5, yPos + 22)
  if (employee.position) {
    doc.text(`Position: ${employee.position}`, margin + 5, yPos + 29)
  }
  
  // Period Info Box
  doc.setFillColor(245, 245, 245)
  doc.rect(margin + contentWidth / 2 + 5, yPos, contentWidth / 2 - 5, 40, 'F')
  
  doc.setFont('helvetica', 'bold')
  doc.text('Pay Period:', margin + contentWidth / 2 + 10, yPos + 8)
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Month: ${monthName} ${salaryRecord.year}`, margin + contentWidth / 2 + 10, yPos + 15)
  doc.text(`Pay Date: ${paymentDate.toLocaleDateString()}`, margin + contentWidth / 2 + 10, yPos + 22)
  doc.text(`Employee ID: ${employee.employeeId}`, margin + contentWidth / 2 + 10, yPos + 29)
  
  yPos += 50
  
  // Salary Details Table
  const tableData = [
    ['EARNINGS', ''],
    ['Basic Salary', `Rs. ${salaryRecord.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['Total Earnings', `Rs. ${salaryRecord.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['', ''],
    ['DEDUCTIONS', ''],
    ['Total Deductions', 'Rs. 0.00'],
    ['', ''],
    ['NET SALARY', `Rs. ${salaryRecord.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
  ]
  
  autoTable(doc, {
    startY: yPos,
    head: [['Description', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    bodyStyles: {
      textColor: [0, 0, 0],
    },
    styles: {
      fontSize: 10,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 140 },
      1: { halign: 'right', cellWidth: 60 },
    },
    didParseCell: (data: any) => {
      // Style earnings row
      if (data.row.index === 0 || data.row.index === 2) {
        data.cell.styles.fontStyle = 'bold'
      }
      // Style net salary row
      if (data.row.index === 7) {
        data.cell.styles.fillColor = [212, 237, 218]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fontSize = 12
      }
      // Style empty rows
      if (data.row.index === 3 || data.row.index === 6) {
        data.cell.styles.fillColor = [255, 255, 255]
      }
    },
  })
  
  const finalY = (doc as any).lastAutoTable?.finalY || yPos + 80
  
  // Footer
  yPos = finalY + 20
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(102, 102, 102)
  doc.text(
    `Generated on: ${new Date().toLocaleString()} | This is a computer-generated payslip.`,
    pageWidth / 2,
    yPos,
    { align: 'center' }
  )
  yPos += 5
  doc.text(
    'All amounts are in Nepalese currency unless stated.',
    pageWidth / 2,
    yPos,
    { align: 'center' }
  )
  
  return doc
}

export const downloadPayslip = (employee: Employee, salaryRecord: SalaryRecord) => {
  const doc = generatePayslip(employee, salaryRecord)
  const fileName = `Payslip_${employee.employeeId}_${salaryRecord.year}_${String(salaryRecord.month).padStart(2, '0')}.pdf`
  doc.save(fileName)
}

export const previewPayslip = (employee: Employee, salaryRecord: SalaryRecord) => {
  const doc = generatePayslip(employee, salaryRecord)
  doc.output('dataurlnewwindow')
}

