/**
 * Shipping Provider Adapter Architecture
 * 
 * Provider interface that all shipping providers must implement.
 * New providers can be added without modifying the order module.
 */

import * as parceldaily from "./parceldaily";
import { ENV } from "./_core/env";

export interface QuoteResult {
  courier: string;
  price: number;
  currency: string;
  estimatedDays?: string;
}

export interface CreateShipmentResult {
  providerOrderId: string;
  status: "created";
  rawResponse: any;
}

export interface CheckoutShipmentResult {
  trackingNumber: string;
  consignmentNoteUrl?: string;
  shippingCost: number;
  rawResponse: any;
}

export interface ShippingProvider {
  key: string;
  displayName: string;
  isConfigured: boolean;
  
  /**
   * Check account balance / info
   */
  checkAccount?(): Promise<{ balance: number; info: any }>;
  
  /**
   * Check if postcode is serviceable
   */
  checkPostcode(postcode: string): Promise<{ ok: boolean; state?: string; message?: string }>;
  
  /**
   * Get shipping quotes for a parcel
   */
  getQuotes(params: {
    fromPostcode: string;
    toPostcode: string;
    weightKg: number;
  }): Promise<QuoteResult[]>;
  
  /**
   * Create a shipment (adds to cart, not yet checked out)
   */
  createShipment(params: {
    courier: string;
    pickupAddress: any;
    deliveryAddress: any;
    weightKg: number;
    price: number;
    content?: string;
    contentValue?: number;
    reference?: string;
  }): Promise<CreateShipmentResult>;
  
  /**
   * Checkout (pay for) a shipment, get tracking number
   */
  checkoutShipment(providerOrderId: string): Promise<CheckoutShipmentResult>;
  
  /**
   * Get consignment note (AWB) URL
   */
  getConsignmentNote?(providerOrderId: string): Promise<{ url?: string; error?: string }>;
}

// ============================================================================
// ParcelDaily Provider Adapter
// ============================================================================

export const parcelDailyProvider: ShippingProvider = {
  key: "parceldaily",
  displayName: "ParcelDaily",
  isConfigured: parceldaily.isParcelDailyConfigured(),
  
  async checkAccount() {
    const info = await parceldaily.checkAccountInfo();
    return {
      balance: info.data?.credit ?? 0,
      info,
    };
  },
  
  async checkPostcode(postcode: string) {
    const res = await parceldaily.checkPostcode(postcode);
    if (res.success) {
      return { ok: res.success.ok, state: res.success.state };
    }
    return { ok: false, message: res.error?.message };
  },
  
  async getQuotes(params) {
    const quote = await parceldaily.getQuote({
      fromPostcode: params.fromPostcode,
      toPostcode: params.toPostcode,
      kg: params.weightKg,
    });
    
    if (quote.error) {
      throw new Error(quote.error.message);
    }
    
    const couriers = parceldaily.extractCourierPrices(quote);
    return couriers.map(c => ({
      courier: c.courier,
      price: parseFloat(c.price) || 0,
      currency: "MYR",
    }));
  },
  
  async createShipment(params) {
    const order = await parceldaily.createOrder({
      serviceProvider: params.courier,
      pickupAddress: params.pickupAddress,
      clientAddress: params.deliveryAddress,
      kg: params.weightKg,
      price: params.price,
      content: params.content || "Goods",
      content_value: params.contentValue,
      contentValueCurrency: "MYR",
      reference: params.reference,
    });
    
    if (order.error) {
      throw new Error(order.error.message);
    }
    
    if (!order.success?.objectId) {
      throw new Error("Failed to create order: no objectId returned");
    }
    
    return {
      providerOrderId: order.success.objectId,
      status: "created" as const,
      rawResponse: order,
    };
  },
  
  async checkoutShipment(providerOrderId: string) {
    const result = await parceldaily.checkoutOrder(providerOrderId);
    
    if (result.error) {
      throw new Error(result.error.message || "Checkout failed");
    }
    
    if (!result.data || result.data.statusCode !== 200) {
      throw new Error("Checkout failed: " + JSON.stringify(result));
    }
    
    return {
      trackingNumber: result.data.connote,
      consignmentNoteUrl: undefined, // Will be fetched separately
      shippingCost: 0, // Will be updated from order details
      rawResponse: result,
    };
  },
  
  async getConsignmentNote(providerOrderId: string) {
    return parceldaily.getConsignmentNote(providerOrderId);
  },
};

// ============================================================================
// Manual Shipping Provider (no API, manual tracking)
// ============================================================================

export const manualProvider: ShippingProvider = {
  key: "manual",
  displayName: "Manual Shipping",
  isConfigured: true,
  
  async checkPostcode(_postcode: string) {
    return { ok: true, message: "Manual shipping - no postcode restrictions" };
  },
  
  async getQuotes(_params) {
    return []; // No automatic quotes for manual shipping
  },
  
  async createShipment(_params) {
    return {
      providerOrderId: "manual-" + Date.now(),
      status: "created" as const,
      rawResponse: {},
    };
  },
  
  async checkoutShipment(providerOrderId: string) {
    // For manual shipping, checkout is a no-op
    return {
      trackingNumber: "", // To be filled manually
      shippingCost: 0,
      rawResponse: { providerOrderId, manual: true },
    };
  },
};

// ============================================================================
// Provider Registry
// ============================================================================

const providers: Record<string, ShippingProvider> = {
  parceldaily: parcelDailyProvider,
  manual: manualProvider,
};

export function getProvider(key: string): ShippingProvider | undefined {
  return providers[key];
}

export function getAllProviders(): ShippingProvider[] {
  return Object.values(providers);
}

export function getAvailableProviders(): ShippingProvider[] {
  return Object.values(providers).filter(p => p.isConfigured);
}
