CREATE TABLE `workflow_definitions` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `workflowType` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `draftDefinition` JSON NOT NULL,
  `draftValidation` JSON NULL,
  `publishedVersion` INTEGER NULL,
  `publishedVersionId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
);

CREATE TABLE `workflow_definition_versions` (
  `id` VARCHAR(191) NOT NULL,
  `workflowDefinitionId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `workflowType` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `definition` JSON NOT NULL,
  `validation` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
);

CREATE UNIQUE INDEX `workflow_definitions_projectId_workflowType_key`
  ON `workflow_definitions`(`projectId`, `workflowType`);

CREATE UNIQUE INDEX `workflow_definitions_publishedVersionId_key`
  ON `workflow_definitions`(`publishedVersionId`);

CREATE INDEX `workflow_definitions_projectId_updatedAt_idx`
  ON `workflow_definitions`(`projectId`, `updatedAt`);

CREATE INDEX `workflow_definitions_userId_updatedAt_idx`
  ON `workflow_definitions`(`userId`, `updatedAt`);

CREATE UNIQUE INDEX `workflow_definition_versions_workflowDefinitionId_version_key`
  ON `workflow_definition_versions`(`workflowDefinitionId`, `version`);

CREATE INDEX `workflow_definition_versions_projectId_workflowType_idx`
  ON `workflow_definition_versions`(`projectId`, `workflowType`);

CREATE INDEX `workflow_definition_versions_userId_createdAt_idx`
  ON `workflow_definition_versions`(`userId`, `createdAt`);

ALTER TABLE `workflow_definitions`
  ADD CONSTRAINT `workflow_definitions_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `workflow_definitions`
  ADD CONSTRAINT `workflow_definitions_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `workflow_definitions`
  ADD CONSTRAINT `workflow_definitions_publishedVersionId_fkey`
  FOREIGN KEY (`publishedVersionId`) REFERENCES `workflow_definition_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `workflow_definition_versions`
  ADD CONSTRAINT `workflow_definition_versions_workflowDefinitionId_fkey`
  FOREIGN KEY (`workflowDefinitionId`) REFERENCES `workflow_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `workflow_definition_versions`
  ADD CONSTRAINT `workflow_definition_versions_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
