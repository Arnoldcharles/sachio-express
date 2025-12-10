import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ToastProvider } from "../components/Toast";

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const onboardingDone = await AsyncStorage.getItem("onboardingComplete");
        const userToken = await AsyncStorage.getItem("userToken");
        
        setIsOnboardingComplete(!!onboardingDone);
        setIsLoggedIn(!!userToken);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFBFB" }}>
        <ActivityIndicator size="large" color="#0B6E6B" />
      </View>
    );
  }

  return (
    <ToastProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {!isOnboardingComplete ? (
          <>
            <Stack.Screen name="onboarding/screen1" />
            <Stack.Screen name="onboarding/screen2" />
            <Stack.Screen name="onboarding/screen3" />
            <Stack.Screen name="onboarding/screen4" />
          </>
        ) : (
          <>
            <Stack.Screen name="auth/login" />
            <Stack.Screen name="auth/signup" />
            <Stack.Screen name="auth/otp" />
            {/* Main app and public browseable screens */}
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="product" />
            <Stack.Screen name="catalog" />
            <Stack.Screen name="buy" />
            <Stack.Screen name="rent" />
            <Stack.Screen name="checkout" />
            <Stack.Screen name="order" />
            <Stack.Screen name="track" />
          </>
        )}
      </Stack>
    </ToastProvider>
  );
}
