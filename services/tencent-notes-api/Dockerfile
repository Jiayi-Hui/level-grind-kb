FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*
COPY services/tencent-notes-api/package.json services/tencent-notes-api/package-lock.json ./
RUN npm ci --omit=dev
COPY services/tencent-notes-api/server.mjs ./server.mjs
COPY services/tencent-notes-api/crypto-envelope.mjs ./crypto-envelope.mjs
COPY services/tencent-notes-api/object-store.mjs ./object-store.mjs
COPY services/tencent-notes-api/price-refresh-worker.mjs ./price-refresh-worker.mjs
COPY services/tencent-notes-api/price-refresh-handler.mjs ./price-refresh-handler.mjs
COPY services/tencent-notes-api/document_parser.py ./document_parser.py
COPY services/tencent-notes-api/requirements.txt ./requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt
EXPOSE 8080 9000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
USER node
CMD ["node", "server.mjs"]
