"use client";

import { useCallback } from "react";
import { triggerNotification } from "@/lib/notification-helpers";
import { showBrowserNotification } from "@/lib/browser-notifications";
import { NotificationType, NotificationTriggerData } from "@/types/notifications";

export function useNotificationTriggers() {
  const onProductAdded = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("product_added", data);

      // 🔔 Browser notification
      showBrowserNotification({
        type: "product_added",
        title: "Product Added",
        body: `${data.productName} has been added`,
        tag: `product-${data.productId}`,
        data: { url: data.url },
      });
    },
    []
  );

  const onProductUpdated = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("product_updated", data);

      // 🔔 Browser notification
      showBrowserNotification({
        type: "product_updated",
        title: "Product Updated",
        body: `${data.productName} has been updated`,
        tag: `product-${data.productId}`,
        data: { url: data.url },
      });
    },
    []
  );

  const onSupplierAdded = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("supplier_added", data);

      // 🔔 Browser notification
      showBrowserNotification({
        type: "supplier_added",
        title: "Supplier Added",
        body: `${data.supplierName} has been added`,
        tag: `supplier-${data.supplierId}`,
        data: { url: data.url },
      });
    },
    []
  );

  const onSupplierUpdated = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("supplier_updated", data);

      // 🔔 Browser notification
      showBrowserNotification({
        type: "supplier_updated",
        title: "Supplier Updated",
        body: `${data.supplierName} has been updated`,
        tag: `supplier-${data.supplierId}`,
        data: { url: data.url },
      });
    },
    []
  );

  const onSPFCreated = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("spf_created", data);

      // 🔔 Browser notification
      showBrowserNotification({
        type: "spf_created",
        title: "SPF Created",
        body: `SPF ${data.spfNumber} has been created`,
        tag: `spf-${data.spfNumber}`,
        data: { url: data.url },
      });
    },
    []
  );

  const onSPFUpdated = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("spf_updated", data);

      // 🔔 Browser notification
      showBrowserNotification({
        type: "spf_updated",
        title: "SPF Updated",
        body: `SPF ${data.spfNumber} has been updated`,
        tag: `spf-${data.spfNumber}`,
        data: { url: data.url },
      });
    },
    []
  );

  const onSPFApproved = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("spf_approved", data);

      // 🔔 Browser notification
      showBrowserNotification({
        type: "spf_approved",
        title: "SPF Approved",
        body: `SPF ${data.spfNumber} has been approved`,
        tag: `spf-${data.spfNumber}`,
        data: { url: data.url },
      });
    },
    []
  );

  const onSPFRejected = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("spf_rejected", data);

      // 🔔 Browser notification
      showBrowserNotification({
        type: "spf_rejected",
        title: "SPF Rejected",
        body: `SPF ${data.spfNumber} has been rejected`,
        tag: `spf-${data.spfNumber}`,
        data: { url: data.url },
      });
    },
    []
  );

  const triggerCustomNotification = useCallback(
    async (type: NotificationType, data: NotificationTriggerData) => {
      await triggerNotification(type, data);
    },
    []
  );

  return {
    onProductAdded,
    onProductUpdated,
    onSupplierAdded,
    onSupplierUpdated,
    onSPFCreated,
    onSPFUpdated,
    onSPFApproved,
    onSPFRejected,
    triggerCustomNotification,
  };
}