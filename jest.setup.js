// Áreas seguras do aparelho: nos testes, um aparelho sem entalhe.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Teclado: nos testes não há teclado; o mock oficial vira View/ScrollView.
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
