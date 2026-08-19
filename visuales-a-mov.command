#!/bin/bash
# ---------------------------------------------------------------------------
# WebM (VP9 con alfa) -> QuickTime ProRes 4444, listo para After Effects.
#
# Uso:
#   - Doble clic: convierte los visual-*.webm que encuentre en ~/Downloads.
#   - Terminal:   ./visuales-a-mov.command archivo1.webm archivo2.webm
#
# ProRes 4444 (yuva444p10le) es el formato que After Effects, Premiere y Final
# Cut abren con transparencia nativa. El .mov queda al lado del .webm original.
# ---------------------------------------------------------------------------
set -u

FFMPEG=""
for candidato in ffmpeg /opt/homebrew/bin/ffmpeg /usr/local/bin/ffmpeg; do
  if command -v "$candidato" >/dev/null 2>&1; then FFMPEG="$candidato"; break; fi
done

if [ -z "$FFMPEG" ]; then
  echo "No encuentro ffmpeg. Instalalo con:  brew install ffmpeg"
  read -r -p "Enter para cerrar..." _
  exit 1
fi

archivos=("$@")
if [ ${#archivos[@]} -eq 0 ]; then
  while IFS= read -r linea; do archivos+=("$linea"); done < <(find "$HOME/Downloads" -maxdepth 1 -name 'visual-*.webm' -print)
fi

if [ ${#archivos[@]} -eq 0 ]; then
  echo "No hay visual-*.webm en ~/Downloads."
  read -r -p "Enter para cerrar..." _
  exit 0
fi

for entrada in "${archivos[@]}"; do
  [ -f "$entrada" ] || { echo "salteo (no existe): $entrada"; continue; }
  salida="${entrada%.*}.mov"
  echo "→ $(basename "$entrada")  ->  $(basename "$salida")"
  # -c:v libvpx-vp9 ANTES del -i: sin eso, el decoder VP9 por defecto descarta
  # el plano alfa del WebM y el .mov sale opaco sin dar ningun error.
  "$FFMPEG" -y -loglevel error -c:v libvpx-vp9 -i "$entrada" \
    -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -alpha_bits 16 \
    "$salida" && echo "   listo: $salida"
done

echo
echo "Terminado. Importalos en After Effects como cualquier .mov."
read -r -p "Enter para cerrar..." _
