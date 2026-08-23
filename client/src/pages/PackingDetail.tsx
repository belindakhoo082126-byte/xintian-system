import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  LargeOperationDialogBody,
  LargeOperationDialogContent,
  LargeOperationDialogFooter,
  LargeOperationDialogHeader,
} from "@/components/LargeOperationDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Printer, Truck, Package, Plus, X, MapPin, Phone, User, Ship, CheckCircle2, Sprout, MessageSquare, RefreshCw, AlertTriangle, Copy, FileUp, ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { ProductImagePreview } from "@/components/ProductImagePreview";
import { getPackingSlipRemarkRows } from "@shared/packingSlipRemarks";
import { getMissingPackingRecipientAddressFields } from "@shared/packingRecipientAddress";
import { derivePackingFinancialSettlement } from "@shared/packingFinancialSettlementRules";
import { getPackingShippingControl } from "@shared/packingSpecialOrderRules";

// V2.1.30: Only show Parcel Daily services (Poslaju for east Malaysia, Line Clear for west Malaysia)
const COURIERS = [
  { zh: "Poslaju", en: "Poslaju" },
  { zh: "Line Clear", en: "Line Clear" },
];

// V2.1.30: Auto-set courier based on order shipping method
function getAutoCourier(shippingMethod: string): string {
  if (shippingMethod === "east_malaysia_poslaju") return "Poslaju";
  if (shippingMethod === "west_malaysia") return "Line Clear";
  if (shippingMethod === "lalamove") return "Lalamove";
  if (shippingMethod === "east_malaysia_shopee") return "Shopee Xpress";
  return "Line Clear";
}

// V2.1.30: Check if shipping method has fixed courier (no user selection needed)
function isFixedCourier(shippingMethod: string): boolean {
  return shippingMethod === "lalamove" || shippingMethod === "east_malaysia_shopee";
}

