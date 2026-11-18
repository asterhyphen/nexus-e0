import { z } from 'zod';

export const teamCodeSchema = z
  .string()
  .trim()
  .min(4, 'Code must be at least 4 characters')
  .max(16, 'Code cannot exceed 16 characters')
  .regex(/^[A-Za-z0-9-]+$/, 'Code may only contain letters, numbers, and hyphens')
  .transform((val) => val.toUpperCase());

export const adminPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters');

export const problemStatementSchema = z
  .string()
  .trim()
  .min(10, 'Statement must be at least 10 characters')
  .max(500, 'Statement cannot exceed 500 characters')
  .transform((val) => val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''));

export const teamNameSchema = z
  .string()
  .trim()
  .min(2, 'Team name must be at least 2 characters')
  .max(64, 'Team name cannot exceed 64 characters');

export const trackNameSchema = z
  .string()
  .trim()
  .min(2, 'Track name must be at least 2 characters')
  .max(80, 'Track name cannot exceed 80 characters');
