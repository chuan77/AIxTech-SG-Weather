CREATE TABLE `visitors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `visitors_key_hash_unique` ON `visitors` (`key_hash`);--> statement-breakpoint
DROP INDEX `locations_latitude_longitude_unique`;--> statement-breakpoint
ALTER TABLE `locations` ADD `visitor_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `locations_visitor_latitude_longitude_unique` ON `locations` (`visitor_id`,`latitude`,`longitude`);