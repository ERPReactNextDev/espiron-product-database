"use client";

import { useCallback } from "react";
import { triggerNotification } from "@/lib/notification-helpers";
import { NotificationType, NotificationTriggerData } from "@/types/notifications";

export function useNotificationTriggers() {
  const onProductAdded = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("product_added", data);
    },
    []
  );

  const onProductUpdated = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("product_updated", data);
    },
    []
  );

  const onSupplierAdded = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("supplier_added", data);
    },
    []
  );

  const onSupplierUpdated = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("supplier_updated", data);
    },
    []
  );

  const onSPFCreated = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("spf_created", data);
    },
    []
  );

  const onSPFUpdated = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("spf_updated", data);
    },
    []
  );

  const onSPFApproved = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("spf_approved", data);
    },
    []
  );

  const onSPFRejected = useCallback(
    async (data: NotificationTriggerData) => {
      await triggerNotification("spf_rejected", data);
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
