
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, ScrollView, Modal, TextInput, StatusBar } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getProducts, Product } from '../lib/products';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import axios from 'axios';
import { auth, db, getUserProfile } from '../lib/firebase';
import { addDoc, collection, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { useTheme } from '../lib/theme';
import { Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Checkout() {
  const FLW_PUBLIC_KEY = process.env.EXPO_PUBLIC_FLW_PUBLIC_KEY ?? 'FLWPUBK_TEST-b4b6028b1cd2963606e7fd405623b8f6-X';
  const FLW_SECRET_KEY = process.env.EXPO_PUBLIC_FLW_SECRET_KEY ?? 'FLWSECK_TEST-4e40dea47380c21b7a9bcdff17b79aba-X';
  const { id, type } = useLocalSearchParams();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [confirmed, setConfirmed] = useState(false);
  const [flutterwaveUrl, setFlutterwaveUrl] = useState<string | null>(null);
  const [txRef, setTxRef] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<'Card' | 'Transfer'>('Card');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('flutterwave');
  const [showDateModal, setShowDateModal] = useState(false);
  const [rentalStart, setRentalStart] = useState('');
  const [rentalEnd, setRentalEnd] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [addressEditingIndex, setAddressEditingIndex] = useState<number | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const fadeIn = useRef(new Animated.Value(0)).current;
  const outOfStockProduct = product?.inStock === false;
  const TRANSFER_ACCOUNT = {
    bank: 'Flutterwave Test Bank',
    accountName: 'Sachio Mobile Toilets',
    accountNumber: '1234567890',
  };

  const safeDate = (value: string) => {
    const d = value ? new Date(value) : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  async function createOrder(status: string, reference?: string | null) {
    try {
      if (!product) return;
      if (!selectedAddress) {
        alert('Please add a delivery address.');
        return;
      }
      const orderData = {
        productId: product.id,
        productTitle: product.title,
        price: product.price,
        type: type === 'buy' ? 'buy' : 'rent',
        paymentMethod: payment,
        paymentMethodId: paymentMethodId || payment,
        userId: auth.currentUser?.uid || 'guest',
        customerName: profileName || auth.currentUser?.email || 'Guest',
        customerPhone: profilePhone || null,
        customerAddress: selectedAddress,
        rentalStartDate: rentalStart || null,
        rentalEndDate: rentalEnd || null,
        status,
        reference: reference || null,
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'orders'), orderData);
      return docRef.id;
    } catch (e) {
      // swallow to avoid breaking UX
      return null;
    }
  }

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      const products = await getProducts();
      const found = products.find(p => p.id === id);
      setProduct(found || null);
      setLoading(false);
    }
    async function loadProfile() {
      if (auth.currentUser) {
        try {
          const profile = await getUserProfile(auth.currentUser.uid);
          if (profile) {
            setAddresses(profile.addresses || []);
            setSelectedAddress((profile.addresses && profile.addresses[0]) || '');
            setProfileName(profile.name || '');
            setProfilePhone(profile.phone || '');
          }
        } catch (e) {
          // ignore profile errors
        }
      }
    }
    fetchProduct();
    loadProfile();
    // load preferred payment (Flutterwave) from profile selection
    AsyncStorage.getItem('preferredPaymentMethod').then((id) => {
      if (id) {
        setPaymentMethodId(id);
        if (id === 'flutterwave') setPayment('Card');
      }
    });
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [id, fadeIn]);

  const handleCashTransferConfirm = async () => {
    if (!auth.currentUser) {
      alert('Please sign in to place an order.');
      router.push('/auth/login');
      return;
    }
    if (!selectedAddress) {
      setAddressModalVisible(true);
      return;
    }
    if (type !== 'buy' && (!rentalStart || !rentalEnd)) {
      alert('Please select rental start and end dates.');
      return;
    }
    setLoading(true);
    const orderId = await createOrder('pending_transfer', null);
    setLoading(false);
    setPaymentSuccess(true);
    setOrderRef(orderId || null);
  };

  if (confirmed) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={styles.breadcrumbsRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><FontAwesome5 name="arrow-left" size={18} color="#0B6E6B" /></TouchableOpacity>
            <Text style={styles.breadcrumbs}>Home {'>'} Checkout</Text>
          </View>
          <Text style={styles.title}>Order Confirmed!</Text>
          <Text style={styles.info}>Thank you for your purchase.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/')}>
            <Text style={styles.buttonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.breadcrumbsRow, { opacity: fadeIn }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><FontAwesome5 name="arrow-left" size={18} color="#0B6E6B" /></TouchableOpacity>
          <Text style={styles.breadcrumbs}>Home {'>'} Checkout</Text>
        </Animated.View>
        <Animated.Text style={[styles.title, { opacity: fadeIn, transform: [{ translateY: fadeIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>Checkout</Animated.Text>
        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: fadeIn.interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] }}>
          {loading || !product ? (
            <View style={styles.productSkeleton}>
              <View style={styles.productSkeletonImage} />
              <View style={styles.productSkeletonLine} />
              <View style={[styles.productSkeletonLine, { width: 120 }]} />
            </View>
          ) : (
            <View style={styles.productCard}>
              {product.imageUrl ? (
                <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
              ) : (
                <View style={styles.productImageFallback}><FontAwesome5 name="toilet" size={48} color="#0B6E6B" /></View>
              )}
              <Text style={styles.productTitle}>{product.title}</Text>
              <Text style={styles.productPrice}>NGN {product.price}</Text>
            </View>
          )}
        </Animated.View>
        <Animated.View style={[styles.summaryCard, { opacity: fadeIn, transform: [{ translateY: fadeIn.interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] }]}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{type === 'buy' ? 'Buy' : 'Rent'}</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Product</Text>
            <Text style={styles.summaryValue}>{product ? product.title : id}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Price</Text>
            <Text style={styles.summaryValue}>NGN {product ? product.price : '-'}</Text>
          </View>
          {outOfStockProduct ? (
            <View style={styles.warningBox}>
              <FontAwesome5 name="exclamation-circle" size={14} color="#B91C1C" />
              <Text style={styles.warningText}>This product is out of stock. Purchasing is disabled.</Text>
            </View>
          ) : null}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Deliver to</Text>
            <Text style={styles.summaryValue}>{selectedAddress ? selectedAddress : 'Add address'}</Text>
          </View>
          {type === 'rent' ? (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Rental start</Text>
                <Text style={styles.summaryValue}>{rentalStart || 'Select date'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Rental end</Text>
                <Text style={styles.summaryValue}>{rentalEnd || 'Select date'}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery</Text>
            <Text style={styles.summaryValue}>Included</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryTotalRow}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>NGN {product ? product.price : '-'}</Text>
          </View>
        </Animated.View>

        {type === 'rent' ? (
          <View style={styles.rentCard}>
            <View style={styles.rentHeader}>
              <Text style={styles.sectionLabel}>Rental dates</Text>
              <TouchableOpacity onPress={() => setShowDateModal(true)} style={styles.linkBtn}>
                <Text style={styles.linkText}>Pick dates</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helperTextSmall}>
              Choose when you need the unit and when it will be returned.
            </Text>
            <View style={styles.rentDatesRow}>
              <TouchableOpacity style={styles.datePill} onPress={() => setShowDateModal(true)}>
                <Text style={styles.datePillLabel}>Start</Text>
                <Text style={styles.datePillValue}>{rentalStart || 'Select'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.datePill} onPress={() => setShowDateModal(true)}>
                <Text style={styles.datePillLabel}>End</Text>
                <Text style={styles.datePillValue}>{rentalEnd || 'Select'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.addressCard}>
          <View style={styles.rentHeader}>
            <Text style={styles.sectionLabel}>Delivery address</Text>
            <TouchableOpacity onPress={() => setAddressModalVisible(true)} style={styles.linkBtn}>
              <Text style={styles.linkText}>{selectedAddress ? 'Change' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
          {selectedAddress ? (
            <Text style={styles.metaLine}>{selectedAddress}</Text>
          ) : (
            <Text style={styles.helperTextSmall}>Add an address to continue.</Text>
          )}
        </View>

        <View style={styles.paymentCard}>
          <Text style={styles.sectionLabel}>Payment Method</Text>
          {paymentMethodId ? (
            <Text style={styles.helperTextSmall}>Preferred: {paymentMethodId === 'flutterwave' ? 'Flutterwave Web Pay' : paymentMethodId}</Text>
          ) : null}
          <View style={styles.paymentRow}>
            {['Card', 'Transfer'].map(method => (
              <TouchableOpacity
                key={method}
                style={[styles.paymentOption, payment === method && styles.paymentOptionActive]}
                onPress={() => setPayment(method as any)}
              >
                <Text style={[styles.paymentOptionText, payment === method && styles.paymentOptionTextActive]}>{method}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.helperRow}>
            <FontAwesome5 name="shield-alt" size={12} color="#0B6E6B" />
            <Text style={styles.helperText}>Secure Flutterwave payments for card or bank transfer</Text>
          </View>
        </View>

        {outOfStockProduct ? (
          <View style={styles.successCard}>
            <FontAwesome5 name="exclamation-circle" size={24} color="#B91C1C" />
            <Text style={styles.successTitle}>Out of stock</Text>
            <Text style={styles.successText}>This item is not available right now. Please check back later.</Text>
          </View>
        ) : paymentSuccess ? (
          <View style={styles.successCard}>
            <FontAwesome5 name="check-circle" size={24} color="#16A34A" />
            <Text style={styles.successTitle}>Payment Successful</Text>
            <Text style={styles.successText}>We are processing your delivery.</Text>
            <TouchableOpacity
              style={[styles.button, { alignSelf: 'stretch' }]}
              onPress={() => router.push('/(tabs)/orders')}
            >
              <Text style={styles.buttonText}>View Orders</Text>
            </TouchableOpacity>
          </View>
        ) : payment === 'Card' ? (
          flutterwaveUrl && txRef ? (
            <View style={styles.webviewContainer}>
              <WebView
                source={{ uri: flutterwaveUrl }}
                onNavigationStateChange={async (nav) => {
                  const successHit =
                    nav.url.includes('status=successful') ||
                    nav.url.includes('success=true') ||
                    nav.url.includes('sachio-mobile/close');
                  if (successHit) {
                    setLoading(true);
                    const createdId = await createOrder('paid', txRef);
                    setLoading(false);
                    setPaymentSuccess(true);
                    setOrderRef(txRef || createdId || null);
                    setFlutterwaveUrl(null); // close the webview automatically
                  }
                }}
                startInLoadingState
                showsVerticalScrollIndicator={false}
              />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.button}
              onPress={async () => {
                if (outOfStockProduct) {
                  alert('This product is out of stock and cannot be purchased.');
                  return;
                }
                if (type !== 'buy' && (!rentalStart || !rentalEnd)) {
                  alert('Please select rental start and end dates.');
                  return;
                }
                if (!auth.currentUser) {
                  alert('Please sign in to pay.');
                  router.push('/auth/login');
                  return;
                }
                if (!product) return;
                if (!selectedAddress) {
                  setAddressModalVisible(true);
                  return;
                }
                const priceNum = typeof product.price === 'number' ? product.price : parseFloat(product.price as string);
                const tx_ref = `sachio-${Date.now()}`;
                setTxRef(tx_ref);
                setLoading(true);
                try {
                  const payload = {
                    tx_ref,
                    amount: priceNum || 1000,
                    currency: 'NGN',
                    // Redirect is required by Flutterwave; we keep it lightweight and close in-app on success.
                    redirect_url: 'https://sachio-mobile/close',
                    customer: { email: 'testuser@sachio.com' },
                    payment_options: 'card',
                  };
                  const res = await axios.post('https://api.flutterwave.com/v3/payments', payload, {
                    headers: {
                      Authorization: `Bearer ${FLW_SECRET_KEY}`,
                      'Content-Type': 'application/json',
                    },
                  });
                  const link = res.data?.data?.link;
                  if (link) {
                    setFlutterwaveUrl(link);
                  } else {
                    alert('Could not start payment');
                  }
                } catch (err: any) {
                  const msg = err?.response?.data?.message || err?.message || 'Payment initialization failed';
                  alert(msg);
                }
                setLoading(false);
              }}
              disabled={loading || outOfStockProduct}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pay with Flutterwave</Text>}
            </TouchableOpacity>
          )
        ) : (
          <>
            <TouchableOpacity
              style={[styles.button, outOfStockProduct && { opacity: 0.5 }]}
              onPress={() => {
                if (outOfStockProduct) {
                  alert('This product is out of stock and cannot be purchased.');
                  return;
                }
                handleCashTransferConfirm();
              }}
              disabled={loading || outOfStockProduct}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm Order</Text>}
            </TouchableOpacity>
            <View style={styles.transferInfo}>
              <Text style={styles.sectionLabel}>Transfer details</Text>
              <View style={styles.transferRow}>
                <Text style={styles.summaryLabel}>Bank</Text>
                <Text style={styles.summaryValue}>{TRANSFER_ACCOUNT.bank}</Text>
              </View>
              <View style={styles.transferRow}>
                <Text style={styles.summaryLabel}>Account name</Text>
                <Text style={styles.summaryValue}>{TRANSFER_ACCOUNT.accountName}</Text>
              </View>
              <View style={styles.transferRow}>
                <Text style={styles.summaryLabel}>Account number</Text>
                <Text style={styles.summaryValue}>{TRANSFER_ACCOUNT.accountNumber}</Text>
              </View>
              <Text style={styles.helperTextSmall}>After payment, tap Confirm Order so we can match your transfer.</Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Rental date modal */}
      <Modal
        visible={showDateModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowDateModal(false);
          setShowStartPicker(false);
          setShowEndPicker(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select rental dates</Text>
            <Text style={styles.helperTextSmall}>
              Pick start and end dates for your rental period.
            </Text>

            <TouchableOpacity
              style={styles.input}
              onPress={() => {
                setShowStartPicker(true);
                setShowEndPicker(false);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.inputLabel}>Start date</Text>
              <Text style={styles.inputValue}>{rentalStart || 'Tap to select'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.input}
              onPress={() => {
                setShowEndPicker(true);
                setShowStartPicker(false);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.inputLabel}>End date</Text>
              <Text style={styles.inputValue}>{rentalEnd || 'Tap to select'}</Text>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={safeDate(rentalStart)}
                mode="date"
                display="spinner"
                onChange={(_, date) => {
                  if (date) setRentalStart(formatDate(date));
                  setShowStartPicker(false);
                }}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={safeDate(rentalEnd)}
                mode="date"
                display="spinner"
                onChange={(_, date) => {
                  if (date) setRentalEnd(formatDate(date));
                  setShowEndPicker(false);
                }}
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={() => {
                  setShowDateModal(false);
                  setShowStartPicker(false);
                  setShowEndPicker(false);
                }}
              >
                <Text style={styles.outlineBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { flex: 1, marginTop: 0 }]}
                onPress={() => {
                  setShowDateModal(false);
                  setShowStartPicker(false);
                  setShowEndPicker(false);
                }}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Address modal */}
      <Modal
        visible={addressModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddressModalVisible(false)}
      >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delivery address</Text>
            <TextInput
              placeholder="Phone number"
              value={profilePhone}
              onChangeText={setProfilePhone}
              style={styles.input}
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
            />
            {addresses.length > 0 ? (
              addresses.map((addr, idx) => (
                <TouchableOpacity
                 key={idx}
                 style={[
                   styles.addressOption,
                   selectedAddress === addr && styles.addressOptionActive,
                 ]}
                  onPress={() => {
                    setSelectedAddress(addr);
                    setAddressModalVisible(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addressOptionText}>{addr}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setAddressEditingIndex(idx);
                        setAddressInput(addr);
                      }}
                      style={styles.iconBtn}
                    >
                      <FontAwesome5 name="edit" size={12} color="#0B6E6B" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => {
                        if (!auth.currentUser) return;
                        const updated = addresses.filter((_, i) => i !== idx);
                        try {
                          await setDoc(doc(db, 'users', auth.currentUser.uid), { addresses: updated }, { merge: true });
                          setAddresses(updated);
                          if (selectedAddress === addr) setSelectedAddress(updated[0] || '');
                        } catch (e) {
                          alert('Failed to remove address');
                        }
                      }}
                      style={[styles.iconBtn, { backgroundColor: '#FEF2F2' }]}
                    >
                      <FontAwesome5 name="trash" size={12} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.helperTextSmall}>No address saved yet.</Text>
            )}
            <Text style={[styles.modalTitle, { marginTop: 12 }]}>Add new address</Text>
            <TextInput
              placeholder="Enter address"
              value={addressInput}
              onChangeText={setAddressInput}
              style={styles.input}
              placeholderTextColor="#94a3b8"
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={() => {
                  setAddressModalVisible(false);
                  setAddressInput('');
                  setAddressEditingIndex(null);
                }}
              >
                <Text style={styles.outlineBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { flex: 1, marginTop: 0 }]}
                onPress={async () => {
                  if (!addressInput.trim()) return;
                  if (!auth.currentUser) {
                    alert('Please sign in to save address');
                    router.push('/auth/login');
                    return;
                  }
                  let updated: string[] = [];
                  if (addressEditingIndex !== null && addressEditingIndex >= 0) {
                    updated = [...addresses];
                    updated[addressEditingIndex] = addressInput.trim();
                  } else {
                    updated = [...addresses, addressInput.trim()];
                  }
                  try {
                    await setDoc(doc(db, 'users', auth.currentUser.uid), { addresses: updated }, { merge: true });
                    setAddresses(updated);
                    setSelectedAddress(addressInput.trim());
                    setAddressInput('');
                    setAddressEditingIndex(null);
                    setAddressModalVisible(false);
                  } catch (e) {
                    alert('Failed to save address');
                  }
                }}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 16, paddingBottom: 140 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#0B6E6B' },
  info: { fontSize: 16, color: '#333', marginBottom: 8 },
  button: { backgroundColor: '#0B6E6B', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8, marginTop: 24, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  breadcrumbsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, alignSelf: 'stretch' },
  backBtn: { marginRight: 10, padding: 6 },
  breadcrumbs: { fontSize: 14, color: '#0B6E6B', fontWeight: '600' },
  productCard: {
    backgroundColor: '#F3F7F7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  productImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  productImageFallback: {
    width: 90,
    height: 90,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0B6E6B',
    marginBottom: 4,
    textAlign: 'center',
  },
  productPrice: {
    fontSize: 16,
    color: '#0B6E6B',
    marginBottom: 2,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#0B6E6B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0B6E6B',
  },
  badge: {
    backgroundColor: '#E6F4F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1E7E5',
  },
  badgeText: {
    color: '#0B6E6B',
    fontWeight: '700',
    fontSize: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  warningText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
  },
  metaLine: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTotalLabel: {
    fontSize: 15,
    color: '#0B6E6B',
    fontWeight: '800',
  },
  summaryTotalValue: {
    fontSize: 18,
    color: '#0B6E6B',
    fontWeight: '800',
  },
  transferInfo: {
    backgroundColor: '#F3F7F7',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 10,
    gap: 6,
  },
  transferRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 16,
    width: '100%',
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B6E6B',
    marginBottom: 10,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
    justifyContent: 'space-between',
    gap: 8,
  },
  paymentOption: {
    flex: 1,
    backgroundColor: '#F3F7F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  paymentOptionActive: {
    backgroundColor: '#0B6E6B',
    borderColor: '#0B6E6B',
  },
  paymentOptionText: {
    color: '#0B6E6B',
    fontWeight: '700',
    fontSize: 14,
  },
  paymentOptionTextActive: {
    color: '#fff',
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  helperText: {
    fontSize: 12,
    color: '#475569',
  },
  helperTextSmall: {
    fontSize: 12,
    color: '#64748b',
  },
  successCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#166534',
  },
  successText: {
    fontSize: 14,
    color: '#166534',
    textAlign: 'center',
  },
  productSkeleton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    width: '100%',
    marginBottom: 18,
  },
  productSkeletonImage: {
    height: 90,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    marginBottom: 10,
  },
  productSkeletonLine: {
    height: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 8,
    width: 160,
  },
  webviewContainer: {
    minHeight: 960,
    borderWidth: 1,
    borderColor: '#cfdede',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 22,
    marginBottom: 32,
    alignSelf: 'stretch',
    width: '100%',
    backgroundColor: '#f4f9f9',
    elevation: 3,
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
  },
  rentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
    width: '100%',
  },
  rentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  linkBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  linkText: {
    color: '#0B6E6B',
    fontWeight: '700',
  },
  rentDatesRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  datePill: {
    flex: 1,
    backgroundColor: '#F3F7F7',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  datePillLabel: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 4,
  },
  datePillValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B6E6B',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0B6E6B',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dce0e8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    color: '#0f172a',
  },
  inputLabel: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 4,
  },
  inputValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B6E6B',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  outlineBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  outlineBtnText: {
    color: '#0B6E6B',
    fontWeight: '700',
  },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
    width: '100%',
  },
  addressOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    marginTop: 8,
  },
  addressOptionActive: {
    borderColor: '#0B6E6B',
    backgroundColor: '#E6F4F3',
  },
  addressOptionText: {
    color: '#0F172A',
    fontWeight: '700',
  },
});
