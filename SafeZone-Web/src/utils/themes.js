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
            background: '#1A0F26',        // Koyu Mor Arka Plan
            sidebar: '#2D1B3D',           // Sidebar/Sol Panel
            card: '#3D2555',              // Kartlar/Mesaj Kutuları
            cardHover: '#4A2E66',         // Hover durumu
            accent: '#8B5CF6',            // Vurgu/Butonlar
            accentHover: '#7C3AED',       // Buton Hover
            text: '#E9D5FF',              // Ana Metin
            textSecondary: '#C4B5FD',     // İkincil Metin
            textMuted: '#A78BFA',         // Soluk Metin
            border: '#4A2E66',            // Çizgiler
            success: '#10B981',           // Yeşil (Başarı)
            error: '#EF4444',             // Kırmızı (Hata)
            warning: '#F59E0B'            // Turuncu (Uyarı)
        },
        light: {
            background: '#F5F3FF',        // Açık Lavanta Arka Plan
            sidebar: '#EDE9FE',           // Sidebar
            card: '#FFFFFF',              // Kartlar
            cardHover: '#F3F0FF',         // Hover
            accent: '#7C3AED',            // Vurgu
            accentHover: '#6D28D9',       // Hover
            text: '#1F1729',              // Ana Metin (Koyu)
            textSecondary: '#4C1D95',     // İkincil
            textMuted: '#7C3AED',         // Soluk
            border: '#DDD6FE',            // Çizgiler
            success: '#059669',
            error: '#DC2626',
            warning: '#D97706'
        }
    },

    // ========== OCEAN BLUE ==========
    ocean: {
        dark: {
            background: '#061E28',        // Derin Deniz
            sidebar: '#0F3443',           // Okyanus
            card: '#1A4D5E',              // Turkuaz Kart
            cardHover: '#236179',         // Hover
            accent: '#06B6D4',            // Cyan Vurgu
            accentHover: '#0891B2',       // Hover
            text: '#CFFAFE',              // Açık Cyan Metin
            textSecondary: '#A5F3FC',     // İkincil
            textMuted: '#67E8F9',         // Soluk
            border: '#236179',            // Çizgi
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B'
        },
        light: {
            background: '#EFF6FF',        // Açık Gökyüzü
            sidebar: '#DBEAFE',           // Sidebar
            card: '#FFFFFF',              // Beyaz Kart
            cardHover: '#E0F2FE',         // Hover
            accent: '#0284C7',            // Sky Blue Vurgu
            accentHover: '#0369A1',       // Hover
            text: '#0C2433',              // Koyu Metin
            textSecondary: '#075985',     // İkincil
            textMuted: '#0284C7',         // Soluk
            border: '#BAE6FD',            // Çizgi
            success: '#059669',
            error: '#DC2626',
            warning: '#D97706'
        }
    },

    // ========== FOREST GREEN ==========
    forest: {
        dark: {
            background: '#0D2319',        // Koyu Orman
            sidebar: '#1A3A2E',           // Zümrüt
            card: '#245240',              // Yeşil Kart
            cardHover: '#2D6650',         // Hover
            accent: '#10B981',            // Canlı Yeşil
            accentHover: '#059669',       // Hover
            text: '#D1FAE5',              // Açık Yeşil Metin
            textSecondary: '#A7F3D0',     // İkincil
            textMuted: '#6EE7B7',         // Soluk
            border: '#2D6650',            // Çizgi
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B'
        },
        light: {
            background: '#ECFDF5',        // Açık Mint
            sidebar: '#D1FAE5',           // Sidebar
            card: '#FFFFFF',              // Beyaz Kart
            cardHover: '#D1FAE5',         // Hover
            accent: '#059669',            // Zümrüt Vurgu
            accentHover: '#047857',       // Hover
            text: '#064E3B',              // Koyu Yeşil Metin
            textSecondary: '#065F46',     // İkincil
            textMuted: '#059669',         // Soluk
            border: '#A7F3D0',            // Çizgi
            success: '#059669',
            error: '#DC2626',
            warning: '#D97706'
        }
    },

    // ========== WARM AMBER ==========
    amber: {
        dark: {
            background: '#1A1510',        // Koyu Kahve
            sidebar: '#2D2416',           // Espresso
            card: '#3D3420',              // Bronz Kart
            cardHover: '#4D4428',         // Hover
            accent: '#F59E0B',            // Amber Vurgu
            accentHover: '#D97706',       // Hover
            text: '#FEF3C7',              // Açık Sarı Metin
            textSecondary: '#FDE68A',     // İkincil
            textMuted: '#FCD34D',         // Soluk
            border: '#4D4428',            // Çizgi
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B'
        },
        light: {
            background: '#FFFBEB',        // Açık Krem
            sidebar: '#FEF3C7',           // Sidebar
            card: '#FFFFFF',              // Beyaz Kart
            cardHover: '#FEF3C7',         // Hover
            accent: '#D97706',            // Amber Vurgu
            accentHover: '#B45309',       // Hover
            text: '#451A03',              // Koyu Kahve Metin
            textSecondary: '#78350F',     // İkincil
            textMuted: '#92400E',         // Soluk
            border: '#FDE68A',            // Çizgi
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
