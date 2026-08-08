CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid,
	"user_id" uuid,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'user',
	"timestamp" integer,
	"username" text
);
--> statement-breakpoint
CREATE TABLE "room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"host_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"video_url" text,
	"video_timestamp" double precision DEFAULT 0 NOT NULL,
	"last_action_time" timestamp DEFAULT now() NOT NULL,
	"video_type" text,
	"is_paused" boolean DEFAULT true,
	"emptied_at" timestamp,
	"guest_permission" jsonb DEFAULT '{"canControl":false,"canChat":true,"canUpload":false}'::jsonb NOT NULL,
	CONSTRAINT "room_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"session_Token" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_Id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subtitle" (
	"room_id" uuid NOT NULL,
	"name" text NOT NULL,
	"data" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"email_verified" boolean DEFAULT false,
	CONSTRAINT "user_username_unique" UNIQUE("username"),
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_Id_user_id_fk" FOREIGN KEY ("user_Id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle" ADD CONSTRAINT "subtitle_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE no action ON UPDATE no action;