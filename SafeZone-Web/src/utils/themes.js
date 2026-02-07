// ============================================
// SafeZone Theme System
// ============================================
// 4 Color Palettes × 2 Modes (Light/Dark) = 8 Total Themes
//
// Usage in components:
// import { getTheme } from '../utils/themes';
// const colors = getTheme(palette, mode);
// style={{ background: colors.background }}

export const THEME_PALETTES = {
    midnight: 'Midnight Purple',
    ocean: 'Ocean Blue',
    forest: 'Forest Green',
    amber: 'Warm Amber'
};

// ============================================
// THEME DEFINITIONS
// ============================================

const themes = {
    // ========== MIDNIGHT PURPLE ==========
    midnight: {
        dark: {
            background: '#1A0F26',
            sidebar: '#2D1B3D',
            card: '#3D2555',
            cardHover: '#4A2E66',
            accent: '#8B5CF6',
            accentHover: '#7C3AED',
            text: '#E9D5FF',
            textSecondary: '#C4B5FD',
            textMuted: '#A78BFA',
            border: '#4A2E66',
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B'
        },
        light: {
            background: '#D3CDE0',        // Darker Lavender
            sidebar: '#C5BFE0',           // Muted Purple
            card: '#E8E4F0',              // Soft Lavender
            cardHover: '#DCD6E8',
            accent: '#4C1D95',            // Deep Violet (Darker)
            accentHover: '#3B0764',       // Violet Black
            text: '#0F0E14',              // Near Black
            textSecondary: '#3B0764',     // Dark Purple
            textMuted: '#4B5563',         // Dark Gray
            border: '#B39DDB',            // Slightly Darker Border
            success: '#059669',
            error: '#DC2626',
            warning: '#D97706'
        }
    },

    // ========== OCEAN BLUE ==========
    ocean: {
        dark: {
            background: '#061E28',
            sidebar: '#0F3443',
            card: '#1A4D5E',
            cardHover: '#236179',
            accent: '#06B6D4',
            accentHover: '#0891B2',
            text: '#CFFAFE',
            textSecondary: '#A5F3FC',
            textMuted: '#67E8F9',
            border: '#236179',
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B'
        },
        light: {
            background: '#C9D8E2',        // Darker Blue-Grey
            sidebar: '#BCCCD9',
            card: '#E2EDF2',              // Soft Blue-White
            cardHover: '#D4E3EA',
            accent: '#0C4A6E',            // Deep Ocean Blue (Darker)
            accentHover: '#082F49',       // Navy Black
            text: '#020617',              // Near Black
            textSecondary: '#0C4A6E',     // Navy
            textMuted: '#334155',         // Dark Slate
            border: '#90A4AE',            // Darker Border
            success: '#059669',
            error: '#DC2626',
            warning: '#D97706'
        }
    },

    // ========== FOREST GREEN ==========
    forest: {
        dark: {
            background: '#0D2319',
            sidebar: '#1A3A2E',
            card: '#245240',
            cardHover: '#2D6650',
            accent: '#10B981',
            accentHover: '#059669',
            text: '#D1FAE5',
            textSecondary: '#A7F3D0',
            textMuted: '#6EE7B7',
            border: '#2D6650',
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B'
        },
        light: {
            background: '#CCDBCF',        // Sage Green
            sidebar: '#B8D3C4',
            card: '#E0EBE4',              // Soft Green-White
            cardHover: '#D1E0D6',
            accent: '#064E3B',            // Deep Forest Green (Darker)
            accentHover: '#022C22',       // Pine Black
            text: '#020604',              // Near Black
            textSecondary: '#064E3B',     // Deep Green
            textMuted: '#3F3F46',         // Dark Zinc
            border: '#81C784',            // Darker Border
            success: '#059669',
            error: '#DC2626',
            warning: '#D97706'
        }
    },

    // ========== WARM AMBER ==========
    amber: {
        dark: {
            background: '#1A1510',
            sidebar: '#2D2416',
            card: '#3D3420',
            cardHover: '#4D4428',
            accent: '#F59E0B',
            accentHover: '#D97706',
            text: '#FEF3C7',
            textSecondary: '#FDE68A',
            textMuted: '#FCD34D',
            border: '#4D4428',
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B'
        },
        light: {
            background: '#E6DCCF',        // Darker Beige
            sidebar: '#D9CBB8',
            card: '#F0EBE0',              // Soft Cream
            cardHover: '#E6DDCF',
            accent: '#78350F',            // Deep Amber/Brown (Darker)
            accentHover: '#451A03',       // Espresso
            text: '#1C120B',              // Near Black
            textSecondary: '#78350F',     // Saddle Brown
            textMuted: '#44403C',         // Dark Stone
            border: '#BCAAA4',            // Darker Border
            success: '#059669',
            error: '#DC2626',
            warning: '#D97706'
        }
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Gets the theme colors for a specific palette and mode
 * @param {string} palette - 'midnight', 'ocean', 'forest', or 'amber'
 * @param {string} mode - 'dark' or 'light'
 * @returns {object} Theme color object
 */
export function getTheme(palette = 'midnight', mode = 'dark') {
    if (!themes[palette]) {
        console.warn(`Theme palette "${palette}" not found, defaulting to "midnight"`);
        palette = 'midnight';
    }
    if (!themes[palette][mode]) {
        console.warn(`Theme mode "${mode}" not found, defaulting to "dark"`);
        mode = 'dark';
    }
    return themes[palette][mode];
}

/**
 * Gets all available palette names
 * @returns {array} Array of palette keys
 */
export function getPalettes() {
    return Object.keys(themes);
}

/**
 * Gets a display name for a palette
 * @param {string} palette - Palette key
 * @returns {string} Display name
 */
export function getPaletteName(palette) {
    return THEME_PALETTES[palette] || palette;
}

export default themes;
