import type {
  CourierAdapter,
  CourierCapabilities,
  CourierCode,
  CourierOrderResult,
  CourierTrackingResult,
  CourierBalanceResult,
  CourierFraudCheckResult,
  CreateCourierOrderParams,
  NormalizedShipmentStatus,
} from '@growthomic/shared';

export interface PathaoCredentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  storeId?: number | string;
  baseUrl?: string;
  testMode?: boolean;
}

interface PathaoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export class PathaoAdapter implements CourierAdapter {
  readonly courierCode: CourierCode = 'pathao';
  readonly capabilities: CourierCapabilities = {
    cancel: true,
    track: true,
    fraudCheck: false,
    webhooks: true,
    balance: false,
  };

  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly username: string;
  private readonly password: string;
  private readonly storeId?: number | string | undefined;
  private readonly timeoutMs: number;

  private cachedAccessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(credentials: PathaoCredentials, options?: { timeoutMs?: number }) {
    if (credentials.baseUrl) {
      this.baseUrl = credentials.baseUrl.replace(/\/+$/, '');
    } else if (credentials.testMode) {
      this.baseUrl = 'https://courier-api-sandbox.pathao.com';
    } else {
      this.baseUrl = 'https://api-hermes.pathao.com';
    }

    this.clientId = credentials.clientId;
    this.clientSecret = credentials.clientSecret;
    this.username = credentials.username;
    this.password = credentials.password;
    this.storeId = credentials.storeId;
    this.timeoutMs = options?.timeoutMs ?? 10000;
  }

  /**
   * Acquires or returns cached OAuth2 Bearer token using Password Grant.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedAccessToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedAccessToken;
    }

    const url = `${this.baseUrl}/aladdin/api/v1/issue-token`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          username: this.username,
          password: this.password,
          grant_type: 'password',
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const json: any = await response.json().catch(() => null);

      if (!response.ok || !json?.access_token) {
        const errorMsg = json?.message || json?.error_description || `HTTP ${response.status} failed to obtain token`;
        throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
      }

      const tokenData = json as PathaoTokenResponse;
      this.cachedAccessToken = tokenData.access_token;
      this.tokenExpiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
      return this.cachedAccessToken;
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError' || err.code === 'ETIMEDOUT') {
        const timeoutErr: any = new Error(`OAuth2 token request timed out after ${this.timeoutMs}ms`);
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }
      throw err;
    }
  }

  private async request<T = any>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ data: T; status: number }> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(options.headers || {}),
        },
      });
      clearTimeout(timer);

      const json: any = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = json?.message || json?.errors || `HTTP ${response.status} ${response.statusText}`;
        throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
      }

      return { data: json as T, status: response.status };
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
        const timeoutErr: any = new Error(`Request timed out after ${this.timeoutMs}ms to ${url}`);
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }
      throw err;
    }
  }

  /**
   * Tests Pathao credentials by issuing token and fetching stores list.
   */
  async testConnection(): Promise<{ success: boolean; message: string; balance?: number }> {
    try {
      const token = await this.getAccessToken();
      if (!token) {
        return { success: false, message: 'Failed to acquire OAuth2 access token from Pathao' };
      }

      const { data } = await this.request<any>('/aladdin/api/v1/stores');
      const storeCount = Array.isArray(data?.data?.data) ? data.data.data.length : 0;

      return {
        success: true,
        message: `Connected successfully to Pathao API (${storeCount} pickup stores found)`,
        balance: 0,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to authenticate with Pathao API',
      };
    }
  }

