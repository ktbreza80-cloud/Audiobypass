FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN curl -L \
    https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Install bgutil yt-dlp PO Token plugin
RUN python3 -m pip install --break-system-packages -U \
    bgutil-ytdlp-pot-provider

# Install bgutil PO Token HTTP provider
WORKDIR /opt

RUN git clone --depth 1 --branch 2.0.2 \
    https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git \
    bgutil-ytdlp-pot-provider

WORKDIR /opt/bgutil-ytdlp-pot-provider/server

RUN npm ci \
    && npx tsc \
    && npm prune --omit=dev

# Kembali ke aplikasi Rezzz Audio
WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN chmod +x start.sh

ENV POT_URL=http://127.0.0.1:4416

EXPOSE 3000

CMD ["./start.sh"]
