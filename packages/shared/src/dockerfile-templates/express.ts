/**
 * Auto-generated Dockerfile for Express / Node.js apps.
 */
export const EXPRESS_DOCKERFILE = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
`;
