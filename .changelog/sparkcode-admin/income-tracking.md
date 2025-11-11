## 2025-11-06

### Files Changed
- src/lib/firebase.ts
- src/types/index.ts
- src/app/dashboard/income/page.tsx (new)
- src/app/dashboard/layout.tsx

### Feature
Income Tracking - Client payment tracking with AUD to NPR conversion and profit/loss calculation

### Update 2025-11-06
Changed bank cuts/fees to be in NPR instead of AUD, reflecting local bank charges

### Update 2025-11-06 (Part 2)
Updated salary calculation logic to:
- Only include employees who joined on or before the target month
- Calculate salaries based on promotion dates (not payment dates)
- If promotion happens in September, September uses old salary, October uses new salary
- Removed dependency on salary records for income calculations

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
  bankCutsNpr: number; // in NPR (local bank fees)
  totalEmployeeSalariesNpr: number;
  profitLossAud: number;
}
```

Core calculation logic:
```ts
const availableAud = totalAud - founderSalary;
const availableNpr = (availableAud * conversionRate) - bankCutsNpr;
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
  * Bank cuts tracking (NPR - local bank fees)
  * Employee salary aggregation based on promotion dates and join dates
  * Profit/loss calculation (accounts for conversion and bank fees)
- Salary calculation logic:
  * Only includes employees who joined on or before the target month
  * Calculates salary based on promotion dates (promotion in September = old salary for September, new salary from October)
  * Does not rely on salary records, calculates from employee data and promotion history
- Visual indicators: profit in green, loss in red
- Monthly grouping with expandable employee details
- Delete functionality for income records

**Navigation (src/app/dashboard/layout.tsx)**
- Added "Income Tracking" link to the sidebar navigation
- Page now accessible from `/dashboard/income`

### Key Features
1. **Founder Identification**: Hardcoded email check for founder badge and separate display
2. **Currency Management**: Manual conversion rate input stored per record for historical accuracy
3. **Multi-Month Selection**: Two modes - individual month checkboxes and date range picker
4. **Real-time Calculations**: Preview profit/loss before saving income records
5. **Bank Fee Tracking**: Separate field for local bank cuts/transfer fees in NPR
6. **Historical Accuracy**: Each record stores its own conversion rate for accurate historical data
7. **Employee Salary Mapping**: Automatic aggregation of employee salaries for profit/loss calculation

### Dependencies
- Existing employee and salary record systems from Firebase
- AuthContext for user authentication and founder identification
- date-fns for date formatting

## 2025-01-27

### Files Changed
- src/lib/firebase.ts
- src/app/dashboard/income/page.tsx
- src/app/dashboard/page.tsx
- src/types/index.ts
- package.json

### Feature
Income Record Modal - Enhanced with multi-currency support and employee payments tracking

### Summary
Enhanced the income record modal to support multiple currency types (AUD, USD, NPR) with comprehensive profit/loss calculations. Added support for tracking employee payments with individual amounts and charges. Implemented automatic calculation of hidden bank cuts and profit/loss in all three currencies.

Key changes:
- Added new fields: `originalAudSalary`, `usdAmount`, `usdRate`, `nprReceived`, `bankCutsKnown`, `bankCutsHidden`, `employeePayments[]`
- Added profit/loss calculations in NPR, AUD, and USD
- Added employee payments section with dynamic rows for name, amount, and charges
- Added profit/loss charts to dashboard (line chart for NPR trend, bar chart for AUD/USD comparison)
- Maintained backward compatibility with legacy income record format

```ts
+ export interface EmployeePayment {
+   employeeName: string;
+   amount: number;
+   charges: number;
+ }
```

### Affected Components
- `IncomeRecord` interface (new fields added)
- Income modal form (completely redesigned)
- Dashboard page (added profit/loss charts using recharts)
- Income record display (updated to show new fields)

### Update 2025-01-27
Changed employee name input in employee payments section to dropdown select populated from employees list
