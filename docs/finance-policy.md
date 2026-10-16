# Finance & Accounting Policy — InventoryOS (PRD Part R)

## 1. Principles & Deterministic Formulas
Finance and accounting calculations in InventoryOS are deterministic, auditable, and completely decoupled from UI display formatting. AI models and assistants never generate or recalculate authoritative accounting balances. All money values across the database, business logic, and APIs are strictly represented as **integer minor units (paisa)** using 64-bit BigInt (`BIGINT` in PostgreSQL). Floats and rounded decimal approximations are strictly forbidden in transaction records.
- 100 paisa = ৳1.00 BDT
- ৳1,000.00 = 100,000 paisa

---

## 2. Revenue Recognition Policy (PRD R.2)
Product sales revenue is recognized strictly **upon delivery** (`delivered` order status).
- **Pending, confirmed, processing, on-hold, or shipped orders** represent commitments or inventory allocations, NOT earned product sales.
- **Cancelled or failed deliveries** do NOT generate sales revenue.
- Cash collection at the customer doorstep and courier COD remittance settlements are distinct financial events tracked separately from accrual sales recognition.

---

## 3. Financial Statements Formulas (PRD R.3)
### A. Net Product Sales
$$\text{Net Product Sales} = \text{Product Subtotal} - \text{Discounts} - \text{Recognized Reversals}$$

### B. Gross Profit & Margin
$$\text{Gross Profit} = \text{Net Product Sales} - \text{Cost of Goods Sold (COGS)}$$
$$\text{Gross Margin \%} = \frac{\text{Gross Profit}}{\text{Net Product Sales}} \times 100$$

### C. Contribution Margin After Order Costs
$$\text{Contribution} = \text{Gross Profit} - \text{Direct Order-Level Costs}$$
Direct order costs include:
- Courier delivery and return shipping charges
- Packaging material costs (standard ৳20.00 default / custom packaging per order)
- Cash-on-Delivery (COD) gateway/courier commission fees
- Return damage write-downs

### D. Operating Profit (Bottom Line)
$$\text{Operating Profit} = \text{Gross Profit} - \text{Operating Expenses} \pm \text{Other Operating Items}$$
$$\text{Operating Margin \%} = \frac{\text{Operating Profit}}{\text{Net Product Sales}} \times 100$$

### E. Net Cash Movement (Cash-Basis)
$$\text{Net Cash Movement} = \text{Actual Inflows} - \text{Actual Outflows}$$
Accrual-based profit and cash-basis net movement are never mixed in a single KPI.

---

## 4. PRD R.3 Worked Example
| Item | Amount (BDT) | Paisa (Minor Units) | Treatment |
| :--- | :--- | :--- | :--- |
| **Gross Product Sales** | ৳1,000.00 | 100,000 | Inflow / Sale |
| **Discount** | ৳50.00 | 5,000 | Revenue Deduction |
| **Net Product Sales** | **৳950.00** | **95,000** | Net Revenue Recognized |
| **Cost of Goods Sold (COGS)** | ৳500.00 | 50,000 | Outflow / COGS Snapshot |
| **Customer Acquisition** | ৳30.00 | 3,000 | Direct Order Marketing Cost |
| **Courier Delivery Fee** | ৳80.00 | 8,000 | Direct Logistics Outflow |
| **Packaging Cost** | ৳20.00 | 2,000 | Direct Order Packaging |
| **Gross Profit** | **৳450.00** | **45,000** | Net Sales - COGS |
| **Contribution Margin** | **৳320.00** | **32,000** | Gross Profit - (Acquisition + Courier + Packaging) |

*This exact scenario is asserted deterministically in the automated test suite (`packages/shared/src/__tests__/finance-calc.test.ts` & `apps/api/test/unit/finance-service.test.ts`).*

---

## 5. Single-Entry Immutable Ledger Architecture (PRD R.5)
The central financial journal is stored in `financial_transactions`:
- **Immutability:** Once a row is written with `status = 'posted'`, it cannot be updated or deleted.
- **Audit Traceability:** Any corrections, cancellations, or returns must be recorded as an offsetting reversal transaction (`reversal_of` foreign key pointing to the original transaction ID) with inverted direction (`in` $\leftrightarrow$ `out`).
- **Double-Entry Readiness:** Each record contains an optional `account_id` column to map to future chart of accounts without restructuring existing ledger data.

### Transaction Fields
- `tenant_id`: Multi-tenant isolation UUID (enforced by RLS).
- `transaction_number`: Unique human-readable code (e.g. `TXN-SALE-ORD-1001`, `REV-TXN-1001`).
- `type`: `sale`, `cogs`, `courier_fee`, `packaging_cost`, `cod_fee`, `return_cost`, `expense`, `refund`, `adjustment`, `payout`.
- `direction`: `in` (inflow/credit) or `out` (outflow/debit).
- `category`: `revenue`, `cogs`, `order_cost`, `operating_expense`, `settlement`, `refund`, `other`.
- `amount_minor`: Positive 64-bit integer (`BIGINT`) in paisa.
- `currency`: 'BDT' (default).
- `date`: Recognition timestamp with timezone.
- `reference_type`: Entity reference (`order`, `expense`, `return`, `shipment`, `manual`).
- `reference_id`: Target entity ID.
- `reversal_of`: Nullable foreign key self-referencing `financial_transactions.id`.
- `status`: `posted` or `reversed`.

---

## 6. Operating Expenses Policy (PRD R.8)
Non-order overhead expenses are recorded in the `expenses` table:
- **Categories:** `rent`, `utilities`, `marketing`, `packaging_supplies`, `software`, `salaries`, `maintenance`, `courier_equipment`, `office`, `other`.
- **Automatic Ledger Posting:** When an expense is recorded with `payment_status = 'paid'`, the system automatically posts an `operating_expense` transaction to the financial ledger.
- **Draft & Approval:** Unpaid or recurring bill templates create draft entries that do not hit the cash ledger until approved and paid.
