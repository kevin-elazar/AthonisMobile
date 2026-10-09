import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/text';
import { plural } from '@/lib/format';
import { useSyncState, type SyncState } from '@/services/sync';
import { MIN_TOUCH, radius, spacing, type Palette } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

interface Appearance {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

function appearance(state: SyncState, theme: Palette): Appearance {
  if (state.rejected > 0) {
    return {
      label: plural(state.rejected, 'recusada', 'recusadas'),
      icon: 'alert-circle',
      color: theme.danger,
    };
  }
  if (state.pending > 0) {
    return {
      label: plural(state.pending, 'pendente', 'pendentes'),
      icon: state.online ? 'sync' : 'cloud-offline',
      color: theme.warning,
    };
  }
  if (!state.online) {
    return { label: 'Sem conexão', icon: 'cloud-offline', color: theme.muted };
  }
  return { label: 'Sincronizado', icon: 'cloud-done', color: theme.success };
}

/**
 * Selo permanente no topo: o entregador sempre sabe se o que registrou já
 * chegou ao escritório. Tocar abre a tela de sincronização.
 */
export function SyncBadge() {
  const theme = useTheme();
  const router = useRouter();
  const state = useSyncState();
  const { label, icon, color } = appearance(state, theme);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sincronização: ${label}. Abrir detalhes.`}
      onPress={() => router.push('/sync')}
      style={[styles.badge, { borderColor: color, backgroundColor: theme.surface }]}
      testID="sync-badge"
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text variant="label" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: MIN_TOUCH - 16,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
  },
});
