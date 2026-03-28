FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Copiamos los archivos de tu bot
COPY package*.json ./
RUN npm install

COPY . .

# Comando para arrancar el bot
CMD ["node", "index.js"]