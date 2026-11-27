const HIDDEN_SPF_STATUS_PREFIX =
  "project status: your spf project has been sent to product development (pd) department.";

export function isVisibleChatMessage(message: { text?: string | null }): boolean {
  return !message.text?.trim().toLowerCase().startsWith(HIDDEN_SPF_STATUS_PREFIX);
}
