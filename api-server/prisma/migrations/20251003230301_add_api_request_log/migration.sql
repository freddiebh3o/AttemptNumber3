-- CreateTable
CREATE TABLE "public"."ApiRequestLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "routeKey" TEXT,
    "query" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorCode" TEXT,
    "correlationId" TEXT,
    "reqBody" TEXT,
    "resBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiRequestLog_tenantId_createdAt_idx" ON "public"."ApiRequestLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiRequestLog_userId_createdAt_idx" ON "public"."ApiRequestLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiRequestLog_routeKey_createdAt_idx" ON "public"."ApiRequestLog"("routeKey", "createdAt");

-- CreateIndex
CREATE INDEX "ApiRequestLog_statusCode_createdAt_idx" ON "public"."ApiRequestLog"("statusCode", "createdAt");

-- CreateIndex
CREATE INDEX "ApiRequestLog_correlationId_idx" ON "public"."ApiRequestLog"("correlationId");
