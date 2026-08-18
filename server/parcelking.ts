/**
 * ParcelKing Partner API Client
 *
 * Integrates with ParcelKing Partner API v1 for shipping operations:
 * - GET /services          — List available courier services
 * - POST /price/query      — Quote shipping prices across services
 * - POST /order/create     — Create a shipment (auto tracking + label)
 * - GET /order/{tracking_no}          — Get order details
 * - GET /order/{tracking_no}/tracking — Get live tracking timeline
 * - POST /order/cancel     — Cancel an active order
 * - GET /balance           — Check e-wallet balance
 * - GET /spx_pickup_slots  — Get SPX pickup time slots
 *
 * Base URL: https://myparcelking.com/en/api/v1/partner
 * Auth: Bearer pk_test_... or pk_live_...
 *
 * Key prefix determines mode (test vs live). No other code changes needed.
 */

import { ENV } from "./_core/env";

const BASE_URL = "https://myparcelking.com/en/api/v1/partner";

// Default timeout for API calls (30 seconds)
const DEFAULT_TIMEOUT_MS = 30_000;

function getHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ENV.parcelkingApiKey}`,
  };
}

export function isTestMode(): boolean {
  return ENV.parcelkingEnv === "test" || ENV.parcelkingApiKey.startsWith("pk_test_");
}

// ============================================================================
// Error Types
// ============================================================================

export class ParcelKingError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly isRetryable: boolean,
    public readonly rawResponse?: any,
  ) {
    super(message);
    this.name = "ParcelKingError";
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface ParcelKingService {
  service_id: number;
  service_name: string;
  service_type: string;
  order_type: string;
  logo_url?: string;
  estimated_days?: string;
  is_mps_supported?: boolean;
}

export interface ParcelKingAddress {
  name: string;
  phone: string;
  email?: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  state: string;
  country: string;
}

export interface ParcelKingParcel {
  weight_kg: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  name?: string;
  quantity?: number;
}

export interface ParcelKingPriceQueryRequest {
  from_postcode: string;
  to_postcode: string;
  parcel_weight_kg: number;
  parcel_value?: number;
  from_state?: string;
  to_state?: string;
  parcels?: ParcelKingParcel[]; // For MPS (multi-parcel shipment)
}

export interface ParcelKingPriceQuote {
  service_id: number;
  service_name: string;
  service_type: string;
  total_price: number;
  shipping_fee: number;
  insurance_fee: number;
  estimated_days: string;
  logo_url?: string;
  is_mps?: boolean;
  insurance?: {
    fee: number;
    rate_percent: number;
    free_coverage: number;
    insured_coverage: number;
  };
}

export interface ParcelKingCreateOrderRequest {
  service_id: number;
  sender: {
    name: string;
    phone: string;
    email?: string;
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    state: string;
    country: string;
    dial_code?: string;
    mobile?: string;
  };
  recipient: {
    name: string;
    phone: string;
    email?: string;
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    state: string;
    country: string;
    dial_code?: string;
    mobile?: string;
  };
  parcel: {
    weight_kg: number;
    length_cm?: number;
    width_cm?: number;
    height_cm?: number;
    name?: string;
    declared_value?: number;
  };
  delivery_options?: {
    handover_method?: "pickup" | "dropoff";
    pickup_time?: number; // Unix timestamp from /spx_pickup_slots
    pickup_time_range_id?: number;
  };
  reference?: string;
  parcels?: ParcelKingParcel[]; // For MPS
}

export interface ParcelKingCreateOrderResponse {
  status: "OK";
  result: {
    tracking_no: string;
    sales_order_id: string;
    final_amount: number;
    insured: boolean;
    test_mode: boolean;
    label_url?: string;
  };
}

export interface ParcelKingOrderDetails {
  status: "OK";
  result: {
    tracking_no: string;
    sales_order_id: string;
    service_id: number;
    service_name: string;
    order_status: number;
    order_status_label: string;
    final_amount: number;
    insured: boolean;
    test_mode: boolean;
    sender: any;
    recipient: any;
    parcel: any;
    created_date: string;
    label_url?: string;
  };
}

export interface ParcelKingTrackingEvent {
  time: string;
  description: string;
  location?: string;
  status?: string;
  reference?: string;
}

export interface ParcelKingTrackingResponse {
  status: "OK";
  result: {
    tracking_no: string;
    timeline: ParcelKingTrackingEvent[];
  };
}

export interface ParcelKingBalanceResponse {
  status: "OK";
  result: {
    balance: number;
    currency: string;
  };
}

export interface ParcelKingCancelResponse {
  status: "OK";
  result: {
    tracking_no: string;
    cancelled: boolean;
  };
}

export interface ParcelKingSpxSlot {
  pickup_time: number;
  pickup_time_range_id: number;
  date_time: string;
}

export interface ParcelKingSpxSlotsResponse {
  status: "OK";
  result: {
    slots: ParcelKingSpxSlot[];
  };
}

// ============================================================================
// Internal fetch wrapper with timeout and error handling
// ============================================================================

async function pkFetch<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { ...getHeaders(), ...(options.headers || {}) },
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.status === "ERROR") {
      const errorMsg = data.result || data.message || `HTTP ${res.status}`;
      const isRetryable = res.status >= 500 || res.status === 429;

      // Map common errors to user-friendly messages
      let friendlyMsg = errorMsg;
      if (res.status === 401) {
        friendlyMsg = "Parcel King API key is invalid or missing. Please check your API credentials.";
      } else if (res.status === 403 && errorMsg.includes("disabled")) {
        friendlyMsg = "Parcel King account is disabled. Please contact ParcelKing support.";
      } else if (res.status === 403 && errorMsg.includes("IP")) {
        friendlyMsg = "Your server IP is not allowed by ParcelKing. Please contact admin to add it.";
      } else if (res.status === 429) {
        friendlyMsg = "Parcel King API rate limit exceeded. Please wait 60 seconds and retry.";
      } else if (res.status === 502 && errorMsg.includes("SPX")) {
        friendlyMsg = "Parcel King courier (SPX) error: " + errorMsg + ". Please retry.";
      }

      throw new ParcelKingError(friendlyMsg, res.status, isRetryable, data);
    }

    return data as T;
  } catch (error: any) {
    if (error instanceof ParcelKingError) throw error;

    // Handle timeout / abort
    if (error.name === "AbortError") {
      throw new ParcelKingError(
        "Parcel King API request timed out. Please check your network and retry.",
        0,
        true,
      );
    }

    // Network errors
    throw new ParcelKingError(
      `Parcel King API connection failed: ${error.message}`,
      0,
      true,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Check if ParcelKing is configured (has API key)
 */
export function isParcelKingConfigured(): boolean {
  return !!ENV.parcelkingApiKey && ENV.parcelkingApiKey.startsWith("pk_");
}

/**
 * Get available courier services
 */
export async function getServices(): Promise<ParcelKingService[]> {
  const data = await pkFetch<{ status: "OK"; result: ParcelKingService[] }>("/services");
  return data.result;
}

/**
 * Query shipping prices across all whitelisted services
 */
export async function priceQuery(req: ParcelKingPriceQueryRequest): Promise<{
  services: ParcelKingPriceQuote[];
  weightUsedKg: number;
  totalParcels: number;
  isMps: boolean;
}> {
  const data = await pkFetch<{ status: "OK"; result: any }>("/price/query", {
    method: "POST",
    body: JSON.stringify(req),
  });

  const result = data.result;
  return {
    services: result.services || [],
    weightUsedKg: result.weight_used_kg || req.parcel_weight_kg,
    totalParcels: result.total_parcels || 1,
    isMps: result.is_mps || false,
  };
}

/**
 * Create a shipping order. Returns tracking number, sales order ID, and label URL.
 * In test mode, no real shipment is created and e-wallet is not charged.
 */
export async function createOrder(req: ParcelKingCreateOrderRequest): Promise<ParcelKingCreateOrderResponse> {
  return pkFetch<ParcelKingCreateOrderResponse>("/order/create", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/**
 * Get order details by tracking number
 */
export async function getOrderDetails(trackingNo: string): Promise<ParcelKingOrderDetails> {
  return pkFetch<ParcelKingOrderDetails>(`/order/${trackingNo}`);
}

/**
 * Get live tracking timeline for an order
 */
export async function getTracking(trackingNo: string): Promise<ParcelKingTrackingResponse> {
  return pkFetch<ParcelKingTrackingResponse>(`/order/${trackingNo}/tracking`);
}

/**
 * Cancel an active order
 */
export async function cancelOrder(trackingNo: string): Promise<ParcelKingCancelResponse> {
  return pkFetch<ParcelKingCancelResponse>("/order/cancel", {
    method: "POST",
    body: JSON.stringify({ tracking_no: trackingNo }),
  });
}

/**
 * Check e-wallet balance
 */
export async function getBalance(): Promise<ParcelKingBalanceResponse> {
  return pkFetch<ParcelKingBalanceResponse>("/balance");
}

/**
 * Get SPX pickup time slots (required for SPX pickup handover)
 */
export async function getSpxPickupSlots(): Promise<ParcelKingSpxSlot[]> {
  const data = await pkFetch<ParcelKingSpxSlotsResponse>("/spx_pickup_slots");
  return data.result.slots;
}

/**
 * Simulate a tracking event (test key only)
 */
export async function simulateTrackingEvent(
  trackingNo: string,
  status: string,
  location?: string,
  delivered?: boolean,
): Promise<any> {
  const body: any = { tracking_no: trackingNo, status };
  if (location) body.location = location;
  if (delivered !== undefined) body.delivered = delivered;

  return pkFetch<any>("/order/simulate_tracking", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Download shipping label PDF for an order
 * Returns the label URL from order details (or direct PDF download URL)
 */
export async function getShippingLabelUrl(trackingNo: string): Promise<string | null> {
  const details = await getOrderDetails(trackingNo);
  return details.result?.label_url || null;
}

/**
 * Normalize a Malaysian phone number for Parcel King API
 * Strips leading 0 and non-digits, returns { dial_code, mobile }
 */
export function normalizePhone(phone: string): { dial_code: string; mobile: string } {
  const digits = phone.replace(/\D/g, "");
  // Malaysian numbers: strip leading 0 or 60
  let mobile = digits;
  if (mobile.startsWith("60")) mobile = mobile.slice(2);
  if (mobile.startsWith("0")) mobile = mobile.slice(1);
  return { dial_code: "+60", mobile };
}
