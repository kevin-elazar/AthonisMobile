// Áreas seguras do aparelho: nos testes, um aparelho sem entalhe.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
