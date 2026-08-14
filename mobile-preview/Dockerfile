FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY index.html ./
COPY vite.config.js ./
COPY public ./public
COPY src ./src

EXPOSE 5174

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
