-- CreateTable
CREATE TABLE "ExtraJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "doneOn" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtraJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtraJobWorker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "extraJobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ExtraJobWorker_extraJobId_fkey" FOREIGN KEY ("extraJobId") REFERENCES "ExtraJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExtraJobWorker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtraJobShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "extraJobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    CONSTRAINT "ExtraJobShare_extraJobId_fkey" FOREIGN KEY ("extraJobId") REFERENCES "ExtraJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExtraJobShare_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtraJobWorker_extraJobId_userId_key" ON "ExtraJobWorker"("extraJobId", "userId");

-- CreateIndex
CREATE INDEX "ExtraJobShare_projectId_idx" ON "ExtraJobShare"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtraJobShare_extraJobId_projectId_key" ON "ExtraJobShare"("extraJobId", "projectId");

