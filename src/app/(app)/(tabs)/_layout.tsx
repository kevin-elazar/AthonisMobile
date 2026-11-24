import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SyncBadge } from '@/components/domain/sync-badge';
import { useTheme } from '@/theme/use-theme';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(active: IconName, inactive: IconName) {
  function TabIcon({
    color,
    focused,
    size,
  }: {
    color: ColorValue;
    focused: boolean;
    size: number;
  }) {
    // Um pouco menor que o padrão (25): sobra altura para o rótulo.
    return <Ionicons name={focused ? active : inactive} size={Math.min(size, 23)} color={color as string} />;
  }
  return TabIcon;
}

/**
 * As três telas principais do entregador, sempre a um toque: o dia de hoje,
 * todas as rotas e a conta. As telas da rota, da parada e da ocorrência abrem
 * por cima, na pilha de `(app)/_layout`.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        // minHeight: sem ele o ícone espreme o rótulo e o texto sai cortado.
        tabBarLabelStyle: { fontSize: 12, lineHeight: 16, minHeight: 16, fontWeight: '600' },
        tabBarItemStyle: { paddingVertical: 3 },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          height: 62 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.foreground,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        headerRight: () => <SyncBadge />,
        headerRightContainerStyle: { paddingRight: 12 },
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoje',
          headerShown: false,
          tabBarIcon: tabIcon('today', 'today-outline'),
          tabBarButtonTestID: 'tab-today',
        }}
      />
      <Tabs.Screen
        name="my-routes"
        options={{
          title: 'Minhas rotas',
          tabBarLabel: 'Rotas',
          tabBarIcon: tabIcon('calendar', 'calendar-outline'),
          tabBarButtonTestID: 'tab-routes',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Minha conta',
          tabBarLabel: 'Conta',
          tabBarIcon: tabIcon('person-circle', 'person-circle-outline'),
          tabBarButtonTestID: 'tab-account',
        }}
      />
    </Tabs>
  );
}
