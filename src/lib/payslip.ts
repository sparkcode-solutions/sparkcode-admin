import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Employee, SalaryRecord } from '@/lib/firebase'
import { COMPANY_INFO } from '@/types'

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

export const generatePayslip = async (employee: Employee, salaryRecord: SalaryRecord) => {
  // Calculate the correct salary based on promotion dates, not the amount in salaryRecord
  // This ensures payslips show the correct salary even if salary records were backfilled incorrectly
  const correctSalary = getEmployeeSalaryForMonth(employee, salaryRecord.month, salaryRecord.year)
  
  const doc = new jsPDF()
  
  // Page setup
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  
  let yPos = margin
  
  // Header - Company name and info
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  const companyNameY = yPos
  doc.text(COMPANY_INFO.name, margin, companyNameY)
  
  // Load and add logo if available - aligned with company name
  if (COMPANY_INFO.logoPath) {
    try {
      // Convert logo to base64 data URL
      const logoResponse = await fetch(COMPANY_INFO.logoPath)
      const logoBlob = await logoResponse.blob()
      const logoDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(logoBlob)
      })
      
      // Calculate logo size (bigger) and align vertically with company name
      const logoHeight = 35 // Increased size
      const logoWidth = logoHeight * 1.0
      const logoX = pageWidth - margin - logoWidth
      
      // Align logo vertically with company name (font size 24 has ~7mm height)
      // Center the logo vertically with the text
      const textHeight = 7 // Approximate height of 24pt font
      const logoY = companyNameY - (logoHeight - textHeight) / 2
      
      doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoWidth, logoHeight)
    } catch (error) {
      console.warn('Failed to load logo:', error)
      // Continue without logo if loading fails
    }
  }
  
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
  
  // Salary Details Table - Use calculated salary instead of salaryRecord.amount
  const tableData = [
    ['EARNINGS', ''],
    ['Basic Salary', `Rs. ${correctSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['Total Earnings', `Rs. ${correctSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['', ''],
    ['DEDUCTIONS', ''],
    ['Total Deductions', 'Rs. 0.00'],
    ['', ''],
    ['NET SALARY', `Rs. ${correctSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
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
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    columnStyles: {
      0: { halign: 'left', cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 'auto' },
    },
    didParseCell: (data: any) => {
      // Note: data.row.index includes the header row, so body rows start at index 1
      // Row indices: 0=header, 1=EARNINGS, 2=Basic Salary, 3=Total Earnings, 4=empty, 
      //              5=DEDUCTIONS, 6=Total Deductions, 7=empty, 8=NET SALARY
      
      // Style EARNINGS and Total Earnings rows (rows 1 and 3)
      if (data.row.index === 1 || data.row.index === 3) {
        data.cell.styles.fontStyle = 'bold'
      }
      // Style net salary row (row 8)
      if (data.row.index === 8) {
        data.cell.styles.fillColor = [212, 237, 218]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fontSize = 12
        data.cell.styles.textColor = [0, 0, 0] // Ensure text is black on green background
      }
      // Style empty rows (rows 4 and 7)
      if (data.row.index === 4 || data.row.index === 7) {
        data.cell.styles.fillColor = [255, 255, 255]
      }
      // Style DEDUCTIONS row (row 5)
      if (data.row.index === 5) {
        data.cell.styles.fontStyle = 'bold'
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

export const downloadPayslip = async (employee: Employee, salaryRecord: SalaryRecord) => {
  const doc = await generatePayslip(employee, salaryRecord)
  const fileName = `Payslip_${employee.employeeId}_${salaryRecord.year}_${String(salaryRecord.month).padStart(2, '0')}.pdf`
  doc.save(fileName)
}

export const previewPayslip = async (employee: Employee, salaryRecord: SalaryRecord) => {
  const doc = await generatePayslip(employee, salaryRecord)
  doc.output('dataurlnewwindow')
}
