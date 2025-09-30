import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { successEnvelope, RESPONSES } from "../components/envelopes.js";
import {
  ZodHealthResponseData,
  ZodVersionResponseData,
} from "../schemas/system.js";

export function registerSystemPaths(registry: OpenAPIRegistry) {
  // GET /api/health
  registry.registerPath({
    tags: ["System"],
    method: "get",
    path: "/api/health",
    responses: {
      200: {
        description: "Service health",
        content: {
          "application/json": {
            schema: successEnvelope(ZodHealthResponseData),
          },
        },
      },
      500: RESPONSES[500],
    },
  });

  // GET /api/version
  registry.registerPath({
    tags: ["System"],
    method: "get",
    path: "/api/version",
    responses: {
      200: {
        description: "Service version",
        content: {
          "application/json": {
            schema: successEnvelope(ZodVersionResponseData),
          },
        },
      },
      500: RESPONSES[500],
    },
  });
}
