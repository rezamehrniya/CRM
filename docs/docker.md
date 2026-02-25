# Docker Quickstart

## 1) Production-like stack (nginx + api + postgres)

```bash
cp .env.docker.example .env
docker compose down
docker compose up -d --build
```

Services:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:3001/api`
- Postgres: `localhost:15432`

If `DEMO_SEED=1`, backend will run Prisma seed on startup (idempotent).

## 2) Development stack (vite + nest watch + postgres)

```bash
cp .env.docker.example .env
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up -d --build
```

Services:

- Frontend (Vite): `http://localhost:5173`
- Backend API: `http://localhost:3001/api`
- Postgres: `localhost:15432`

## 3) Useful commands

```bash
# prod logs
docker compose logs -f

# dev logs
docker compose -f docker-compose.dev.yml logs -f

# stop everything
docker compose down
docker compose -f docker-compose.dev.yml down
```

## 4) Important

- Do not run prod and dev compose stacks at the same time.
- If frontend still runs `vite` on port `8080`, recreate containers:

```bash
docker compose down --remove-orphans
docker compose up -d --build --force-recreate
```
