# KPI Definitions — InventoryOS

## 1. Executive & Financial KPIs

### Net Product Sales (Revenue)
- **Definition:** The earned revenue from goods successfully delivered to customers during the selected time period.
- **Formula:**
  $$\text{Net Sales} = \sum \text{Product Subtotal of Delivered Orders} - \sum \text{Discounts} - \sum \text{Sales Reversals}$$
- **Timing:** Recognized strictly at the moment order status transitions to `delivered`.
- **Unit:** Bangladeshi Taka (৳), stored in integer paisa.

### Cost of Goods Sold (COGS)
- **Definition:** The inventory cost incurred to produce or acquire the products delivered to customers.
- **Formula:**
  $$\text{COGS} = \sum (\text{Delivered Item Quantity} \times \text{Historical Unit Cost Snapshot})$$
- **Unit:** Stored in integer paisa.

### Gross Profit & Gross Margin %
- **Definition:** Earnings generated from product sales after deducting the direct production/acquisition costs.
- **Formula:**
  $$\text{Gross Profit} = \text{Net Product Sales} - \text{COGS}$$
  $$\text{Gross Margin \%} = \left(\frac{\text{Gross Profit}}{\text{Net Product Sales}}\right) \times 100$$
- **Precision:** 2 decimal places (e.g. 47.36%).

### Contribution Margin After Order Costs
- **Definition:** The profit remaining after subtracting variable fulfillment costs required to deliver each parcel.
- **Formula:**
  $$\text{Contribution} = \text{Gross Profit} - (\text{Courier Charges} + \text{Packaging Costs} + \text{COD Fees} + \text{Return Logistics Losses})$$

### Operating Profit & Operating Margin %
- **Definition:** The operational net earnings after deducting overhead, rent, marketing, salaries, and office expenses.
- **Formula:**
  $$\text{Operating Profit} = \text{Gross Profit} - \text{Total Operating Expenses}$$
  $$\text{Operating Margin \%} = \left(\frac{\text{Operating Profit}}{\text{Net Product Sales}}\right) \times 100$$

### Net Cash Movement (Cash-Basis)
- **Definition:** The actual net cash received minus cash spent during the timeframe.
- **Formula:**
  $$\text{Net Cash} = \sum \text{Actual Inflows} - \sum \text{Actual Outflows}$$
- **Note:** Distinct from accrual profit. Does not include uncollected courier receivables.

---

## 2. Order & Customer Operational KPIs

### Average Order Value (AOV)
- **Definition:** The average value in Taka of each completed, delivered customer order.
- **Formula:**
  $$\text{AOV} = \frac{\text{Total Delivered Order Sales}}{\text{Total Delivered Orders Count}}$$

### Delivery Success Rate
- **Definition:** Percentage of dispatched orders that reached final delivered status without returning.
- **Formula:**
  $$\text{Delivery Success Rate \%} = \left(\frac{\text{Delivered Orders}}{\text{Delivered Orders} + \text{Returned Orders}}\right) \times 100$$

### Return Rate
- **Definition:** Percentage of delivered or attempted orders that resulted in customer returns.
- **Formula:**
  $$\text{Return Rate \%} = \left(\frac{\text{Returned Orders}}{\text{Total Dispatched Orders}}\right) \times 100$$
