#!/usr/bin/env bash
# Instala o NAPS2 WebScan LocalService como unit systemd.
# Uso: sudo ./install.sh <pasta-do-publish-linux-x64>
set -euo pipefail

SRC="${1:?Informe a pasta do publish (dotnet publish -r linux-x64)}"
APP_DIR=/opt/naps2-webscan
SVC_USER=naps2scan

if [[ $EUID -ne 0 ]]; then
  echo "Execute como root (sudo)." >&2
  exit 1
fi

if ! command -v scanimage >/dev/null 2>&1; then
  echo "Aviso: sane-utils nao encontrado. Instale: apt install libsane1 sane-utils sane-airscan" >&2
fi

id -u "$SVC_USER" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin "$SVC_USER"

install -d -m 755 "$APP_DIR"
cp -r "$SRC"/. "$APP_DIR"/
chmod 755 "$APP_DIR/NAPS2.WebScan.LocalService"

install -m 644 "$(dirname "$0")/naps2-webscan.service" /etc/systemd/system/naps2-webscan.service
systemctl daemon-reload
systemctl enable --now naps2-webscan.service

echo "Servico instalado. Status: systemctl status naps2-webscan"
