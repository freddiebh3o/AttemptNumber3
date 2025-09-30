import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { ZodTenantThemeResponseData } from "../schemas/tenants.js";

extendZodWithOpenApi(z);

// Reuse in path modules
export const ZodUploadKind = z
  .enum(["logo", "product", "user", "misc"])
  .openapi("UploadKind");

export const ZodBinaryFile = z
  .any() // overridden for OpenAPI rendering
  .openapi({ type: "string", format: "binary", description: "File blob" });

export const ZodMultipartImageUploadBody = z
  .object({
    file: ZodBinaryFile, // <input name="file" />
    kind: ZodUploadKind.optional(), // optional for generic uploads
  })
  .openapi("MultipartImageUploadBody");

export const ZodTenantLogoUploadBody = z
  .object({
    file: ZodBinaryFile, // only a file; kind is fixed to "logo" server-side
  })
  .openapi("TenantLogoUploadBody");

export const ZodUploadInfo = z
  .object({
    url: z.string().url(),
    path: z.string(),
    contentType: z.string(),
    bytes: z.number().int().min(0),
  })
  .openapi("UploadInfo");

// Generic upload response: { upload }
export const ZodGenericUploadResponseData = z
  .object({ upload: ZodUploadInfo })
  .openapi("GenericUploadResponseData");

export const ZodTenantLogoUploadResponseData =
  ZodTenantThemeResponseData.extend({ upload: ZodUploadInfo }).openapi(
    "TenantLogoUploadResponseData"
  );
