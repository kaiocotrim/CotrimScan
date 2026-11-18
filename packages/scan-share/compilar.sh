#!/usr/bin/env bash
# Publica o NAPS2 WebScan LocalService para linux-x64 em dist-linux/.
# Uso: ./compilar.sh [--self-contained]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$SCRIPT_DIR/NAPS2.WebScan.LocalService.csproj"
OUT_DIR="$SCRIPT_DIR/dist-linux"
SELF_CONTAINED=false

for arg in "$@"; do
  case "$arg" in
    --self-contained) SELF_CONTAINED=true ;;
    -h|--help)
      echo "Uso: ./compilar.sh [--self-contained]"
      echo "  Padrao: framework-dependent (requer .NET 8 Runtime no destino)."
      exit 0
      ;;
    *)
      echo "Opcao desconhecida: $arg" >&2
      exit 1
      ;;
  esac
done

if ! command -v dotnet >/dev/null 2>&1; then
  echo "ERRO: .NET 8 SDK nao encontrado." >&2
  echo "Instale: https://dotnet.microsoft.com/download/dotnet/8.0" >&2
  exit 1
fi

echo "Projeto: $PROJECT"
echo "Saida:   $OUT_DIR"
echo "Modo:    self-contained=$SELF_CONTAINED"
echo

rm -rf "$OUT_DIR"
dotnet publish "$PROJECT" -c Release -r linux-x64 \
  --self-contained "$SELF_CONTAINED" -o "$OUT_DIR"

# Copia o instalador e a unit systemd para a pasta publicada, que vira o pacote de distribuicao.
cp "$SCRIPT_DIR/instalador.sh" "$OUT_DIR/"
cp "$SCRIPT_DIR/deploy/linux/install.sh" "$OUT_DIR/"
cp "$SCRIPT_DIR/deploy/linux/naps2-webscan.service" "$OUT_DIR/"
chmod +x "$OUT_DIR/instalador.sh" "$OUT_DIR/install.sh" "$OUT_DIR/NAPS2.WebScan.LocalService"

echo
echo "Compilacao concluida: $OUT_DIR"
echo "Proximo passo: cd dist-linux && sudo ./instalador.sh install"
