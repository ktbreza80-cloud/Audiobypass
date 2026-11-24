FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN curl -L https://github.com/ViRb3/wgcf/releases/download/v2.2.22/wgcf_2.2.22_linux_amd64 -o /usr/local/bin/wgcf && chmod +x /usr/local/bin/wgcf
RUN curl -L https://github.com/pufferffish/wireproxy/releases/download/v1.0.9/wireproxy_linux_amd64.tar.gz | tar xz -C /usr/local/bin wireproxy
COPY start.sh /start.sh
RUN chmod +x /start.sh
CMD ["/start.sh"]
