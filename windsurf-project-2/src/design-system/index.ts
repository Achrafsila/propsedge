/**
 * PropEdge Design System
 * Premium futuristic fintech dashboard design system
 * Modern, fast, premium, data-driven, elegant, minimal, professional, high-tech
 */

// ============================================
// COLOR PALETTE
// ============================================

export const colors = {
  // Primary Background
  background: {
    primary: '#030712',      // Main background
    secondary: '#050816',    // Secondary background
    tertiary: '#07111F',     // Tertiary background
  },

  // Secondary Surfaces
  surface: {
    primary: '#0B1220',      // Card surface
    secondary: '#101828',    // Card hover
    tertiary: '#111827',     // Card active
  },

  // Accent Gradient (Purple → Indigo → Electric Blue)
  accent: {
    purple: '#298DFF',
    indigo: '#1E6FE0',
    blue: '#3B82F6',
    gradient: 'linear-gradient(135deg, #298DFF 0%, #1E6FE0 50%, #3B82F6 100%)',
  },

  // Status Colors
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',

  // Text Colors
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    tertiary: '#64748B',
  },

  // Border Colors
  border: {
    default: 'rgba(148, 163, 184, 0.1)',
    hover: 'rgba(148, 163, 184, 0.2)',
    active: 'rgba(41,141,255, 0.3)',
  },

  // Glow Effects
  glow: {
    purple: 'rgba(41,141,255, 0.3)',
    blue: 'rgba(59, 130, 246, 0.3)',
    success: 'rgba(16, 185, 129, 0.3)',
  },
};

// ============================================
// TYPOGRAPHY
// ============================================

export const typography = {
  fontFamily: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'JetBrains Mono, "Fira Code", Consolas, Monaco, monospace',
  },

  // Premium Typography Hierarchy
  fontSize: {
    // Dashboard Title - Large, Bold, Premium
    display: '3rem',      // 48px
    
    // KPI Values - Numbers dominate the interface
    kpi: '2.625rem',      // 42px
    
    // Section Titles
    section: '1.25rem',   // 20px
    
    // Standard sizes
    xs: '0.75rem',      // 12px - Descriptions
    sm: '0.8125rem',    // 13px - Card Labels
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
    '5xl': '3rem',      // 48px
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extraBold: 800,  // For titles and KPI values
  },

  letterSpacing: {
    // Dashboard Title
    display: '-0.05em',  // -2px
    
    // KPI Values
    kpi: '-0.05em',      // -2px
    
    // Section Titles
    section: '-0.03125em',  // -0.5px
    
    // Card Labels - Uppercase with spacing
    label: '0.0625em',   // 1px
    
    // Default
    normal: '0',
  },

  lineHeight: {
    // Dashboard Title
    display: 1,
    
    // KPI Values
    kpi: 1,
    
    // Section Titles
    section: 1.25,
    
    // Standard
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Opacity levels for text hierarchy
  opacity: {
    primary: 1,
    secondary: 0.7,    // Card labels
    tertiary: 0.55,    // Descriptions
    muted: 0.4,
  },

  // Text transformation
  textTransform: {
    uppercase: 'uppercase',
    none: 'none',
  },
};

// ============================================
// SPACING
// ============================================

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
};

// ============================================
// BORDER RADIUS
// ============================================

export const borderRadius = {
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  full: '9999px',
};

// ============================================
// SHADOWS
// ============================================

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  glow: '0 0 20px rgba(41,141,255, 0.15)',
  glowBlue: '0 0 20px rgba(59, 130, 246, 0.15)',
};

// ============================================
// TRANSITIONS
// ============================================

export const transitions = {
  fast: '150ms ease-in-out',
  normal: '300ms ease-in-out',
  slow: '500ms ease-in-out',
};

// ============================================
// ANIMATIONS
// ============================================

export const animations = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.3 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 },
  },
  scale: {
    initial: { scale: 0.95 },
    animate: { scale: 1 },
    transition: { duration: 0.2 },
  },
};

// ============================================
// GLASSMORPHISM
// ============================================

export const glassmorphism = {
  base: {
    backdropBlur: 'backdrop-blur-xl',
    background: 'rgba(11, 18, 32, 0.8)',
    border: '1px solid rgba(148, 163, 184, 0.1)',
  },
  card: {
    backdropBlur: 'backdrop-blur-lg',
    background: 'rgba(16, 24, 40, 0.6)',
    border: '1px solid rgba(148, 163, 184, 0.08)',
  },
};

// ============================================
// GRADIENT BORDERS
// ============================================

export const gradientBorder = {
  purpleBlue: 'linear-gradient(135deg, rgba(41,141,255, 0.3), rgba(59, 130, 246, 0.3))',
  success: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.1))',
  warning: 'linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(245, 158, 11, 0.1))',
  danger: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0.1))',
};

// ============================================
// PREMIUM GRADIENT TEXT
// ============================================

export const gradientText = {
  premium: 'linear-gradient(90deg, #FFFFFF, #7CC0FF, #60A5FA)',
};

// ============================================
// SUI-STYLE HERO GLOW
// ============================================

export const gradientHero = {
  // Signature electric-blue radial glow (Sui-inspired)
  radial: 'radial-gradient(120% 120% at 50% 0%, rgba(41,141,255,0.35) 0%, rgba(41,141,255,0.10) 32%, rgba(41,141,255,0) 65%)',
  // Softer page-wide top glow
  page: 'radial-gradient(80% 60% at 50% -10%, rgba(41,141,255,0.18) 0%, rgba(41,141,255,0) 60%)',
};

// ============================================
// NUMBER STYLING
// ============================================

export const numberStyle = {
  tabular: 'font-variant-numeric: tabular-nums;',
};
