import { useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export interface ScreenProps {
  children: ReactNode;
  /** Barra fixa no rodapé, para a ação principal ficar sempre ao alcance do polegar. */
  footer?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Moldura de toda tela: fundo do tema, margens e respeito às áreas seguras do aparelho. */
export function Screen({
  children,
  footer,
  scroll = true,
  refreshing = false,
  onRefresh,
  contentStyle,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, spacing.lg);
  const [footerHeight, setFooterHeight] = useState(0);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {scroll ? (
        // Com o teclado aberto, a tela rola até o campo em foco e o deixa acima
        // do rodapé, que sobe junto com o teclado. O ajuste nativo do Android
        // não funciona com o app desenhado até as bordas (edge-to-edge).
        <KeyboardAwareScrollView
          bottomOffset={footerHeight + spacing.lg}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: footer ? spacing.lg : bottom },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            ) : undefined
          }
        >
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
      )}

      {footer ? (
        <KeyboardStickyView offset={{ opened: bottom - spacing.sm }}>
          <View
            onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
            style={[
              styles.footer,
              {
                paddingBottom: bottom,
                backgroundColor: theme.surface,
                borderTopColor: theme.border,
              },
            ]}
          >
            {footer}
          </View>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
});
