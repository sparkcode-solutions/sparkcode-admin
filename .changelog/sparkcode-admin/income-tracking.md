## 2025-11-05

### Files Changed
- src/lib/firebase.ts
- src/types/index.ts
- src/app/dashboard/income/page.tsx (new)

### Feature
Income Tracking - Client payment tracking with AUD to NPR conversion and profit/loss calculation

### Summary
Implemented a comprehensive income tracking system that allows the founder to track client payments in AUD, manage currency conversion to NPR for employee salaries, account for bank fees, and calculate profit/loss across multiple months.

Key data model addition:
```ts
export interface IncomeRecord {
  month: number;
  year: number;
  totalAudReceived: number;
  founderSalaryAud: number;
  conversionRate: number; // AUD to NPR
  bankCuts: number; // in AUD
  totalEmployeeSalariesNpr: number;
  profitLossAud: number;
}
```

Core calculation logic:
```ts
const availableAud = totalAud - founderSalary - bankCuts;
const availableNpr = availableAud * conversionRate;
const profitLossAud = (availableNpr - totalEmployeeSalariesNpr) / conversionRate;
```

### Affected Components

**Firebase (src/lib/firebase.ts)**
- Added `IncomeRecord` interface
- Added `incomeRecords` collection to collections object
- Created CRUD operations: `createIncomeRecord`, `getIncomeRecords`, `getIncomeRecordsByMonths`, `updateIncomeRecord`, `deleteIncomeRecord`
- Includes duplicate prevention for month/year combinations

**Types (src/types/index.ts)**
- Exported `IncomeRecord` type for use across components

**Income Page (src/app/dashboard/income/page.tsx)**
- New page component with comprehensive income tracking features
- Founder section displaying salary in AUD only (hardcoded email check)
- Employee salary breakdown with NPR amounts and AUD equivalents
- Multi-month selector supporting both individual month selection and date ranges
- Add income modal with real-time profit/loss preview
- Automated calculations:
  * Currency conversion (AUD to NPR)
  * Bank cuts tracking
  * Employee salary aggregation
  * Profit/loss calculation
- Visual indicators: profit in green, loss in red
- Monthly grouping with expandable employee details
- Delete functionality for income records

### Key Features
1. **Founder Identification**: Hardcoded email check for founder badge and separate display
2. **Currency Management**: Manual conversion rate input stored per record for historical accuracy
3. **Multi-Month Selection**: Two modes - individual month checkboxes and date range picker
4. **Real-time Calculations**: Preview profit/loss before saving income records
5. **Bank Fee Tracking**: Separate field for bank cuts/transfer fees in AUD
6. **Historical Accuracy**: Each record stores its own conversion rate for accurate historical data
7. **Employee Salary Mapping**: Automatic aggregation of employee salaries for profit/loss calculation

### Dependencies
- Existing employee and salary record systems from Firebase
- AuthContext for user authentication and founder identification
- date-fns for date formatting

