import React, { useMemo, useState, useEffect } from 'react';
import { View, Text as RNText, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, StatusBar, Modal, TextInput, ActivityIndicator, RefreshControl, Linking, Pressable } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth, ensureUserProfile, getUserProfile, signOut, db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../lib/theme';

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} style={[{ fontFamily: 'Nunito' }, props.style]} />
);

export default function ProfileTab() {
  const router = useRouter();
  const { show } = useToast();
  const { colors, isDark, preference, setPreference } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const Header = ({ title }: { title: string }) => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
  const CustomButton = ({ title, onPress, style }: { title: string; onPress: () => void; style?: any }) => (
    <TouchableOpacity onPress={onPress} style={[styles.button, style]}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>({ name: '', email: '', phone: '', addresses: [] });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>({ name: '', phone: '', address: '' });
  const [addresses, setAddresses] = useState<string[]>([]);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [notifications, setNotifications] = useState({ push: true, sms: false, email: false });
  const [refreshing, setRefreshing] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

  const menuItems = [
    { label: 'Edit Profile', icon: 'user' },
    { label: 'Addresses', icon: 'map-marker-alt' },
    { label: 'Payment Methods', icon: 'credit-card' },
    { label: 'Favorites', icon: 'heart' },
    { label: 'Order History', icon: 'history' },
    { label: 'Help & Support', icon: 'question-circle' },
    { label: 'Terms & Privacy', icon: 'file' },
  ];

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const current = auth.currentUser;
        if (!current) {
          router.replace('/auth/login' as any);
          return;
        }
        const profile = await getUserProfile(current.uid);
        if (!mounted) return;
        const mergedProfile =
          profile ||
          (await ensureUserProfile(current, {
            name: current.displayName ?? null,
            phone: current.phoneNumber ?? null,
          }));
        setUser(mergedProfile);
        setAddresses(mergedProfile.addresses || []);
        setEditData({
          name: mergedProfile.name || '',
          phone: mergedProfile.phone || '',
          address: '',
        });
        if (mergedProfile.notifications) {
          setNotifications({
            push: mergedProfile.notifications.push ?? true,
            sms: mergedProfile.notifications.sms ?? false,
            email: mergedProfile.notifications.email ?? false,
          });
        }
      } catch (e) {
        console.warn('Failed to load profile', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const current = auth.currentUser;
      if (!current) return;
      const profile = await getUserProfile(current.uid);
      const mergedProfile =
        profile ||
        (await ensureUserProfile(current, {
          name: current.displayName ?? null,
          phone: current.phoneNumber ?? null,
        }));
      setUser(mergedProfile);
      setAddresses(mergedProfile.addresses || []);
    } catch (e) {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  async function handleEditProfile() {
    try {
      const current = auth.currentUser;
      if (!current) return;
      const userRef = doc(db, 'users', current.uid);
      await setDoc(userRef, { name: editData.name, phone: editData.phone }, { merge: true });
      setUser((prev: any) => ({ ...prev, name: editData.name, phone: editData.phone }));
      setEditModalVisible(false);
      try { show('Profile updated', { type: 'success' }); } catch (e) {}
    } catch (e) {
      console.warn(e);
      try { show('Could not save profile', { type: 'error' }); } catch (err) {}
    }
  }

  async function handleAddAddress() {
    try {
      if (!newAddress) return Alert.alert('Address required');
      const current = auth.currentUser;
      if (!current) return;
      let updated: string[] = [];
      if (editingIndex !== null && editingIndex >= 0) {
        updated = [...addresses];
        updated[editingIndex] = newAddress;
      } else {
        updated = [...addresses, newAddress];
      }
      const userRef = doc(db, 'users', current.uid);
      await setDoc(userRef, { addresses: updated }, { merge: true });
      setAddresses(updated);
      setNewAddress('');
      setEditingIndex(null);
      setAddressModalVisible(false);
      try { show('Address added', { type: 'success' }); } catch (e) {}
    } catch (e) {
      console.warn(e);
      try { show('Could not add address', { type: 'error' }); } catch (err) {}
    }
  }

  async function handleDeleteAddress(index: number) {
    try {
      const current = auth.currentUser;
      if (!current) return;
      const updated = addresses.filter((_, i) => i !== index);
      const userRef = doc(db, 'users', current.uid);
      await setDoc(userRef, { addresses: updated }, { merge: true });
      setAddresses(updated);
      try { show('Address removed', { type: 'success' }); } catch (e) {}
    } catch (e) {
      console.warn(e);
    }
  }

  async function handleLogout() {
    try {
      await signOut();
      router.replace('/auth/login' as any);
    } catch (e) {
      console.warn(e);
    }
  }

  async function updateNotificationPref(key: 'push' | 'sms' | 'email', value: boolean) {
    try {
      const current = auth.currentUser;
      if (!current) return;
      const userRef = doc(db, 'users', current.uid);
      const updated = { ...notifications, [key]: value };
      setNotifications(updated);
      await setDoc(userRef, { notifications: updated }, { merge: true });
    } catch (e) {
      console.warn('Failed to update notification preference', e);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <Header title="Profile" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0B6E6B']} />}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <FontAwesome5 name="user" size={28} color="#0B6E6B" />
            </View>
          </View>
          <Text style={styles.userName}>{user.name || user.email}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          {user.phone ? <Text style={styles.userPhone}>{user.phone}</Text> : null}
          {addresses.length ? (
            <View style={styles.addressBlock}>
              <View style={styles.addressHeaderRow}>
                <Text style={styles.addressHeader}>Addresses</Text>
                <TouchableOpacity
                  onPress={() => {
                    setAddressModalVisible(true);
                    setEditingIndex(null);
                    setNewAddress('');
                  }}
                  style={styles.manageBtn}
                >
                  <FontAwesome5 name="plus" size={12} color="#0B6E6B" />
                  <Text style={styles.manageBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
              {addresses.map((a, i) => (
                <View key={i} style={styles.addressRow}>
                  <View style={styles.addressTextWrap}>
                    <Text style={styles.addressItem}>{a}</Text>
                  </View>
                  <View style={styles.addressActions}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingIndex(i);
                        setNewAddress(a);
                        setAddressModalVisible(true);
                      }}
                      style={styles.iconBtn}
                    >
                      <FontAwesome5 name="edit" size={12} color="#0B6E6B" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteAddress(i)} style={[styles.iconBtn, { backgroundColor: '#FEF2F2' }]}>
                      <FontAwesome5 name="trash" size={12} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => { setAddressModalVisible(true); setEditingIndex(null); }}
              style={styles.emptyAddressBtn}
            >
              <Text style={styles.manageBtnText}>Add address</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.notificationItem}>
            <View style={styles.notificationLabel}>
              <FontAwesome5 name="bell" size={18} color="#0B6E6B" />
              <Text style={styles.notificationText}>Push Notifications</Text>
            </View>
            <Switch
              value={notifications.push}
              onValueChange={(value) => updateNotificationPref('push', value)}
              trackColor={{ false: '#ddd', true: '#0B6E6B' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.notificationItem}>
            <View style={styles.notificationLabel}>
              <FontAwesome5 name="sms" size={18} color="#0B6E6B" />
              <Text style={styles.notificationText}>SMS Updates</Text>
            </View>
            <Switch
              value={notifications.sms}
              onValueChange={(value) => updateNotificationPref('sms', value)}
              trackColor={{ false: '#ddd', true: '#0B6E6B' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.notificationItem}>
            <View style={styles.notificationLabel}>
              <FontAwesome5 name="envelope" size={18} color="#0B6E6B" />
              <Text style={styles.notificationText}>Email Notifications</Text>
            </View>
            <Switch
              value={notifications.email}
              onValueChange={(value) => updateNotificationPref('email', value)}
              trackColor={{ false: '#ddd', true: '#0B6E6B' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.themeRow}>
            <Text style={styles.themeLabel}>Theme</Text>
            <View style={styles.themeOptions}>
              {(['system', 'light', 'dark'] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.themeOption, preference === opt && styles.themeOptionActive]}
                  onPress={() => setPreference(opt)}
                >
                  <Text style={[styles.themeOptionText, preference === opt && styles.themeOptionTextActive]}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, index === menuItems.length - 1 && styles.menuItemLast]}
              onPress={() => {
                switch (item.label) {
                  case 'Edit Profile':
                    setEditData({ name: user.name || '', phone: user.phone || '', address: '' });
                    setEditModalVisible(true);
                    break;
                  case 'Addresses':
                    setAddressModalVisible(true);
                    break;
                  case 'Payment Methods':
                    router.push('/profile/payment-methods' as any);
                    break;
                  case 'Favorites':
                    router.push('/profile/favorites' as any);
                    break;
                  case 'Order History':
                    router.push('/(tabs)/orders' as any);
                    break;
                  case 'Help & Support':
                    setSupportModalVisible(true);
                    break;
                  case 'Terms & Privacy':
                    setTermsModalVisible(true);
                    break;
                  default:
                    break;
                }
              }}
            >
              <FontAwesome5 name={item.icon as any} size={18} color="#0B6E6B" />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <FontAwesome5 name="chevron-right" size={16} color="#999" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <CustomButton title="Logout" onPress={handleLogout} style={styles.logoutButton} />
        </View>

        <View style={styles.footerSection}>
          <Text style={styles.appVersion}>Sachio v1.0.0</Text>
          <Text style={styles.copyright}>© 2025 Sachio Mobile Toilets</Text>
        </View>
      </ScrollView>

      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalOverlay} onPress={() => setEditModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: '700', marginBottom: 12 }}>Edit Profile</Text>
            <TextInput placeholder="Name" value={editData.name} onChangeText={v => setEditData({ ...editData, name: v })} style={styles.input} />
            <TextInput placeholder="Phone" value={editData.phone} onChangeText={v => setEditData({ ...editData, phone: v })} style={styles.input} />
            <CustomButton title="Save" onPress={handleEditProfile} />
            <CustomButton title="Cancel" onPress={() => setEditModalVisible(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={addressModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              setAddressModalVisible(false);
              setEditingIndex(null);
              setNewAddress('');
            }}
          />
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: '700', marginBottom: 12 }}>
              {editingIndex !== null ? 'Edit Address' : 'Add Address'}
            </Text>
            <TextInput placeholder="Address" value={newAddress} onChangeText={setNewAddress} style={styles.input} multiline />
            <CustomButton title={editingIndex !== null ? 'Save' : 'Add'} onPress={handleAddAddress} />
            <CustomButton title="Cancel" onPress={() => { setAddressModalVisible(false); setEditingIndex(null); setNewAddress(''); }} />
          </View>
        </View>
      </Modal>

      <Modal visible={supportModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalOverlay} onPress={() => setSupportModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: '700', marginBottom: 12 }}>Support</Text>
            <Text style={styles.supportText}>
              Contact us at{' '}
              <Text
                style={styles.linkText}
                onPress={() => Linking.openURL('mailto:sachiomobiletoilets@gmail.com')}
              >
                Mail
              </Text>{' '}
              or{' '}
              <Text
                style={styles.linkText}
                onPress={() => Linking.openURL('https://wa.me/2348187692998')}
              >
                Whatsapp
              </Text>
              .
            </Text>
            <CustomButton title="OK" onPress={() => setSupportModalVisible(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={termsModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalOverlay} onPress={() => setTermsModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: '700', marginBottom: 12 }}>Terms & Privacy</Text>
            <Text style={styles.supportText}>
              View our{' '}
              <Text
                style={styles.linkText}
                onPress={() => {
                  setTermsModalVisible(false);
                  router.push('/profile/terms' as any);
                }}
              >
                Terms
              </Text>{' '}
              or{' '}
              <Text
                style={styles.linkText}
                onPress={() => {
                  setTermsModalVisible(false);
                  router.push('/profile/privacy' as any);
                }}
              >
                Privacy
              </Text>
              .
            </Text>
            <CustomButton title="OK" onPress={() => setTermsModalVisible(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  profileCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    paddingVertical: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 13,
    color: colors.muted,
  },
  userAddress: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 2,
  },
  addressItem: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 2,
    textAlign: 'center',
  },
  addressTextWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressBlock: {
    marginTop: 12,
    alignSelf: 'stretch',
    gap: 8,
  },
  addressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressHeader: {
    fontWeight: '700',
    color: colors.text,
    fontSize: 14,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manageBtnText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 10,
  },
  addressActions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyAddressBtn: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  themeRow: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 10,
  },
  themeLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  themeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  themeOptionText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  themeOptionTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  notificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  notificationText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 12,
    fontWeight: '500',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuLabel: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 16,
    flex: 1,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: colors.danger,
  },
  footerSection: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
  },
  appVersion: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
  copyright: {
    fontSize: 11,
    color: colors.muted,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 12,
    width: '80%',
    alignItems: 'center',
  },
  supportText: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  linkText: {
    color: colors.primary,
    fontWeight: '700',
  },
  input: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
