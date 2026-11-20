/**
 * Tokens do Design System ATHONIS, portados de
 * `athonis-front-end/src/styles/tokens.css`.
 *
 * Os valores são os mesmos do sistema web, para que aplicativo e painel
 * pareçam o mesmo produto. Nenhuma tela deve usar cor, espaçamento ou raio
 * fora deste arquivo.
 */

export interface Palette {
  background: string;
  foreground: string;
  surface: string;
  surfaceMuted: string;
  surfaceActive: string;
  border: string;
  borderSubtle: string;
  primary: string;
  primaryActive: string;
  primaryForeground: string;
  secondary: string;
  secondaryActive: string;
  secondaryForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  danger: string;
  dangerForeground: string;
  info: string;
  infoForeground: string;
  muted: string;
}

export const lightPalette: Palette = {
  background: '#f5f6f8',
  foreground: '#12151a',
  surface: '#ffffff',
  surfaceMuted: '#f0f1f4',
  surfaceActive: '#e1e4ea',
  border: '#dde1e7',
  borderSubtle: '#eaecf0',
  primary: '#2f5de3',
  primaryActive: '#1f3a9c',
  primaryForeground: '#ffffff',
  secondary: '#e9ebef',
  secondaryActive: '#cbd0d9',
  secondaryForeground: '#12151a',
  success: '#17845a',
  successForeground: '#ffffff',
  warning: '#d97706',
  warningForeground: '#1c1300',
  danger: '#dc2626',
  dangerForeground: '#ffffff',
  info: '#0369a1',
  infoForeground: '#ffffff',
  muted: '#6b7280',
};

export const darkPalette: Palette = {
  background: '#0d0f13',
  foreground: '#edeef1',
  surface: '#16191f',
  surfaceMuted: '#1c2028',
  surfaceActive: '#2a303d',
  border: '#2a303d',
  borderSubtle: '#1f2430',
  primary: '#5b82f2',
  primaryActive: '#a0b8f8',
  primaryForeground: '#0d0f13',
  secondary: '#232833',
  secondaryActive: '#333a49',
  secondaryForeground: '#edeef1',
  success: '#34b784',
  successForeground: '#04140d',
  warning: '#f0a942',
  warningForeground: '#1c1300',
  danger: '#f0605a',
  dangerForeground: '#1c0504',
  info: '#4bb4ec',
  infoForeground: '#04141c',
  muted: '#8b93a3',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/**
 * Escala tipográfica do web, com o corpo um ponto acima: a tela é lida no
 * braço esticado, dentro de um veículo.
 */
export const typography = {
  heading2: { fontSize: 26, lineHeight: 32, fontWeight: '600' },
  heading3: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  heading4: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  bodyLg: { fontSize: 18, lineHeight: 26, fontWeight: '400' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodySm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Altura mínima de qualquer alvo de toque. O entregador usa com uma mão e, às vezes, de luva. */
export const MIN_TOUCH = 52;
