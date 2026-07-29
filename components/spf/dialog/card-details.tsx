"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";

interface Field {
    label: string;
    value: string | undefined;
    pre?: boolean;
}

interface CardDetailsProps {
    title: string;
    fields: Field[];
}

const CardDetails: React.FC<CardDetailsProps> = ({ title, fields }) => {
    const [open, setOpen] = useState(false);

    return (
        <Card className="p-4 border rounded">
            <button
                type="button"
                className="flex items-center justify-between w-full font-semibold text-sm cursor-pointer"
                onClick={() => setOpen((prev) => !prev)}
            >
                {title}
                <ChevronDown
                    className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    size={16}
                />
            </button>

            {open && (
                <div className="mt-2 space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {fields.map((field) => (
                        <div key={field.label} className="flex flex-wrap gap-2">
                            <span className="font-semibold text-sm">{field.label}:</span>
                            <span
                                className={`text-gray-700 text-sm ${
                                    field.pre ? "whitespace-pre-line" : "capitalize"
                                }`}
                            >
                                {field.value || "-"}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
};

export default CardDetails;