# syntax=docker/dockerfile:1
# ---- build: assemble the single-file app (dist/index.html) ----
FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY package.json ./
COPY scripts ./scripts
COPY app ./app
COPY server ./server
RUN node scripts/build.mjs

# ---- runtime: zero npm dependencies (node:http + node:sqlite) ----
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    IFA_HOST=0.0.0.0 \
    IFA_PORT=8080 \
    IFA_DATA=/data \
    IFA_CONFIG=/data/config.json
WORKDIR /opt/ifa
COPY --from=build /src/server ./server
COPY --from=build /src/dist ./dist
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.IFA_PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--experimental-sqlite", "--no-warnings", "server/server.js"]