  /**
   * Dispatches order to Pathao Courier.
   * Handles timeout safety (Gate 1).
   */
  async createOrder(params: CreateCourierOrderParams): Promise<CourierOrderResult> {
    const storeId = Number(params.storeId || this.storeId || 1);

    const payload = {
      store_id: isNaN(storeId) ? 1 : storeId,
      merchant_order_id: params.invoice,
      recipient_name: params.recipientName,
      recipient_phone: params.recipientPhone,
      recipient_address: params.recipientAddress,
      recipient_city: params.recipientCityId ?? 1, // Default to Dhaka City (ID 1)
      recipient_zone: params.recipientZoneId ?? 1,
      recipient_area: params.recipientAreaId ?? 1,
      delivery_type: 48, // 48h standard delivery
      item_type: params.itemType ?? 2, // 2: Parcel
      special_instruction: params.note || '',
      item_quantity: params.itemQuantity ?? 1,
      item_weight: params.itemWeight ?? 0.5,
      amount_to_collect: params.codAmount,
      item_description: params.itemDescription || 'Products Order',
    };

    try {
      const { data } = await this.request<any>('/aladdin/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const orderData = data?.data || data;
      const consignmentId = orderData?.consignment_id;

      if (consignmentId) {
        return {
          success: true,
          consignmentId: String(consignmentId),
          trackingCode: String(consignmentId),
          status: 'pending',
          rawResponse: data,
        };
      }

      return {
        success: false,
        errorMessage: data?.message || 'Failed to create order on Pathao',
        rawResponse: data,
      };
    } catch (err: any) {
      if (err.isTimeout) {
        // Gate 1: Ambiguous network timeout during dispatch
        return {
          success: false,
          isAmbiguousTimeout: true,
          status: 'unknown_pending_reconciliation',
          errorMessage: err.message,
        };
      }

      return {
        success: false,
        isAmbiguousTimeout: false,
        errorMessage: err.message || 'Unknown network error',
      };
    }
  }

  /**
   * Tracks order by Pathao Consignment ID.
   */
  async trackByConsignmentId(consignmentId: string): Promise<CourierTrackingResult> {
    const { data } = await this.request<any>(`/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`);
    const orderData = data?.data || data;
    const providerStatus = orderData?.order_status || orderData?.delivery_status || 'unknown';
    const normalized = this.normalizePathaoStatus(providerStatus);

    const result: CourierTrackingResult = {
      consignmentId,
      trackingCode: consignmentId,
      providerStatus,
      normalizedStatus: normalized,
      rawResponse: data,
    };

    if (orderData?.delivery_fee != null) {
      result.deliveryCharge = Number(orderData.delivery_fee);
    }

    if (orderData?.updated_at) {
      result.statusTimestamp = String(orderData.updated_at);
    }

    return result;
  }

  /**
   * Tracks order by tracking code. In Pathao, consignment_id and tracking code are identical.
   */
  async trackByTrackingCode(trackingCode: string): Promise<CourierTrackingResult> {
    return this.trackByConsignmentId(trackingCode);
  }

  /**
   * Fetches account balance.
   */
  async getBalance(): Promise<CourierBalanceResult> {
    return {
      currentBalance: 0,
      rawResponse: { info: 'Pathao balances are reconciled via settlements/bank transfers' },
    };
  }

  /**
   * Customer risk check. Pathao does not offer a standalone phone risk database.
   */
  async checkCustomerRisk(phone: string): Promise<CourierFraudCheckResult> {
    return {
      provider: 'pathao',
      phone,
      totalOrders: 0,
      successfulDeliveries: 0,
      returns: 0,
      deliveryRatePercent: 0,
      returnRatePercent: 0,
      riskRating: 'insufficient_data',
      providerUnavailable: false,
      rawResponse: { note: 'Pathao API does not expose a public cross-merchant fraud index' },
    };
  }

  /**
   * Normalizes Pathao order status to NormalizedShipmentStatus.
   */
  normalizePathaoStatus(providerStatus: string): NormalizedShipmentStatus {
    const s = providerStatus.toLowerCase().replace(/[\s_-]+/g, '');
    switch (s) {
      case 'pending':
      case 'ordercreated':
      case 'orderplaced':
        return 'pending';
      case 'pickuprequested':
      case 'assignedforpickup':
      case 'picked':
      case 'intransit':
      case 'hubtransfer':
      case 'receivedathub':
        return 'in_transit';
      case 'outfordelivery':
      case 'assignedfordelivery':
        return 'out_for_delivery';
      case 'delivered':
      case 'successful':
        return 'delivered';
      case 'partialdelivered':
      case 'partiallydelivered':
        return 'partially_delivered';
      case 'cancelled':
        return 'cancelled';
      case 'return':
      case 'returned':
      case 'returnedtomerchant':
      case 'returntransit':
        return 'returned';
      case 'failed':
      case 'deliveryfailed':
      case 'deliveryattemptfailed':
        return 'failed';
      default:
        return 'in_transit';
    }
  }
}
