FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg curl ca-certificates && rm -rf /var/lib/apt/lists/*
ARG CACHEBUST=1
RUN pip3 install --no-cache-dir --break-system-packages -U --pre "yt-dlp[default]" bgutil-ytdlp-pot-provider
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
CMD ["node", "server.js"]
