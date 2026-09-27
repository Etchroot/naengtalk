import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    'SUIT-Regular': require('@sun-typeface/suit/fonts/static/ttf/SUIT-Regular.ttf'),
    'SUIT-Medium': require('@sun-typeface/suit/fonts/static/ttf/SUIT-Medium.ttf'),
    'SUIT-SemiBold': require('@sun-typeface/suit/fonts/static/ttf/SUIT-SemiBold.ttf'),
    'SUIT-Bold': require('@sun-typeface/suit/fonts/static/ttf/SUIT-Bold.ttf'),
  });

  if (fontError) throw fontError;
  if (!fontsLoaded) return null;

  return <SafeAreaProvider><Stack screenOptions={{ headerShown: false }} /></SafeAreaProvider>;
}
