FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates tar && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://github.com/ViRb3/wgcf/releases/download/v2.2.22/wgcf_2.2.22_linux_amd64 -o /usr/local/bin/wgcf && chmod +x /usr/local/bin/wgcf
RUN curl -fsSL https://github.com/pufferffish/wireproxy/releases/download/v1.0.9/wireproxy_linux_amd64.tar.gz -o /tmp/w.tgz && tar -xzf /tmp/w.tgz -C /usr/local/bin wireproxy && rm /tmp/w.tgz
COPY start.sh /start.sh
RUN sed -i 's/\r$//' /start.sh && chmod +x /start.sh
CMD ["/start.sh"]
