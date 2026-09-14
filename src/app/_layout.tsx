import { LoginScreen } from '@/components/login-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkToken = async () => {
      const token = await AsyncStorage.getItem('auth_token');
      setIsLoggedIn(!!token);
    };
    checkToken();
  }, []);

  const handleLoginSuccess = async (token: string, user: any) => {
    await AsyncStorage.setItem('auth_token', token);
    // บันทึก role ลง AsyncStorage เพื่อให้หน้า index.tsx ดึงไปเช็คสิทธิ์ได้
    await AsyncStorage.setItem('user_role', user?.role || 'user');
    setIsLoggedIn(true);
  };

  if (isLoggedIn === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="explore" />
    </Stack>
  );
}