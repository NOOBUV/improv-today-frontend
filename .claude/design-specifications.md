# ImprovToday Design Specifications

## Overview
ImprovToday is an AI-powered English conversation practice app that prioritizes calm, focused interactions through conversation. This document provides comprehensive design specifications to transform the current basic interface into a polished, conversation-focused experience.

## Current State Analysis
- **Background**: Basic gradient (slate-900 → blue-900 → indigo-900)
- **Typography**: Default system fonts with inconsistent hierarchy
- **Components**: Generic shadcn/ui components without customization
- **Color System**: Limited to gradient background, no cohesive palette
- **Accessibility**: Basic, needs improvement for conversation-focused experience

---

## 1. Color System

### Primary Colors
- **Conversation Blue**: `#2563EB` (Primary action, listening state)
- **Conversation Blue Light**: `#3B82F6` (Hover states)
- **Conversation Blue Dark**: `#1D4ED8` (Active states)

### Secondary Colors
- **AI Purple**: `#A855F7` (AI speaking state, secondary actions)
- **AI Purple Light**: `#C084FC` (Hover states)
- **AI Purple Dark**: `#9333EA` (Active states)

### Neutral Colors
- **Charcoal**: `#1F2937` (Primary text, dark surfaces)
- **Slate**: `#374151` (Secondary text, borders)
- **Mist**: `#6B7280` (Tertiary text, disabled states)
- **Fog**: `#F3F4F6` (Light backgrounds, subtle borders)
- **Snow**: `#FEFEFE` (Pure white, highest contrast)

### Background System
- **Deep Navy**: `#0F172A` (Primary background base)
- **Midnight Blue**: `#1E293B` (Secondary surface)
- **Ocean Blue**: `#0EA5E9` (Accent gradient stop)
- **Twilight Purple**: `#8B5CF6` (Accent gradient stop)

### Semantic Colors
- **Success Green**: `#10B981` (Success states, completion)
- **Warning Amber**: `#F59E0B` (Warning states, attention)
- **Error Red**: `#EF4444` (Error states, interruption)
- **Info Cyan**: `#06B6D4` (Information, tips)

### Accessibility Compliance
All color combinations meet WCAG 2.1 AA standards:
- **Text on Background**: 4.5:1 minimum contrast ratio
- **Interactive Elements**: 3:1 minimum contrast ratio
- **Focus Indicators**: 3:1 contrast with adjacent colors

---

## 2. Typography Scale

### Font System
- **Primary Font**: `Inter` (Clean, modern, excellent readability)
- **Accent Font**: `Poppins` (Friendly, approachable for headings)
- **Monospace Font**: `JetBrains Mono` (Code, technical elements)

### Scale
```css
--text-xs: 0.75rem;    /* 12px - Captions, labels */
--text-sm: 0.875rem;   /* 14px - Small text, descriptions */
--text-base: 1rem;     /* 16px - Body text */
--text-lg: 1.125rem;   /* 18px - Large body text */
--text-xl: 1.25rem;    /* 20px - Small headings */
--text-2xl: 1.5rem;    /* 24px - Section headings */
--text-3xl: 1.875rem;  /* 30px - Page headings */
--text-4xl: 2.25rem;   /* 36px - Large headings */
--text-5xl: 3rem;      /* 48px - Display text */
--text-6xl: 3.75rem;   /* 60px - Hero text */
```

### Weight System
- **Light**: 300 (Subtle text, large sizes)
- **Regular**: 400 (Body text)
- **Medium**: 500 (Emphasis, small headings)
- **Semibold**: 600 (Headings, important text)
- **Bold**: 700 (Strong emphasis, CTAs)

### Line Heights
- **Tight**: 1.25 (Large headings)
- **Snug**: 1.375 (Headings)
- **Normal**: 1.5 (Body text)
- **Relaxed**: 1.625 (Reading text)
- **Loose**: 2 (Sparse text)

---

## 3. Spacing System

### Scale (8px base unit)
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

### Usage Guidelines
- **Component Padding**: 16px-24px (space-4 to space-6)
- **Element Margins**: 8px-16px (space-2 to space-4)
- **Section Spacing**: 32px-48px (space-8 to space-12)
- **Page Margins**: 16px-24px mobile, 24px-48px desktop

---

## 4. Component Design Specifications

### Circular Waveform (Primary Interface Element)

