# Test Plan

## Overview
This document outlines the testing strategy for the Growthomic Inventory OS.

## 1. RLS Tests
Testing Row Level Security (RLS) is mandatory and MUST be executed against a real PostgreSQL instance (via Docker in CI).
We use the temporary `test_items` table in M0 to verify isolation.

## 2. Unit Tests
- `packages/shared`: 100% coverage target for all utility functions, especially `money.ts` and `order-state-machine.ts`.
- Backend endpoints: tested with Zod schemas.

## 3. Directory Structure
Adheres to `SECURITY_AND_TESTING_RULES.md` §11.2 structure:
- `apps/api/test/unit/`
- `apps/api/test/integration/`
- `apps/api/test/security/`
- `apps/api/test/contracts/fixtures/`
- `packages/db/tests/rls/`
- `packages/db/tests/migrations/`
