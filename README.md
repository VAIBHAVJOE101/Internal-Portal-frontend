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

Requires Node.js 20.12.2 (see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:5173, proxies /devopsportal to http://localhost:8080
```

The backend is served under `/devopsportal` (API at `/devopsportal/api`, OAuth at `/devopsportal/oauth2`); `BACKEND_PATH` in `src/lib/api.ts` holds the prefix.
Run the backend in mock mode (`PORTAL_PROFILE=mock ./gradlew bootRun`) and sign in with `admin/admin` or `reader/reader`. Set `PORTAL_BACKEND_URL` to proxy to a different backend.

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

The image is unprivileged nginx on port 8080. It serves the SPA (with SPA fallback) and proxies `/devopsportal/` to the
backend by its Service name, `BACKEND_URL` (default `http://devops-portal-backend:8080`, both apps in the same namespace).
The browser therefore only talks to the frontend; proxy buffering is off so the alert stream works.

Manifests in `k8s/base`:

- `frontend.yaml`: Deployment, HorizontalPodAutoscaler (2–5 replicas at 70% CPU) and Service.
- `ingress.yaml`: Ingress sending everything on the host to the frontend Service.
- `namespace.yaml`: the `devops-portal` namespace.

Both files can also be applied directly (`kubectl apply -f k8s/base/frontend.yaml -f k8s/base/ingress.yaml`).
Deploy the backend first: nginx resolves the backend Service name at startup.
