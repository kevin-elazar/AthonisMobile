import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { typography, type Palette, type TypographyVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Tone = 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'danger' | 'inverse';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  weight?: 'regular' | 'medium' | 'semibold';
  align?: 'left' | 'center' | 'right';
}

const WEIGHTS = { regular: '400', medium: '500', semibold: '600' } as const;

function toneColor(theme: Palette, tone: Tone): string {
  switch (tone) {
    case 'muted':
      return theme.muted;
    case 'primary':
      return theme.primary;
    case 'success':
      return theme.success;
    case 'warning':
      return theme.warning;
    case 'danger':
      return theme.danger;
    case 'inverse':
      return theme.primaryForeground;
    default:
      return theme.foreground;
  }
}

/** Todo texto do aplicativo passa por aqui, para usar só a escala tipográfica dos tokens. */
export function Text({
  variant = 'body',
  tone = 'default',
  weight,
  align,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();

  return (
    <RNText
      {...rest}
      style={[
        typography[variant],
        { color: toneColor(theme, tone) },
        weight ? { fontWeight: WEIGHTS[weight] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
