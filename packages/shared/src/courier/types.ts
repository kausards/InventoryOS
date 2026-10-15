export type CourierCode = 'steadfast' | 'pathao' | 'redx';

export type NormalizedShipmentStatus =
  | 'pending'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'partially_delivered'
  | 'cancelled'
  | 'returned'
  | 'failed'
  | 'unknown_pending_reconciliation';

export const TERMINAL_SHIPMENT_STATUSES: readonly NormalizedShipmentStatus[] = [
  'delivered',
  'partially_delivered',
  'cancelled',
  'returned',
] as const;

export function isTerminalShipmentStatus(status: NormalizedShipmentStatus | string): boolean {
  return TERMINAL_SHIPMENT_STATUSES.includes(status as NormalizedShipmentStatus);
}

/**
 * Gate 2 State Machine:
 * Courier events arriving out-of-order must never regress terminal statuses.
 * e.g., 'delivered' cannot be replaced by 'in_transit' or 'pending'.
 */
export function canTransitionShipmentStatus(
  currentStatus: NormalizedShipmentStatus,
  newStatus: NormalizedShipmentStatus
): boolean {
  if (currentStatus === newStatus) {
    return true; // idempotent
  }

  // Once in a terminal status, no regression allowed
  if (isTerminalShipmentStatus(currentStatus)) {
    return false;
  }

  return true;
}

export interface CourierCapabilities {
  cancel: boolean;
  track: boolean;
  fraudCheck: boolean;
  webhooks: boolean;
  balance: boolean;
}

export interface CreateCourierOrderParams {
  invoice: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  codAmount: number; // in BDT Taka
  note?: string;
  operationId: string;
  // Pathao specific delivery options
  recipientCityId?: number;
  recipientZoneId?: number;
  recipientAreaId?: number;
  itemType?: number; // 1 = Document, 2 = Parcel (default)
  itemQuantity?: number;
  itemWeight?: number; // in KG
  itemDescription?: string;
  storeId?: number | string;
}

export interface CourierOrderResult {
  success: boolean;
  consignmentId?: string;
  trackingCode?: string;
  status?: NormalizedShipmentStatus;
  rawResponse?: unknown;
  errorMessage?: string;
  isAmbiguousTimeout?: boolean;
}

export interface CourierTrackingResult {
  consignmentId?: string;
  trackingCode?: string;
  providerStatus: string;
  normalizedStatus: NormalizedShipmentStatus;
  statusTimestamp?: string;
  deliveryCharge?: number;
  codFee?: number;
  rawResponse?: unknown;
}

export interface CourierBalanceResult {
  currentBalance: number;
  rawResponse?: unknown;
}

export interface CourierFraudCheckResult {
  provider: string;
  phone: string;
  totalOrders: number;
  successfulDeliveries: number;
  returns: number;
  deliveryRatePercent: number;
  returnRatePercent: number;
  riskRating: 'low' | 'medium' | 'high' | 'insufficient_data' | 'provider_unavailable';
  providerUnavailable?: boolean;
  rawResponse?: unknown;
}

export interface CourierAdapter {
  readonly courierCode: CourierCode;
  readonly capabilities: CourierCapabilities;

  testConnection(): Promise<{ success: boolean; message: string; balance?: number }>;
  createOrder(params: CreateCourierOrderParams): Promise<CourierOrderResult>;
  trackByConsignmentId(consignmentId: string): Promise<CourierTrackingResult>;
  trackByTrackingCode(trackingCode: string): Promise<CourierTrackingResult>;
  getBalance(): Promise<CourierBalanceResult>;
  checkCustomerRisk(phone: string): Promise<CourierFraudCheckResult>;
}

export interface CourierAccountCredentials {
  apiKey?: string;
  secretKey?: string;
  baseUrl?: string;
  // Pathao specific OAuth2 credentials
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  storeId?: number | string;
}

export interface MaskedCourierAccount {
  id: string;
  courierCode: CourierCode;
  accountName: string;
  senderName?: string | null;
  senderPhone?: string | null;
  senderAddress?: string | null;
  isActive: boolean;
  isDefault: boolean;
  testMode: boolean;
  lastConnectionTestAt?: string | null;
  lastConnectionStatus?: string | null;
  maskedCredentials: {
    apiKey?: string;
    secretKey?: string;
    clientId?: string;
    username?: string;
    storeId?: number | string;
  };
  createdAt: string;
  updatedAt: string;
}