export default function PackingDetail() {
  const { id } = useParams<{ id: string }>();
  const { translate, lang } = useI18n();
  const orderId = parseInt(id);
  const utils = trpc.useUtils();

  const { data: detail, isLoading } = trpc.packing.detail.useQuery({ orderId });
  const { data: slipData } = trpc.packing.slipData.useQuery({ orderId });
  const { data: existingPackages } = trpc.shipping.packages.useQuery({ orderId });
  const { data: fulfilmentSummary } = trpc.packing.fulfilmentSummary.useQuery({ orderId }, { enabled: !!orderId });
  const { data: mergeCandidates } = trpc.packing.mergeCandidates.useQuery({ orderId }, { enabled: !!orderId });
  const { data: remarks } = trpc.orderRemarks.list.useQuery({ orderId });
  const { data: repots } = trpc.repots.list.useQuery({ orderId });

  const [shippingMode, setShippingMode] = useState<"full" | "partial">("full");
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [editingExceptionId, setEditingExceptionId] = useState<number | null>(null);
  const [exceptionType, setExceptionType] = useState<"out_of_stock" | "quality_issue" | "overcharged_shipping" | "delivery_delay" | "cancelled_item" | "other">("quality_issue");
  const [exceptionDesc, setExceptionDesc] = useState("");
  const [resolutionType, setResolutionType] = useState<"replace" | "wait_restock" | "refund">("replace");
  const [exceptionItemId, setExceptionItemId] = useState<number | "">("");
  const [replacementProductId, setReplacementProductId] = useState<number | "">("");
  const [replacementQty, setReplacementQty] = useState(1);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  // V2.1.26补充4: Per-item ship quantity for partial shipping (Issue 7)
  const [shipQuantities, setShipQuantities] = useState<Record<number, number>>({});
  // V2.1.26补充4: New state for enhanced exception handling (Issue 6)
  const [exceptionQuantity, setExceptionQuantity] = useState<number>(1);
  const [customerAction, setCustomerAction] = useState<"replace_product" | "wait_restock" | "refund" | "pending">("pending");
  const [refundMethod, setRefundMethod] = useState<"credit" | "tng" | "cash">("credit");
  const [customerRefundDetails, setCustomerRefundDetails] = useState("");
  const [customerRefundQrUrl, setCustomerRefundQrUrl] = useState("");
  const [refundAttachmentUrls, setRefundAttachmentUrls] = useState<string[]>([]);
  const [refundInternalNotes, setRefundInternalNotes] = useState("");
  const [uploadingRefundAttachment, setUploadingRefundAttachment] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [replacementUnitPrice, setReplacementUnitPrice] = useState<number>(0);
  const [replacementProductName, setReplacementProductName] = useState("");
  const [packages, setPackages] = useState<Array<{
    courier: string;
    shippingType: "auto" | "manual" | "parcelking";
    trackingNumber: string;
    shippingLabelUrl?: string;
    weight: string;
    serviceId: string;
  }>>([{ courier: "Line Clear", shippingType: "manual", trackingNumber: "", weight: "1", serviceId: "" }]);
  const [actualWeightInput, setActualWeightInput] = useState("");
  const [uploadingAwbIndex, setUploadingAwbIndex] = useState<number | null>(null);
  const [supplementalDialogOpen, setSupplementalDialogOpen] = useState(false);
  const [supplementalReceiptUrl, setSupplementalReceiptUrl] = useState("");
  const [supplementalPaymentMethod, setSupplementalPaymentMethod] = useState("银行转账");
  const [supplementalNotes, setSupplementalNotes] = useState("");
  const [uploadingSupplementalReceipt, setUploadingSupplementalReceipt] = useState(false);
  const [mergeShippingDialogOpen, setMergeShippingDialogOpen] = useState(false);
  const [mergeCandidateId, setMergeCandidateId] = useState<number | null>(null);
  const { data: specialActions } = trpc.shippingV2.specialOrderActions.useQuery({ orderId }, { enabled: !!detail });
  const shippingRefund = ((detail as any)?.refunds || []).find((refund: any) => (
    refund.refundSource === "packing" && refund.refundReasonCode === "overcharged_shipping"
  ));

  // V2.1.30: Auto-set courier based on order shipping method when detail loads
  useEffect(() => {
    if (detail) {
      const shippingMethod = (detail as any).shippingMethod || "west_malaysia";
      const autoCourier = getAutoCourier(shippingMethod);
      setPackages((prev) => prev.map((p) => ({
        ...p,
        courier: autoCourier,
        shippingType: shippingMethod === "west_malaysia" || shippingMethod === "east_malaysia_poslaju" ? "auto" : p.shippingType,
      })));
    }
  }, [detail]);
  const updateWeightMutation = trpc.shippingV2.updateActualWeight.useMutation({
    onSuccess: (data) => {
      if (data.needsSpecialOrder) {
        toast.warning(translate("已记录实际重量，订单需特别处理", "Actual weight recorded, order needs special handling"));
      } else {
        toast.success(translate("实际重量已更新", "Actual weight updated"));
      }
      utils.packing.detail.invalidate({ orderId });
      setActualWeightInput("");
    },
    onError: (err: any) => toast.error(translate("更新失败: ", "Update failed: ") + err.message),
  });
  const specialOrderMutation = trpc.shippingV2.processSpecialOrder.useMutation({
    onSuccess: (data: any) => {
      toast.success(data?.requiresRefundManagement
        ? translate(`已建立退款管理任务 ${data.refund?.refundNumber || ""}，请在退款管理完成。`, `Refund task ${data.refund?.refundNumber || ""} created. Complete it in Refund Management.`)
        : translate("特别订单已处理", "Special order processed"));
      utils.packing.detail.invalidate({ orderId });
      utils.shippingV2.specialOrderActions.invalidate({ orderId });
      utils.refunds.list.invalidate();
    },
    onError: (err: any) => toast.error(translate("处理失败: ", "Processing failed: ") + err.message),
  });
  const pendingShippingReleaseMutation = trpc.shippingV2.setPendingShippingShipmentRelease.useMutation({
    onSuccess: (data) => {
      toast.success(data.allowShipping
        ? translate("已记录允许客户后补差价，现可继续发货", "Recorded: ship first and collect the balance later")
        : translate("已记录等待客户补款后再发货", "Recorded: wait for the customer balance before shipment"));
      utils.packing.detail.invalidate({ orderId });
      utils.packing.list.invalidate();
      utils.shippingV2.specialOrderActions.invalidate({ orderId });
    },
    onError: (err: any) => toast.error(translate("发货决定记录失败: ", "Could not save shipment decision: ") + err.message),
  });
  const mergeShipMutation = trpc.shipping.mergeShip.useMutation({
    onSuccess: () => {
      toast.success(translate("合并发货成功，参与订单已同步更新", "Merged shipment created and participating orders updated"));
      setMergeShippingDialogOpen(false);
      setMergeCandidateId(null);
      utils.packing.list.invalidate();
      utils.packing.detail.invalidate({ orderId });
      utils.shipping.packages.invalidate({ orderId });
    },
    onError: (err: any) => toast.error(translate("合并发货失败: ", "Merged shipment failed: ") + err.message),
  });
  const supplementalProofMutation = trpc.shippingV2.submitSupplementalShippingProof.useMutation({
    onSuccess: (data: any) => {
      toast.success(translate(`已提交补运费凭证 RM${Number(data.amount || 0).toFixed(2)}，请到订单管理审核付款。`, `Shipping proof RM${Number(data.amount || 0).toFixed(2)} submitted. Review it in Order Management.`));
      setSupplementalDialogOpen(false);
      setSupplementalReceiptUrl("");
      setSupplementalNotes("");
      utils.packing.detail.invalidate({ orderId });
      utils.shippingV2.specialOrderActions.invalidate({ orderId });
    },
    onError: (err: any) => toast.error(translate("提交补运费凭证失败: ", "Failed to submit shipping proof: ") + err.message),
  });
  const cashShippingRefundMutation = trpc.shippingV2.completeCashShippingRefund.useMutation({
    onSuccess: async () => {
      toast.success(translate("现金运费退款已记录并完成，订单已完成（已发货）", "Cash shipping refund recorded; order completed after shipment"));
      await utils.packing.detail.invalidate({ orderId });
      await utils.orders.invalidate();
      await utils.refunds.list.invalidate();
      await utils.dashboard.invalidate();
    },
    onError: (err: any) => toast.error(translate("现金退款记录失败: ", "Failed to record cash refund: ") + err.message),
  });

  async function uploadSupplementalReceipt(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(translate("文件不能超过 10MB", "File must not exceed 10MB"));
      return;
    }
    setUploadingSupplementalReceipt(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: dataUrl, filename: file.name, contentType: file.type }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.url) throw new Error(payload.error || "Upload failed");
      setSupplementalReceiptUrl(payload.url);
      toast.success(translate("补运费凭证已上传", "Supplemental shipping receipt uploaded"));
    } catch (error: any) {
      toast.error(error?.message || translate("上传失败", "Upload failed"));
    } finally {
      setUploadingSupplementalReceipt(false);
    }
  }

  const parcelKingServicesQuery = trpc.parcelking.getServices.useQuery(undefined, {
    enabled: !!detail,
  });

  const createParcelKingMutation = trpc.shipping.createParcelKing.useMutation({
    onSuccess: (data: any) => {
            toast.success(translate(
        "Parcel King 运单已创建！追踪号: {trackingNumber}{testSuffix}",
        "Parcel King waybill created. Tracking No: {trackingNumber}{testSuffix}",
        { trackingNumber: data.trackingNumber, testSuffix: data.testMode ? " (Test)" : "" },
      ));
      utils.packing.list.invalidate();
      utils.packing.detail.invalidate({ orderId });
      utils.shipping.packages.invalidate({ orderId });
      setPackages([{ courier: "Line Clear", shippingType: "manual", trackingNumber: "", weight: "1", serviceId: "" }]);
      setSelectedItems([]);
    },
    onError: (err) => toast.error(translate(`Parcel King 发货失败: ${err.message}`, `Parcel King Shipping Failed: ${err.message}`)),
  });

  const autoShipParcelDailyMutation = trpc.shipping.autoShipParcelDaily.useMutation({
    onSuccess: (data: any) => {
      toast.success(translate(
        `已自动生成 ${data.courier} 运单，追踪号：${data.trackingNumber}`,
        `${data.courier} shipment created automatically. Tracking No: ${data.trackingNumber}`,
      ));
      if (data.shippingLabelUrl) window.open(data.shippingLabelUrl, "_blank", "noopener,noreferrer");
      if (data.notificationStatus !== "sent") {
        toast.warning(translate("运单已生成，但客户通知未自动发送，请在通知记录中处理。", "The shipment was created, but the customer notice was not sent automatically. Please handle it in notification records."));
      }
      utils.packing.list.invalidate();
      utils.packing.detail.invalidate({ orderId });
      utils.shipping.packages.invalidate({ orderId });
      setSelectedItems([]);
    },
    onError: (err: any) => toast.error(translate("自动生成运单失败：", "Automatic shipment creation failed: ") + err.message),
  });

  const createExceptionMutation = trpc.orderException.create.useMutation({
    onSuccess: () => {
      // V2.1.26补充4: Don't close dialog here - the inline onSuccess in save handler decides whether to close
      // This global onSuccess just invalidates queries to refresh data
      utils.packing.detail.invalidate({ orderId });
      utils.orderException.list.invalidate({ orderId });
    },
    onError: (err) => toast.error("创建异常失败: " + err.message),
  });

  const updateExceptionMutation = trpc.orderException.update.useMutation({
    onSuccess: () => {
      toast.success(translate("异常已更新", "Exception updated"));
      setExceptionDialogOpen(false);
      setEditingExceptionId(null);
      utils.packing.detail.invalidate({ orderId });
      utils.orderException.list.invalidate({ orderId });
    },
    onError: (err) => toast.error(translate("更新异常失败: ", "Failed to update exception: ") + err.message),
  });

  // V3.3: A packing exception is cancelled rather than physically deleted.
  const cancelExceptionMutation = trpc.orderException.cancel.useMutation({
    onSuccess: () => {
      toast.success(translate("异常已取消，历史记录已保留", "Exception cancelled; its history is retained"));
      utils.packing.detail.invalidate({ orderId });
      utils.orderException.list.invalidate({ orderId });
      utils.packing.list.invalidate();
    },
    onError: (err) => toast.error(translate("取消异常失败: ", "Failed to cancel exception: ") + err.message),
  });

  // V2.1.26补充6: Mark exception as resolved (Issue 8)
  const markResolvedMutation = trpc.orderException.markResolved.useMutation({
    onSuccess: () => {
      toast.success(translate("异常已关闭", "Exception closed"));
      utils.packing.detail.invalidate({ orderId });
      utils.orderException.list.invalidate({ orderId });
      utils.packing.list.invalidate();
    },
    onError: (err) => toast.error("处理失败: " + err.message),
  });

  const resolveExceptionMutation = trpc.orderException.resolve.useMutation({
    onSuccess: (data: any) => {
      const refund = data?.exception?.linkedRefund;
      toast.success(refund?.refundNumber
        ? translate(`已建立待处理退款 ${refund.refundNumber}，请到退款管理完成退款。`, `Pending refund ${refund.refundNumber} created. Complete it in Refund Management.`)
        : translate("异常已处理", "Exception handled"));
      setExceptionDialogOpen(false);
      setExceptionDesc("");
      setExceptionItemId("");
      setReplacementProductId("");
      setReplacementQty(1);
      setExceptionQuantity(1);
      setCustomerAction("pending");
      setRefundMethod("credit");
      setCustomerRefundDetails("");
      setCustomerRefundQrUrl("");
      setRefundAttachmentUrls([]);
      setRefundInternalNotes("");
      setProductSearchQuery("");
      setProductSearchResults([]);
      setReplacementUnitPrice(0);
      setReplacementProductName("");
      utils.packing.detail.invalidate({ orderId });
      utils.packing.list.invalidate();
    },
    onError: (err) => toast.error("处理异常失败: " + err.message),
  });

  const cancelPackingItemMutation = trpc.orderException.cancelPackingItem.useMutation({
    onSuccess: (data: any) => {
      const settlement = data?.settlement;
      const message = settlement?.type === "pending_refund"
        ? `已取消商品并重算订单；建立待退款 ${data.refund?.refundNumber || ""} RM${Number(settlement.amount || 0).toFixed(2)}，请到退款管理完成。`
        : settlement?.type === "pending_shipping"
          ? `已取消商品并重算订单；仍待汇款差价 RM${Number(settlement.amount || 0).toFixed(2)}。`
          : "已取消商品，库存、估计重量及运费已重新计算。";
      toast.success(translate(message, message));
      setExceptionDialogOpen(false);
      setExceptionDesc("");
      setExceptionItemId("");
      setExceptionQuantity(1);
      setCustomerAction("pending");
      setRefundMethod("credit");
      setCustomerRefundDetails("");
      setCustomerRefundQrUrl("");
      setRefundAttachmentUrls([]);
      setRefundInternalNotes("");
      utils.packing.detail.invalidate({ orderId });
      utils.packing.fulfilmentSummary.invalidate({ orderId });
      utils.packing.list.invalidate();
      utils.orderException.list.invalidate({ orderId });
      utils.orders.list.invalidate();
      utils.products.list.invalidate();
    },
    onError: (err) => toast.error("取消商品失败: " + err.message),
  });

  const { data: exceptions } = trpc.orderException.list.useQuery({ orderId }, { enabled: !!detail });

  async function uploadRefundAttachment(file: File, target: "attachment" | "customer_qr" = "attachment") {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(translate("文件不能超过 10MB", "File must not exceed 10MB"));
      return;
    }
    setUploadingRefundAttachment(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: dataUrl, filename: file.name, contentType: file.type }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.url) throw new Error(payload.error || "Upload failed");
      if (target === "customer_qr") setCustomerRefundQrUrl(payload.url);
      else setRefundAttachmentUrls((urls) => [...urls, payload.url]);
      toast.success(translate(target === "customer_qr" ? "客户退款收款二维码已上传" : "客户问题附件已上传", target === "customer_qr" ? "Customer refund QR uploaded" : "Customer issue attachment uploaded"));
    } catch (error: any) {
      toast.error(error?.message || translate("上传失败", "Upload failed"));
    } finally {
      setUploadingRefundAttachment(false);
    }
  }

  const redownloadLabelMutation = trpc.shipping.redownloadLabel.useMutation({
    onSuccess: (data: any) => {
      if (data.success && data.url) {
        window.open(data.url, "_blank");
              toast.success(translate("标签已打开", "Label opened"));
      } else {
              toast.error(translate("下载标签失败: ", "Failed to download label: ") + (data.error || translate("未知错误", "Unknown error")));
      }
    },
    onError: (err: any) => toast.error(translate("下载标签失败: ", "Failed to download label: ") + err.message),
  });

  const resyncTrackingMutation = trpc.shipping.resyncTracking.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
              toast.success(translate(`追踪已同步！最新状态: ${data.newStatus}`, `Tracking synced! Latest status: ${data.newStatus}`));
        utils.shipping.packages.invalidate({ orderId });
      } else {
              toast.error(translate("同步失败: ", "Sync failed: ") + (data.error || translate("未知错误", "Unknown error")));
      }
    },
    onError: (err) => toast.error(translate("同步失败: ", "Sync failed: ") + err.message),
  });

  const fullShipMutation = trpc.shipping.fullShip.useMutation({
    onSuccess: () => {
            toast.success(translate("发货成功！订单状态已更新为已发货", "Shipment successful! Order status updated to shipped"));
      utils.packing.list.invalidate();
      utils.packing.detail.invalidate({ orderId });
      utils.shipping.packages.invalidate({ orderId });
    },
    onError: (err) => toast.error(translate(`发货失败: ${err.message}`, `Shipment failed: ${err.message}`)),
  });

  const partialShipMutation = trpc.shipping.partialShip.useMutation({
    onSuccess: (data: any) => {
      if (data.allShipped) {
                toast.success(translate("部分发货成功！所有商品已全部发出，订单状态更新为已发货", "Partial shipment successful! All items have been sent, order status updated to shipped"));
      } else {
                toast.success(translate("部分发货成功！订单状态更新为部分发货", "Partial shipment successful! Order status updated to partial shipped"));
      }
      utils.packing.list.invalidate();
      utils.packing.detail.invalidate({ orderId });
      utils.shipping.packages.invalidate({ orderId });
      setSelectedItems([]);
    },
    onError: (err) => toast.error(translate(`发货失败: ${err.message}`, `Shipment failed: ${err.message}`)),
  });

  const handleShip = async (mode: "full" | "partial") => {
    if (isWaitingRestockPartialOnly && mode === "full") {
      toast.error(translate("此订单仍有等待补货商品，请只选择其他现货商品进行部分发货", "A restock item remains. Ship only the other available items as a partial shipment."));
      return;
    }
    const shippingMethod = (detail as any)?.shippingMethod || "west_malaysia";
    const requiresParcelDaily = shippingMethod === "west_malaysia" || shippingMethod === "east_malaysia_poslaju";
    const hasAutoParcelDailyPackage = requiresParcelDaily && packages.some((pkg) => pkg.shippingType === "auto");
    const missingAddressFields = shippingMethod === "self_pickup"
      ? []
      : getMissingPackingRecipientAddressFields(detail as any, lang);
    if (missingAddressFields.length > 0) {
      toast.error(translate(
        `收件资料不完整，请先补齐：${missingAddressFields.join("、")}`,
        `Recipient details are incomplete. Complete: ${missingAddressFields.join(", ")}`,
      ));
      return;
    }
    const actualWeight = Number((detail as any)?.actualWeight || 0);
    const existingPackageWeight = ((detail as any)?.packages || []).reduce(
      (sum: number, pkg: any) => sum + Math.max(0, Number(pkg.weight || 0)),
      0,
    );
    if (hasAutoParcelDailyPackage) {
      if (packages.some((pkg) => pkg.shippingType !== "auto")) {
        toast.error(translate("同一次自动发货的包裹请统一选择自动模式；手动包裹请另行确认发货", "Use automatic mode for every package in one automatic shipment; confirm manual packages separately"));
        return;
      }
      const packageWeights = packages.map((pkg) => Number(pkg.weight));
      if (packageWeights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
        toast.error(translate("请为每个包裹填写大于 0 的实际重量", "Enter a valid weight greater than 0 for every package"));
        return;
      }
      if (mode === "partial" && packages.length > 1) {
        toast.error(translate("部分发货请一次建立一个包裹，避免商品归属不明确", "Create one package per partial shipment to keep item assignment clear"));
        return;
      }
      if (mode === "partial" && selectedItems.length === 0) {
        toast.error(translate("请选择本次发出的商品", "Please select items for this shipment"));
        return;
      }
      const itemQuantities = selectedItems
        .filter((itemId) => shipQuantities[itemId] !== undefined)
        .map((itemId) => ({ itemId: String(itemId), quantity: shipQuantities[itemId] }));
      const packageWeightTotal = packageWeights.reduce((sum, weight) => sum + weight, 0);
      try {
        // 先以各包裹的合计重量回写订单，继续沿用既有运费差额与特别订单规则。
        if (Math.abs(actualWeight - packageWeightTotal) > 0.001) {
          await updateWeightMutation.mutateAsync({ orderId, actualWeight: packageWeightTotal });
        }
        await autoShipParcelDailyMutation.mutateAsync({
          orderId,
          actualWeight: packageWeightTotal,
          mode,
          itemIds: mode === "partial" ? selectedItems : undefined,
          itemQuantities: itemQuantities.length > 0 ? itemQuantities : undefined,
          packages: packageWeights.map((weightKg) => ({ weightKg })),
        });
      } catch {
        // Mutation callbacks display the actionable backend error.
      }
      return;
    }
    if (mode === "full") {
      if (packages.length === 0) {
                toast.error(translate("请至少添加一个包裹", "Please add at least one package"));
        return;
      }
      const hasIncompleteManualPackage = packages.some((p) => p.shippingType === "manual" && (!p.trackingNumber || !p.shippingLabelUrl));
      if (hasIncompleteManualPackage) {
                toast.error(translate("手动发货必须填写追踪号并上传 AWB", "Manual shipping requires a tracking number and an AWB upload"));
        return;
      }
      const packageWeightTotal = packages.reduce((sum, pkg) => sum + Number(pkg.weight || 0), 0);
      if (!Number.isFinite(packageWeightTotal) || packageWeightTotal <= 0) {
        toast.error(translate("请为每个包裹填写大于 0 的实际重量", "Enter a valid weight greater than 0 for every package"));
        return;
      }
      try {
        await fullShipMutation.mutateAsync({
          orderId,
          packages: packages.map((p) => ({
            courier: p.courier,
            shippingType: p.shippingType as "auto" | "manual",
            trackingNumber: p.trackingNumber || undefined,
            shippingLabelUrl: p.shippingLabelUrl || undefined,
            weight: p.weight,
          })),
        });
        await updateWeightMutation.mutateAsync({ orderId, actualWeight: packageWeightTotal });
      } catch {
        // 各Mutation已展示可执行的错误信息。
      }
    } else {
      if (selectedItems.length === 0) {
                toast.error(translate("请选择本次发出的商品", "Please select items for this shipment"));
        return;
      }
      if (packages.length === 0) {
                toast.error(translate("请至少添加一个包裹", "Please add at least one package"));
        return;
      }
      if (packages.length > 1) {
        toast.error(translate("部分发货一次只可建立一个包裹", "Partial shipping supports one package per shipment"));
        return;
      }
      const pkg = packages[0];
      if (pkg.shippingType === "manual" && (!pkg.trackingNumber || !pkg.shippingLabelUrl)) {
                toast.error(translate("手动发货必须填写追踪号并上传 AWB", "Manual shipping requires a tracking number and an AWB upload"));
        return;
      }
      const newPackageWeight = Number(pkg.weight || 0);
      if (!Number.isFinite(newPackageWeight) || newPackageWeight <= 0) {
        toast.error(translate("请填写大于 0 的实际包裹重量", "Enter a valid actual package weight greater than 0"));
        return;
      }
      // V2.1.26补充4: Pass per-item ship quantities (Issue 7)
      const itemQuantities = selectedItems
        .filter((itemId) => shipQuantities[itemId] !== undefined)
        .map((itemId) => ({ itemId: String(itemId), quantity: shipQuantities[itemId] }));
      try {
        const result = await partialShipMutation.mutateAsync({
          orderId,
          itemIds: selectedItems,
          packageData: {
            courier: pkg.courier,
            shippingType: pkg.shippingType as "auto" | "manual",
            trackingNumber: pkg.trackingNumber || undefined,
            shippingLabelUrl: pkg.shippingLabelUrl || undefined,
            weight: pkg.weight,
          },
          itemQuantities: itemQuantities.length > 0 ? itemQuantities : undefined,
        });
        if (result.allShipped) {
          await updateWeightMutation.mutateAsync({ orderId, actualWeight: existingPackageWeight + newPackageWeight });
        }
      } catch {
        // 各Mutation已展示可执行的错误信息。
      }
    }
  };

  const toggleItem = (itemId: number) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  // V2.1.26补充4: Update ship quantity for a specific item (Issue 7)
  const updateShipQuantity = (itemId: number, qty: number, maxQty: number) => {
    const clampedQty = Math.max(1, Math.min(qty, maxQty));
    setShipQuantities((prev) => ({ ...prev, [itemId]: clampedQty }));
  };

  const addPackage = () => {
    setPackages((prev) => [...prev, { courier: "Line Clear", shippingType: "manual", trackingNumber: "", weight: "1", serviceId: "" }]);
  };

  const removePackage = (index: number) => {
    setPackages((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePackage = (index: number, field: string, value: string) => {
    setPackages((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  async function uploadShippingLabel(index: number, file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(translate("AWB 文件不能超过 10MB", "AWB file must not exceed 10MB"));
      return;
    }
    setUploadingAwbIndex(index);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: dataUrl, filename: file.name, contentType: file.type }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.url) throw new Error(payload.error || "Upload failed");
      updatePackage(index, "shippingLabelUrl", payload.url);
      toast.success(translate("AWB 已上传", "AWB uploaded"));
    } catch (error: any) {
      toast.error(error?.message || translate("上传 AWB 失败", "Failed to upload AWB"));
    } finally {
      setUploadingAwbIndex(null);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
        return <div className="text-center py-12 text-muted-foreground">{translate("加载中...", "Loading...")}</div>;
  }

  if (!detail) {
        return <div className="text-center py-12 text-muted-foreground">{translate("订单不存在", "Order not found")}</div>;
  }

  const d = detail as any;
  const missingAddressFields = d.shippingMethod === "self_pickup" ? [] : getMissingPackingRecipientAddressFields(d, lang);
  const specialLabel = d.shippingMethod === "lalamove" ? "LALAMOVE" :
    d.shippingMethod === "east_malaysia_shopee" ? translate("东马 SHOPEE", "East Malaysia SHOPEE") :
    d.shippingMethod === "east_malaysia_poslaju" ? translate("东马 POSLAJU", "East Malaysia POSLAJU") : "";
  const estimatedWeightKg = Number(d.estimatedWeight ?? d.totalWeight ?? 0);
  const actualWeightKg = d.actualWeight === null || d.actualWeight === undefined ? null : Number(d.actualWeight);
  const customerPaidShipping = Number(d.customerPaidShipping ?? d.shippingFee ?? 0);
  const actualWeightShippingFee = d.actualShippingFee === null || d.actualShippingFee === undefined
    ? null
    : Number(d.actualShippingFee);
  const shippingDifference = d.shippingDifference === null || d.shippingDifference === undefined
    ? null
    : Number(d.shippingDifference);
  const approvedSupplementalShipping = ((d.payments || []) as any[])
    .filter((payment) => payment.reviewStatus === "approved" && String(payment.purpose || "").startsWith("supplemental_shipping:"))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const completedRefundAmount = ((d.refunds || []) as any[])
    .filter((refund) => refund.status === "processed" || refund.status === "awaiting_return")
    .reduce((sum, refund) => sum + Number(refund.amount || refund.requestedAmount || 0), 0);
  const pendingRefundAmount = ((d.refunds || []) as any[])
    .filter((refund) => !["processed", "awaiting_return", "rejected", "cancelled"].includes(String(refund.status || "").toLowerCase()))
    .reduce((sum, refund) => sum + Number(refund.requestedAmount || refund.amount || 0), 0);
  const checkoutOrderTotal = Number(d.totalAmount || 0);
  const checkoutReceived = Number(d.paidAmount || 0);
  const financialSettlement = derivePackingFinancialSettlement({
    currentOrderDue: checkoutOrderTotal,
    checkoutReceipts: checkoutReceived,
    approvedSupplementalShipping,
    completedRefunds: completedRefundAmount,
    pendingRefunds: pendingRefundAmount,
  });
  const canManagePacking = d.physicalStatus === "packing" || d.physicalStatus === "partial_shipped";
  const packingShippingControl = (d as any).packingShippingControl || getPackingShippingControl(d);
  const isPackingBlocked = packingShippingControl.mode === "block" || packingShippingControl.mode === "requires_release";
  const isWaitingRestockPartialOnly = packingShippingControl.mode === "partial_only";
  const canShip = canManagePacking && !isPackingBlocked;
  const activeShippingMode = d.physicalStatus === "partial_shipped" || isWaitingRestockPartialOnly ? "partial" : shippingMode;
  const fulfilmentByItem = new Map(
    ((fulfilmentSummary || []) as any[]).map((row) => [Number(row.orderItemId), row]),
  );
  const shippableItems = (d.items as any[]).map((item) => {
    const summary = fulfilmentByItem.get(Number(item.id));
    const remainingQuantity = summary ? Number(summary.remainingQuantity || 0) : Number(item.quantity || 0);
    const shippedQuantity = summary ? Number(summary.shippedQuantity || 0) : 0;
    return { ...item, remainingQuantity, shippedQuantity };
  }).filter((item) => item.remainingQuantity > 0);
  const compatibleMergeCandidates = ((mergeCandidates || []) as any[]).filter((candidate) => Number(candidate.id) !== Number(orderId));
  const selectedMergeCandidate = compatibleMergeCandidates.find((candidate) => Number(candidate.id) === mergeCandidateId) || null;
  const canMergeRemainingShipment = canShip && !isWaitingRestockPartialOnly && compatibleMergeCandidates.length > 0;
  const trackedPackageNumbers = ((existingPackages || []) as any[])
    .map((pkg) => String(pkg.trackingNumber || "").trim())
    .filter(Boolean);
  const courierForNotice = ((existingPackages || []) as any[])
    .map((pkg) => pkg.courier || pkg.courierCompany)
    .find(Boolean) || getAutoCourier(d.shippingMethod || "west_malaysia");
  const copyPendingShippingNotice = async () => {
    const trackingNumbers = trackedPackageNumbers.join("、") || translate("请填写追踪号码", "please enter tracking number");
    const message = `老板娘/老板您好，我们已为您发货啦，收到包裹如有问题记得48小时内发图/视频给我们哦，追踪号码：${trackingNumbers}，快递公司：${courierForNotice}`;
    await navigator.clipboard.writeText(message);
    toast.success(translate("发货通知已复制，可手动发送给客户", "Shipping notice copied for manual sending"));
  };

  return (
    <div className="space-y-6">
      {/* Header - not printable */}
      <div className="flex items-center justify-between print-hide">
        <div className="flex items-center gap-4">
          <Link href="/packing">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />{translate("返回", "Back")}</Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{d.orderNumber}</h1>
              {/* V2.1.26: Move A5 print button next to order number */}
              <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" />{translate("A5打印", "A5 Print")}</Button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {specialLabel && <Badge variant="destructive">{specialLabel}</Badge>}
              {d.shippedAt && (
                <span className="text-xs text-muted-foreground">
                  {translate("发货日期", "Shipped at")}: {new Date(d.shippedAt).toLocaleString()}
                </span>
              )}
              {d.notificationStatus && (
                <>
                  <Badge variant={d.notificationStatus === "sent" ? "secondary" : "destructive"}>
                    {d.notificationStatus === "sent"
                      ? translate("追踪通知已发送", "Tracking notice sent")
                      : translate("追踪通知未自动发送", "Tracking notice not sent automatically")}
                  </Badge>
                  {d.notificationStatus !== "sent" && trackedPackageNumbers.length > 0 && (
                    <span className="text-xs font-medium text-destructive">
                      {translate("待补发追踪号", "Tracking number to send")}: {trackedPackageNumbers.join("、")}
                    </span>
                  )}
                  {d.notificationStatus !== "sent" && trackedPackageNumbers.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => void copyPendingShippingNotice()}>
                      <Copy className="h-3.5 w-3.5 mr-1" />{translate("复制通知", "Copy notice")}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Info */}
      <Card className="print-hide">
        <CardHeader><CardTitle className="text-base">{translate("客户信息", "Customer Information")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-muted-foreground" />{d.customerName}</div>
          <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" />{d.customerPhone}</div>
          <div className="flex items-start gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />{d.shippingAddress}</div>
        </CardContent>
      </Card>

      <Card className="print-hide border-slate-200 bg-slate-50/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">{translate("订单财务结算摘要", "Order Financial Settlement")}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span>{translate("当前订单应收", "Current Order Due")}</span><span className="font-medium">RM {financialSettlement.currentOrderDue.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>{translate("已确认收款（退款前）", "Confirmed Receipts Before Refund")}</span><span>RM {financialSettlement.confirmedReceipts.toFixed(2)}</span></div>
          {d.specialOrderType === "pending_shipping" && d.specialOrderStatus === "pending" && <div className="flex justify-between text-amber-800"><span>{translate("待汇款差价", "Pending Remittance Difference")}</span><span>RM {Number(d.shippingDifference || 0).toFixed(2)}</span></div>}
          {approvedSupplementalShipping > 0 && <div className="flex justify-between text-emerald-700"><span>{translate("补差价已收", "Supplemental Shipping Received")}</span><span>+RM {approvedSupplementalShipping.toFixed(2)}</span></div>}
          {pendingRefundAmount > 0 && <div className="flex justify-between text-amber-800"><span>{translate("待退款（未完成）", "Pending Refund")}</span><span>-RM {pendingRefundAmount.toFixed(2)}</span></div>}
          {completedRefundAmount > 0 && <div className="flex justify-between text-rose-700"><span>{translate("已完成退款", "Completed Refunds")}</span><span>-RM {completedRefundAmount.toFixed(2)}</span></div>}
          <Separator />
          <div className="flex justify-between"><span>{translate("当前实际净实收（未完成退款前）", "Current Net Received Before Pending Refund")}</span><span>RM {financialSettlement.currentActualNetReceived.toFixed(2)}</span></div>
          {pendingRefundAmount > 0 && <div className="flex justify-between font-semibold text-emerald-800"><span>{translate("退款处理后预计净实收", "Projected Net After Refund")}</span><span>RM {financialSettlement.projectedNetAfterPendingRefund.toFixed(2)}</span></div>}
          <p className="text-xs text-muted-foreground">{translate("当前订单应收与订单管理相同；已确认收款和待退款单独展示，避免把未退回金额误认作订单总额。", "Current order due matches Order Management. Confirmed receipts and pending refunds are shown separately so unrefunded cash is not mistaken for the order total.")}</p>
        </CardContent>
      </Card>

      <Card className="print-hide border-sky-200 bg-sky-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-sky-950">
            <Package className="h-4 w-4 text-sky-700" />
            {translate("重量与运费对照", "Weight & Shipping Summary")}
          </CardTitle>
          <p className="text-xs text-sky-800">
            {translate("预计重量按订单商品／规格重量×数量计算；实际重量按已建立包裹合计。", "Estimated weight uses item weight × quantity; actual weight uses all saved packages.")}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-sky-100 bg-background p-3">
              <div className="text-xs text-muted-foreground">{translate("预计重量", "Estimated weight")}</div>
              <div className="mt-1 text-lg font-bold">{estimatedWeightKg.toFixed(2)} kg</div>
            </div>
            <div className="rounded-lg border border-sky-100 bg-background p-3">
              <div className="text-xs text-muted-foreground">{translate("实际重量", "Actual weight")}</div>
              <div className="mt-1 text-lg font-bold">{actualWeightKg === null ? translate("尚未包货", "Not packed yet") : `${actualWeightKg.toFixed(2)} kg`}</div>
            </div>
            <div className="rounded-lg border border-sky-100 bg-background p-3">
              <div className="text-xs text-muted-foreground">{translate("客户结账已付运费", "Shipping paid at checkout")}</div>
              <div className="mt-1 text-lg font-bold">RM {customerPaidShipping.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border border-sky-100 bg-background p-3">
              <div className="text-xs text-muted-foreground">{translate("按实际重量应收运费", "Shipping due by actual weight")}</div>
              <div className="mt-1 text-lg font-bold">{actualWeightShippingFee === null ? "—" : `RM ${actualWeightShippingFee.toFixed(2)}`}</div>
            </div>
          </div>
          {shippingDifference !== null && Math.abs(shippingDifference) > 0.001 && (
            <div className={`mt-3 rounded-lg border p-3 text-sm ${shippingDifference > 0 && detail?.specialOrderType === "pending_shipping" && detail?.specialOrderStatus === "resolved" ? "border-emerald-300 bg-emerald-50 text-emerald-950" : shippingDifference > 0 ? "border-amber-300 bg-amber-50 text-amber-950" : "border-emerald-300 bg-emerald-50 text-emerald-950"}`}>
              {shippingDifference > 0
                ? detail?.specialOrderType === "pending_shipping" && detail?.specialOrderStatus === "resolved"
                  ? translate(`补运费已审核确认：RM ${shippingDifference.toFixed(2)}`, `Supplemental shipping approved: RM ${shippingDifference.toFixed(2)}`)
                  : translate(`需补收运费：RM ${shippingDifference.toFixed(2)}`, `Additional shipping to collect: RM ${shippingDifference.toFixed(2)}`)
                : translate(`应退运费：RM ${Math.abs(shippingDifference).toFixed(2)}`, `Shipping to refund: RM ${Math.abs(shippingDifference).toFixed(2)}`)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Items - Color display for packing */}
      <Card className="print-hide">
        <CardHeader><CardTitle className="text-base">{translate("商品列表（彩色照片）", "Product List (Color Photos)")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {(d.items as any[]).map((item) => (
              <div key={item.id} className="flex gap-4 items-start border rounded-lg p-3">
                {/* Product Image */}
                <ProductImagePreview
                  src={item.coverImageUrl}
                  alt={item.productName}
                  className="h-24 w-24"
                  label={translate("预览商品图片", "Preview product image")}
                />
                {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base">{item.productName}</div>
                    {item.variationName && <div className="text-sm text-muted-foreground">{item.variationName}</div>}
                    {item.keyword && <div className="text-xs text-muted-foreground">{translate("关键词:", "Keyword:")} {item.keyword}</div>}
                    <div className="mt-1 text-sm text-muted-foreground">
                      {translate("单价", "Unit price")}: RM {Number(item.unitPrice || 0).toFixed(2)} × {item.quantity}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {translate("总价", "Total")}: RM {Number(item.subtotal || Number(item.unitPrice || 0) * Number(item.quantity || 0)).toFixed(2)}
                    </div>
                  </div>
                {/* Large Quantity */}
                <div className="flex flex-col items-center justify-center">
                  <div className={`text-3xl font-bold ${item.quantity > 1 ? "border-4 border-primary rounded-lg px-3 py-1" : ""}`}>
                    ×{item.quantity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Existing Packages */}
      {existingPackages && (existingPackages as any[]).length > 0 && (
        <Card className="print-hide">
          <CardHeader><CardTitle className="text-base">{translate("已有包裹", "Existing Packages")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(existingPackages as any[]).map((pkg: any) => (
              <div key={pkg.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">{translate("包裹", "Package")} {pkg.packageNumber} - {pkg.courier}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {pkg.batchNo && <Badge variant="outline" className="text-[11px]">{translate(`履约批次 #${pkg.batchNo}`, `Fulfilment batch #${pkg.batchNo}`)}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{translate("追踪号:", "Tracking:")} {pkg.trackingNumber || translate("未填写", "Not filled")}</div>
                    {pkg.weight && <div className="text-xs text-muted-foreground">{translate("重量", "Weight")}: {pkg.weight} kg</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pkg.shippingLabelUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={pkg.shippingLabelUrl} target="_blank" rel="noreferrer">
                        <Printer className="h-4 w-4 mr-1" />{translate("打开 AWB", "Open AWB")}
                      </a>
                    </Button>
                  )}
                  {/* Fallback only for packages without a saved label URL. */}
                  {pkg.providerOrderId && pkg.trackingNumber && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => redownloadLabelMutation.mutate({ trackingNo: pkg.trackingNumber })}
                        disabled={redownloadLabelMutation.isPending || !!pkg.shippingLabelUrl}
                      >
                        <Printer className="h-4 w-4 mr-1" />{translate("重新获取 AWB", "Refresh AWB")}
                      </Button>
                    </>
                  )}
                  {/* Resync tracking button for Parcel King packages */}
                  {pkg.providerOrderId && pkg.trackingNumber && pkg.shippingType === "parcelking" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resyncTrackingMutation.mutate({ trackingNo: pkg.trackingNumber, packageId: pkg.id })}
                      disabled={resyncTrackingMutation.isPending}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />{translate("同步追踪", "Sync Tracking")}
                    </Button>
                  )}
                  {pkg.status && (
                    <Badge
                      className={`text-xs ${pkg.status === "shipped" ? "bg-green-500" : pkg.status === "pending" ? "bg-yellow-500" : "bg-gray-500"}`}
                    >
                      {pkg.status === "shipped" ? translate("已发货", "Shipped") : pkg.status === "pending" ? translate("待处理", "Pending") : translate("未知", "Unknown")}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 包货工作台仅展示履约进度；待处理特别订单仍须可见以便交接。 */}
      {canManagePacking && (
        <Card className="print-hide">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4 text-violet-600" />{translate("履约进度", "Fulfilment Progress")}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{translate("部分发货以每项实际已发数量计算；当同客户订单的收件资料与物流方式一致时，可在下方“合并剩余订单发货”共同出货。", "Partial shipping is calculated from actual quantities. When a same-customer order has matching recipient and shipping details, use Merge Remaining Orders below to ship together.")}</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(fulfilmentSummary || []).map((item: any) => {
                const orderItem = (d.items || []).find((row: any) => Number(row.id) === Number(item.orderItemId));
                return <div key={item.orderItemId} className="rounded-md border p-2 text-sm"><div className="truncate font-medium">{orderItem?.productName || translate("商品", "Item")}</div><div className="mt-1 text-xs text-muted-foreground">{translate(`已发 ${item.shippedQuantity} · 待发 ${item.remainingQuantity}`, `Shipped ${item.shippedQuantity} · Remaining ${item.remainingQuantity}`)}</div></div>;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exception Handling - keep available for packing/partial-shipped orders, including pending special follow-up. */}
      {canManagePacking && (
        <Card className="print-hide border-orange-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              {translate("异常处理", "Exception Handling")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing exceptions */}
            {exceptions && (exceptions as any[]).length > 0 && (
              <div className="space-y-2">
                {(exceptions as any[]).map((exc: any) => (
                  <div key={exc.id} className="flex items-center justify-between gap-3 border rounded-lg p-3 bg-orange-50 dark:bg-orange-950/20">
                    <div className="text-sm flex-1">
                      <Badge variant={exc.status === "resolved" ? "secondary" : "destructive"} className="mr-2">
                        {exc.status === "resolved" ? translate("已处理", "Resolved") : translate("待处理", "Open")}
                      </Badge>
                      {exc.exceptionType === "out_of_stock" ? translate("商品缺货", "Out of Stock") :
                       exc.exceptionType === "quality_issue" ? translate("植物品质异常", "Quality Issue") :
                       exc.exceptionType === "overcharged_shipping" ? translate("运费多收", "Overcharged Shipping") :
                       exc.exceptionType === "delivery_delay" ? translate("配送／到货延迟", "Delivery Delay") :
                       exc.exceptionType === "cancelled_item" ? translate("商品取消", "Cancelled Item") :
                       translate("其他异常", "Other")}
                      {exc.quantity > 0 && <span className="text-muted-foreground ml-2">×{exc.quantity}</span>}
                      {exc.customerAction && exc.customerAction !== "pending" && (
                        <span className="text-muted-foreground ml-2">—
                          {exc.customerAction === "replace_product" ? translate("更换商品", "Replace Product") :
                           exc.customerAction === "wait_restock" ? translate("等待补货", "Wait Restock") :
                           exc.customerAction === "refund" ? translate("退款", "Refund") : ""}
                        </span>
                      )}
                      {exc.waitingForRestock && exc.status !== "resolved" && (
                        <Badge className="ml-2 border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100">
                          {translate("等待补货", "Waiting for restock")}
                        </Badge>
                      )}
                      {exc.description && <span className="text-muted-foreground ml-2">— {exc.description}</span>}
                      {(exc.items || []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1 text-xs">
                          {(exc.items || []).map((item: any) => (
                            <Badge key={item.id} variant="outline" className="border-orange-200 text-orange-800">
                              {item.productName} ×{item.quantity}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {exc.linkedRefund && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <Badge className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50">
                            {translate("关联退款", "Linked refund")}: {exc.linkedRefund.refundNumber}
                          </Badge>
                          <Badge variant="outline" className={exc.linkedRefund.status === "processed" ? "border-emerald-200 text-emerald-700" : exc.linkedRefund.status === "pending" ? "border-amber-200 text-amber-700" : "border-slate-200 text-slate-700"}>
                            {exc.linkedRefund.status === "pending" ? translate("未处理", "Pending") : exc.linkedRefund.status === "processed" ? translate("已处理", "Processed") : exc.linkedRefund.status === "awaiting_return" ? translate("待退货确认", "Awaiting return") : exc.linkedRefund.status}
                          </Badge>
                          <Link href="/admin/refunds" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                            {translate("查看退款管理", "Open Refund Management")} <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {exc.status !== "resolved" && !exc.linkedRefund && (
                        <>
                          {/* V2.1.26补充6: Mark as resolved button (Issue 8) */}
                          {exc.waitingForRestock ? (
                            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                              {translate(
                                `请在进货管理的进货单确认收货。系统会按商品及规格自动分配到这张订单；当前已到货 ${Number(exc.restockAllocatedQuantity || 0)}/${Number(exc.quantity || 0)}，未到齐前不能手动关闭。`,
                                `Confirm the purchase receipt in Purchase Management. The system allocates the matching product and variant automatically; ${Number(exc.restockAllocatedQuantity || 0)}/${Number(exc.quantity || 0)} received so far, and this exception cannot be closed manually until complete.`,
                              )}
                            </p>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-300 text-green-600 hover:bg-green-50"
                              onClick={() => markResolvedMutation.mutate({ exceptionId: exc.id })}
                              disabled={markResolvedMutation.isPending}
                            >
                              {translate("已处理", "Resolved")}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingExceptionId(exc.id);
                              setExceptionType(exc.exceptionType);
                              setExceptionDesc(exc.description || "");
                              setExceptionItemId(exc.orderItemId ? Number(exc.orderItemId) : "");
                              setExceptionQuantity(exc.quantity || 1);
                              setCustomerAction(exc.customerAction || "pending");
                              setExceptionDialogOpen(true);
                            }}
                          >
                            {translate("修改", "Edit")}
                          </Button>
                        </>
                      )}
                      {exc.status === "open" && !exc.linkedRefund && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(translate("确定取消此异常？取消后会保留完整历史记录，且不能恢复为原异常。", "Cancel this exception? Its full history is retained and it cannot be restored to the original exception."))) {
                              cancelExceptionMutation.mutate({ exceptionId: exc.id });
                            }
                          }}
                          disabled={cancelExceptionMutation.isPending}
                        >
                          <X className="h-4 w-4" /> {translate("取消异常", "Cancel")}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Dialog open={exceptionDialogOpen} onOpenChange={(open) => {
              setExceptionDialogOpen(open);
              if (!open) setEditingExceptionId(null);
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-orange-300 text-orange-600">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {translate("新增异常处理", "New Exception")}
                </Button>
              </DialogTrigger>
              <LargeOperationDialogContent>
                <LargeOperationDialogHeader>
                  <DialogTitle>{editingExceptionId ? translate("修改异常处理", "Edit Exception") : translate("异常处理", "Exception Handling")}</DialogTitle>
                </LargeOperationDialogHeader>
                <LargeOperationDialogBody>
                <div className="space-y-4">
                  {/* Step 1: Exception Type */}
                  <div className="space-y-2">
                    <Label>{translate("异常类型", "Exception Type")}</Label>
                    <Select value={exceptionType} onValueChange={(v: any) => {
                      setExceptionType(v);
                      setCustomerAction(v === "overcharged_shipping" ? "refund" : "pending");
                      if (v === "overcharged_shipping") setExceptionItemId("");
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="out_of_stock">{translate("商品缺货", "Out of Stock")}</SelectItem>
                        <SelectItem value="quality_issue">{translate("植物品质异常", "Quality Issue")}</SelectItem>
                        <SelectItem value="overcharged_shipping">{translate("运费多收", "Overcharged Shipping")}</SelectItem>
                        <SelectItem value="delivery_delay">{translate("配送／到货延迟", "Delivery Delay")}</SelectItem>
                        <SelectItem value="cancelled_item">{translate("商品取消", "Cancelled Item")}</SelectItem>
                        <SelectItem value="other">{translate("其他异常", "Other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* V2.1.26补充6: Step 2: Select affected item - hidden for overcharged_shipping (Issue 9) */}
                  {exceptionType !== "overcharged_shipping" && (
                  <div className="space-y-2">
                    <Label>{translate("涉及商品", "Affected Item")}</Label>
                    <Select value={String(exceptionItemId)} onValueChange={(v) => { setExceptionItemId(Number(v)); const item = (d.items as any[]).find((it: any) => it.id === Number(v)); if (item) setExceptionQuantity(item.quantity); }}>
                      <SelectTrigger><SelectValue placeholder={translate("选择商品", "Select item")} /></SelectTrigger>
                      <SelectContent>
                        {(d.items as any[]).map((item: any) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.productName} {item.variationName && `(${item.variationName})`} ×{item.quantity}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )}

                  {/* V2.1.26补充6: Refund amount input for overcharged_shipping (Issue 9) */}
                  {exceptionType === "overcharged_shipping" && (
                    <div className="space-y-2 border rounded-lg p-3 bg-orange-50 dark:bg-orange-950/20">
                      <Label>{translate("退款金额 (RM)", "Refund Amount (RM)")}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={exceptionQuantity}
                        onChange={(e) => setExceptionQuantity(Math.max(0, Number(e.target.value)))}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-muted-foreground">{translate("输入需退给客户的运费差额", "Enter shipping overcharge to refund")}</p>
                    </div>
                  )}

                  {/* V2.1.26补充4: Step 2b: Quantity input (Issue 6a/6c/6e) - show for out_of_stock, quality_issue, other */}
                  {exceptionType !== "overcharged_shipping" && exceptionItemId !== "" && (
                    <div className="space-y-2">
                      <Label>{translate("异常数量", "Affected Quantity")}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={(d.items as any[]).find((it: any) => it.id === exceptionItemId)?.quantity || 1}
                        value={exceptionQuantity}
                        onChange={(e) => setExceptionQuantity(Math.max(1, Math.min(Number(e.target.value), (d.items as any[]).find((it: any) => it.id === exceptionItemId)?.quantity || 1)))}
                      />
                      <p className="text-xs text-muted-foreground">{translate("填写受影响的数量", "Enter the affected quantity")}</p>
                    </div>
                  )}

                  {/* Step 3: Description */}
                  <div className="space-y-2">
                    <Label>{translate("异常描述", "Description")}</Label>
                    <Input
                      value={exceptionDesc}
                      onChange={(e) => setExceptionDesc(e.target.value)}
                      placeholder={translate("描述异常情况...", "Describe the issue...")}
                    />
                  </div>

                  {/* V2.1.26补充4: Step 4: Customer Action (Issue 6b/6f) - show for out_of_stock, quality_issue, other */}
                  {exceptionType !== "overcharged_shipping" && (
                    <div className="space-y-2">
                      <Label>{translate("客户处理方式", "Customer Action")}</Label>
                      <Select value={customerAction} onValueChange={(v: any) => setCustomerAction(v)}>
                        <SelectTrigger><SelectValue placeholder={translate("选择处理方式", "Select action")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="replace_product">{translate("更换商品", "Replace Product")}</SelectItem>
                          <SelectItem value="wait_restock">{translate("等待补货", "Wait for Restock")}</SelectItem>
                          <SelectItem value="refund">{translate("退款", "Refund")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* V2.1.26补充4: Step 5: Product Search for replacement (Issue 6g) */}
                  {customerAction === "replace_product" && (
                    <div className="space-y-2 border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/20">
                      <Label>{translate("搜索更换商品", "Search Replacement Product")}</Label>
                      <Input
                        value={productSearchQuery}
                        onChange={(e) => {
                          setProductSearchQuery(e.target.value);
                          if (e.target.value.length >= 2) {
                            utils.products.list.fetch({ search: e.target.value }).then((res: any) => setProductSearchResults((res || []).slice(0, 10)));
                          } else {
                            setProductSearchResults([]);
                          }
                        }}
                        placeholder={translate("输入商品名称或关键词...", "Enter product name or keyword...")}
                      />
                      {productSearchResults.length > 0 && (
                        <div className="max-h-40 overflow-y-auto border rounded-md">
                          {productSearchResults.map((p: any) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between p-2 hover:bg-accent cursor-pointer border-b last:border-0"
                              onClick={() => {
                                setReplacementProductId(p.id);
                                setReplacementProductName(p.name);
                                setReplacementUnitPrice(Number(p.sellingPrice || p.price) || 0);
                                setProductSearchQuery(p.name);
                                setProductSearchResults([]);
                              }}
                            >
                              <div>
                                <div className="font-medium text-sm">{p.name}</div>
                                <div className="text-xs text-muted-foreground">RM {Number(p.sellingPrice || p.price || 0).toFixed(2)} {p.stock !== undefined && `| ${translate("库存", "Stock")}: ${p.stock}`}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {replacementProductId !== "" && (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">{translate("已选:", "Selected:")} {replacementProductName}</Badge>
                          <span className="text-xs">RM {replacementUnitPrice.toFixed(2)}</span>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs">{translate("数量:", "Qty:")}</Label>
                            <Input
                              type="number"
                              min={1}
                              value={replacementQty}
                              onChange={(e) => setReplacementQty(Math.max(1, Number(e.target.value)))}
                              className="w-16 h-8"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* V2.1.26补充4: Step 6: Refund Method (Issue 6j) */}
                  {customerAction === "refund" && (
                    <div className="space-y-3 border rounded-lg p-3 bg-orange-50 dark:bg-orange-950/20">
                      <div className="rounded-md bg-amber-100/80 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                        {exceptionType === "cancelled_item"
                          ? translate("商品取消会立即归还未发货库存，并按剩余商品重新计算估计重量与运费；如已确认付款高于新订单应收，系统会建立待退款，实际退款、Credit与利润仍由退款管理完成时同步。", "Cancelling an item immediately restores unshipped stock and recalculates estimated weight and shipping. If confirmed payment exceeds the new order amount, a pending refund is created; the actual refund, credit and profit sync when Refund Management completes it.")
                          : translate("提交后只会建立“未处理”退款；库存、Credit、利润及客户通知均会在退款管理完成退款时才同步。", "Submitting creates a pending refund only. Inventory, Credit, profit and customer notification update only when Refund Management completes the refund.")}
                      </div>
                      <Label>{translate("退款方式", "Refund Method")}</Label>
                      <Select value={refundMethod} onValueChange={(v: any) => setRefundMethod(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="credit">{translate("退款到Credit", "Refund to Credit")}</SelectItem>
                          <SelectItem value="tng">{translate("退款TNG", "Refund to TNG")}</SelectItem>
                          <SelectItem value="cash">{translate("退款Cash", "Refund to Cash")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="space-y-2">
                        <Label>{translate("客户退款资料", "Customer refund details")}</Label>
                        <Textarea value={customerRefundDetails} onChange={(event) => setCustomerRefundDetails(event.target.value)} placeholder={translate("QR收款人、姓名、电话号码／DuitNow号码，或银行名称、户口姓名与号码", "QR recipient, name, phone/DuitNow number, or bank, account holder and account number")} />
                      </div>
                      <div className="space-y-2">
                        <Label>{translate("客户退款收款二维码／QR图片", "Customer refund QR image")}</Label>
                        <div className="flex items-center gap-2">
                          <Input type="file" accept="image/*" disabled={uploadingRefundAttachment} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadRefundAttachment(file, "customer_qr"); }} />
                          <FileUp className="h-4 w-4 shrink-0 text-violet-700" />
                        </div>
                        {customerRefundQrUrl && <a href={customerRefundQrUrl} target="_blank" rel="noreferrer" className="block truncate text-xs text-primary hover:underline">{translate("预览客户收款二维码", "Preview customer refund QR")}</a>}
                      </div>
                      <div className="space-y-2">
                        <Label>{translate("客户问题照片／聊天截图", "Customer issue photo / chat screenshot")}</Label>
                        <div className="flex items-center gap-2">
                          <Input type="file" accept="image/*,.pdf" disabled={uploadingRefundAttachment} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadRefundAttachment(file); }} />
                          <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                        {refundAttachmentUrls.length > 0 && <div className="space-y-1 text-xs">{refundAttachmentUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="block truncate text-primary hover:underline">{url}</a>)}</div>}
                      </div>
                      <div className="space-y-2">
                        <Label>{translate("内部备注", "Internal notes")}</Label>
                        <Textarea value={refundInternalNotes} onChange={(event) => setRefundInternalNotes(event.target.value)} placeholder={translate("仅供后台处理记录", "Internal processing notes only")} />
                      </div>
                    </div>
                  )}

                  {/* Actions remain fixed below the scrollable content. */}
                </div>
                </LargeOperationDialogBody>
                <LargeOperationDialogFooter>
                  <div className="flex w-full justify-end gap-2">
                    <Button variant="outline" onClick={() => setExceptionDialogOpen(false)}>
                      {translate("取消", "Cancel")}
                    </Button>
                    <Button
                      onClick={() => {
                        if (editingExceptionId) {
                          updateExceptionMutation.mutate({
                            exceptionId: editingExceptionId,
                            orderItemId: exceptionType === "overcharged_shipping" ? null : (exceptionItemId || null),
                            exceptionType,
                            description: exceptionDesc,
                            quantity: exceptionQuantity,
                            customerAction,
                          });
                          return;
                        }
                        if (exceptionType !== "overcharged_shipping" && exceptionItemId === "") {
                          toast.error(translate("请选择涉及商品", "Please select the affected product"));
                          return;
                        }
                        if (exceptionType === "overcharged_shipping" && exceptionQuantity <= 0) {
                          toast.error(translate("请输入大于 0 的退款金额", "Enter a refund amount greater than 0"));
                          return;
                        }
                        if (customerAction === "replace_product" && replacementProductId === "") {
                          toast.error(translate("请选择更换商品", "Please select a replacement product"));
                          return;
                        }
                        if (exceptionType === "cancelled_item" && customerAction === "refund") {
                          cancelPackingItemMutation.mutate({
                            orderId,
                            orderItemId: Number(exceptionItemId),
                            quantity: exceptionQuantity,
                            description: exceptionDesc || undefined,
                            refundMethod,
                            customerRefundDetails: customerRefundDetails.trim() || undefined,
                            customerRefundQrUrl: customerRefundQrUrl || undefined,
                            attachmentUrls: refundAttachmentUrls.length ? JSON.stringify(refundAttachmentUrls) : undefined,
                            internalNotes: refundInternalNotes.trim() || undefined,
                          });
                          return;
                        }
                        const actionMap: Record<string, string> = { replace_product: "replace", wait_restock: "wait_restock", refund: "refund" };
                        const needsResolve = customerAction !== "pending" && customerAction !== "wait_restock";
                        if (needsResolve) {
                          // For replace/refund, create + resolve in one step
                          createExceptionMutation.mutate({
                            orderId,
                            orderItemId: exceptionItemId || undefined,
                            exceptionType,
                            description: exceptionDesc,
                            quantity: exceptionQuantity,
                            customerAction,
                          }, {
                            onSuccess: (created: any) => {
                              toast.success("异常已记录");
                              const selectedItem = (d.items as any[]).find((it: any) => it.id === exceptionItemId);
                              resolveExceptionMutation.mutate({
                                exceptionId: created.id,
                                resolutionType: actionMap[customerAction] as any,
                                orderId,
                                quantity: exceptionQuantity,
                                customerAction,
                                refundAmount: exceptionType === "overcharged_shipping" ? exceptionQuantity : undefined,
                                replacementProductId: customerAction === "replace_product" && replacementProductId !== "" ? Number(replacementProductId) : undefined,
                                replacementProductName: customerAction === "replace_product" ? replacementProductName : undefined,
                                replacementQuantity: customerAction === "replace_product" ? replacementQty : undefined,
                                replacementUnitPrice: customerAction === "replace_product" ? replacementUnitPrice : undefined,
                                refundMethod: customerAction === "refund" ? refundMethod : undefined,
                                customerRefundDetails: customerAction === "refund" ? customerRefundDetails.trim() || undefined : undefined,
                                customerRefundQrUrl: customerAction === "refund" ? customerRefundQrUrl || undefined : undefined,
                                attachmentUrls: customerAction === "refund" && refundAttachmentUrls.length ? JSON.stringify(refundAttachmentUrls) : undefined,
                                internalNotes: customerAction === "refund" ? refundInternalNotes.trim() || undefined : undefined,
                                scrapItems: exceptionType === "quality_issue" && exceptionItemId ? (d.items as any[])
                                  .filter((it: any) => it.id === exceptionItemId)
                                  .map((it: any) => ({
                                    orderItemId: it.id,
                                    productId: it.productId,
                                    productName: it.productName,
                                    quantity: exceptionQuantity,
                                    unitCost: Number(it.unitPrice) || 0,
                                  })) : [],
                                replacementItems: customerAction === "replace_product" && replacementProductId !== "" ? [{
                                  productId: Number(replacementProductId),
                                  productName: replacementProductName,
                                  quantity: replacementQty,
                                  unitPrice: replacementUnitPrice,
                                  subtotal: replacementUnitPrice * replacementQty,
                                }] : undefined,
                              });
                            },
                          });
                        } else {
                          // For wait_restock or pending, just create the exception
                          createExceptionMutation.mutate({
                            orderId,
                            orderItemId: exceptionItemId || undefined,
                            exceptionType,
                            description: exceptionDesc,
                            quantity: exceptionQuantity,
                            customerAction,
                          }, {
                            onSuccess: () => {
                              toast.success("异常已记录");
                              setExceptionDialogOpen(false);
                              setExceptionDesc("");
                              setExceptionItemId("");
                              setExceptionQuantity(1);
                              setCustomerAction("pending");
                              setRefundMethod("credit");
                              setProductSearchQuery("");
                              setProductSearchResults([]);
                              setReplacementProductId("");
                              setReplacementQty(1);
                              setReplacementUnitPrice(0);
                              setReplacementProductName("");
                            },
                          });
                        }
                      }}
                      disabled={createExceptionMutation.isPending || updateExceptionMutation.isPending || resolveExceptionMutation.isPending || cancelPackingItemMutation.isPending}
                    >
                      {editingExceptionId ? translate("保存修改", "Save changes") : translate("确认", "Confirm")}
                    </Button>
                  </div>
                </LargeOperationDialogFooter>
              </LargeOperationDialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Actual Weight & Shipping Difference：待补运费／待退款即使已发货也必须可继续交接处理。 */}
      {(canShip || !!detail?.actualWeight || (detail?.specialOrderStatus === "pending" && (detail?.specialOrderType === "pending_shipping" || detail?.specialOrderType === "pending_refund"))) && (
        <Card className="print-hide border-blue-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              {translate("实际重量与运费", "Actual Weight & Shipping")}
              {/* V2.1.26补充6: Show 免邮 badge — west_malaysia & lalamove only (Issue 6 sync with Packing.tsx) */}
              {detail && (detail.shippingMethod === "west_malaysia" || detail.shippingMethod === "lalamove") && Number((detail as any).physicalSubtotal || 0) >= 150 && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">{translate("免邮", "Free Shipping")}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {missingAddressFields.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span className="font-semibold">{translate("地址校验提醒：", "Address validation:")}</span>{" "}
                {translate("发货前请补齐：", "Complete before shipping: ")}{missingAddressFields.join("、")}
              </div>
            )}
            {/* Estimated weight display */}
            {detail && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{translate("预估重量", "Estimated Weight")}: </span>
                  <span className="font-medium">{Number(detail.estimatedWeight || detail.totalWeight || 0).toFixed(2)} kg</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{translate("客户已付运费", "Customer Paid Shipping")}: </span>
                  <span className="font-medium">RM {Number(detail.customerPaidShipping || detail.shippingFee || 0).toFixed(2)}</span>
                </div>
                {/* V2.1.26: Show 商品金额 and 免邮 status */}
                <div>
                  <span className="text-muted-foreground">{translate("商品金额", "Subtotal")}: </span>
                  <span className="font-medium">RM {Number((detail as any).physicalSubtotal || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{translate("免邮状态", "Free Shipping")}: </span>
                  <span className="font-medium">{(detail.shippingMethod === "west_malaysia" || detail.shippingMethod === "lalamove") ? (Number((detail as any).physicalSubtotal || 0) >= 150 ? translate("是（满RM150免邮）", "Yes (Free shipping over RM150)") : translate("否（未满RM150）", "No (Under RM150)")) : translate("不适用", "N/A")}</span>
                </div>
              </div>
            )}

            {/* Actual weight / Lalamove fee input */}
            {detail && !detail.actualWeight && (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label>
                    {d.shippingMethod === "lalamove"
                      ? translate("Lalamove 实际配送费用 (RM)", "Lalamove Actual Delivery Fee (RM)")
                      : translate("实际重量 (kg)", "Actual Weight (kg)")}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={actualWeightInput}
                    onChange={(e) => setActualWeightInput(e.target.value)}
                  />
                  {d.shippingMethod === "lalamove" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {translate("公司承担 RM15 + 客户已付 RM" + (Number(d.customerPaidShipping || d.shippingFee || 0)).toFixed(0), "Company bears RM15 + Customer paid RM" + (Number(d.customerPaidShipping || d.shippingFee || 0)).toFixed(0))}
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => {
                    const w = parseFloat(actualWeightInput);
                    if (!w || w <= 0) {
                      toast.error(translate("请输入有效数值", "Please enter a valid value"));
                      return;
                    }
                    updateWeightMutation.mutate({ orderId, actualWeight: w });
                  }}
                  disabled={updateWeightMutation.isPending || !actualWeightInput}
                >
                  {translate("确认", "Confirm")}
                </Button>
              </div>
            )}

            {/* Actual weight result */}
            {detail?.actualWeight && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/20">
                  <div>
                    <span className="text-muted-foreground block">{d.shippingMethod === "lalamove" ? translate("Lalamove 费用", "Lalamove Fee") : translate("实际重量", "Actual Weight")}</span>
                    <span className="font-medium">{d.shippingMethod === "lalamove" ? `RM ${Number(detail.actualWeight).toFixed(2)}` : `${Number(detail.actualWeight).toFixed(2)} kg`}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{translate("实际运费", "Actual Shipping")}</span>
                    <span className="font-medium">RM {Number(detail.actualShippingFee || 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{translate("差额", "Difference")}</span>
                    <span className={`font-medium ${Number(detail.shippingDifference || 0) > 0 ? "text-red-600" : Number(detail.shippingDifference || 0) < 0 ? "text-green-600" : ""}`}>
                      RM {Number(detail.shippingDifference || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Special order handling */}
                {(detail.specialOrderType === "pending_shipping" || detail.specialOrderType === "pending_refund") && detail.specialOrderStatus === "pending" && (
                  <div className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-950/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium text-sm">
                        {detail.specialOrderType === "pending_shipping"
                          ? translate("等待补运费", "Pending Additional Shipping Fee")
                          : detail.specialOrderType === "pending_refund"
                          ? translate("等待退款", "Pending Refund")
                          : translate("特别订单", "Special Order")}
                      </span>
                      <Badge variant="destructive">RM {Math.abs(Number(detail.shippingDifference || 0)).toFixed(2)}</Badge>
                    </div>

                    {/* Special order action buttons */}
                    <div className="flex flex-wrap gap-2">
                      {detail.specialOrderType === "pending_shipping" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              specialOrderMutation.mutate({
                                orderId,
                                actionType: "notify_shortage",
                                amount: Math.abs(Number(detail.shippingDifference || 0)),
                                remark: translate("已通知客户补运费", "Customer notified for additional shipping fee"),
                              });
                            }}
                            disabled={specialOrderMutation.isPending}
                          >
                            {translate("通知补运费", "Notify Additional Shipping")}
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => setSupplementalDialogOpen(true)}
                            disabled={supplementalProofMutation.isPending}
                          >
                            {translate("上传补运费凭证", "Upload Shipping Proof")}
                          </Button>
                        </>
                      )}
                      {detail.specialOrderType === "pending_refund" && (
                        shippingRefund ? (
                          <Button size="sm" variant="default" asChild>
                            <Link href={`/admin/refunds?order=${encodeURIComponent(detail.orderNumber || String(orderId))}`}>
                              {translate(`前往退款管理 ${shippingRefund.refundNumber || ""}`, `Go to Refund Management ${shippingRefund.refundNumber || ""}`)}
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => specialOrderMutation.mutate({ orderId, actionType: "refund", amount: Math.abs(Number(detail.shippingDifference || 0)) })}
                            disabled={specialOrderMutation.isPending}
                          >
                            {translate("建立退款管理任务", "Create Refund Task")}
                          </Button>
                        )
                      )}
                      {detail.specialOrderType === "pending_refund" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => {
                            specialOrderMutation.mutate({
                              orderId,
                              actionType: "convert_to_credit",
                              amount: Math.abs(Number(detail.shippingDifference || 0)),
                            });
                          }}
                          disabled={specialOrderMutation.isPending}
                        >
                          {translate("转 Credit", "Convert to Credit")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          specialOrderMutation.mutate({
                            orderId,
                            actionType: "company_bear",
                            amount: Math.abs(Number(detail.shippingDifference || 0)),
                            remark: translate("公司承担", "Company bears the cost"),
                          });
                        }}
                        disabled={specialOrderMutation.isPending}
                      >
                        {translate("公司承担", "Company Bear")}
                      </Button>
                    </div>

                    {detail.specialOrderType === "pending_shipping" && (
                      <div className="rounded-md border border-amber-200 bg-white/80 p-3 text-sm text-amber-950 dark:bg-slate-950/30 dark:text-amber-100">
                        <p className="font-medium">{translate("补差价收款交接", "Shipping Difference Collection Handover")}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{translate("客户补款后，在此上传付款凭证。凭证会进入订单管理的付款记录，审核通过后才解除待补差价、进入实际收款，并把订单收口为“已完成（已发货）”。", "After the customer pays, upload the receipt here. It enters Order Management for review; approval clears the pending difference, records cash, and closes the shipped order.")}</p>
                      </div>
                    )}

                    {detail.specialOrderType === "pending_refund" && shippingRefund && (
                      <div className="rounded-md border border-rose-200 bg-white/80 p-3 text-sm text-rose-950 dark:bg-slate-950/30 dark:text-rose-100">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{translate("退款管理交接", "Refund Management Handover")}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {shippingRefund.refundNumber || `RF-${shippingRefund.id}`} · {translate("申请退款", "Requested")} RM {Number(shippingRefund.requestedAmount || 0).toFixed(2)} · {shippingRefund.status === "pending" ? translate("待处理", "Pending") : shippingRefund.status}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {shippingRefund.status === "pending" && (
                              <Button size="sm" variant="secondary" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={cashShippingRefundMutation.isPending} onClick={() => {
                                if (window.confirm(translate("确认已当场把现金运费退款交给客户？系统会记录退款管理并完成订单收口。", "Confirm the cash shipping refund was handed to the customer? This records the refund and closes the order."))) {
                                  cashShippingRefundMutation.mutate({ orderId });
                                }
                              }}>{cashShippingRefundMutation.isPending ? translate("记录中", "Recording") : translate("现金退款并完成", "Record Cash Refund")}</Button>
                            )}
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/admin/refunds?order=${encodeURIComponent(detail.orderNumber || String(orderId))}`}>{translate("TnG／转账：退款管理处理", "TnG / Transfer: Refund Management")}</Link>
                            </Button>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{translate("退款完成前不会计入实际退款、Dashboard净实收或利润退款损失。", "The refund affects cash flow and profit only after Refund Management completion.")}</p>
                      </div>
                    )}

                    <Dialog open={supplementalDialogOpen} onOpenChange={setSupplementalDialogOpen}>
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader><DialogTitle>{translate("上传客户补运费凭证", "Upload Customer Supplemental Shipping Receipt")}</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-2">
                          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            {translate("本次待补运费", "Additional shipping to collect")}: <strong>RM {Math.abs(Number(detail.shippingDifference || 0)).toFixed(2)}</strong>
                            <p className="mt-1 text-xs">{translate("上传后状态为“待审核”，不会立即记入已收款。", "After upload the status is Pending Review; it is not recorded as cash yet.")}</p>
                          </div>
                          <div className="space-y-2">
                            <Label>{translate("付款方式", "Payment Method")}</Label>
                            <Input value={supplementalPaymentMethod} onChange={(e) => setSupplementalPaymentMethod(e.target.value)} placeholder={translate("例如：TNG、银行转账", "e.g. TNG, bank transfer")} />
                          </div>
                          <div className="space-y-2">
                            <Label>{translate("客户付款凭证", "Customer Payment Receipt")}</Label>
                            <Input type="file" accept="image/*,.pdf" disabled={uploadingSupplementalReceipt} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadSupplementalReceipt(file); }} />
                            {supplementalReceiptUrl && <a className="text-sm text-primary underline" href={supplementalReceiptUrl} target="_blank" rel="noreferrer">{translate("查看已上传凭证", "View uploaded receipt")}</a>}
                          </div>
                          <div className="space-y-2">
                            <Label>{translate("备注（可选）", "Notes (optional)")}</Label>
                            <Textarea value={supplementalNotes} onChange={(e) => setSupplementalNotes(e.target.value)} />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setSupplementalDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
                          <Button disabled={!supplementalReceiptUrl || uploadingSupplementalReceipt || supplementalProofMutation.isPending} onClick={() => supplementalProofMutation.mutate({ orderId, receiptUrl: supplementalReceiptUrl, paymentMethod: supplementalPaymentMethod, notes: supplementalNotes || undefined })}>
                            {supplementalProofMutation.isPending ? translate("提交中", "Submitting") : translate("提交待审核", "Submit for Review")}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Special order actions history */}
                    {specialActions && (specialActions as any[]).length > 0 && (
                      <div className="space-y-1 mt-2">
                        {(specialActions as any[]).map((action: any) => (
                          <div key={action.id} className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{new Date(action.createdAt).toLocaleString()}</span>
                            <span>{action.performedBy}</span>
                            <Badge variant="secondary" className="text-xs">
                              {action.actionType === "notify_shortage" ? translate("通知补运费", "Notify") :
                               action.actionType === "confirm_received" ? translate("确认收到", "Confirmed") :
                               action.actionType === "refund" ? translate("退款", "Refund") :
                               action.actionType === "company_bear" ? translate("公司承担", "Company Bear") :
                               translate("备注", "Remark")}
                            </Badge>
                            {action.remark && <span>— {action.remark}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Resolved special order */}
                {detail.specialOrderStatus === "resolved" && (detail.specialOrderType === "pending_shipping" || detail.specialOrderType === "pending_refund") && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {detail.specialOrderType === "pending_shipping"
                      ? translate("补差价已审核确认；订单已完成（已发货）。", "Shipping difference payment approved; order completed after shipment.")
                      : translate("运费退款已处理；订单已完成（已发货）。", "Shipping refund processed; order completed after shipment.")}
                  </div>
                )}

                {shippingRefund && (
                  <div className={`rounded-md border p-3 text-sm ${shippingRefund.status === "pending" ? "border-rose-200 bg-rose-50/60" : "border-emerald-200 bg-emerald-50/60"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{translate("运费退款记录", "Shipping Refund Record")}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{shippingRefund.refundNumber || `RF-${shippingRefund.id}`} · {shippingRefund.status === "pending" ? translate("待退款管理处理", "Pending Refund Management") : shippingRefund.status === "processed" ? translate("已完成退款", "Refund Completed") : shippingRefund.status} · RM {Number(shippingRefund.status === "pending" ? shippingRefund.requestedAmount : shippingRefund.amount).toFixed(2)}</p>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/refunds?order=${encodeURIComponent(detail.orderNumber || String(orderId))}`}>{translate("查看退款管理", "View Refund Management")}</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shipping Actions */}
      <Card className="print-hide">
        <CardHeader>
          <CardTitle className="text-base">{translate("发货操作", "Shipping Actions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {packingShippingControl.mode === "requires_release" ? <div className="rounded-lg border border-orange-300 bg-orange-50 p-4 text-sm text-orange-950">
            <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />{translate("待汇款差价：请选择是否允许先发货", "Pending balance: choose whether shipment may go first")}</div>
            <p className="mt-2">{translate("老客户可由员工明确记录“允许先发货”；新客户可保持等待补款。无论选择哪一种，待汇款差价都会继续留在特别订单交接队列。", "Staff may explicitly allow a trusted customer to ship first, or hold shipment until the balance is paid. The follow-up remains in the special-order queue.")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={pendingShippingReleaseMutation.isPending} onClick={() => pendingShippingReleaseMutation.mutate({ orderId, allowShipping: true })}>{translate("允许先发货", "Allow Shipment First")}</Button>
              <Button size="sm" variant="outline" disabled={pendingShippingReleaseMutation.isPending} onClick={() => pendingShippingReleaseMutation.mutate({ orderId, allowShipping: false })}>{translate("等待补款再发", "Wait for Balance")}</Button>
            </div>
          </div> : packingShippingControl.mode === "block" ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />{translate("特别订单待处理，暂不可发货", "Pending special order: shipment is paused")}</div>
            <p className="mt-2">{translate("请先完成该特别处理后再继续包货／发货。", "Complete this special follow-up before continuing packing or shipment.")}</p>
          </div> : canShip ? <>
            {packingShippingControl.reason === "pending_refund" && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              {translate("待退款仍在处理，但不会阻止本订单照常包货／发货；退款请继续在退款管理跟进。", "A refund remains pending but does not block normal packing or shipment. Continue to follow it up in Refund Management.")}
            </div>}
            {isWaitingRestockPartialOnly && <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
              {translate("本订单有商品等待补货：可先选择其他现货商品进行部分发货；缺货商品不会被发出。补货自动分配完成后，剩余商品会恢复可发货。", "This order has a waiting-restock item. Ship the other available items as a partial shipment; the missing item cannot ship. It becomes shippable after automatic restock allocation.")}
            </div>}
            {canMergeRemainingShipment && <Dialog open={mergeShippingDialogOpen} onOpenChange={setMergeShippingDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Package className="mr-2 h-4 w-4" />{translate("合并剩余订单发货", "Merge Remaining Orders")}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{translate("合并同客户剩余待发商品", "Merge Remaining Orders for Shipment")}</DialogTitle></DialogHeader>
                <div className="space-y-4 text-sm">
                  <p className="text-muted-foreground">{translate("只列出同一客户、同一收件地址和同一物流方式的可发订单。会以当前填写的包裹、追踪号和实际重量建立一个共同包裹。", "Only orders with the same customer, recipient address and shipping method are listed. The current package, tracking number and actual weight create one shared package.")}</p>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="font-medium">{d.orderNumber} · {translate("本订单剩余商品", "This order remaining")}</div>
                    <div className="mt-1 text-muted-foreground">{shippableItems.map((item: any) => `${item.productName}${item.variationName ? ` (${item.variationName})` : ""} × ${item.remainingQuantity}`).join("；")}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>{translate("选择要一同发货的订单", "Choose order to ship together")}</Label>
                    <Select value={mergeCandidateId ? String(mergeCandidateId) : ""} onValueChange={(value) => setMergeCandidateId(Number(value))}>
                      <SelectTrigger><SelectValue placeholder={translate("请选择兼容待发订单", "Select a compatible order")}/></SelectTrigger>
                      <SelectContent>
                        {compatibleMergeCandidates.map((candidate: any) => <SelectItem key={candidate.id} value={String(candidate.id)}>{candidate.orderNumber} · {candidate.physicalStatus === "partial_shipped" ? translate("部分发货，剩余商品", "Partial shipment remaining") : translate("待包货", "Packing")} · RM {Number(candidate.totalAmount || 0).toFixed(2)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedMergeCandidate && <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
                    <div className="font-medium">{selectedMergeCandidate.orderNumber} · {translate("将一同发货的剩余商品", "Remaining items to ship together")}</div>
                    <div className="mt-1 text-emerald-900">{selectedMergeCandidate.items.map((item: any) => `${item.productName}${item.variationName ? ` (${item.variationName})` : ""} × ${item.remainingQuantity}`).join("；")}</div>
                  </div>}
                  <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">{translate("请先在下方发货资料填写同一个包裹的追踪号／AWB和实际重量，再确认合并发货。系统不会重新扣减库存，只会记录共同包裹及各订单实际发出数量。", "First enter the shared tracking/AWB and actual weight below. The system does not deduct inventory again; it records one shared package and the shipped quantities for each order.")}</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setMergeShippingDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
                    <Button disabled={!selectedMergeCandidate || mergeShipMutation.isPending} onClick={() => {
                      const pkg = packages[0];
                      if (!pkg) { toast.error(translate("请先填写包裹资料", "Enter package details first")); return; }
                      if (packages.length !== 1) { toast.error(translate("合并发货一次只可建立一个共同包裹", "Merged shipment supports one shared package at a time")); return; }
                      if (pkg.shippingType === "manual" && (!pkg.trackingNumber || !pkg.shippingLabelUrl)) { toast.error(translate("手动发货必须填写追踪号并上传 AWB", "Manual shipping requires a tracking number and an AWB upload")); return; }
                      mergeShipMutation.mutate({
                        orderIds: [orderId, selectedMergeCandidate.id],
                        itemQuantities: [
                          ...shippableItems.map((item: any) => ({ itemId: String(item.id), quantity: Number(item.remainingQuantity) })),
                          ...selectedMergeCandidate.items.map((item: any) => ({ itemId: String(item.id), quantity: Number(item.remainingQuantity) })),
                        ],
                        packageData: { courier: pkg.courier, shippingType: pkg.shippingType as "auto" | "manual", trackingNumber: pkg.trackingNumber || undefined, shippingLabelUrl: pkg.shippingLabelUrl || undefined, weight: pkg.weight },
                      });
                    }}>{mergeShipMutation.isPending ? translate("处理中…", "Working…") : translate("确认合并发货", "Confirm Merged Shipment")}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>}
            <div className="flex items-center space-x-4">
              <Label htmlFor="shipping-mode" className="text-right">{translate("发货模式", "Shipping Mode")}:</Label>
              <Select
                value={activeShippingMode}
                onValueChange={(value: "full" | "partial") => setShippingMode(value)}
                disabled={d.physicalStatus === "partial_shipped" || isWaitingRestockPartialOnly}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={translate("选择发货模式", "Select shipping mode")} />
                </SelectTrigger>
                <SelectContent>
                  {!isWaitingRestockPartialOnly && <SelectItem value="full">{translate("完整发货", "Full Shipment")}</SelectItem>}
                  <SelectItem value="partial">{translate("部分发货", "Partial Shipment")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {activeShippingMode === "partial" && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">{translate("选择本次发货的商品", "Select items for this shipment")}:</h3>
                <div className="grid gap-2">
                  {shippableItems.length === 0 ? (
                    <div className="text-muted-foreground text-sm">{translate("所有商品均已发货或无待发货商品", "All items have been shipped or no items to ship")}</div>
                  ) : (
                    shippableItems.map((item: any) => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`item-${item.id}`}
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => {
                            toggleItem(item.id);
                            // Initialize to the actual unshipped balance, never the original order quantity.
                            if (!selectedItems.includes(item.id)) {
                              setShipQuantities((prev) => ({ ...prev, [item.id]: item.remainingQuantity }));
                            }
                          }}
                        />
                        <label
                          htmlFor={`item-${item.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {item.productName} {item.variationName && `(${item.variationName})`}
                          <span className="ml-1 text-muted-foreground">
                            {translate(`已发 ${item.shippedQuantity}／待发 ${item.remainingQuantity}`, `Shipped ${item.shippedQuantity} / Remaining ${item.remainingQuantity}`)}
                          </span>
                        </label>
                        {/* V2.1.26补充4: Quantity input for partial shipping (Issue 7) */}
                        {selectedItems.includes(item.id) && item.remainingQuantity > 1 && (
                          <div className="flex items-center gap-1 ml-auto">
                            <Label className="text-xs text-muted-foreground">{translate("发货数量", "Ship Qty")}:</Label>
                            <Input
                              type="number"
                              min={1}
                              max={item.remainingQuantity}
                              value={shipQuantities[item.id] ?? item.remainingQuantity}
                              onChange={(e) => updateShipQuantity(item.id, Number(e.target.value), item.remainingQuantity)}
                              className="w-16 h-8 text-sm"
                            />
                            <span className="text-xs text-muted-foreground">/ {item.remainingQuantity}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <Separator />

            <h3 className="font-semibold text-sm">{translate("包裹信息", "Package Information")}:</h3>
            <div className="space-y-3">
              {packages.map((pkg, index) => {
                const fixedCourier = isFixedCourier(d.shippingMethod || "west_malaysia");
                const automaticParcelDaily = d.shippingMethod === "west_malaysia" || d.shippingMethod === "east_malaysia_poslaju";
                const lockedCourier = fixedCourier || automaticParcelDaily;
                return (
                <div key={index} className="flex items-end gap-2 border p-3 rounded-md relative">
                  <div className="grid grid-cols-2 gap-2 flex-grow">
                    {/* Fixed methods and Parcel Daily shipments do not allow a courier override. */}
                    {lockedCourier ? (
                      <div className="space-y-1 col-span-2">
                        <Label>{translate("快递公司", "Courier")}</Label>
                        <div className="border rounded-md px-3 py-2 bg-muted/50 text-sm font-medium">
                          {pkg.courier}
                          {automaticParcelDaily && <span className="ml-2 text-xs font-normal text-muted-foreground">· {translate("Parcel Daily 自动生成追踪号与 AWB", "Parcel Daily generates the tracking number and AWB automatically")}</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label htmlFor={`courier-${index}`}>{translate("快递公司", "Courier")}</Label>
                        <Select
                          value={pkg.courier}
                          onValueChange={(value) => updatePackage(index, "courier", value)}
                        >
                          <SelectTrigger id={`courier-${index}`}>
                            <SelectValue placeholder={translate("选择快递公司", "Select courier")} />
                          </SelectTrigger>
                          <SelectContent>
                            {COURIERS.map((c) => (
                              <SelectItem key={c.en} value={c.zh}>{lang === "zh" ? c.zh : c.en}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {/* Parcel Daily keeps its route-selected courier but can be switched between automatic and manual shipment. */}
                    {!fixedCourier && (
                      <div className="space-y-1">
                        <Label htmlFor={`shipping-type-${index}`}>{translate("发货类型", "Shipping Type")}</Label>
                        <Select
                          value={pkg.shippingType}
                          onValueChange={(value: "auto" | "manual") => updatePackage(index, "shippingType", value)}
                        >
                          <SelectTrigger id={`shipping-type-${index}`}>
                            <SelectValue placeholder={translate("选择发货类型", "Select shipping type")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">{translate("手动发货", "Manual")}</SelectItem>
                            {automaticParcelDaily && <SelectItem value="auto">{translate("自动生成 AWB（Parcel Daily）", "Auto AWB (Parcel Daily)")}</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label htmlFor={`package-weight-${index}`}>{translate("本包裹实际重量 (kg)", "This package weight (kg)")}</Label>
                      <Input
                        id={`package-weight-${index}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={pkg.weight}
                        onChange={(e) => updatePackage(index, "weight", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    {/* Lalamove and Shopee use manually supplied tracking references only. */}
                    {(pkg.shippingType === "manual" || fixedCourier) && (
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor={`tracking-number-${index}`}>{translate("追踪号", "Tracking Number")}</Label>
                        <Input
                          id={`tracking-number-${index}`}
                          value={pkg.trackingNumber}
                          onChange={(e) => updatePackage(index, "trackingNumber", e.target.value)}
                          placeholder={translate("输入追踪号", "Enter tracking number")}
                        />
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Button asChild size="sm" variant="outline" disabled={uploadingAwbIndex === index}>
                            <label htmlFor={`awb-upload-${index}`} className="cursor-pointer">
                              <FileUp className="h-4 w-4 mr-1" />
                              {uploadingAwbIndex === index ? translate("上传中…", "Uploading…") : translate("上传 AWB", "Upload AWB")}
                            </label>
                          </Button>
                          <Input
                            id={`awb-upload-${index}`}
                            type="file"
                            accept="application/pdf,image/*"
                            className="sr-only"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void uploadShippingLabel(index, file);
                              event.currentTarget.value = "";
                            }}
                          />
                          {pkg.shippingLabelUrl ? (
                            <a className="inline-flex items-center text-xs text-blue-700 hover:underline" href={pkg.shippingLabelUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 mr-1" />{translate("查看已上传 AWB", "View uploaded AWB")}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">{translate("手动发货建议上传 AWB 以便追溯", "Upload the AWB for traceability")}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {packages.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePackage(index)}
                      className="absolute top-2 right-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                );
              })}
              {/* V2.1.30: Hide add package button for fixed courier methods */}
              {!isFixedCourier(d.shippingMethod || "west_malaysia") && (
                <Button variant="outline" size="sm" onClick={addPackage}>
                  <Plus className="h-4 w-4 mr-1" />{translate("新增包裹", "Add Package")}
                </Button>
              )}
            </div>

              <Button
                onClick={() => handleShip(activeShippingMode)}
                disabled={fullShipMutation.isPending || partialShipMutation.isPending || createParcelKingMutation.isPending}
                className="w-full"
              >
                <Ship className="h-4 w-4 mr-2" />
                {activeShippingMode === "full" ? translate("确认完整发货", "Confirm Full Shipment") : translate("确认部分发货", "Confirm Partial Shipment")}
              </Button>
            </> : <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
              {translate("此订单当前状态为", "This order's current status is")} “{d.physicalStatus === "shipped" ? translate("已发货", "Shipped") : d.physicalStatus === "completed" ? translate("已完成", "Completed") : translate("已取消", "Cancelled")}”，{translate("不可再次创建包裹或发货。", "cannot create packages or ship again.")}
            </div>}
          </CardContent>
        </Card>

        {/* A5 Packing Slip - Print Only */}
        {slipData && (
          <div className="print-only hidden">
            <A5PackingSlip data={slipData as any} translate={translate} lang={lang} />
          </div>
        )}
      </div>
    );
  }

  // V2.1.26: Simplified A5 Packing Slip - no images, large order number, large quantity, keywords, unit price, shipping method
  function A5PackingSlip({ data, translate, lang }: { data: any; translate: (zh: string, en: string, params?: Record<string, string | number>) => string; lang: "zh" | "en" }) {
    const allItems = [...(data.items || []), ...(data.giftItems || [])];
    const remarkRows = getPackingSlipRemarkRows([
      ...(data.remarks || []),
      ...(data.adminRemarks || []),
      ...(data.customerRemark ? [{ remarkCategory: "customer", content: data.customerRemark }] : []),
    ], lang === "en" ? "en" : "zh");
    // V2.1.26补充4: Only use grid when more than 2 product items (Issue 5e)
    const productItemCount = (data.items || []).length;
    const useGrid = productItemCount > 2;
    return (
      <div className="a5-slip" style={{ width: "148mm", padding: "8mm", fontFamily: "sans-serif", fontSize: "12px", color: "#000" }}>
        {/* V2.1.26: Large shipping method label at top */}
        <div style={{ textAlign: "center", fontSize: "36px", fontWeight: "bold", marginBottom: "4px", border: "3px solid #000", padding: "6px" }}>
          {data.shippingMethodLabel || data.specialLabel || "西马"}
        </div>

        {/* V2.1.26: Large order number */}
        <div style={{ textAlign: "center", fontSize: "28px", fontWeight: "bold", marginBottom: "4px" }}>
          {data.orderNumber}
        </div>

        {/* V2.1.26: Customer info - show orderer name (下单人) + recipient */}
        <div style={{ marginBottom: "4px", fontSize: "12px", lineHeight: "1.4" }}>
          <div><strong>{translate("下单人:", "Orderer:")}</strong> <span style={{ fontSize: "22px", fontWeight: "bold", lineHeight: 1.3 }}>{data.facebookName || data.customerName || "-"}</span></div>
          <div><strong>{translate("收件人:", "Recipient:")}</strong> <span style={{ fontSize: "22px", fontWeight: "bold", lineHeight: 1.3 }}>{data.recipientName || data.customerName || "-"}</span></div>
          <div><strong>{translate("电话:", "Phone:")}</strong> {data.recipientPhone || data.customerPhone}</div>
          <div><strong>{translate("地址:", "Address:")}</strong> {
            [
              data.addressLine1,
              data.addressLine2,
              data.postcode || data.recipientPostcode,
              data.recipientCity,
              data.recipientState
            ].filter(Boolean).join(", ")
          }</div>
        </div>

        <div style={{ borderTop: "2px solid #000", margin: "4px 0" }} />

        {/* V2.1.26: Items - large quantity, keywords, unit price, subtotal */}
        <div style={{ marginBottom: "8px" }}>
          {useGrid ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {data.items.map((item: any, i: number) => (
                <div key={i} style={{ border: "2px solid #000", padding: "8px", borderRadius: "6px", minHeight: "80px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "20px" }}>☐</span>
                    <span style={{ fontWeight: "bold", fontSize: "22px", lineHeight: "1.2" }}>{item.productName}</span>
                  </div>
                  {item.keyword && <div style={{ fontSize: "14px", color: "#555", marginLeft: "26px" }}>{item.keyword}</div>}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                    <span style={{ fontSize: "14px" }}>RM{Number(item.unitPrice || 0).toFixed(0)} × {item.quantity}</span>
                    <span style={{ fontSize: "36px", fontWeight: "bold", border: "4px solid #000", padding: "4px 12px", borderRadius: "6px" }}>
                      {item.quantity}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", textAlign: "right", marginTop: "4px" }}>小计: RM{Number(item.subtotal || 0).toFixed(2)}</div>
                </div>
              ))}
            </div>
          ) : (
            data.items.map((item: any, i: number) => (
              <div key={i} style={{ marginBottom: "6px", paddingBottom: "4px", borderBottom: "1px dashed #ccc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "16px" }}>☐</span>
                  <span style={{ fontWeight: "bold", fontSize: "18px", lineHeight: "1.2" }}>{item.productName}</span>
                  {item.variationName && <span style={{ fontSize: "11px" }}>({item.variationName})</span>}
                </div>
                {item.keyword && <div style={{ fontSize: "11px", color: "#555", marginLeft: "20px" }}>{translate("关键词:", "Keyword:")} {item.keyword}</div>}
                <div style={{ marginLeft: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px" }}>{translate("单价:", "Unit Price:")} RM{Number(item.unitPrice || 0).toFixed(2)} × {item.quantity} = RM{Number(item.subtotal || 0).toFixed(2)}</span>
                  <span style={{
                    fontSize: "32px",
                    fontWeight: "bold",
                    border: item.quantity > 1 ? "3px solid #000" : "none",
                    padding: item.quantity > 1 ? "2px 10px" : "0",
                    borderRadius: "4px",
                  }}>
                    {item.quantity}
                  </span>
                </div>
              </div>
            ))
          )}

          {/* Gift Items */}
          {data.giftItems && data.giftItems.length > 0 && (
            <>
              <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />
              {data.giftItems.map((gift: any, i: number) => (
                <div key={i} style={{ marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "16px" }}>☐</span>
                    <span style={{ fontSize: "16px", fontWeight: "bold" }}><strong>{translate("赠品", "Gift")}</strong> {gift.productName}</span>
                  </div>
                  <div style={{ marginLeft: "20px", display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "24px", fontWeight: "bold", border: "2px solid #000", padding: "1px 8px", borderRadius: "3px" }}>
                      {gift.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* V2.1.26补充4: Order amount details (Issue 5c) */}
        <div style={{ borderTop: "2px solid #000", margin: "4px 0" }} />
        <div style={{ marginBottom: "6px", fontSize: "13px", lineHeight: "1.6" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{translate("商品小计:", "Item Subtotal:")}</span>
            <span>RM {data.summary.physicalSubtotal || data.summary.regularTotal}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{translate("运费:", "Shipping Fee:")}</span>
            <span>RM {data.summary.shippingFee}</span>
          </div>
          {parseFloat(data.summary.discountAmount || "0") > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{translate("折扣:", "Discount:")} {data.summary.discountReason ? `(${data.summary.discountReason})` : ""}</span>
              <span>-RM {data.summary.discountAmount}</span>
            </div>
          )}
          {parseFloat(data.summary.extraCharge || "0") > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{translate("额外收费:", "Extra Charge:")} {data.summary.extraChargeDescription ? `(${data.summary.extraChargeDescription})` : ""}</span>
              <span>+RM {data.summary.extraCharge}</span>
            </div>
          )}
          {parseFloat(data.summary.creditUsed || "0") > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{translate("Credit:", "Credit:")}</span>
              <span>-RM {data.summary.creditUsed}</span>
            </div>
          )}
          <div style={{ borderTop: "1px solid #000", margin: "2px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: "bold" }}>
            <span>{translate("总金额:", "Total Amount:")}</span>
            <span>RM {data.summary.totalAmount}</span>
          </div>
        </div>
        {data.summary.isFreeShipping && (
          <div style={{ textAlign: "center", fontSize: "14px", fontWeight: "bold", color: "green", marginBottom: "4px" }}>
            {translate("免邮", "Free Shipping")}
          </div>
        )}

        {remarkRows.length > 0 && (
          <div style={{ marginBottom: "4px", border: "2px solid #000", padding: "4px" }}>
            <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>{translate("订单备注", "Order Notes")}</div>
            {remarkRows.map((remark, index) => (
              <div key={`${remark.label}-${remark.content}-${index}`} style={{ fontSize: "11px", marginLeft: "8px", marginBottom: "3px", whiteSpace: "pre-wrap" }}>
                <strong>{remark.label}：</strong>{remark.content}
              </div>
            ))}
          </div>
        )}


      </div>
    );
  }
