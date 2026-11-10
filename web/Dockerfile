# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_fetch_timeout=600000 \
    npm_config_maxsockets=3
COPY package*.json ./
RUN npm ci
COPY . .
# The API lives on its own hostname; the browser calls it directly, so the URL
# is baked in at build time. Change it -> rebuild the web image.
ARG VITE_API_URL=http://localhost:3000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- runtime: nginx serving the static SPA ---
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
