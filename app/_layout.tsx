import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ToastProvider } from "../components/Toast";
import { useFonts } from "expo-font";
import { ThemeProvider, useTheme } from "../lib/theme";

function RootLayoutInner() {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const { colors } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Nunito: require("../assets/fonts/Nunito-Variable.ttf"),
  });

  if (fontsLoaded) {
    const TextAny = Text as unknown as { defaultProps?: { style?: any } };
    TextAny.defaultProps = TextAny.defaultProps || {};
    TextAny.defaultProps.style = [
      { fontFamily: "Nunito", color: colors.text },
      TextAny.defaultProps.style,
    ];
    const TextInputAny = TextInput as unknown as { defaultProps?: { style?: any } };
    TextInputAny.defaultProps = TextInputAny.defaultProps || {};
    TextInputAny.defaultProps.style = [
      { fontFamily: "Nunito", color: colors.text },
      TextInputAny.defaultProps.style,
    ];
    const AnimatedTextAny = Animated.Text as unknown as { defaultProps?: { style?: any } };
    AnimatedTextAny.defaultProps = AnimatedTextAny.defaultProps || {};
    AnimatedTextAny.defaultProps.style = [
      { fontFamily: "Nunito", color: colors.text },
      AnimatedTextAny.defaultProps.style,
    ];
  }

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const onboardingDone = await AsyncStorage.getItem("onboardingComplete");
        await AsyncStorage.getItem("userToken");

        setIsOnboardingComplete(!!onboardingDone);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  if (isLoading || (!fontsLoaded && !fontError)) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
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

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}
