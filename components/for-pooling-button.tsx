"use client";

import { Button } from "@/components/ui/button";

interface ForPoolingButtonProps {
  show?: boolean;
}

export function ForPoolingButton({ show = true }: ForPoolingButtonProps) {
  if (!show) return null;

  return (
    <Button
      size="icon"
      className="h-5 w-5 rounded-full bg-linear-to-br from-[#be2d2d] to-[#5f2828] hover:from-[#a32525] hover:to-[#4d2020] text-white shadow-md"
    >
    </Button>
  );
}
