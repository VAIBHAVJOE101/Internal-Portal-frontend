# DevOps Portal – Frontend

React 19 + TypeScript + Vite + Tailwind CSS v4 UI for the internal Platform & DevOps portal.

- **Design**: dark-first with a light theme, a collapsible sidebar with dynamic inventory pages, breadcrumbs, a **Ctrl/⌘ K** command palette, a live alert bell (SSE), KPI strips with sparklines, drawers for details and editing, and type-to-confirm for destructive operations.
- **Pages**:
  - Dashboard
  - Inventory: create, edit and delete pages; customize columns with drag-reorder and per-user visibility; schema-driven forms; CSV import/export
  - Kafka: clusters from inventory, topics (create, configs, partitions, purge, delete), consumer groups (lag, offset reset), connectors and sinks, Connect REST console
  - App Kafka Portal: inline and bulk remaps with diff preview
  - Connectivity: quick tests, interval and cron schedules, history
  - Azure Boards: drag-and-drop sprint board and work item editor
  - GitHub: workflows and teams
  - Alerts, Audit logs, Settings
- **Role aware**: READER sees everything read-only. ADMIN actions are shown only to members of the DevOps team.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api, /oauth2 and /login/oauth2 to http://localhost:8080
```

Run the backend in mock mode (`./gradlew bootRun --args='--spring.profiles.active=mock'`) and sign in with `admin/admin` or `reader/reader`. Set `PORTAL_BACKEND_URL` to proxy to a different backend.

```bash
npm run lint && npm run build
```

## Structure

```
src/
  lib/            api client (CSRF + 401 handling), auth context, theme, shared types
  components/ui/  design system (button, card, badge, dialog/sheet, data table, stat card, confirm…)
  components/layout/  app shell, sidebar, top bar, command palette, alert bell
  features/<module>/  one folder per page
```

## Deploy

```bash
docker build -t ghcr.io/your-org/devops-portal-frontend:0.1.0 .
kubectl apply -k k8s/overlays/prod
```

The image is unprivileged nginx on port 8080 with SPA fallback. `k8s/base/ingress.yaml` routes on a single host:

- `/` goes to the frontend.
- `/api`, `/oauth2`, `/login/oauth2`, `/swagger-ui` and `/v3/api-docs` go to `devops-portal-backend:8080`.
- Proxy buffering is disabled so the alert stream works.

This base also creates the `devops-portal` namespace.
