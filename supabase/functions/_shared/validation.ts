import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

/**
 * Validation schemas for edge function inputs
 */

// labels-apply-batch
export const LabelsApplyBatchSchema = z.object({
  assetId: z.string().min(1).max(512),
  toAdd: z.array(z.string().uuid()).max(100).default([]),
  toRemove: z.array(z.string().uuid()).max(100).default([]),
});

// get-thumb-urls
export const GetThumbUrlsSchema = z.object({
  fileIds: z.array(z.string().min(1).max(256)).min(1).max(100),
});

// library-list-unified
export const LibraryListUnifiedSchema = z.object({
  page: z.number().int().min(1).max(1000).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  source: z.enum(["all", "db", "gdrive"]).default("all"),
  mimeClass: z.enum(["all", "image", "video"]).default("all"),
  labelIds: z.array(z.string().uuid()).max(50).default([]),
  q: z.string().max(500).default(""),
  collectionId: z.string().uuid().optional(),
  driveOriginFolder: z.string().max(500).optional(),
  originStatus: z.enum(["active", "missing", "permanently_deleted"]).optional(),
});

// labels-apply-bulk
export const LabelsApplyBulkSchema = z.object({
  assetIds: z.array(z.string().min(1).max(512)).min(1).max(1000),
  toAdd: z.array(z.string().uuid()).max(100).default([]),
  toRemove: z.array(z.string().uuid()).max(100).default([]),
});

// google-drive-auth actions
export const GoogleDriveAuthActionSchema = z.enum([
  "status",
  "authorize",
  "set_folder",
  "set_prefs",
  "setFolder",
  "disconnect",
]);

export const GoogleDriveSetFolderSchema = z.object({
  folderId: z.string().min(1).max(256),
  folderName: z.string().max(500).optional(),
});

export const GoogleDriveSetPrefsSchema = z.object({
  allowExtendedScope: z.boolean(),
});

/**
 * Validate and parse request body
 */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Error("VALIDATION_FAILED");
  }
  return result.data;
}
