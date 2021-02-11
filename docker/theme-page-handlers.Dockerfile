FROM node-14-next-10

WORKDIR /opt/app
ENV NODE_ENV=production
#COPY package.json yarn.lock next.config.js ./
COPY . .
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs
EXPOSE 3000
CMD ["node", "containerServer.js"]
