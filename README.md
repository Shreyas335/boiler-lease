# boiler-lease

A sublease management platform for sublessees, subleasers, and management companies.

## Quick Start (Docker)

```bash
# From project root
cp .env.example .env   # if you haven't already
docker-compose up --build
```

** make sure docker is installed **
** docker compose **

**IMPORTANT:** After containers start, you MUST run migrations in another terminal: Also make sure to delete any existing volumes or change the existing volumnes for existing services

```bash
docker-compose exec backend python manage.py migrate
```

**Without running migrations, the app will show database errors!** The `accounts_user` table needs to be created first.

Create a superuser (optional, for Django admin):

```bash
docker-compose exec backend python manage.py createsuperuser
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000/api
- **Django Admin:** http://localhost:8000/admin

---

## AWS S3 Media Env Vars

To enable S3-backed media, copy the AWS settings from `.env.example` into `.env` and fill in:

- `AWS_ACCESS_KEY_ID`: IAM access key for the media buckets.
- `AWS_SECRET_ACCESS_KEY`: IAM secret key for the media buckets.
- `AWS_DEFAULT_REGION`: AWS region for the buckets, for example `us-east-1`.
- `AWS_S3_PUBLIC_BUCKET_NAME`: bucket used for publicly viewable listing photos.
- `AWS_S3_PRIVATE_BUCKET_NAME`: bucket reserved for private photos.

Optional settings:

- `AWS_S3_PUBLIC_CUSTOM_DOMAIN`: hostname to use if public media should resolve through a custom domain or CDN.
- `AWS_S3_ENDPOINT_URL`: use only for a non-default S3 endpoint or S3-compatible provider.
- `AWS_S3_PRIVATE_URL_EXPIRE_SECONDS`: signed private-photo URL lifetime in seconds. Default is `300`.

Current setup notes:

- Public S3 storage settings activate only when `AWS_S3_PUBLIC_BUCKET_NAME` is set.
- Private S3 storage settings activate only when `AWS_S3_PRIVATE_BUCKET_NAME` is set and generate signed URLs that expire based on `AWS_S3_PRIVATE_URL_EXPIRE_SECONDS`.
- Prefer separate public and private buckets instead of mixing both access levels in one bucket.

If you change Python dependencies for S3 support, rebuild the backend container:

```bash
docker-compose up --build backend
```

---

## Database: View Schemas & Data

### Option 1: Django Admin (easiest)

1. Create a superuser: `docker-compose exec backend python manage.py createsuperuser`
2. Go to http://localhost:8000/admin
3. Log in and browse Users, groups, etc.

### Option 2: psql (PostgreSQL CLI)

```bash
docker-compose exec db psql -U app_user -d app_db
```

Then run SQL:

```sql
\dt                    -- list tables
\d accounts_user       -- describe accounts_user schema
SELECT * FROM accounts_user;
```

### Option 3: pgAdmin or DBeaver (GUI)

Connect with:

| Setting   | Value    |
|-----------|----------|
| Host      | localhost |
| Port      | 5432     |
| Database  | app_db   |
| Username  | app_user |
| Password  | app_password (from .env) |

### Option 4: Django dbshell

```bash
docker-compose exec backend python manage.py dbshell
```

Runs a PostgreSQL shell connected to your project database.


## To have linting locally

Frontend

run npm install

npm run dev

## sidecommands

'
docker compose up --build\
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
'
