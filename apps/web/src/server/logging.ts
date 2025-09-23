import pino from "pino";
export const logger = pino({ name: "web", level: process.env.LOG_LEVEL ?? "info" });
