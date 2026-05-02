ALTER TABLE `graph_events`
  ADD COLUMN `idempotencyKey` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `graph_events_idempotencyKey_key`
  ON `graph_events`(`idempotencyKey`);
