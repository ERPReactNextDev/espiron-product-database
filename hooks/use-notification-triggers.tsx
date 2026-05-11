"use client";

import { useCallback } from "react";
import { triggerNotification, broadcastNotificationToAllUsers } from "@/lib/notification-helpers";
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

  // Broadcast to all users (excluding the one who performed the action)
  const broadcastProductAdded = useCallback(
    async (data: NotificationTriggerData, excludeUserId?: string) => {
      await broadcastNotificationToAllUsers("product_added", data, excludeUserId);
    },
    []
  );

  const broadcastProductUpdated = useCallback(
    async (data: NotificationTriggerData, excludeUserId?: string) => {
      await broadcastNotificationToAllUsers("product_updated", data, excludeUserId);
    },
    []
  );

  const broadcastSupplierAdded = useCallback(
    async (data: NotificationTriggerData, excludeUserId?: string) => {
      await broadcastNotificationToAllUsers("supplier_added", data, excludeUserId);
    },
    []
  );

  const broadcastSupplierUpdated = useCallback(
    async (data: NotificationTriggerData, excludeUserId?: string) => {
      await broadcastNotificationToAllUsers("supplier_updated", data, excludeUserId);
    },
    []
  );

  const broadcastSPFCreated = useCallback(
    async (data: NotificationTriggerData, excludeUserId?: string) => {
      await broadcastNotificationToAllUsers("spf_created", data, excludeUserId);
    },
    []
  );

  const broadcastSPFUpdated = useCallback(
    async (data: NotificationTriggerData, excludeUserId?: string) => {
      await broadcastNotificationToAllUsers("spf_updated", data, excludeUserId);
    },
    []
  );

  const broadcastSPFApproved = useCallback(
    async (data: NotificationTriggerData, excludeUserId?: string) => {
      await broadcastNotificationToAllUsers("spf_approved", data, excludeUserId);
    },
    []
  );

  const broadcastSPFRejected = useCallback(
    async (data: NotificationTriggerData, excludeUserId?: string) => {
      await broadcastNotificationToAllUsers("spf_rejected", data, excludeUserId);
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
    // Broadcast functions
    broadcastProductAdded,
    broadcastProductUpdated,
    broadcastSupplierAdded,
    broadcastSupplierUpdated,
    broadcastSPFCreated,
    broadcastSPFUpdated,
    broadcastSPFApproved,
    broadcastSPFRejected,
  };
}
