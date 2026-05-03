/**
 * Auto-generated Dockerfile for Next.js apps.
 */
export const NEXTJS_DOCKERFILE = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
`;
