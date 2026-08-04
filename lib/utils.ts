import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind class names, resolving any conflicts.
 *
 * @param inputs - An array of class names to merge.
 * @returns A string of merged and optimized class names.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes input by removing all commas from the string.
 * This prevents users from typing commas in input fields.
 *
 * @param value - The input string to sanitize.
 * @returns The sanitized string without commas.
 */
export function sanitizeCommas(value: string): string {
  return value.replace(/,/g, '');
}
