/**
 * ParcelDaily API Client
 * 
 * Integrates with ParcelDaily OpenAPI for shipping operations:
 * - Account Info (check balance)
 * - Postcode Check
 * - Quote / Rate Check
 * - Create Order
 * - Bulk Create Order
 * - Checkout Order
 * - Bulk Checkout
 * - Consignment Note download
 * - Order Status
 * 
 * API Docs: https://api.parceldaily.com/
 * Sandbox: https://api.sandbox.parceldaily.com/
 */

import { ENV } from "./_core/env";

const SANDBOX_URL = "https://api.sandbox.parceldaily.com";
const PRODUCTION_URL = "https://api.parceldaily.com";

function getBaseUrl(): string {
  return ENV.parceldailyEnv === "sandbox" ? SANDBOX_URL : PRODUCTION_URL;
}

function getHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    token: ENV.parceldailyToken,
    merchantid: ENV.parceldailyMerchantId,
  };
}

export interface ParcelDailyAddress {
  fullName: string;
  countryCode?: string;
  phone: string;
  email?: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  state: string;
  country: string;
}

export interface ParcelDailyQuoteRequest {
  fromPostcode: string;
  toPostcode: string;
  kg: number;
  courier?: string; // optional: specific courier to quote
}

export interface ParcelDailyQuoteResponse {
  success?: {
    fromPostcode?: { Postcode: string; Place: string; Area: string; State: string; StateName: string; CountryName: string };
    toPostcode?: { Postcode: string; Place: string; Area: string; State: string; StateName: string; CountryName: string };
    poslajuPrice?: string;
    poslajuPostage?: string;
    dhlPrice?: string;
    dhlPostage?: string;
    ninjavanPrice?: string;
    ninjavanPostage?: string;
    jntPrice?: string;
    jntPostage?: string;
    citylinkPostage?: string;
    citylinkPrice?: string;
    [key: string]: any;
  };
  error?: { message: string };
}

export interface ParcelDailyCreateOrderRequest {
  serviceProvider: string; // e.g. "jnt", "dhl", "poslaju", "ninjavan", "spx", "line_clear"
  pickupAddress: ParcelDailyAddress;
  clientAddress: ParcelDailyAddress;
  kg: number;
  price: number;
  cod?: number;
  isNextDayRemittance?: boolean;
  content?: string;
  content_value?: number;
  contentValueCurrency?: string;
  isDropoff?: boolean;
  isNotify?: string; // "SMS" or "Whatsapp"
  isReschdule?: string;
  reference?: string;
}

export interface ParcelDailyCreateOrderResponse {
  success?: {
    objectId?: string;
    serviceProvider?: string;
    price?: number;
    kg?: number;
    content?: string;
    content_value?: number;
    receiver?: any;
    pickup?: any;
    merchant?: any;
    createdAt?: string;
    updatedAt?: string;
  };
  error?: { message: string };
}

export interface ParcelDailyCheckoutRequest {
  orderId: string; // ParcelDaily order ID from create response
}

export interface ParcelDailyCheckoutResponse {
  data?: {
    statusCode: number;
    orderId: string;
    connote: string; // tracking number
    reference?: string;
  };
  error?: { message: string; code?: number };
}

export interface ParcelDailyAccountInfo {
  data?: {
    credit: number;
    topupPackage: string;
    packageValidDays: number;
    expiresIn: number;
    packageBoughtAt: string;
  };
  error?: { message: string };
}

export interface ParcelDailyPostcodeResponse {
  success?: { ok: boolean; state: string };
  error?: { message: string };
}

/**
 * Check account info (balance, package, expiry)
 */
export async function checkAccountInfo(): Promise<ParcelDailyAccountInfo> {
  const res = await fetch(`${getBaseUrl()}/v1/partner/account-info`, {
    method: "GET",
    headers: getHeaders(),
  });
  return res.json() as Promise<ParcelDailyAccountInfo>;
}

/**
 * Check postcode validity and state
 */
