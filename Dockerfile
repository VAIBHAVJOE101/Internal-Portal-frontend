# ---- build ----
FROM node:20.12.2-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime: unprivileged nginx serving the SPA on :8080 and proxying /devopsportal/ to the backend ----
FROM nginxinc/nginx-unprivileged:1.29-alpine
# Backend Service the SPA's /devopsportal/ calls are proxied to; override per environment
ENV BACKEND_URL=http://devops-portal-backend:8080 \
    NGINX_ENVSUBST_FILTER=^BACKEND_
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
