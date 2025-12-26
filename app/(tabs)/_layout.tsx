import { Tabs, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { auth, db, signOut } from '../../lib/firebase';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { FontAwesome5 } from '@expo/vector-icons';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, onSnapshot } from 'firebase/firestore';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockMessage, setBlockMessage] = useState('Your account has been blocked by an administrator.');
  const [blockAlertVisible, setBlockAlertVisible] = useState(false);

  useEffect(() => {
    if (!auth || typeof auth.onAuthStateChanged !== 'function') return;
    const unsubscribe = auth.onAuthStateChanged((user: FirebaseAuthTypes.User | null) => {
      setCurrentUser(user);
    });
    setCurrentUser(auth.currentUser as FirebaseAuthTypes.User | null);
    setAuthChecked(true);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setBlocked(false);
      setBlockMessage('Your account has been blocked by an administrator.');
      return;
    }
    const ref = doc(db, 'users', currentUser.uid);
    const unsub = onSnapshot(
      ref,
      async (snap) => {
        const data = snap.data() as any;
        if (data?.blocked) {
          setBlocked(true);
          setBlockMessage(
            data.blockReason
              ? String(data.blockReason)
              : 'Your account has been blocked by an administrator.'
          );
          await signOut();
          setBlockAlertVisible(true);
        } else {
          setBlocked(false);
        }
      },
      () => {
        // ignore errors; keep last known state
      }
    );
    return () => unsub();
  }, [currentUser, router]);

  useEffect(() => {
    if (!blockAlertVisible) return;
    Alert.alert(
      'Account blocked',
      `${blockMessage} Please contact support.`,
      [
        {
          text: 'Contact support',
          onPress: () => {
            Linking.openURL('mailto:arnoldcharles028@gmail.com');
            router.replace('/auth/login');
            setBlockAlertVisible(false);
          },
        },
        {
          text: 'Go to Login',
          onPress: () => {
            router.replace('/auth/login');
            setBlockAlertVisible(false);
          },
          style: 'destructive',
        },
      ],
      { cancelable: false }
    );
  }, [blockAlertVisible, blockMessage, router]);

  if (!authChecked) {
    return (
      <View style={styles.blocked}>
        <ActivityIndicator size="large" color="#0B6E6B" />
        <Text style={styles.blockedText}>Checking your session...</Text>
      </View>
    );
  }

  if (blocked) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedTitle}>Account blocked</Text>
        <Text style={styles.blockedText}>
          {blockMessage}{' '}
          <Text
            style={styles.link}
            onPress={() => Linking.openURL('mailto:arnoldcharles028@gmail.com')}
          >
            contact support
          </Text>
          .
        </Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.replace('/auth/login')}>
          <Text style={styles.loginBtnText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedTitle}>Login required</Text>
        <Text style={styles.blockedText}>Please sign in to use the app.</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.replace('/auth/login')}>
          <Text style={styles.loginBtnText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: [
          styles.tabBar,
          {
            paddingBottom: 10 + insets.bottom,
            height: 60 + insets.bottom,
          },
        ],
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarActiveTintColor: '#0B6E6B',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: 'Track',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="map-marker-alt" size={size} color={color} />
          ),
        }}
      />
      {/* Hide detail screens from the tab bar */}
      <Tabs.Screen name="orders/[id]" options={{ href: null }} />
      <Tabs.Screen name="track/[id]" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
      tabBarIcon: ({ color, size }) => (
        <FontAwesome5 name="user" size={size} color={color} />
      ),
    }}
  />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopColor: '#e0e0e0',
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 8,
    height: 70,
  },
  tabBarLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  blocked: {
    flex: 1,
    backgroundColor: '#FAFBFB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  blockedTitle: { fontSize: 18, fontWeight: '800', color: '#0B6E6B' },
  blockedText: { fontSize: 14, color: '#475569', textAlign: 'center' },
  link: { color: '#0B6E6B', fontWeight: '700', textDecorationLine: 'underline' },
  loginBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0B6E6B',
    borderRadius: 10,
  },
  loginBtnText: { color: '#fff', fontWeight: '700' },
});