export async function checkPostcode(postcode: string): Promise<ParcelDailyPostcodeResponse> {
  const res = await fetch(`${getBaseUrl()}/v1/partner/postcode`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ destination: postcode }),
  });
  return res.json() as Promise<ParcelDailyPostcodeResponse>;
}

/**
 * Get shipping quote/rate for a parcel
 */
export async function getQuote(req: ParcelDailyQuoteRequest): Promise<ParcelDailyQuoteResponse> {
  const res = await fetch(`${getBaseUrl()}/v1/partner/merchant/quote`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      destination: req.toPostcode,
      origin: req.fromPostcode,
      kg: req.kg,
    }),
  });
  return res.json() as Promise<ParcelDailyQuoteResponse>;
}

/**
 * Create a shipment order in ParcelDaily
 * After creating, must call checkoutOrder to actually process it.
 */
export async function createOrder(req: ParcelDailyCreateOrderRequest): Promise<ParcelDailyCreateOrderResponse> {
  const res = await fetch(`${getBaseUrl()}/v1/partner/order/create`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(req),
  });
  return res.json() as Promise<ParcelDailyCreateOrderResponse>;
}

/**
 * Checkout (pay for) an order. Returns tracking number.
 * Credits are deducted from wallet.
 */
export async function checkoutOrder(orderId: string): Promise<ParcelDailyCheckoutResponse> {
  const res = await fetch(`${getBaseUrl()}/v1/partner/order/pay`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ orderId }),
  });
  return res.json() as Promise<ParcelDailyCheckoutResponse>;
}

/**
 * Bulk checkout orders.
 * Returns order IDs that are under processing.
 */
export async function bulkCheckoutOrders(orderIds: string[]): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/v2/partner/order/payAll`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ orderIds }),
  });
  return res.json();
}

/**
 * Get consignment note (AWB) URL for a checked-out order.
 * The consignment note is a PDF that can be downloaded.
 */
export async function getConsignmentNote(orderId: string): Promise<{ url?: string; error?: string }> {
  const res = await fetch(`${getBaseUrl()}/v1/partner/order/consignment-note`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ orderId }),
  });
  const data = await res.json();
  return data;
}

/**
 * Get order status from ParcelDaily
 */
export async function getOrderStatus(orderId: string): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/v1/partner/order/status`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ orderId }),
  });
  return res.json();
}

/**
 * Check if ParcelDaily is configured (has credentials)
 */
export function isParcelDailyConfigured(): boolean {
  return !!ENV.parceldailyMerchantId && !!ENV.parceldailyToken;
}

/**
 * Extract available courier prices from a quote response
 * Returns array of { courier, price, postage }
 */
export function extractCourierPrices(quote: ParcelDailyQuoteResponse): Array<{ courier: string; price: string; postage: string }> {
  if (!quote.success) return [];
  const s = quote.success;
  const couriers: Array<{ courier: string; price: string; postage: string }> = [];
  
  if (s.poslajuPrice) couriers.push({ courier: "poslaju", price: s.poslajuPrice, postage: s.poslajuPostage || s.poslajuPrice });
  if (s.dhlPrice) couriers.push({ courier: "dhl", price: s.dhlPrice, postage: s.dhlPostage || s.dhlPrice });
  if (s.ninjavanPrice) couriers.push({ courier: "ninjavan", price: s.ninjavanPrice, postage: s.ninjavanPostage || s.ninjavanPrice });
  if (s.jntPrice) couriers.push({ courier: "jnt", price: s.jntPrice, postage: s.jntPostage || s.jntPrice });
  if (s.citylinkPrice) couriers.push({ courier: "citylink", price: s.citylinkPrice, postage: s.citylinkPostage || s.citylinkPrice });
  // Also check for SPX, Line Clear
  if ((s as any).spxPrice) couriers.push({ courier: "spx", price: (s as any).spxPrice, postage: (s as any).spxPostage || (s as any).spxPrice });
  if ((s as any).lineclearPrice) couriers.push({ courier: "line_clear", price: (s as any).lineclearPrice, postage: (s as any).lineclearPostage || (s as any).lineclearPrice });
  
  return couriers;
}
