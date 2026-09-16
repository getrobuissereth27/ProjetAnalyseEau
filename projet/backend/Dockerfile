FROM node:20-alpine

WORKDIR /app

# Copier uniquement les fichiers de dépendances d'abord (meilleur cache Docker :
# si le code change mais pas package.json, npm install n'est pas rejoué)
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
