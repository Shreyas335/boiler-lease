# boiler-lease

A sublease management platform for sublessees, subleasers, and management companies.

## Quick Start (Docker)

```bash
# From project root
cp .env.example .env   # if you haven't already
docker-compose up --build
```

**have 

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




Frontend

run npm install
