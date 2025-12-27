import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text as RNText, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../lib/firebase';
import { WebView } from 'react-native-webview';
import axios from 'axios';
import { useTheme } from '../lib/theme';

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} style={[{ fontFamily: 'Nunito' }, props.style]} />
);

type OrderDoc = {
  type?: string;
  status?: string;
  amount?: number | null;
  productTitle?: string;
  userId?: string;
  rentalStartDate?: string | null;
  rentalEndDate?: string | null;
  location?: string;
  phone?: string;
  note?: string;
  reference?: string | null;
  paymentStatus?: string;
};

export default function OrderPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [txRef, setTxRef] = useState<string | null>(null);
  const webviewRef = useRef<WebView>(null);

  const statusText = useMemo(() => {
    if (!order) return 'Loading order...';
    if (!order.amount || order.status === 'waiting_admin_price') return 'Waiting for admin to set price';
    if (order.paymentStatus === 'paid' || order.status === 'paid') return 'Payment confirmed. We are processing your delivery.';
    return `Price set: NGN ${order.amount}. Please complete payment.`;
  }, [order]);
  const waitingPrice = (order?.status || '').toLowerCase().includes('waiting_admin_price');
  const paid = (order?.paymentStatus || order?.status || '').toLowerCase().includes('paid');

  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    const ref = doc(db, 'orders', id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as OrderDoc;
          setOrder(data);
        } else {
          setOrder(null);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [id]);

  const startPayment = async () => {
    if (!id || typeof id !== 'string' || !order || !order.amount) return;
    try {
      setPaying(true);
      const tx_ref = `rent-${id}-${Date.now()}`;
      setTxRef(tx_ref);
      const secretKey = process.env.EXPO_PUBLIC_FLW_SECRET_KEY || 'FLWSECK_TEST-4e40dea47380c21b7a9bcdff17b79aba-X';
      const payload = {
        tx_ref,
        amount: order.amount,
        currency: 'NGN',
        redirect_url: 'https://checkout.flutterwave.com/close',
        customer: {
          email: order.userId ? `${order.userId}@sachio.app` : 'customer@sachio.app',
          name: order.productTitle || 'Sachio Customer',
        },
      };
      const res = await axios.post('https://api.flutterwave.com/v3/payments', payload, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      });
      const link = res.data?.data?.link;
      if (!link) throw new Error('No payment link returned');
      setPayUrl(link);
      await updateDoc(doc(db, 'orders', id), {
        status: 'price_set',
        paymentStatus: 'awaiting_payment',
        reference: tx_ref,
      });
    } catch (e) {
      console.warn('payment link error', e);
      Alert.alert('Payment', 'Could not start payment. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const handleWebViewNav = async (event: any) => {
    const url = event.url || '';
    if (url.includes('status=successful') || url.includes('status=completed') || url.includes('status=paid')) {
      if (id && typeof id === 'string') {
        await updateDoc(doc(db, 'orders', id), {
          status: 'paid',
          paymentStatus: 'paid',
        });
      }
      setPayUrl(null);
      Alert.alert('Payment successful', 'Thank you. Your order is confirmed.', [
        {
          text: 'View orders',
          onPress: () => router.push('/(tabs)/orders'),
        },
      ]);
      router.push('/(tabs)/orders');
    }
    if (url.includes('status=cancelled') || url.includes('status=failed')) {
      setPayUrl(null);
    }
  };

  if (payUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={{ padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>Flutterwave Payment</Text>
          <TouchableOpacity onPress={() => setPayUrl(null)}>
            <Text style={{ color: colors.danger, fontWeight: '700' }}>Close</Text>
          </TouchableOpacity>
        </View>
        <WebView
          ref={webviewRef}
          source={{ uri: payUrl }}
          onNavigationStateChange={handleWebViewNav}
          startInLoadingState
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>‹ Go back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Order</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#0B6E6B" />
      ) : !order ? (
        <Text style={styles.status}>Order not found.</Text>
      ) : (
        <>
          <Text style={styles.status}>{statusText}</Text>
          {order.reference ? <Text style={styles.ref}>Reference: {order.reference}</Text> : null}
          {waitingPrice ? (
            <Text style={{ marginTop: 16, color: '#475569' }}>
              Admin will set the price. You will be able to pay once it is set.
            </Text>
          ) : (
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Order Summary</Text>
                {order.productTitle ? <Text style={styles.summaryLine}>Item: {order.productTitle}</Text> : null}
                {order.type ? <Text style={styles.summaryLine}>Type: {order.type === 'rent' ? 'Rent' : 'Buy'}</Text> : null}
                {order.amount ? <Text style={styles.summaryLine}>Amount: NGN {order.amount}</Text> : null}
                {order.rentalStartDate ? <Text style={styles.summaryLine}>Start: {order.rentalStartDate}</Text> : null}
                {order.rentalEndDate ? <Text style={styles.summaryLine}>End: {order.rentalEndDate}</Text> : null}
                {order.location ? <Text style={styles.summaryLine}>Location: {order.location}</Text> : null}
                {order.phone ? <Text style={styles.summaryLine}>Phone: {order.phone}</Text> : null}
                {order.note ? <Text style={styles.summaryLine}>Note: {order.note}</Text> : null}
              </View>
              {paid ? (
                <Text style={{ marginTop: 16, color: '#0B6E6B', fontWeight: '700' }}>Payment completed.</Text>
              ) : (
                <TouchableOpacity style={styles.payBtn} onPress={startPayment} disabled={paying}>
                  <Text style={styles.payBtnText}>{paying ? 'Starting payment...' : 'Pay with Flutterwave'}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, color: '#0B6E6B' },
  status: { fontSize: 18, marginBottom: 12, textAlign: 'center', color: '#0F172A' },
  ref: { fontSize: 14, color: '#666' },
  backBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#E6F4F3',
  },
  backBtnText: {
    color: '#0B6E6B',
    fontWeight: '700',
  },
  summaryCard: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#F9FBFB',
    alignSelf: 'stretch',
    marginHorizontal: 12,
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
  payBtn: {
    marginTop: 18,
    backgroundColor: '#0B6E6B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
