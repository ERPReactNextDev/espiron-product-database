"use client";

import { Bell, Volume2, Smartphone, Clock, RotateCcw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useNotificationSettings } from "@/hooks/use-notification-settings";
import { useNotificationPermissions } from "@/hooks/use-notification-permissions";

export function NotificationSettings({ hideCard = false }: { hideCard?: boolean } = {}) {
  const {
    settings,
    isLoading,
    updateSettings,
    resetSettings,
    toggleEnabled,
    toggleProductNotifications,
    toggleSupplierNotifications,
    toggleSPFNotifications,
    toggleSoundEnabled,
    toggleVibrationEnabled,
    toggleAutoClose,
    setAutoCloseDuration,
  } = useNotificationSettings();

  const { permission, requestPermission } = useNotificationPermissions();

  if (isLoading) {
    return <div>Loading settings...</div>;
  }

  const body = (
    <div className="space-y-6">
        {/* Permission Status */}
        <div className="flex items-center justify-between p-3 rounded-md bg-muted">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2">
              {permission === "granted" ? <Bell className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              Browser Permission: {permission === "granted" ? "Granted" : permission === "denied" ? "Denied" : "Not Set"}
            </Label>
            <p className="text-sm text-muted-foreground">
              {permission === "granted" ? "Notifications are allowed" : "Notifications may not work"}
            </p>
          </div>
          {permission !== "granted" && (
            <Button size="sm" onClick={requestPermission}>
              Request Permission
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enabled">Enable Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Turn all notifications on or off
            </p>
          </div>
          <Switch
            id="enabled"
            checked={settings.enabled}
            onCheckedChange={toggleEnabled}
          />
        </div>

        {settings.enabled && (
          <>
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Notification Types</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="product-notifications">Product Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about product changes
                  </p>
                </div>
                <Switch
                  id="product-notifications"
                  checked={settings.productNotifications}
                  onCheckedChange={toggleProductNotifications}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="supplier-notifications">Supplier Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about supplier updates
                  </p>
                </div>
                <Switch
                  id="supplier-notifications"
                  checked={settings.supplierNotifications}
                  onCheckedChange={toggleSupplierNotifications}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="spf-notifications">SPF Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about SPF requests
                  </p>
                </div>
                <Switch
                  id="spf-notifications"
                  checked={settings.spfNotifications}
                  onCheckedChange={toggleSPFNotifications}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Alert Options</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sound-enabled" className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Sound Effects
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Play sound on notification
                  </p>
                </div>
                <Switch
                  id="sound-enabled"
                  checked={settings.soundEnabled}
                  onCheckedChange={toggleSoundEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="vibration-enabled" className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Vibration
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Vibrate on notification (mobile)
                  </p>
                </div>
                <Switch
                  id="vibration-enabled"
                  checked={settings.vibrationEnabled}
                  onCheckedChange={toggleVibrationEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-close" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Auto-close Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically close non-critical notifications
                  </p>
                </div>
                <Switch
                  id="auto-close"
                  checked={settings.autoClose}
                  onCheckedChange={toggleAutoClose}
                />
              </div>

              {settings.autoClose && (
                <div className="space-y-2">
                  <Label htmlFor="auto-close-duration">
                    Auto-close Duration: {settings.autoCloseDuration / 1000}s
                  </Label>
                  <Slider
                    id="auto-close-duration"
                    min={3}
                    max={10}
                    step={1}
                    value={[settings.autoCloseDuration / 1000]}
                    onValueChange={([value]) => setAutoCloseDuration(value * 1000)}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              localStorage.removeItem("notificationPermissionShown");
              window.location.reload();
            }}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Permission Dialog
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetSettings}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Settings
          </Button>
        </div>
      </div>
  );

  if (hideCard) {
    return body;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Manage your notification preferences
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
