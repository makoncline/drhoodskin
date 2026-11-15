CREATE TABLE `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`t` text NOT NULL,
	`k` text NOT NULL,
	`p` text NOT NULL,
	`a` text NOT NULL,
	`an` text,
	`v` text,
	`c` text,
	`r` text,
	`md` integer,
	`e` text,
	`tool` text,
	`via` text
);
--> statement-breakpoint
CREATE TABLE `availability` (
	`visit` text PRIMARY KEY,
	`snapshot` text,
	`checked_at` integer,
	`due_at` integer DEFAULT 0 NOT NULL,
	`retry_ms` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `maintenance` (
	`name` text PRIMARY KEY,
	`day` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visitor_salts` (
	`day` text PRIMARY KEY,
	`salt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_time` ON `activity` (`t`);
--> statement-breakpoint
INSERT INTO `availability` (`visit`) VALUES ('office'), ('full-body-exam');