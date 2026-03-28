# Usamos una imagen que ya tiene Chrome y Node instalados
FROM ghcr.io/puppeteer/puppeteer:latest

# Cambiamos a usuario root para tener permisos
USER root

# Creamos la carpeta de la app
WORKDIR /app

# Copiamos archivos de dependencias
COPY package*.json ./

# Instalamos librerías
RUN npm install

# Copiamos el resto del código
COPY . .

# Comando para arrancar el bot
CMD ["node", "index.js"]