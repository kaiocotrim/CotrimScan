#!/usr/bin/env bash
# Instalador do NAPS2 WebScan LocalService para Linux (systemd).
# Execute a partir da pasta publicada (dist-linux/), gerada por compilar.sh.
# Uso: sudo ./instalador.sh [install|uninstall|start|stop|status|logs|scanners]
#      sudo ./instalador.sh            (menu interativo)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE="naps2-webscan.service"
APP_DIR="/opt/naps2-webscan"
API_URL="http://127.0.0.1:5000/api/scanners"

service_installed() {
  systemctl cat "$SERVICE" >/dev/null 2>&1
}

require_root() {
  if [[ $EUID -ne 0 ]]; then
    echo "ERRO: execute como root (sudo ./instalador.sh ...)." >&2
    return 1
  fi
}

wait_api() {
  local i
  for i in $(seq 1 10); do
    if curl -fsS "$API_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

show_status() {
  if service_installed; then
    echo "Servico: instalado ($SERVICE)"
    echo "Estado: $(systemctl is-active "$SERVICE" 2>/dev/null)"
    echo "Inicio automatico: $(systemctl is-enabled "$SERVICE" 2>/dev/null)"
  else
    echo "Servico: nao instalado"
  fi
}

install_service() {
  require_root || return 1
  if service_installed; then
    echo "Servico ja instalado. Desinstale primeiro (opcao uninstall)."
    return 1
  fi
  if [[ ! -x "$SCRIPT_DIR/NAPS2.WebScan.LocalService" ]]; then
    echo "ERRO: executavel nao encontrado em $SCRIPT_DIR." >&2
    echo "Gere o pacote com ./compilar.sh e execute o instalador a partir de dist-linux/." >&2
    return 1
  fi
  "$SCRIPT_DIR/install.sh" "$SCRIPT_DIR"
}

uninstall_service() {
  require_root || return 1
  if ! service_installed; then
    echo "Servico nao esta instalado."
    return 0
  fi
  systemctl disable --now "$SERVICE" || true
  rm -f "/etc/systemd/system/$SERVICE"
  systemctl daemon-reload
  if [[ "$SCRIPT_DIR" != "$APP_DIR" ]]; then
    rm -rf "$APP_DIR"
  fi
  echo "Servico removido. As portas salvas em /var/lib/naps2-webscan foram mantidas."
}

start_service() {
  require_root || return 1
  systemctl start "$SERVICE" || return 1
  if wait_api; then
    echo "Servico iniciado. API: $API_URL"
  else
    echo "Servico iniciado, mas a API nao respondeu. Veja: sudo ./instalador.sh logs" >&2
    return 1
  fi
}

stop_service() {
  require_root || return 1
  systemctl stop "$SERVICE" && echo "Servico parado."
}

show_logs() {
  journalctl -u "$SERVICE" -n 50 --no-pager
}

list_scanners() {
  local body
  if ! body="$(curl -fsS "$API_URL")"; then
    echo "ERRO: API indisponivel em $API_URL. O servico esta iniciado?" >&2
    return 1
  fi
  if command -v jq >/dev/null 2>&1; then
    jq . <<<"$body"
  else
    echo "$body"
  fi
}

run_action() {
  case "$1" in
    install)   install_service ;;
    uninstall) uninstall_service ;;
    start)     start_service ;;
    stop)      stop_service ;;
    status)    show_status ;;
    logs)      show_logs ;;
    scanners)  list_scanners ;;
    *)
      echo "Acao invalida: $1" >&2
      return 1
      ;;
  esac
}

menu() {
  while true; do
    echo
    echo "NAPS2 WebScan LocalService - Instalador Linux"
    show_status
    echo
    echo "1. Instalar como servico systemd"
    echo "2. Desinstalar servico"
    echo "3. Iniciar servico"
    echo "4. Parar servico"
    echo "5. Status do servico"
    echo "6. Ver logs (ultimas 50 linhas)"
    echo "7. Listar scanners"
    echo "0. Sair"
    echo
    read -r -p "Digite sua opcao (0-7): " opcao
    case "$opcao" in
      1) run_action install ;;
      2) run_action uninstall ;;
      3) run_action start ;;
      4) run_action stop ;;
      5) run_action status ;;
      6) run_action logs ;;
      7) run_action scanners ;;
      0) exit 0 ;;
      *) echo "Opcao invalida!" ;;
    esac
  done
}

case "${1:-}" in
  "")
    menu
    ;;
  -h|--help)
    echo "Uso: sudo ./instalador.sh [install|uninstall|start|stop|status|logs|scanners]"
    ;;
  *)
    run_action "$1"
    ;;
esac
