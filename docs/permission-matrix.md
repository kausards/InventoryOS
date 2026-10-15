# Permission Matrix

| Permission Key | Owner | Admin | Order Staff | Inventory Staff | Accountant |
|----------------|-------|-------|-------------|-----------------|------------|
| `orders.view` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `orders.create` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `orders.confirm` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `orders.cancel` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `orders.hold` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `orders.edit` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `orders.export` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `orders.bulk_action` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `inventory.view` | ✅ | ✅ | ❌ | ✅ | ✅ |
| `inventory.adjust` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `inventory.export` | ✅ | ✅ | ❌ | ✅ | ✅ |
| `products.view` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `products.create` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `products.edit` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `products.delete` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `customers.view` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `customers.create` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `customers.edit` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `customers.export` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `shipments.view` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `shipments.create` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `shipments.cancel` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `returns.view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `returns.create` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `returns.inspect` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `finance.view` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `finance.export` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `finance.manage` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `expenses.view` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `expenses.create` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `settings.view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings.integrations` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings.billing` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `team.view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `team.invite` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `team.remove` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `team.change_role` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `audit.view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `reports.view` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `reports.export` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `couriers.view` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `couriers.manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
