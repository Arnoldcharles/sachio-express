import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image, ActivityIndicator, TextInput, Animated, Easing, Modal, TouchableWithoutFeedback, Linking, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getProducts, getProductsByCategory, getCategories, Product } from '../../lib/products';
import { getBanners } from '../../lib/banners';
import { auth, db } from '../../lib/firebase';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';

// Inline Button (generic)
const InlineButton = ({ title, onPress, style }: { title: string; onPress: () => void; style?: any }) => (
  <TouchableOpacity
    style={[{ backgroundColor: '#0B6E6B', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' }, style]}
    onPress={onPress}
  >
    <Text style={{ color: '#fff', fontWeight: '700' }}>{title}</Text>
  </TouchableOpacity>
);

// Inline Header
function Header({ title, showNotifications, onPressNotifications, badgeCount, onPressMenu }: any) {
  return (
    <View style={styles.headerBar}>
      <TouchableOpacity onPress={onPressMenu} style={styles.iconBtn}>
        <FontAwesome5 name="bars" size={18} color="#0B6E6B" />
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {showNotifications ? (
        <TouchableOpacity style={{ position: 'relative' }} onPress={onPressNotifications}>
          <FontAwesome5 name="bell" size={18} color="#0B6E6B" />
          {badgeCount > 0 ? (
            <View style={{ position: 'absolute', top: -8, right: -8, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{badgeCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ) : (
        <View style={{ width: 20 }} />
      )}
    </View>
  );
}

export default function HomeTab() {
  const [banners, setBanners] = useState<any[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [notifCount, setNotifCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const sliderRef = useRef<ScrollView | null>(null);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const stats = [
    { id: 'deliveries', label: 'On-time rate', value: '98%', icon: 'clock' },
    { id: 'cleanliness', label: 'Hygiene score', value: '4.8/5', icon: 'thumbs-up' },
    { id: 'support', label: 'Support', value: '24/7', icon: 'headset' },
  ];

  const quickActions = [
    { id: 1, icon: 'shopping-bag', label: 'Buy Toilet', action: () => router.push('/buy' as any) },
    { id: 2, icon: 'calendar-alt', label: 'Rent Toilet', action: () => router.push('/rent' as any) },
    { id: 3, icon: 'map-marker-alt', label: 'Track Order', action: () => router.push('/track' as any) },
  ];

  useEffect(() => {
    if (!auth || typeof auth.onAuthStateChanged !== 'function') return;
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Fetch banners from Firestore
    (async () => {
      try {
        setBannersLoading(true);
        const loaded = await getBanners();
        setBanners(loaded);
      } catch (e) {
        // ignore
      } finally {
        setBannersLoading(false);
      }
    })();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setNotifCount(0);
      setActiveOrders([]);
      return;
    }
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        let active = 0;
        const actives: any[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as any;
          const status = data.status || '';
          const norm = status.toLowerCase();
          const done = norm.includes('delivered') || norm.includes('completed') || norm.includes('cancel');
          if (!done) {
            active += 1;
            actives.push({ id: doc.id, ...data });
          }
        });
        setNotifCount(active);
        setActiveOrders(actives.slice(0, 2));
      },
      () => setNotifCount(0),
    );
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    filterProducts();
  }, [selectedCategory, products]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setBannerIndex((prev) => {
        const next = (prev + 1) % banners.length;
        if (sliderRef.current) {
          sliderRef.current.scrollTo({ x: next * 320, animated: true });
        }
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [banners]);

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = filteredProducts;
    if (!term) return source;
    return source.filter(p => (p.title || '').toLowerCase().includes(term));
  }, [filteredProducts, search]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const allProducts = await getProducts();
      setProducts(allProducts);
      const cats = await getCategories();
      setCategories(cats.length > 0 ? cats.map((c) => c.name) : []);
    } catch (e) {
      console.warn('Failed to fetch products', e);
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = async () => {
    if (selectedCategory === 'all') {
      setFilteredProducts(products);
    } else {
      const filtered = await getProductsByCategory(selectedCategory);
      setFilteredProducts(filtered);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const [allProducts, cats, loadedBanners] = await Promise.all([
        getProducts(),
        getCategories(),
        getBanners(),
      ]);
      setProducts(allProducts);
      setCategories(cats.length > 0 ? cats.map((c) => c.name) : []);
      setFilteredProducts(selectedCategory === 'all' ? allProducts : await getProductsByCategory(selectedCategory));
      setBanners(loadedBanners);
    } catch (e) {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0B6E6B']} />}
      >
      <Header
        title="Sachio"
        showNotifications
        badgeCount={notifCount}
        onPressNotifications={() => router.push('/notifications')}
        onPressMenu={() => setMenuVisible(true)}
      />

      {/* Hero CTA */}
      <Animated.View style={[styles.heroCard, { opacity: fadeIn, transform: [{ translateY: fadeIn.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
        <View style={styles.heroTop}>
          <View style={styles.logoPill}>
            <Text style={styles.logoPillText}>Sachio</Text>
          </View>
          <View style={styles.heroStats}>
            {stats.map((stat) => (
              <View key={stat.id} style={styles.heroStat}>
                <FontAwesome5 name={stat.icon as any} size={12} color="#0B6E6B" />
                <Text style={styles.heroStatValue}>{stat.value}</Text>
                <Text style={styles.heroStatLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Clean. Timely. Trusted.</Text>
            <Text style={styles.heroCopy}>Rent or buy premium mobile toilets and track delivery live.</Text>
            <View style={styles.heroButtons}>
              <TouchableOpacity style={[styles.primaryPill]} onPress={() => router.push('/rent' as any)}>
                <Text style={styles.primaryPillText}>Rent Now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryPill} onPress={() => router.push('/buy' as any)}>
                <Text style={styles.secondaryPillText}>Buy</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.heroIconWrap}>
            <FontAwesome5 name="toilet" size={42} color="#0B6E6B" />
          </View>
        </View>
      </Animated.View>

      {/* Search */}
      <Animated.View style={[styles.searchCard, { opacity: fadeIn, transform: [{ translateY: fadeIn.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
        <View style={styles.searchRow}>
          <FontAwesome5 name="search" size={14} color="#0B6E6B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search VIP toilets, events, rentals..."
            placeholderTextColor="#6B7280"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {['all', 'rent', 'buy', ...categories].map((cat) => {
            const label = cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1);
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity key={cat} onPress={() => setSelectedCategory(cat)} style={[styles.filterChip, active && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* Banner Slider */}
      {bannersLoading ? (
        <View style={styles.bannerSkeletonRow}>
          {[1, 2].map(i => (
            <View key={i} style={styles.bannerSkeleton} />
          ))}
        </View>
      ) : banners.length > 0 ? (
        <View style={styles.bannerSlider}>
          <ScrollView
            ref={sliderRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={e => {
              const i = Math.round(e.nativeEvent.contentOffset.x / 320);
              setBannerIndex(i);
            }}
            scrollEventThrottle={16}
            style={{ width: '100%' }}
            contentContainerStyle={{ alignItems: 'center' }}
          >
            {banners.map((banner, idx) => {
              const image = typeof banner === 'string' ? banner : banner?.image;
              const link = typeof banner === 'string' ? '' : banner?.link;
              return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.9}
                    style={styles.bannerImageWrap}
                    onPress={() => {
                      const safeLink = link && /^https?:\/\//i.test(link) ? link : null;
                      if (!safeLink) {
                        router.push('/catalog' as any);
                        return;
                      }
                      Linking.canOpenURL(safeLink)
                        .then((ok) => {
                          if (ok) Linking.openURL(safeLink);
                        })
                        .catch(() => {});
                    }}
                  >
                  {image ? (
                    <Image source={{ uri: image }} style={styles.bannerImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.bannerImage, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
                      <FontAwesome5 name="image" size={18} color="#94a3b8" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.bannerDots}>
            {banners.map((_, idx) => (
              <View
                key={idx}
                style={[styles.dot, bannerIndex === idx && styles.dotActive]}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.promoBanner}>
          <Text style={styles.promoText}>Holiday Special!</Text>
          <Text style={styles.promoSubtext}>Get 20% off on all rentals</Text>
          <Button title="View Offers" style={{ minWidth: 140 }} />
        </View>
      )}

      {/* Trust stats */}
      <Animated.View style={[styles.statsRow, { opacity: fadeIn }]}>
        {stats.map(stat => (
          <View key={stat.id} style={styles.statCard}>
            <View style={styles.statIcon}>
              <FontAwesome5 name={stat.icon as any} size={14} color="#0B6E6B" />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </Animated.View>

      {/* Quick Actions */}
      <Animated.View style={[styles.quickActionsContainer, { opacity: fadeIn }]}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionCard}
              onPress={action.action}
            >
              <View style={styles.actionIcon}>
                <FontAwesome5 name={action.icon} size={22} color="#0B6E6B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionLabel}>{action.label}</Text>
                <Text style={styles.actionSub}>Tap to continue</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={14} color="#0B6E6B" />
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* Featured Products */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Products</Text>
          <TouchableOpacity onPress={() => router.push('/catalog' as any)}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skeletonRow}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.productSkeleton}>
                <View style={styles.productSkeletonImage} />
                <View style={styles.productSkeletonLine} />
                <View style={[styles.productSkeletonLine, { width: 60 }]} />
              </View>
            ))}
          </ScrollView>
        ) : visibleProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="box-open" size={40} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No products yet</Text>
            <Text style={styles.emptySubtitle}>Products you add will show here.</Text>
          </View>
        ) : (
          <FlatList
            data={visibleProducts.slice(0, 6)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.productCard} onPress={() => router.push(`/product?id=${item.id}`)}>
                <View style={styles.productImage}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%', borderRadius: 10 }} />
                  ) : (
                    <FontAwesome5 name="toilet" size={40} color="#0B6E6B" />
                  )}
                </View>
                <Text style={styles.productName} numberOfLines={2}>{item.title}</Text>
                {item.category && <Text style={styles.productType}>{item.category}</Text>}
                <View style={styles.priceRatingRow}>
                  <Text style={styles.productPrice}>NGN {item.price}</Text>
                  <Text style={styles.rating}>★ 4.5</Text>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id || Math.random().toString()}
            horizontal
            scrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productsList}
          />
        )}
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Browse by Category</Text>
        <View style={styles.categoriesContainer}>
          <TouchableOpacity
            key="all"
            style={[
              styles.categoryChip,
              selectedCategory === 'all' && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === 'all' && styles.categoryTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                selectedCategory === cat && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat && styles.categoryTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Active Orders Carousel */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Orders</Text>
        {activeOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="inbox" size={32} color="#9CA3AF" />
            <Text style={styles.emptySubtitle}>No active orders yet.</Text>
          </View>
        ) : (
          activeOrders.map((order) => (
            <TouchableOpacity key={order.id} style={styles.orderCard} onPress={() => router.push('/(tabs)/orders')}>
              <View style={styles.orderInfo}>
                <Text style={styles.orderTitle}>Order #{String(order.id).slice(0, 6)}</Text>
                <Text style={styles.orderStatus}>{order.status || 'Processing'}</Text>
                {order.rentalStartDate || order.rentalEndDate ? (
                  <Text style={styles.orderDate}>
                    Rental: {order.rentalStartDate || '—'} to {order.rentalEndDate || '—'}
                  </Text>
                ) : null}
                {order.productTitle ? (
                  <Text style={styles.orderMeta}>{order.productTitle}</Text>
                ) : null}
              </View>
              <FontAwesome5 name="chevron-right" size={20} color="#0B6E6B" />
            </TouchableOpacity>
          ))
        )}
      </View>
      </ScrollView>
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.menuBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.menuSheet}>
                <Text style={styles.menuTitle}>Menu</Text>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push('/(tabs)/home'); }}>
                  <FontAwesome5 name="home" size={14} color="#0B6E6B" />
                  <Text style={styles.menuItemText}>Home</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push('/(tabs)/orders'); }}>
                  <FontAwesome5 name="list" size={14} color="#0B6E6B" />
                  <Text style={styles.menuItemText}>Orders</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push('/notifications'); }}>
                  <FontAwesome5 name="bell" size={14} color="#0B6E6B" />
                  <Text style={styles.menuItemText}>Notifications</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push('/(tabs)/profile'); }}>
                  <FontAwesome5 name="user" size={14} color="#0B6E6B" />
                  <Text style={styles.menuItemText}>Profile</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    backgroundColor: '#E6F4F3',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#D1E7E5',
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0B6E6B',
    marginBottom: 4,
  },
  heroCopy: {
    fontSize: 13,
    color: '#1E293B',
    marginBottom: 10,
  },
  heroButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryPill: {
    backgroundColor: '#0B6E6B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryPillText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryPill: {
    borderWidth: 1,
    borderColor: '#0B6E6B',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  secondaryPillText: {
    color: '#0B6E6B',
    fontWeight: '700',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuSheet: {
    marginTop: 70,
    marginRight: 16,
    width: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
    gap: 10,
  },
  menuTitle: { fontSize: 14, fontWeight: '800', color: '#0B6E6B', marginBottom: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  menuItemText: { color: '#0F172A', fontWeight: '700', fontSize: 13 },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1E7E5',
  },
      bannerSlider: {
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 20,
        alignItems: 'center',
      },
      bannerImageWrap: {
        width: 320,
        height: 160,
        borderRadius: 16,
        overflow: 'hidden',
        marginRight: 12,
        backgroundColor: '#f0f8f8',
        justifyContent: 'center',
        alignItems: 'center',
      },
      bannerImage: {
        width: '100%',
        height: '100%',
        borderRadius: 16,
      },
      bannerDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 8,
      },
      dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#e0e0e0',
        marginHorizontal: 3,
      },
      dotActive: {
        backgroundColor: '#0B6E6B',
      },
    safeArea: { flex: 1, backgroundColor: '#fff' },
  container: {
    flex: 1,
    backgroundColor: '#FAFBFB',
  },
  promoBanner: {
    backgroundColor: '#0B6E6B',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  promoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  promoSubtext: {
    fontSize: 14,
    color: '#ddd',
    marginBottom: 12,
  },
  quickActionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  searchCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F7F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  filterChipActive: {
    borderColor: '#0B6E6B',
    backgroundColor: '#E6F4F3',
  },
  filterChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#0B6E6B',
  },
  actionsGrid: {
    flexDirection: 'column',
    gap: 10,
  },
  actionCard: {
    alignItems: 'center',
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    width: '100%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 12,
  },
  actionIcon: {
    padding: 12,
    backgroundColor: '#f0f8f8',
    borderRadius: 10,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'left',
  },
  actionSub: {
    fontSize: 12,
    color: '#64748B',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  viewAll: {
    color: '#F6B22F',
    fontWeight: '600',
    fontSize: 12,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 140,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  productImage: {
    backgroundColor: '#f0f8f8',
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  productsList: {
    paddingRight: 16,
    paddingVertical: 4,
  },
  productName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  productType: {
    fontSize: 11,
    color: '#666',
    marginBottom: 8,
  },
  priceRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0B6E6B',
  },
  rating: {
    fontSize: 11,
    color: '#475569',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  categoryChipActive: {
    backgroundColor: '#0B6E6B',
    borderColor: '#0B6E6B',
  },
  categoryText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  orderInfo: {
    flex: 1,
  },
  orderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  orderStatus: {
    fontSize: 12,
    color: '#0B6E6B',
    fontWeight: '600',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 11,
    color: '#999',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'flex-start',
    gap: 2,
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 1,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E6F4F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B6E6B',
  },
  statLabel: {
    fontSize: 12,
    color: '#475569',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B6E6B',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  skeletonRow: {
    paddingVertical: 6,
    paddingRight: 16,
    gap: 12,
    flexDirection: 'row',
  },
  productSkeleton: {
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  productSkeletonImage: {
    height: 80,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
    marginBottom: 10,
  },
  productSkeletonLine: {
    height: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    marginBottom: 6,
  },
  bannerSkeletonRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  bannerSkeleton: {
    flex: 1,
    height: 160,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
});
