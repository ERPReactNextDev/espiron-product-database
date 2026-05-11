import type { Metadata } from "next";
import { GeistSans, GeistMono } from "geist/font";
import "./globals.css";

import { UserProvider } from "@/contexts/UserContext";
import { WallpaperProvider } from "@/contexts/WallpaperContext";
import { RoleAccessProvider } from "@/contexts/RoleAccessContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "sonner";

import { SidebarProvider } from "@/components/ui/sidebar";
import LayoutShell from "@/components/layout-shell";
import { ThemeBody } from "@/components/theme-body";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata = {
  title: "Espiron | Product Database",
  description: "...",
icons: {
  icon: [
    { url: "/espiron-logo.svg", type: "image/svg+xml" },
  ],
},
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <ThemeProvider>
        <ThemeBody>
          <UserProvider>
            <RoleAccessProvider>
              <WallpaperProvider>
                <SidebarProvider>
                  <LayoutShell>{children}</LayoutShell>
                </SidebarProvider>

              <Toaster
                position="top-right"
                closeButton
                toastOptions={{
                  className:
                    "bg-background border border-border text-foreground shadow-lg rounded-lg",
                }}
              />
              <ServiceWorkerRegistration />
            </WallpaperProvider>
          </RoleAccessProvider>
          </UserProvider>
        </ThemeBody>
      </ThemeProvider>
    </html>
  );
}
