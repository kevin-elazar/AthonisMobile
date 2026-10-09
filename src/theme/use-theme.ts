import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette, type Palette } from './tokens';

/** Paleta do tema ativo no aparelho. */
export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? darkPalette : lightPalette;
}
