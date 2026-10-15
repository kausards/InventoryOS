export interface WooCommerceProduct {
  id: number;
  name: string;
  sku: string;
  price: string;
  regular_price?: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  status: string;
  type: string; // 'simple' | 'variable' | 'grouped'
  variations?: number[];
  images?: Array<{ id: number; src: string; name?: string }>;
}

export interface WooCommerceVariation {
  id: number;
  sku: string;
  price: string;
  stock_quantity: number | null;
  attributes: Array<{ id: number; name: string; option: string }>;
}

export interface WooCommerceOrderItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  subtotal: string;
  total: string;
  sku?: string;
  price: number;
}

export interface WooCommerceOrder {
  id: number;
  number: string;
  order_key: string;
  status: string; // 'pending' | 'processing' | 'on-hold' | 'completed' | 'cancelled' | 'refunded' | 'failed'
  currency: string;
  date_created: string;
  date_modified: string;
  discount_total: string;
  shipping_total: string;
  total: string;
  payment_method: string;
  payment_method_title: string;
  billing: {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    address_1: string;
    address_2?: string;
    city: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    phone?: string;
    address_1: string;
    city: string;
    state?: string;
    postcode?: string;
  };
  customer_note?: string;
  line_items: WooCommerceOrderItem[];
}

export interface WooCommerceClientOptions {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  timeoutMs?: number;
}

export class WooCommerceClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly timeoutMs: number;

  constructor(options: WooCommerceClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    const token = Buffer.from(`${options.consumerKey}:${options.consumerSecret}`).toString('base64');
    this.authHeader = `Basic ${token}`;
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/wp-json/wc/v3${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Growthomic-InventoryOS/1.0',
          ...(options.headers || {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `WooCommerce API error: ${response.status} ${response.statusText} - ${errorText.slice(0, 300)}`
        );
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`WooCommerce connection timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Tests connection to WooCommerce store using System Status or orders ping.
   */
  async testConnection(): Promise<{ success: boolean; message: string; version?: string }> {
    try {
      // First attempt system_status
      try {
        const status = await this.request<{ environment?: { version?: string; site_url?: string } }>(
          '/system_status'
        );
        return {
          success: true,
          message: 'Successfully connected to WooCommerce REST API.',
          ...(status.environment?.version && { version: status.environment.version }),
        };
      } catch {
        // Fallback to lightweight orders ping if system_status permissions are restricted
        await this.request<WooCommerceOrder[]>('/orders?per_page=1');
        return {
          success: true,
          message: 'Successfully connected to WooCommerce REST API (Orders read scope verified).',
        };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown connection error';
      return { success: false, message };
    }
  }

  /**
   * Fetches paginated products from WooCommerce.
   */
  async getProducts(page = 1, perPage = 50): Promise<WooCommerceProduct[]> {
    return this.request<WooCommerceProduct[]>(`/products?page=${page}&per_page=${perPage}&status=publish`);
  }

  /**
   * Fetches product variations if product is variable.
   */
  async getVariations(productId: number, page = 1, perPage = 50): Promise<WooCommerceVariation[]> {
    return this.request<WooCommerceVariation[]>(
      `/products/${productId}/variations?page=${page}&per_page=${perPage}`
    );
  }

  /**
   * Fetches orders with optional date filter for reconciliation.
   */
  async getOrders(params: {
    after?: string;
    status?: string;
    page?: number;
    perPage?: number;
  } = {}): Promise<WooCommerceOrder[]> {
    const query = new URLSearchParams();
    if (params.after) query.set('after', params.after);
    if (params.status) query.set('status', params.status);
    query.set('page', String(params.page || 1));
    query.set('per_page', String(params.perPage || 50));
    query.set('orderby', 'date');
    query.set('order', 'desc');

    return this.request<WooCommerceOrder[]>(`/orders?${query.toString()}`);
  }

  /**
   * Updates product or variation stock quantity in WooCommerce.
   */
  async updateStock(
    productId: number,
    quantity: number,
    variationId?: number
  ): Promise<{ id: number; stock_quantity: number }> {
    const body = JSON.stringify({
      manage_stock: true,
      stock_quantity: quantity,
    });

    if (variationId && variationId > 0) {
      return this.request<{ id: number; stock_quantity: number }>(
        `/products/${productId}/variations/${variationId}`,
        {
          method: 'PUT',
          body,
        }
      );
    }

    return this.request<{ id: number; stock_quantity: number }>(`/products/${productId}`, {
      method: 'PUT',
      body,
    });
  }

  /**
   * Registers a webhook in WooCommerce.
   */
  async registerWebhook(params: {
    name: string;
    topic: string;
    deliveryUrl: string;
    secret: string;
  }): Promise<{ id: number; name: string; status: string }> {
    return this.request<{ id: number; name: string; status: string }>('/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        name: params.name,
        topic: params.topic,
        delivery_url: params.deliveryUrl,
        secret: params.secret,
        status: 'active',
      }),
    });
  }
}
