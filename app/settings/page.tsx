"use client";

import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { useWallpaper } from "@/contexts/WallpaperContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Palette, Sparkles, Building2, Wrench, ChevronDown, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { NotificationSettings } from "@/components/notifications/NotificationSettings";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { userId } = useUser();
  const { wallpaper } = useWallpaper();
  const isEngineer = theme === "engineer";
const [mounted, setMounted] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className={`container mx-auto max-w-4xl p-6 space-y-6 pb-12 ${
      isEngineer && !wallpaper ? "engineer-blueprint-bg" : ""
    }`}>
      {/* Header */}
      <div className="space-y-1">
        <h1 className={`text-3xl font-bold ${theme === "comic" ? "font-comic-title text-red-500 comic-text-outline" : theme === "engineer" ? "font-engineer-title text-orange-600 engineer-text-shadow" : "font-formal-title text-red-600"}`}>
          Settings
        </h1>
        <p className={`text-muted-foreground ${theme === "comic" ? "font-comic" : theme === "engineer" ? "font-engineer" : "font-formal"}`}>
          Customize your application experience
        </p>
      </div>

      {/* Theme Settings */}
      <Card className={theme === "comic" ? "comic-card" : theme === "engineer" ? "engineer-card" : "formal-card"}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${theme === "comic" ? "comic-card-primary" : theme === "engineer" ? "engineer-card-primary" : "formal-card-primary"}`}>
              <Palette className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className={theme === "comic" ? "font-comic-title" : "font-formal-title"}>
                Theme
              </CardTitle>
              <CardDescription className={theme === "comic" ? "font-comic" : theme === "engineer" ? "font-engineer" : "font-formal"}>
                Choose your preferred visual style
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as Theme)}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {/* Comic Theme Option */}
            <Label
              htmlFor="comic"
              className={`cursor-pointer transition-all ${
                theme === "comic"
                  ? "comic-card-primary scale-[1.02]"
                  : "comic-card hover:scale-[1.01]"
              }`}
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    <span className="font-comic-title text-lg">Comic</span>
                  </div>
                  <RadioGroupItem value="comic" id="comic" className="sr-only" />
                  {theme === "comic" && (
                    <span className="comic-badge bg-green-400 text-gray-900 px-2 py-0.5 text-xs">
                      Active
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full bg-linear-to-r from-yellow-400 via-orange-400 to-red-400 rounded-full" />
                  <p className="font-comic text-sm opacity-90">
                    Fun, colorful, and playful UI with comic book style elements
                  </p>
                  <div className="flex gap-1">
                    <span className="comic-badge bg-yellow-400 text-gray-900 px-2 py-0.5 text-xs">Fun</span>
                    <span className="comic-badge bg-blue-400 text-white px-2 py-0.5 text-xs">Animated</span>
                  </div>
                </div>
              </div>
            </Label>

            {/* Formal Theme Option */}
            <Label
              htmlFor="formal"
              className={`cursor-pointer transition-all ${
                theme === "formal"
                  ? "border-2 border-red-600 bg-red-50 scale-[1.02]"
                  : "formal-card hover:scale-[1.01]"
              }`}
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-red-600" />
                    <span className="font-formal-title text-lg text-gray-900">Formal</span>
                  </div>
                  <RadioGroupItem value="formal" id="formal" className="sr-only" />
                  {theme === "formal" && (
                    <span className="formal-badge bg-red-600 text-white px-2 py-0.5 text-xs">
                      Active
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full bg-linear-to-r from-red-600 to-red-800 rounded-full" />
                  <p className="font-formal text-sm text-gray-600">
                    Professional, clean UI with white and red color scheme
                  </p>
                  <div className="flex gap-1">
                    <span className="formal-badge bg-gray-100 text-gray-700 px-2 py-0.5 text-xs">Professional</span>
                    <span className="formal-badge bg-gray-100 text-gray-700 px-2 py-0.5 text-xs">Clean</span>
                  </div>
                </div>
              </div>
            </Label>

            {/* Engineer Theme Option */}
            <Label
              htmlFor="engineer"
              className={`cursor-pointer transition-all ${
                theme === "engineer"
                  ? "engineer-card-primary scale-[1.02]"
                  : "engineer-card hover:scale-[1.01]"
              }`}
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    <span className="font-engineer-title text-lg">Engineer</span>
                  </div>
                  <RadioGroupItem value="engineer" id="engineer" className="sr-only" />
                  {theme === "engineer" && (
                    <span className="engineer-badge bg-orange-500 text-white px-2 py-0.5 text-xs">
                      Active
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full bg-linear-to-r from-orange-500 via-yellow-400 to-orange-500 rounded-full" />
                  <p className="font-engineer text-sm opacity-90">
                    Bob the Builder inspired - construction site aesthetic with safety colors
                  </p>
                  <div className="flex gap-1">
                    <span className="engineer-badge bg-orange-500 text-white px-2 py-0.5 text-xs">Industrial</span>
                    <span className="engineer-badge bg-yellow-400 text-gray-900 px-2 py-0.5 text-xs">Construction</span>
                  </div>
                </div>
              </div>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Preview Section */}
      <Card className={theme === "comic" ? "comic-card" : theme === "engineer" ? "engineer-card" : "formal-card"}>
        <CardHeader>
          <CardTitle className={theme === "comic" ? "font-comic-title" : theme === "engineer" ? "font-engineer-title" : "font-formal-title"}>
            Preview
          </CardTitle>
          <CardDescription className={theme === "comic" ? "font-comic" : theme === "engineer" ? "font-engineer" : "font-formal"}>
            See how your theme looks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sample Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              className={
                theme === "comic"
                  ? "comic-button px-4 py-2 bg-red-500 text-white"
                  : theme === "engineer"
                  ? "engineer-button px-4 py-2"
                  : "formal-button px-4 py-2 bg-red-600 text-white hover:bg-red-700"
              }
            >
              Primary Button
            </button>
            <button
              className={
                theme === "comic"
                  ? "comic-button px-4 py-2 bg-white text-gray-800 border-2 border-gray-800"
                  : theme === "engineer"
                  ? "engineer-button px-4 py-2 bg-yellow-400 text-gray-900"
                  : "formal-button px-4 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }
            >
              Secondary Button
            </button>
          </div>

          {/* Sample Card */}
          <div
            className={`p-4 ${
              theme === "comic" ? "comic-card-yellow" : theme === "engineer" ? "engineer-card-yellow" : "formal-card bg-gray-50"
            }`}
          >
            <h3 className={`font-bold mb-2 ${theme === "comic" ? "font-comic-title" : theme === "engineer" ? "font-engineer-title" : "font-formal-title"}`}>
              Sample Card
            </h3>
            <p className={theme === "comic" ? "font-comic" : theme === "engineer" ? "font-engineer" : "font-formal"}>
              This is how cards appear in the {theme === "comic" ? "Comic" : theme === "engineer" ? "Engineer" : "Formal"} theme.
            </p>
          </div>

          {/* Sample Text */}
          <div className="space-y-2">
            <p className={`text-sm ${theme === "comic" ? "font-comic" : theme === "engineer" ? "font-engineer" : "font-formal"}`}>
              Font: {theme === "comic" ? "Fredoka / Comic Neue (Playful)" : theme === "engineer" ? "Roboto Condensed / Arial Narrow (Industrial)" : "Arial / Helvetica (Professional)"}
            </p>
            <p className={`text-sm ${theme === "comic" ? "font-comic" : theme === "engineer" ? "font-engineer" : "font-formal"}`}>
              Primary Color: {theme === "comic" ? "Superhero Red #ff4757" : theme === "engineer" ? "Safety Orange #ff6b35" : "Professional Red #dc2626"}
            </p>
            <p className={`text-sm ${theme === "comic" ? "font-comic" : theme === "engineer" ? "font-engineer" : "font-formal"}`}>
              Background: {theme === "comic" ? "Sky Blue #87CEEB" : theme === "engineer" ? "Construction Beige #f4e4bc" : "Clean White #ffffff"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings — collapsible */}
      <Card className={theme === "comic" ? "comic-card" : theme === "engineer" ? "engineer-card" : "formal-card"}>
        <button
          type="button"
          onClick={() => setIsNotifOpen((v) => !v)}
          className="w-full text-left touch-auto"
        >
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${theme === "comic" ? "comic-card-primary" : theme === "engineer" ? "engineer-card-primary" : "formal-card-primary"}`}>
                  <Bell className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className={theme === "comic" ? "font-comic-title" : theme === "engineer" ? "font-engineer-title" : "font-formal-title"}>
                    Notification Settings
                  </CardTitle>
                  <CardDescription className={theme === "comic" ? "font-comic" : theme === "engineer" ? "font-engineer" : "font-formal"}>
                    Manage alerts, sounds, and vibration
                  </CardDescription>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 shrink-0 transition-transform ${
                  isNotifOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </CardHeader>
        </button>
        {isNotifOpen && (
          <CardContent>
            <NotificationSettings />
          </CardContent>
        )}
      </Card>

      {/* Info Section */}
      <div className={`text-center text-sm text-muted-foreground ${theme === "comic" ? "font-comic" : theme === "engineer" ? "font-engineer" : "font-formal"}`}>
        <p>Changes are saved automatically and apply across all pages.</p>
      </div>
    </div>
  );
}
