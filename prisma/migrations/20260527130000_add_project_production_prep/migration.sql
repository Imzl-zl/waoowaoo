CREATE TABLE `project_production_preps` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `document` JSON NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `sourceMode` VARCHAR(191) NOT NULL DEFAULT 'manual',
  `lastGeneratedSource` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
);

CREATE UNIQUE INDEX `project_production_preps_projectId_key`
  ON `project_production_preps`(`projectId`);

CREATE INDEX `project_production_preps_userId_updatedAt_idx`
  ON `project_production_preps`(`userId`, `updatedAt`);

ALTER TABLE `project_production_preps`
  ADD CONSTRAINT `project_production_preps_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `project_production_preps`
  ADD CONSTRAINT `project_production_preps_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
