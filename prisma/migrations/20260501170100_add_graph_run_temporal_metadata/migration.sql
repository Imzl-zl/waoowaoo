ALTER TABLE `graph_runs`
  ADD COLUMN `temporalWorkflowId` VARCHAR(191) NULL,
  ADD COLUMN `temporalFirstExecutionRunId` VARCHAR(191) NULL,
  ADD COLUMN `temporalTaskQueue` VARCHAR(191) NULL;

CREATE INDEX `graph_runs_temporalWorkflowId_idx`
  ON `graph_runs`(`temporalWorkflowId`);
