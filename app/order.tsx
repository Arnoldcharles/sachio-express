import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function OrderPage() {
  const { reference, status: statusParam, title, amount, type } = useLocalSearchParams();
  const [status, setStatus] = useState('Getting your order details...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Flutterwave is now used for card/transfer. Orders are created on checkout,
    // so we simply show a friendly status with the reference the user can keep.
    if (reference) {
      const normalized = typeof statusParam === 'string' ? statusParam : '';
      if (normalized === 'paid' || normalized === 'successful') {
        setStatus('Payment confirmed. We are processing your delivery.');
      } else {
        setStatus('Order received. We will confirm payment shortly.');
      }
    } else {
      setStatus('Order created. Please keep this screen for your records.');
    }
    setLoading(false);
  }, [reference, statusParam]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#0B6E6B" />
      ) : (
        <>
          <Text style={styles.status}>{status}</Text>
          {reference && <Text style={styles.ref}>Reference: {reference}</Text>}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            {title ? <Text style={styles.summaryLine}>Item: {title}</Text> : null}
            {type ? <Text style={styles.summaryLine}>Type: {type === 'rent' ? 'Rent' : 'Buy'}</Text> : null}
            {amount ? <Text style={styles.summaryLine}>Amount: NGN {amount}</Text> : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, color: '#0B6E6B' },
  status: { fontSize: 18, marginBottom: 12 },
  ref: { fontSize: 14, color: '#666' },
  summaryCard: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#F9FBFB',
    alignSelf: 'stretch',
    marginHorizontal: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B6E6B',
    marginBottom: 8,
  },
  summaryLine: {
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 4,
  },
});
