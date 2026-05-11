import { NotificationPayload, NotificationType, NotificationTriggerData } from "@/types/notifications";
import { showBrowserNotification, vibrateDevice, playNotificationSound } from "./browser-notifications";
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export function createProductAddedNotification(data: NotificationTriggerData): NotificationPayload {
  return {
    type: "product_added",
    title: "New Product Added",
    body: `${data.productName} has been added to the database`,
    icon: "/images/disruptive-logo.png",
    badge: "/favicon.ico",
    tag: `product-${data.productId}`,
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
    tag: `product-${data.productId}`,
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
    tag: `supplier-${data.supplierId}`,
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
    tag: `supplier-${data.supplierId}`,
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
    tag: `spf-${data.spfId}`,
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
    tag: `spf-${data.spfId}`,
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
    tag: `spf-${data.spfId}`,
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
    tag: `spf-${data.spfId}`,
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
export async function storeGlobalNotification(
  type: NotificationType,
  data: NotificationTriggerData,
  payload: NotificationPayload
): Promise<void> {
  try {
    const notificationsRef = collection(db, "global_notifications");
    await addDoc(notificationsRef, {
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
    });
  } catch (error) {
    console.error("Failed to store global notification in Firebase:", error);
  }
}

export async function triggerNotification(
  type: NotificationType,
  data: NotificationTriggerData,
  settings: {
    soundEnabled: boolean;
    vibrationEnabled: boolean;
  } = { soundEnabled: true, vibrationEnabled: true }
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

  // Store notification in Firebase for global broadcasting
  await storeGlobalNotification(type, data, payload);

  // Show notification locally for the current user
  showBrowserNotification(payload);

  if (settings.vibrationEnabled) {
    vibrateDevice();
  }

  if (settings.soundEnabled) {
    playNotificationSound();
  }
}

// Real-time listener for global notifications
export function subscribeToGlobalNotifications(
  onNotification: (payload: NotificationPayload) => void
): () => void {
  const notificationsRef = collection(db, "global_notifications");
  const q = query(
    notificationsRef,
    orderBy("createdAt", "desc"),
    limit(50)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const notificationData = change.doc.data();
        const payload: NotificationPayload = {
          type: notificationData.type,
          title: notificationData.title,
          body: notificationData.body,
          icon: notificationData.icon,
          badge: notificationData.badge,
          tag: notificationData.tag,
          requireInteraction: notificationData.requireInteraction,
          data: notificationData.data,
          actions: notificationData.actions,
        };
        
        // Show the notification to all connected users
        showBrowserNotification(payload);
        onNotification(payload);
      }
    });
  });

  return unsubscribe;
}
