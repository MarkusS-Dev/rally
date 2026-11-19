/** Rally's base colours for light and dark mode (before the chosen palette is applied). */

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    border: '#D9D9E0',
    accent: '#E4572E',
    onAccent: '#FFFFFF',
    tertiary: '#8B8D98',
    switchOff: '#FAFAFA',
    success: '#1F8F4E',
    danger: '#CE2C31',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    border: '#3A3D42',
    accent: '#FF6B3D',
    onAccent: '#FFFFFF',
    tertiary: '#8B8D98',
    switchOff: '#D4D4D8',
    success: '#3DD68C',
    danger: '#FF6369',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
