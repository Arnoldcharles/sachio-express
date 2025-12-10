import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useRouter } from 'expo-router';

type PaystackWebViewProps = {
  url: string;
  reference: string;
  onPaymentVerified?: (reference: string) => Promise<void>;
};

export default function PaystackWebView({ url, reference, onPaymentVerified }: PaystackWebViewProps) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Listen for navigation changes to detect payment completion
  const handleNavigationStateChange = async (navState: WebViewNavigation) => {
    // You can customize this logic based on Paystack's redirect/callback URL
    if (navState.url.includes('paystack.com/close')) {
      // Payment completed, verify status via backend
      if (reference && onPaymentVerified) {
        await onPaymentVerified(reference);
      }
      router.push({ pathname: '/order', params: { reference } });
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0B6E6B" />
          <Text style={styles.loadingText}>Loading Paystack...</Text>
        </View>
      )}
      <WebView
        source={{ uri: url }}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={handleNavigationStateChange}
        style={{ flex: 1 }}
        startInLoadingState={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#0B6E6B',
  },
});
