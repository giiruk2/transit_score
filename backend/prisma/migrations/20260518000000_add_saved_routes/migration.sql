CREATE TABLE "SavedRoute" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "originName"     TEXT NOT NULL,
    "originLat"      DOUBLE PRECISION NOT NULL,
    "originLng"      DOUBLE PRECISION NOT NULL,
    "attractionId"   TEXT NOT NULL,
    "attractionName" TEXT NOT NULL,
    "attractionLat"  DOUBLE PRECISION NOT NULL,
    "attractionLng"  DOUBLE PRECISION NOT NULL,
    "legs"           JSONB NOT NULL,
    "totalTimeMin"   INTEGER NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedRoute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedRoute_userId_idx" ON "SavedRoute"("userId");
