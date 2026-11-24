#!/bin/sh
cd /root
[ -f wgcf-account.toml ] || wgcf register --accept-tos
wgcf generate
cat >> wgcf-profile.conf <<EOF

[Socks5]
BindAddress = [::]:40000
EOF
exec wireproxy -c wgcf-profile.conf
