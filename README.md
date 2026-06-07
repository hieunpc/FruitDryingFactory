# DADN Demo

Dryer monitoring and control demo project with a Node.js backend and a Vite-based frontend.

## Repository Layout

- `BE/` - backend API, database scripts, Docker setup, and backend docs.
- `FE/` - frontend application.
- `docs/` - project notes, flows, and testing guides.

## Quick Start

### Backend

```bash
cd BE
copy .env.example .env
npm install
docker compose up -d
npm run seed
npm run dev
```

### Frontend

```bash
cd FE
npm install
npm run dev
```

## Notes

- Do not commit `.env` files or `node_modules`.
- Backend API docs and workflow notes live in `BE/README.md` and `docs/`.
