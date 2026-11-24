import { Platform } from 'react-native';

/**
 * Endereço da API.
 *
 * Dentro do emulador Android, "localhost" é o próprio emulador; a máquina
 * que roda o backend é alcançada por 10.0.2.2. Por isso o padrão muda por
 * plataforma quando EXPO_PUBLIC_API_URL não é definida.
 */
const fallback = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || fallback).replace(/\/+$/, '');
