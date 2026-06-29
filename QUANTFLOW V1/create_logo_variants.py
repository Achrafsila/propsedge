import subprocess
import os

# Créer les variantes PNG à partir du SVG
svg_file = "quantflow-logo.svg"
sizes = {
    "512": "quantflow-logo-512x512.png",
    "256": "quantflow-logo-256x256.png",
    "128": "quantflow-logo-128x128.png",
    "64": "quantflow-logo-64x64.png",
    "32": "quantflow-logo-32x32.png"
}

print("🎨 Conversion SVG → PNG...\n")

for size, output in sizes.items():
    try:
        # Utiliser ImageMagick si disponible, sinon Inkscape
        cmd = f"convert -background none -resize {size}x{size} {svg_file} {output}"
        subprocess.run(cmd, shell=True, capture_output=True)
        
        if os.path.exists(output):
            file_size = os.path.getsize(output) / 1024
            print(f"✅ {output} ({file_size:.1f} KB)")
        else:
            print(f"⚠️  {output} (conversion échouée - ImageMagick non disponible)")
    except Exception as e:
        print(f"❌ {output}: {e}")

print("\n✨ Variantes créées!")
print("\nPour exporter en PDF ou d'autres formats, utilise Inkscape:")
print("  inkscape quantflow-logo.svg --export-type=pdf -o quantflow-logo.pdf")