#### Current Implementation Issues
- Hardcoded colors in canvas drawing
- Basic animation without personality
- Limited visual feedback states

#### Enhanced Design
```css
/* Container */
.waveform-container {
  position: relative;
  width: 280px;
  height: 280px;
  margin: 0 auto;
}

/* States */
.waveform-idle {
  --primary-color: #6B7280;
  --glow-color: rgba(107, 114, 128, 0.2);
}

.waveform-listening {
  --primary-color: #2563EB;
  --glow-color: rgba(37, 99, 235, 0.4);
  --pulse-color: rgba(37, 99, 235, 0.1);
}

.waveform-speaking {
  --primary-color: #A855F7;
  --glow-color: rgba(168, 85, 247, 0.4);
  --pulse-color: rgba(168, 85, 247, 0.1);
}

/* Responsive Sizing */
@media (max-width: 640px) {
  .waveform-container {
    width: 240px;
    height: 240px;
  }
}
```

#### Visual States
1. **Idle**: Gentle static pulse, muted gray (#6B7280)
2. **Listening**: Dynamic blue waves (#2563EB), increased amplitude
3. **AI Speaking**: Purple waves (#A855F7), smooth rhythmic pattern
4. **Processing**: Subtle spinner overlay, reduced opacity

### Button System

#### Primary Button (Conversation Actions)
```css
.btn-primary {
  background: linear-gradient(135deg, #2563EB 0%, #3B82F6 100%);
  color: #FFFFFF;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
  transform: translateY(-1px);
}
```

#### Secondary Button (Settings, Options)
```css
.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #FFFFFF;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}
```

#### Personality Selector Buttons
```css
.personality-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 16px;
  backdrop-filter: blur(12px);
  transition: all 0.3s ease;
}

.personality-btn.active {
  background: var(--personality-gradient);
  border-color: transparent;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* Personality-specific gradients */
.personality-sassy {
  --personality-gradient: linear-gradient(135deg, #A855F7 0%, #EC4899 100%);
}

.personality-blunt {
  --personality-gradient: linear-gradient(135deg, #EF4444 0%, #F97316 100%);
}

.personality-friendly {
  --personality-gradient: linear-gradient(135deg, #3B82F6 0%, #10B981 100%);
}
```

### Settings Modal

#### Design Specifications
```css
.settings-modal {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 32px;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.settings-section {
  margin-bottom: 32px;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.voice-selector {
  background: #F8FAFC;
  border: 2px solid #E2E8F0;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 16px;
  transition: border-color 0.2s ease;
}

.voice-selector:focus {
  outline: none;
  border-color: #2563EB;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
```

---

## 5. Layout Improvements

### Enhanced Visual Hierarchy

#### Mobile-First Layout (320px - 768px)
```css
.container {
  min-height: 100vh;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.main-content {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}

.personality-selector {
  width: 100%;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border-radius: 20px;
  padding: 24px;
}
```

#### Desktop Layout (768px+)
```css
@media (min-width: 768px) {
  .container {
    padding: 32px;
    gap: 48px;
  }
  
  .main-content {
    max-width: 500px;
    gap: 48px;
  }
  
  .personality-selector {
    padding: 32px;
  }
}

@media (min-width: 1024px) {
  .container {
    padding: 48px;
  }
  
  .header h1 {
    font-size: 4rem; /* text-6xl */
  }
}
```

### Background System
```css
.app-background {
  background: linear-gradient(
    135deg,
    #0F172A 0%,
    #1E293B 25%,
    #0EA5E9 75%,
    #8B5CF6 100%
  );
  background-attachment: fixed;
  background-size: 400% 400%;
  animation: gradientShift 20s ease infinite;
}

@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
```

---

## 6. Accessibility Guidelines

### Focus Management
```css
.focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.5);
  border-radius: 8px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .btn-primary {
    border: 2px solid #000;
  }
  
  .waveform-container {
    border: 2px solid #000;
  }
}
```

### Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  .waveform-container * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  .app-background {
    animation: none;
  }
}
```

### Screen Reader Support
- All interactive elements have appropriate ARIA labels
- Status announcements for listening/speaking states
- Semantic HTML structure with proper headings
- Alt text for visual elements

---

## 7. Mobile Responsive Specifications

### Breakpoints
```css
/* Mobile: 320px - 640px */
.mobile-only { display: block; }
.tablet-up { display: none; }

/* Tablet: 640px - 1024px */
@media (min-width: 640px) {
  .mobile-only { display: none; }
  .tablet-up { display: block; }
}

/* Desktop: 1024px+ */
@media (min-width: 1024px) {
  .desktop-up { display: block; }
}
```

### Touch Optimization
```css
.touch-target {
  min-height: 48px;
  min-width: 48px;
  padding: 12px;
}

/* Increase touch targets on mobile */
@media (max-width: 640px) {
  .waveform-container {
    min-height: 280px;
    min-width: 280px;
  }
  
  .personality-btn {
    min-height: 64px;
    padding: 20px;
  }
}
```

### Safe Area Support
```css
.container {
  padding-top: max(16px, env(safe-area-inset-top));
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  padding-left: max(16px, env(safe-area-inset-left));
  padding-right: max(16px, env(safe-area-inset-right));
}
```

---

## 8. Implementation Notes with Tailwind CSS

### Custom Color Configuration
Add to `globals.css`:
```css
:root {
  /* Conversation Colors */
  --conversation-blue: #2563EB;
  --conversation-blue-light: #3B82F6;
  --conversation-blue-dark: #1D4ED8;
  
  /* AI Colors */
  --ai-purple: #A855F7;
  --ai-purple-light: #C084FC;
  --ai-purple-dark: #9333EA;
  
  /* Background System */
  --deep-navy: #0F172A;
  --midnight-blue: #1E293B;
  --ocean-blue: #0EA5E9;
  --twilight-purple: #8B5CF6;
}
```

### Essential Tailwind Classes

#### Waveform Container
```html
<div class="relative w-[280px] h-[280px] mx-auto md:w-[320px] md:h-[320px]">
  <!-- Waveform canvas here -->
</div>
```

#### Main Layout
```html
<div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 flex flex-col items-center justify-center p-4 gap-6 md:gap-12">
  <!-- Content here -->
</div>
```

#### Enhanced Background
```html
<div class="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1E293B] via-[#0EA5E9] to-[#8B5CF6] animate-gradient-shift">
  <!-- App content -->
</div>
```

#### Personality Selector
```html
<div class="w-full max-w-md bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
  <!-- Personality buttons -->
</div>
```

#### Status Text Area (Fixed Height)
```html
<div class="text-center text-white h-24 flex flex-col justify-center max-w-md mx-auto">
  <!-- Status content with consistent height -->
</div>
```

### Animation Classes
```css
@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.animate-gradient-shift {
  background-size: 400% 400%;
  animation: gradient-shift 20s ease infinite;
}
```

---

## 9. Performance Considerations

### Optimization Strategies
1. **CSS-in-JS Minimal Usage**: Prefer Tailwind classes over inline styles
2. **Animation Performance**: Use `transform` and `opacity` for smooth animations
3. **Background Attachment**: Consider removing `fixed` on mobile for better performance
4. **Canvas Optimization**: Debounce canvas redraws in waveform component

### Bundle Size Impact
- **Font Loading**: Preload critical fonts with `font-display: swap`
- **Background Images**: Use CSS gradients instead of images
- **Icon Usage**: Prefer system icons or lightweight icon libraries

---

## 10. Next Steps for Implementation

### Phase 1: Core Visual Updates (Days 1-2)
1. Update global CSS with new color system
2. Implement enhanced background gradient
3. Update typography scale and font loading
4. Enhance button components with new styling

### Phase 2: Component Refinements (Days 3-4)
1. Redesign circular waveform with new colors and animations
2. Update personality selector with enhanced styling
3. Redesign settings modal with improved UX
4. Implement responsive adjustments

### Phase 3: Polish & Accessibility (Days 5-6)
1. Add focus management and keyboard navigation
2. Implement reduced motion preferences
3. Test and adjust contrast ratios
4. Performance optimization and testing

### Development Guidelines
- Start with mobile-first implementation
- Test on actual devices, not just browser dev tools
- Validate color contrast with tools like WebAIM
- Use semantic HTML throughout
- Implement proper focus management for keyboard users

---

## Conclusion

This design system transforms ImprovToday from a basic prototype into a polished, conversation-focused application. The enhanced color palette, improved typography, and thoughtful component design create an environment that feels calm, professional, and encouraging for English conversation practice.

The specifications prioritize accessibility, performance, and mobile experience while maintaining the core simplicity that makes the app effective for its intended purpose. All designs are implementable within a 6-day sprint using the existing Tailwind CSS and shadcn/ui foundation.