FROM node:20-alpine AS build

WORKDIR /app

# `npm ci` pelo mesmo motivo do backend: a build tem de ser reproduzivel, e o
# lock e quem garante isso.
COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build


FROM nginx:alpine

# Config com SPA fallback (necessario para o react-router em rotas como /login).
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
