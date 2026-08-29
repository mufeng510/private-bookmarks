CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` text NOT NULL,
	`remote_id` text NOT NULL,
	`parent_id` text DEFAULT '0' NOT NULL,
	`type` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`url` text,
	`position` integer DEFAULT 0 NOT NULL,
	`favicon_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookmarks_client_remote_uq` ON `bookmarks` (`client_id`,`remote_id`);--> statement-breakpoint
CREATE INDEX `bookmarks_client_live_idx` ON `bookmarks` (`client_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `bookmarks_client_type_idx` ON `bookmarks` (`client_id`,`type`);--> statement-breakpoint
CREATE INDEX `bookmarks_url_idx` ON `bookmarks` (`url`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`last_sync_at` text,
	`last_full_sync_at` text,
	`sync_version` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_state_client_uq` ON `sync_state` (`client_id`);--> statement-breakpoint
CREATE TABLE `sync_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`prefix` text NOT NULL,
	`last_used_at` text,
	`created_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_tokens_hash_uq` ON `sync_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_uq` ON `users` (`username`);