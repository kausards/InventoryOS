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

export interface SteadfastCredentials {
  apiKey: string;
  secretKey: string;
  baseUrl?: string;
}

export class SteadfastAdapter implements CourierAdapter {
  readonly courierCode: CourierCode = 'steadfast';
  readonly capabilities: CourierCapabilities = {
    cancel: false,
    track: true,
    fraudCheck: true,
    webhooks: true,
    balance: true,
  };

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly timeoutMs: number;

  constructor(credentials: SteadfastCredentials, options?: { timeoutMs?: number }) {
    this.baseUrl = (credentials.baseUrl || 'https://portal.steadfast.com.bd/api/v1').replace(/\/+$/, '');
    this.apiKey = credentials.apiKey;
    this.secretKey = credentials.secretKey;
    this.timeoutMs = options?.timeoutMs ?? 10000;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Api-Key': this.apiKey,
      'Secret-Key': this.secretKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async request<T = any>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ data: T; status: number }> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...this.getHeaders(),
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
   * Tests API key and secret key connectivity by querying Steadfast balance.
   */
  async testConnection(): Promise<{ success: boolean; message: string; balance?: number }> {
    try {
      const res = await this.getBalance();
      return {
        success: true,
        message: 'Connected successfully to Steadfast Courier API',
        balance: res.currentBalance,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to authenticate with Steadfast API',
      };
    }
  }

  /**
   * Dispatches order to Steadfast.
   * Handles timeout safety (Gate 1).
   */
  async createOrder(params: CreateCourierOrderParams): Promise<CourierOrderResult> {
    const payload = {
      invoice: params.invoice,
      recipient_name: params.recipientName,
      recipient_phone: params.recipientPhone,
      recipient_address: params.recipientAddress,
      cod_amount: params.codAmount,
      note: params.note || '',
    };

    try {
      const { data } = await this.request<any>('/create_order', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (data?.status === 200 || data?.consignment) {
        const consignment = data.consignment || data;
        const res: CourierOrderResult = {
          success: true,
          status: 'pending',
          rawResponse: data,
        };
        const cId = consignment.consignment_id || consignment.id;
        if (cId) res.consignmentId = String(cId);
        if (consignment.tracking_code) res.trackingCode = String(consignment.tracking_code);
        return res;
      }

      return {
        success: false,
        errorMessage: data?.message || 'Failed to create consignment on Steadfast',
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
   * Tracks shipment by Steadfast Consignment ID.
   */
  async trackByConsignmentId(consignmentId: string): Promise<CourierTrackingResult> {
    const { data } = await this.request<any>(`/status_by_cid/${encodeURIComponent(consignmentId)}`);
    const providerStatus = data?.delivery_status || data?.status || 'unknown';
    const normalized = this.normalizeSteadfastStatus(providerStatus);

    const result: CourierTrackingResult = {
      consignmentId,
      providerStatus,
      normalizedStatus: normalized,
      rawResponse: data,
    };
    if (data?.tracking_code) result.trackingCode = String(data.tracking_code);
    if (data?.updated_at) result.statusTimestamp = String(data.updated_at);

    return result;
  }

  /**
   * Tracks shipment by Steadfast Tracking Code.
   */
  async trackByTrackingCode(trackingCode: string): Promise<CourierTrackingResult> {
    const { data } = await this.request<any>(`/status_by_trackingcode/${encodeURIComponent(trackingCode)}`);
    const providerStatus = data?.delivery_status || data?.status || 'unknown';
    const normalized = this.normalizeSteadfastStatus(providerStatus);

    const result: CourierTrackingResult = {
      trackingCode,
      providerStatus,
      normalizedStatus: normalized,
      rawResponse: data,
    };
    if (data?.consignment_id) result.consignmentId = String(data.consignment_id);
    if (data?.updated_at) result.statusTimestamp = String(data.updated_at);

    return result;
  }

  /**
   * Fetches current account balance from Steadfast.
   */
  async getBalance(): Promise<CourierBalanceResult> {
    const { data } = await this.request<any>('/get_balance');
    const balance = Number(data?.current_balance ?? data?.balance ?? 0);
    return {
      currentBalance: isNaN(balance) ? 0 : balance,
      rawResponse: data,
    };
  }

  /**
   * Queries delivery history / fraud rating for a phone number.
   * Gate 3 Safeguard: If provider fails or throws, MUST return 'provider_unavailable', NEVER 'low'.
   */
  async checkCustomerRisk(phone: string): Promise<CourierFraudCheckResult> {
    try {
      // Steadfast delivery checker / fraud endpoint
      const { data } = await this.request<any>(`/fraud_check/${encodeURIComponent(phone)}`, {
        method: 'GET',
      });

      const total = Number(data?.total_orders ?? data?.total_parcels ?? 0);
      const successful = Number(data?.successful_deliveries ?? data?.delivered ?? 0);
      const returns = Number(data?.returns ?? data?.cancelled ?? 0);

      const deliveryRate = total > 0 ? Math.round((successful / total) * 100) : 0;
      const returnRate = total > 0 ? Math.round((returns / total) * 100) : 0;

      let riskRating: 'low' | 'medium' | 'high' | 'insufficient_data' | 'provider_unavailable' = 'insufficient_data';
      if (total >= 3) {
        if (returnRate >= 40) {
          riskRating = 'high';
        } else if (returnRate >= 20) {
          riskRating = 'medium';
        } else {
          riskRating = 'low';
        }
      }

      return {
        provider: 'steadfast',
        phone,
        totalOrders: total,
        successfulDeliveries: successful,
        returns,
        deliveryRatePercent: deliveryRate,
        returnRatePercent: returnRate,
        riskRating,
        providerUnavailable: false,
        rawResponse: data,
      };
    } catch (err: any) {
      // Gate 3: Provider down, offline, or errored. MUST return 'provider_unavailable', NEVER 'low'
      return {
        provider: 'steadfast',
        phone,
        totalOrders: 0,
        successfulDeliveries: 0,
        returns: 0,
        deliveryRatePercent: 0,
        returnRatePercent: 0,
        riskRating: 'provider_unavailable',
        providerUnavailable: true,
        rawResponse: { error: err.message },
      };
    }
  }

  /**
   * Normalizes Steadfast status strings into system NormalizedShipmentStatus.
   */
  normalizeSteadfastStatus(providerStatus: string): NormalizedShipmentStatus {
    const s = providerStatus.toLowerCase().trim();
    switch (s) {
      case 'in_review':
      case 'pending':
      case 'hold':
        return 'pending';
      case 'delivered_approval_pending':
      case 'partial_delivered_approval_pending':
      case 'in_transit':
      case 'picked_up':
      case 'dispatched':
        return 'in_transit';
      case 'out_for_delivery':
      case 'on_the_way':
        return 'out_for_delivery';
      case 'delivered':
        return 'delivered';
      case 'partial_delivered':
      case 'partially_delivered':
        return 'partially_delivered';
      case 'cancelled':
        return 'cancelled';
      case 'returned':
      case 'return_received':
        return 'returned';
      case 'failed':
      case 'delivery_failed':
        return 'failed';
      default:
        return 'in_transit';
    }
  }
}
