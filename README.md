# Gator CLI

Gator is a local multi-user RSS feed collection CLI built with TypeScript, Drizzle ORM, and PostgreSQL. It stores users, feeds, follow relationships, and feed posts in a local Postgres database.

## Requirements

- Node.js / npm
- PostgreSQL database running locally
- A valid Postgres connection string for your database

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create the config file in your home directory:

```json
{
  "db_url": "postgres://postgres:postgres@localhost:5432/gator?sslmode=disable"
}
```

Save this as `~/.gatorconfig.json`.

3. Build the project and generate/run migrations if needed:

```bash
npm exec -- tsx src/index.ts
```

## Common commands

Run commands with:

```bash
npm run start -- <command> [args]
```

### User commands

- `register <username>`  — create a new user and set them as current
- `login <username>`     — set the current user
- `users`                — list all registered users

### Feed commands

- `addfeed <name> <url>`   — add a new feed and follow it as the current user
- `feeds`                  — list all feeds and their creators
- `follow <url>`           — follow an existing feed as the current user
- `unfollow <url>`         — unfollow a feed as the current user
- `following`              — list feeds followed by the current user

### Aggregation

- `agg <interval>`         — run the feed fetcher continuously, where `interval` is like `1s`, `30s`, `1m`

Example:

```bash
npm run start -- agg 1m
```

### Posts

- `browse [limit]`         — show the most recent posts for feeds followed by the current user

If `limit` is omitted, the default is `2`.

### Utility

- `reset`                 — delete all users and cascade delete related feeds/follows

## Notes

- The CLI is intended for local development.
- The program uses `~/.gatorconfig.json` to store the database URL and current user.
- `agg` is a long-running process and should be stopped with `Ctrl+C`.
