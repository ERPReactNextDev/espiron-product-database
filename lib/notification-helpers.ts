import { NotificationPayload, NotificationType, NotificationTriggerData } from "@/types/notifications";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export function createProductAddedNotification(data: NotificationTriggerData): NotificationPayload {
  return {
    type: "product_added",
    title: "New Product Added",
    body: `${data.productName} has been added to the database`,
    icon: "/images/disruptive-logo.png",
    badge: "/favicon.ico",
    tag: "espiron-product-added",
    requireInteraction: false,
    data: {
      productId: data.productId,
      productName: data.productName,
      url: data.url || `/products`,
    },
    actions: [
      {
        action: "view",
        title: "View Product",
        icon: "/images/disruptive-logo.png",
      },
    ],
  };
}

export function createProductUpdatedNotification(data: NotificationTriggerData): NotificationPayload {
  return {
    type: "product_updated",
    title: "Product Updated",
    body: `${data.productName} has been updated`,
    icon: "/images/disruptive-logo.png",
    badge: "/favicon.ico",
    tag: "espiron-product-updated",
    requireInteraction: false,
    data: {
      productId: data.productId,
      productName: data.productName,
      url: data.url || `/products`,
    },
    actions: [
      {
        action: "view",
        title: "View Product",
        icon: "/images/disruptive-logo.png",
      },
    ],
  };
}

export function createSupplierAddedNotification(data: NotificationTriggerData): NotificationPayload {
  return {
    type: "supplier_added",
    title: "New Supplier Added",
    body: `${data.supplierName} has been registered`,
    icon: "/images/disruptive-logo.png",
    badge: "/favicon.ico",
    tag: "espiron-supplier-added",
    requireInteraction: false,
    data: {
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      url: data.url || `/suppliers`,
    },
    actions: [
      {
        action: "view",
        title: "View Supplier",
        icon: "/images/disruptive-logo.png",
      },
    ],
  };
}

export function createSupplierUpdatedNotification(data: NotificationTriggerData): NotificationPayload {
  return {
    type: "supplier_updated",
    title: "Supplier Updated",
    body: `${data.supplierName} details have been updated`,
    icon: "/images/disruptive-logo.png",
    badge: "/favicon.ico",
    tag: "espiron-supplier-updated",
    requireInteraction: false,
    data: {
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      url: data.url || `/suppliers`,
    },
    actions: [
      {
        action: "view",
        title: "View Supplier",
        icon: "/images/disruptive-logo.png",
      },
    ],
  };
}

export function createSPFCreatedNotification(data: NotificationTriggerData): NotificationPayload {
  return {
    type: "spf_created",
    title: "SPF Request Created",
    body: `SPF ${data.spfNumber} has been submitted`,
    icon: "/images/disruptive-logo.png",
    badge: "/favicon.ico",
    tag: "espiron-spf-created",
    requireInteraction: false,
    data: {
      spfId: data.spfId,
      spfNumber: data.spfNumber,
      url: data.url || `/requests`,
    },
    actions: [
      {
        action: "view",
        title: "View SPF",
        icon: "/images/disruptive-logo.png",
      },
    ],
  };
}

export function createSPFUpdatedNotification(data: NotificationTriggerData): NotificationPayload {
  return {
    type: "spf_updated",
    title: "SPF Updated",
    body: `SPF ${data.spfNumber} has been modified`,
    icon: "/images/disruptive-logo.png",
    badge: "/favicon.ico",
    tag: "espiron-spf-updated",
    requireInteraction: false,
    data: {
      spfId: data.spfId,
      spfNumber: data.spfNumber,
      url: data.url || `/requests`,
    },
    actions: [
      {
        action: "view",
        title: "View SPF",
        icon: "/images/disruptive-logo.png",
      },
    ],
  };
}

export function createSPFApprovedNotification(data: NotificationTriggerData): NotificationPayload {
  return {
    type: "spf_approved",
    title: "SPF Approved",
    body: `SPF ${data.spfNumber} has been approved`,
    icon: "/images/disruptive-logo.png",
    badge: "/favicon.ico",
    tag: "espiron-spf-approved",
    requireInteraction: true,
    data: {
      spfId: data.spfId,
      spfNumber: data.spfNumber,
      url: data.url || `/requests`,
    },
    actions: [
      {
        action: "view",
        title: "View SPF",
        icon: "/images/disruptive-logo.png",
      },
    ],
  };
}

export function createSPFRejectedNotification(data: NotificationTriggerData): NotificationPayload {
  return {
    type: "spf_rejected",
    title: "SPF Rejected",
    body: `SPF ${data.spfNumber} has been rejected${data.reason ? `: ${data.reason}` : ""}`,
    icon: "/images/disruptive-logo.png",
    badge: "/favicon.ico",
    tag: "espiron-spf-rejected",
    requireInteraction: true,
    data: {
      spfId: data.spfId,
      spfNumber: data.spfNumber,
      reason: data.reason,
      url: data.url || `/requests`,
    },
    actions: [
      {
        action: "view",
        title: "View SPF",
        icon: "/images/disruptive-logo.png",
      },
      {
        action: "edit",
        title: "Edit SPF",
        icon: "/images/disruptive-logo.png",
      },
    ],
  };
}

// Store notification in Firebase for global broadcasting
async function storeNotificationInFirebase(
  type: NotificationType,
  payload: NotificationPayload,
  data: NotificationTriggerData
): Promise<void> {
  await addDoc(collection(db, "global_notifications"), {
    type,
    title: payload.title,
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    requireInteraction: payload.requireInteraction,
    data: payload.data,
    actions: payload.actions,
    triggerData: data,
    createdAt: serverTimestamp(),
    isActive: true,
    broadcastToAll: true,
  });
}

export async function triggerNotification(
  type: NotificationType,
  data: NotificationTriggerData
): Promise<void> {
  let payload: NotificationPayload;

  switch (type) {
    case "product_added":
      payload = createProductAddedNotification(data);
      break;
    case "product_updated":
      payload = createProductUpdatedNotification(data);
      break;
    case "supplier_added":
      payload = createSupplierAddedNotification(data);
      break;
    case "supplier_updated":
      payload = createSupplierUpdatedNotification(data);
      break;
    case "spf_created":
      payload = createSPFCreatedNotification(data);
      break;
    case "spf_updated":
      payload = createSPFUpdatedNotification(data);
      break;
    case "spf_approved":
      payload = createSPFApprovedNotification(data);
      break;
    case "spf_rejected":
      payload = createSPFRejectedNotification(data);
      break;
    default:
      throw new Error(`Unknown notification type: ${type}`);
  }

  try {
    await storeNotificationInFirebase(type, payload, data);
  } catch (error) {
    console.error("Failed to store notification in Firebase:", error);
  }

  try {
    const response = await fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Failed to send push notification:", response.status, await response.text());
      return;
    }

    const result = await response.json();
    if (result.failureCount > 0) {
      console.error("Some push notifications failed:", result);
    } else if (result.totalSent === 0) {
      console.warn("Push notification was not delivered: no other devices are registered.");
    }
  } catch (error) {
    console.error("Failed to send push notification:", error);
  }
}
