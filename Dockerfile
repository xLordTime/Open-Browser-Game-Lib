FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY lib ./lib
COPY dist ./dist
USER node
ENV PORT=5173 HOST=0.0.0.0
EXPOSE 5173
CMD ["node", "server.mjs"]
