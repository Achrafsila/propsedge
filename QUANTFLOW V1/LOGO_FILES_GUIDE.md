# QUANTFLOW Logo - Files & Usage Guide

**4 variantes professionnelles créées | SVG premium vectoriel | Animations incluses**

---

## 📁 FICHIERS LOGO DISPONIBLES

### **1. 🎨 quantflow-logo.svg** (PRINCIPAL)
**Utilisation:** Marque complète, tous les contextes

**Inclut:**
- ✅ Hexagone Cyan (#00D9FF)
- ✅ Particule quantique orbitale (animation 6s)
- ✅ 6 vagues d'énergie Violet (#7C3AED)
- ✅ Accents Or (#FFD700)
- ✅ Texte "QUANTFLOW" intégré
- ✅ Tagline "QUANTUM MARKET INTELLIGENCE"

**Tailles recommandées:**
- Logo web: 256px - 512px
- Logo print: 300dpi minimum
- Logo email: 128px - 256px

**Animation:**
- Particule orbite continuellement (subtile, premium)
- Effet de glow Cyan

---

### **2. ⚡ quantflow-logo-glyph.svg** (SIMPLIFIÉ)
**Utilisation:** Favicon, profile picture, UI icons, très petits espaces

**Inclut:**
- ✅ Particule quantique simplifiée (sans hexagone)
- ✅ Accents Or croisés
- ✅ 1 vague d'énergie (pulsing animation)
- ✅ Animation pulse 2s

**Tailles recommandées:**
- Favicon: 32px - 64px
- Profile picture (Instagram/Twitter): 256px - 400px
- App icon: 128px - 256px
- Micro UI: 32px minimum

**Avantages:**
- Très lisible à petite taille
- Animation subtile (pulsing)
- Identité reconnaissable instantanément

---

### **3. ⚪ quantflow-logo-monochrome.svg**
**Utilisation:** Contextes sans couleur, b&w printing, haute contrast

**Inclut:**
- ✅ Logo complet en Blanc (#FFFFFF)
- ✅ Background Noir (#0F1419) pour contraste
- ✅ Tous les éléments (hexagone, particule, vagues)

**Tailles recommandées:**
- Tout format (scalable)
- Idéal pour: impression noir/blanc, documents officiels, fax

**Avantages:**
- Maximum de lisibilité
- Aucune perte d'information en couleur
- Conforme aux normes b&w

---

### **4. ⚫ quantflow-logo-dark-bg.svg**
**Utilisation:** Fond clair/blanc, mode light

**Inclut:**
- ✅ Logo complet en Noir (#000000)
- ✅ Background Blanc (#FFFFFF)
- ✅ Tous les éléments

**Tailles recommandées:**
- Tout format
- Idéal pour: site light mode, présentations claires, brochures

**Contraste:** ✅ WCAG AA compliant

---

### **5. 🔤 quantflow-logo-wordmark.svg** (HORIZONTAL)
**Utilisation:** En-têtes de page, couvertures, bannières larges

**Inclut:**
- ✅ Logo glyph (animé) à gauche
- ✅ Texte "QUANTFLOW" Georgia Bold Cyan
- ✅ Tagline "QUANTUM MARKET INTELLIGENCE"
- ✅ Accent line sous le texte
- ✅ ViewBox: 1024×512 (format horizontal)

**Tailles recommandées:**
- Logo page: 400px - 800px de largeur
- En-tête email: 600px largeur
- Bannière web: 100% responsive

**Cas d'usage:**
- Header de site web
- En-tête de document
- Couverture présentation
- Bannière LinkedIn/Twitter

---

## 🎯 MATRICE D'UTILISATION RAPIDE

| Context | Logo | Taille | Variante | Couleur |
|---------|------|--------|----------|---------|
| **Profile Picture** | Glyph | 256-400px | quantflow-logo-glyph.svg | Cyan |
| **Favicon** | Glyph | 32-64px | quantflow-logo-glyph.svg | Cyan |
| **Site Web (Dark)** | Principale | 256-512px | quantflow-logo.svg | Cyan+Or |
| **Site Web (Light)** | Principal | 256-512px | quantflow-logo-dark-bg.svg | Noir |
| **Email Header** | Principal | 128-256px | quantflow-logo.svg | Cyan+Or |
| **En-tête Document** | Wordmark | 600px w | quantflow-logo-wordmark.svg | Cyan+Or |
| **Impression B&W** | Mono | Tout | quantflow-logo-monochrome.svg | Blanc |
| **App Icon** | Glyph | 128-256px | quantflow-logo-glyph.svg | Cyan |
| **Social Media** | Glyph | 256px | quantflow-logo-glyph.svg | Cyan |
| **LinkedIn Cover** | Wordmark | 1200×627px | quantflow-logo-wordmark.svg | Cyan+Or |

---

## 🔄 COMMENT EXPORTER EN PNG / PDF

### **Option 1: Online (Gratuit, Instant)**
1. Allez sur **[convertio.co](https://convertio.co/)** ou **[cloudconvert.com](https://cloudconvert.com/)**
2. Upload le fichier `.svg`
3. Select output format: `PNG` ou `PDF`
4. Download

### **Option 2: Figma (Recommended for Designers)**
1. Créez compte gratuit **[figma.com](https://figma.com)**
2. File → Open → Upload `quantflow-logo.svg`
3. Right-click → Export
4. Choose size (512px, 256px, etc.)
5. Format: PNG / PDF / SVG

### **Option 3: Inkscape (Desktop, Gratuit)**
```bash
# Installation
brew install inkscape  # Mac
# ou via apt-get (Linux) / choco (Windows)

# Export
inkscape quantflow-logo.svg --export-type=png -o quantflow-logo-512.png
inkscape quantflow-logo.svg --export-type=pdf -o quantflow-logo.pdf
```

### **Option 4: Adobe Illustrator (Si disponible)**
1. File → Open → quantflow-logo.svg
2. File → Export As
3. Format: PNG/PDF
4. Options: Transparency ✅, Resolution 300dpi (pour print)

---

## 🎨 CUSTOMIZATION RAPIDE (SVG Editing)

### **Changer la couleur Cyan en Or:**
Ouvrez le fichier `.svg` dans un éditeur texte et remplacez:
```
#00D9FF  →  #FFD700
```

### **Changer le background Noir en autre couleur:**
```xml
<rect width="512" height="512" fill="#0F1419"/>
```
Changez `#0F1419` par votre couleur hex.

### **Désactiver l'animation:**
Supprimez la section `<style>` et la ligne `class="orbiting"`

### **Changer l'épaisseur des lignes:**
```xml
stroke-width: 3.5  →  stroke-width: 2  (plus fin)
stroke-width: 3.5  →  stroke-width: 5  (plus épais)
```

---

## 📏 SPÉCIFICATIONS TECHNIQUES

### **Format:** SVG (Scalable Vector Graphics)
- ✅ Sans perte de qualité à toute taille
- ✅ Fichiers légers (~10-20 KB)
- ✅ Transparence native
- ✅ Animations CSS incluses
- ✅ Éditable dans tout éditeur

### **Color Space:** RGB (Web standard)
```
Cyan Electric:     RGB(0, 217, 255)   / HEX #00D9FF
Violet Quantum:    RGB(124, 58, 237)  / HEX #7C3AED
Gold Premium:      RGB(255, 215, 0)   / HEX #FFD700
Dark Background:   RGB(15, 20, 25)    / HEX #0F1419
Silver Bright:     RGB(232, 232, 232) / HEX #E8E8E8
```

### **Animation Specs:**
- **Particule Orbit:** 6 secondes, rotation continue, smooth easing
- **Wave Pulse:** 2 secondes, opacity fade, ease-in-out
- **Performance:** GPU accelerated, léger (pas de lag)

---

## ✅ CHECKLIST - AVANT DE PUBLIER

- [ ] Tester le logo à 32px (doit rester lisible)
- [ ] Tester le logo à 512px (doit rester proportionné)
- [ ] Vérifier le contraste sur fond clair et fond sombre
- [ ] Tester l'animation (fluide, pas de lag)
- [ ] Exporter en PNG pour web (si nécessaire)
- [ ] Exporter en PDF pour print (300dpi)
- [ ] Créer favicon version 16x16, 32x32, 64x64
- [ ] Archiver les fichiers sources (SVG)
- [ ] Documenter usage guidelines pour le team
- [ ] Mettre à jour tous les assets (site, email, social)

---

## 🎯 PROCHAINES ÉTAPES

### **Immédiat:**
1. ✅ Télécharge tous les `.svg` files
2. ✅ Teste-les dans une application (Figma, Illustrator, navigateur)
3. ✅ Exporte les PNG/PDF nécessaires

### **Court terme:**
1. Mets à jour le favicon du site
2. Ajoute le logo au site web
3. Mets à jour Instagram profile picture (glyph version)
4. Crée email signature avec logo

### **Moyen terme:**
1. Intègre le logo dans tous les matériaux marketing
2. Crée des variantes pour appareils (iOS, Android icons)
3. Ajoute les logos à Google Brand Portal (si public)
4. Update business cards, letterheads, templates

---

## 📞 SUPPORT & MODIFICATIONS

### **Besoin de personnalisations?**

**Option 1: Self-edit (SVG)**
- Ouvrez le fichier dans un éditeur texte
- Modifiez les couleurs Hex
- Sauvegardez et testez

**Option 2: Utiliser Figma**
- Importez le SVG
- Éditez visuellement
- Exportez en tous les formats

**Option 3: Faire appel à un designer**
- Partagez le fichier SVG
- Demandez les modifications
- Récupérez les variantes exportées

---

## 📊 VERSION CONTROL

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-04-14 | Logo initial, 5 variantes |
| - | - | (À mettre à jour après modifications) |

---

**Ready to use!** 🚀

Tous les fichiers sont dans `/Users/achraf/CascadeProjects/QUANTFLOW V1/`

Les variantes sont prêtes à être intégrées dans ton branding QUANTFLOW.
