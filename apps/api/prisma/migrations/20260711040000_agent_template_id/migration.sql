-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "templateId" TEXT;

-- CreateIndex
CREATE INDEX "Agent_templateId_idx" ON "Agent"("templateId");
