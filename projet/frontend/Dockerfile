# Étape 1 : compilation de l'application React (Vite)
FROM node:20-alpine AS build
WORKDIR /app

# L'URL de l'API doit être connue AU MOMENT DE LA COMPILATION (Vite l'intègre
# directement dans le JavaScript généré) — d'où l'ARG passé par docker-compose.
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Étape 2 : image finale, ne contient que les fichiers statiques + nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
