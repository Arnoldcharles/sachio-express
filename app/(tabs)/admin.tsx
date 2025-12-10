import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Linking, Image, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { createProduct, getProducts, Product, getCategories, createCategory, updateCategory, deleteCategory, Category } from '../../lib/products';
import { useToast } from '../../components/Toast';
import { saveBanners, getBanners } from '../../lib/banners';
import { auth, db } from '../../lib/firebase';
import { collection, doc, orderBy, query, updateDoc, onSnapshot, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';

export default function AdminProductScreen() {
  // Banner management state
  const [banners, setBanners] = useState<any[]>([]);
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerLink, setBannerLink] = useState('');
  const [bannerCta, setBannerCta] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [editingBannerIndex, setEditingBannerIndex] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { show } = useToast();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imagesInput, setImagesInput] = useState('');
  const [category, setCategory] = useState('');
  const [categoriesSelected, setCategoriesSelected] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [inStock, setInStock] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const [initialOrdersReady, setInitialOrdersReady] = useState(false);
  const [newOrderModal, setNewOrderModal] = useState<{ visible: boolean; order?: any }>({ visible: false });
  const [refreshing, setRefreshing] = useState(false);
  const allowedUser = {
    email: 'arnoldcharles028@gmail.com',
    name: 'Arnold Charles',
    phone: '09023311459',
    uid: 'LT2b0m9GGPQMA4OGE8NNJtqM8iZ2',
  };

  useEffect(() => {
    if (params.payment === 'success') {
      Alert.alert('Payment Successful', `Reference: ${params.reference || ''}`);
    }
  }, [params]);

  useEffect(() => {
    const url = bannerUrl.trim();
    if (!url) {
      setPreviewError(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // quick fetch to verify image reachability
        const res = await fetch(url, { method: 'GET' });
        if (!cancelled) setPreviewError(!res.ok);
      } catch {
        if (!cancelled) setPreviewError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [bannerUrl]);

  useEffect(() => {
    async function fetchProductsData() {
      try {
        setLoadingProducts(true);
        const items = await getProducts();
        setProducts(items);
      } catch (e) {
        show('Failed to load products', { type: 'error' });
      } finally {
        setLoadingProducts(false);
      }
    }
    async function fetchCategoriesData() {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (e) {
        // ignore
      }
    }
    function listenOrders() {
      setLoadingOrders(true);
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const list: any[] = [];
          snap.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...(docSnap.data() as any) });
          });
          // detect new orders after initial load
          if (initialOrdersReady) {
            const existing = knownOrderIds.current;
            const newOnes = list.filter((o) => !existing.has(o.id));
            if (newOnes.length > 0) {
              setNewOrderModal({ visible: true, order: newOnes[0] });
            }
            list.forEach((o) => existing.add(o.id));
          } else {
            const idSet = new Set<string>();
            list.forEach((o) => idSet.add(o.id));
            knownOrderIds.current = idSet;
            setInitialOrdersReady(true);
          }
          setOrders(list);
          setLoadingOrders(false);
        },
        () => setLoadingOrders(false)
      );
      return unsub;
    }
    const bannersUnsub = onSnapshot(
      doc(db, 'appConfig', 'banners'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          const arr = Array.isArray(data?.banners) ? data.banners : [];
          const normalized = arr.map((b: any) => (typeof b === 'string' ? { image: b, link: '' } : b));
          setBanners(normalized);
        }
      },
      () => {
        // fallback to one-time fetch if needed
        getBanners().then(setBanners).catch(() => {});
      }
    );
    fetchProductsData();
    fetchCategoriesData();
    const unsubOrders = listenOrders();
    setUser(auth.currentUser);
    return () => {
      if (unsubOrders) unsubOrders();
      if (bannersUnsub) bannersUnsub();
    };
  }, []);

  const updateOrderStatus = async (id: string, status: string) => {
    try {
      setUpdatingOrder(id);
      const ref = doc(db, 'orders', id);
      await updateDoc(ref, { status });
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      show('Order updated', { type: 'success' });
    } catch (e) {
      show('Failed to update order', { type: 'error' });
    } finally {
      setUpdatingOrder(null);
    }
  };

  const cancelOrder = async (id: string) => {
    try {
      setUpdatingOrder(id);
      const ref = doc(db, 'orders', id);
      await updateDoc(ref, { status: 'cancelled_by_admin' });
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: 'cancelled_by_admin' } : o)));
      show('Order cancelled', { type: 'success' });
    } catch (e) {
      show('Failed to cancel order', { type: 'error' });
    } finally {
      setUpdatingOrder(null);
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      setUpdatingOrder(id);
      await deleteDoc(doc(db, 'orders', id));
      setOrders((prev) => prev.filter((o) => o.id !== id));
      show('Order deleted', { type: 'success' });
    } catch (e) {
      show('Failed to delete order', { type: 'error' });
    } finally {
      setUpdatingOrder(null);
    }
  };

  const startEditProduct = (product: Product) => {
    setTitle(product.title);
    setPrice(String(product.price));
    setDescription(product.description || '');
    setImageUrl(product.imageUrl || '');
    setImagesInput((product.images || []).join(', '));
    setCategory(product.category || '');
    setCategoriesSelected(product.categories || (product.category ? [product.category] : []));
    setInStock(product.inStock !== false);
    setEditingProduct(product);
  };

  const saveProduct = async () => {
    if (!title || !price) return Alert.alert('Validation', 'Please provide title and price');
    setSubmitting(true);
    const parsedImages = Array.from(
      new Set(
        (imagesInput || '')
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    const images = imageUrl ? [imageUrl.trim(), ...parsedImages] : parsedImages;
    const cats = Array.from(new Set(categoriesSelected.slice(0, 4)));
    const primaryCat = cats[0] || category || '';

    try {
      if (editingProduct?.id) {
        const ref = doc(db, 'products', editingProduct.id);
        await updateDoc(ref, { title, price, description, imageUrl: imageUrl || images[0] || '', images, category: primaryCat, categories: cats, inStock: inStock });
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? { ...p, title, price, description, imageUrl: imageUrl || images[0] || '', images, category: primaryCat, categories: cats, inStock: inStock } : p))
        );
        show('Product updated', { type: 'success' });
      } else {
        const productData: any = { title, price, description, imageUrl: imageUrl || images[0] || '', images, category: primaryCat, categories: cats, inStock: inStock };
        const prod = await createProduct(productData);
        setProducts((prev) => [prod as Product, ...prev]);
        show('Product created', { type: 'success' });
      }
      setTitle('');
      setPrice('');
      setDescription('');
      setImageUrl('');
      setImagesInput('');
      setCategory('');
      setCategoriesSelected([]);
      setInStock(true);
      setEditingProduct(null);
    } catch (e) {
      show('Failed to save product', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id?: string) => {
    if (!id) return;
    Alert.alert('Delete product', 'This cannot be undone. Proceed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'products', id));
            setProducts((prev) => prev.filter((p) => p.id !== id));
            if (editingProduct?.id === id) setEditingProduct(null);
            show('Product deleted', { type: 'success' });
          } catch (e) {
            show('Failed to delete product', { type: 'error' });
          }
        },
      },
    ]);
  };

  const handleDeleteCategory = (cat: Category) => {
    Alert.alert('Delete category', `Delete "${cat.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(cat.id);
            setCategories((prev) => prev.filter((c) => c.id !== cat.id));
            setCategoriesSelected((prev) => prev.filter((name) => name !== cat.name));
            if (category === cat.name) setCategory('');
            if (editingCategoryId === cat.id) {
              setEditingCategoryId(null);
              setCategoryInput('');
            }
            show('Category removed', { type: 'success' });
          } catch (e) {
            show('Failed to delete category', { type: 'error' });
          }
        },
      },
    ]);
  };

  const totalOrders = orders.length;
  const activeOrders = orders.filter(
    (o) => !['completed', 'cancelled_by_admin', 'delivered'].includes(o.status || '')
  ).length;
  const revenue = orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);

  const statusChip = (status?: string) => {
    switch (status) {
      case 'processing':
        return { label: 'Processing', color: '#0ea5e9', bg: '#e0f2fe' };
      case 'dispatched':
        return { label: 'Dispatched', color: '#2563eb', bg: '#dbeafe' };
      case 'in_transit':
        return { label: 'In transit', color: '#f59e0b', bg: '#fef3c7' };
      case 'returning':
        return { label: 'Returning', color: '#a855f7', bg: '#f3e8ff' };
      case 'delivered':
        return { label: 'Delivered', color: '#0f766e', bg: '#ccfbf1' };
      case 'completed':
        return { label: 'Completed', color: '#16a34a', bg: '#dcfce7' };
      case 'cancelled_by_admin':
        return { label: 'Cancelled', color: '#ef4444', bg: '#fee2e2' };
      default:
        return { label: status || 'Pending', color: '#475569', bg: '#e2e8f0' };
    }
  };

  // Restrict access to allowed user
  if (!user || user.email !== allowedUser.email || user.uid !== allowedUser.uid) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Access Denied</Text>
        <Text style={{ color: '#EF4444', marginTop: 12 }}>You do not have permission to access this page.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                const [items, loadedBanners, cats] = await Promise.all([getProducts(), getBanners(), getCategories()]);
                setProducts(items);
                setBanners(loadedBanners as any);
                setCategories(cats);
              } catch (e) {
                // ignore
              } finally {
                setRefreshing(false);
              }
            }}
            colors={['#0B6E6B']}
          />
        }
      >
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.pageEyebrow}>Admin Control</Text>
            <Text style={styles.pageTitle}>Dashboard</Text>
          </View>
          <View style={styles.topActions}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/home')} style={styles.navChip}>
              <FontAwesome5 name="home" size={12} color="#0B6E6B" />
              <Text style={styles.navChipText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/orders')} style={styles.navChip}>
              <FontAwesome5 name="list" size={12} color="#0B6E6B" />
              <Text style={styles.navChipText}>Orders</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statGrid}>
          <StatCard title="Total orders" value={totalOrders} icon="clipboard-list" />
          <StatCard title="Active" value={activeOrders} icon="truck" accent />
          <StatCard title="Revenue" value={`NGN ${revenue.toLocaleString()}`} icon="wallet" />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.sectionTitle}>Home Banners</Text>
              <Text style={styles.sectionSub}>Keep the homepage fresh with new hero images.</Text>
            </View>
          </View>
          <TextInput
            placeholder="Banner Image URL"
            value={bannerUrl}
            onChangeText={setBannerUrl}
            style={styles.input}
          />
          <Text style={styles.helperTextSmall}>
            Tip: Use a direct image link (e.g., “Direct Link” from imgbb). Paste the image URL, add an optional tap link, then save.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://imgbb.com/')}
            style={styles.linkChip}
          >
            <FontAwesome5 name="external-link-alt" size={12} color="#0B6E6B" />
            <Text style={styles.linkChipText}>Open imgbb.com to host image</Text>
          </TouchableOpacity>
          <Text style={styles.helperTextSmall}>Optional CTA</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              placeholder="CTA label (e.g., View catalog)"
              value={bannerCta}
              onChangeText={setBannerCta}
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              placeholder="Tap link (https://...)"
              value={bannerLink}
              onChangeText={setBannerLink}
              style={[styles.input, { flex: 1 }]}
            />
          </View>
          {bannerUrl ? (
            <View style={styles.previewBox}>
              <Image
                key={bannerUrl.trim()}
                source={{ uri: bannerUrl.trim() }}
                style={styles.previewImage}
                resizeMode="cover"
                onError={() => setPreviewError(true)}
                onLoadEnd={() => setPreviewError(false)}
              />
              {previewError ? (
                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 6 }}>Preview failed. Use a direct HTTPS image link.</Text>
              ) : null}
              <Text style={styles.bannerLink} numberOfLines={1}>{bannerLink || 'No link set'}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.button, { marginBottom: 8 }]}
            onPress={async () => {
              if (!bannerUrl.trim()) return show('Please enter a banner image URL', { type: 'error' });
              let updated: any[];
              if (editingBannerIndex !== null) {
                updated = banners.map((b, i) => (i === editingBannerIndex ? { image: bannerUrl, link: bannerLink, cta: bannerCta } : b));
                setEditingBannerIndex(null);
              } else {
                updated = [...banners, { image: bannerUrl, link: bannerLink, cta: bannerCta }];
              }
              setBanners(updated);
              setBannerUrl('');
              setBannerLink('');
              setBannerCta('');
              setPreviewError(false);
              try {
                await saveBanners(updated);
                show('Banners saved', { type: 'success' });
              } catch (e) {
                show('Failed to save banners', { type: 'error' });
              }
            }}
          >
            <Text style={styles.buttonText}>{editingBannerIndex !== null ? 'Update Banner' : 'Add Banner'}</Text>
          </TouchableOpacity>
          {banners.length === 0 ? (
            <Text style={styles.emptyText}>No banners added yet.</Text>
          ) : (
            <View style={{ gap: 12 }}>
              {banners.map((banner, idx) => {
                const image = (banner as any)?.image || banner;
                const link = (banner as any)?.link || '';
                return (
                  <View key={idx} style={styles.bannerRow}>
                    <View style={styles.bannerThumb}>
                      {image ? <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bannerUrl} numberOfLines={1}>{image}</Text>
                      {link ? <Text style={styles.bannerLink} numberOfLines={1}>{link}</Text> : null}
                      { (banner as any)?.cta ? <Text style={styles.bannerCta} numberOfLines={1}>CTA: {(banner as any)?.cta}</Text> : null}
                    </View>
                    <View style={styles.bannerActions}>
                      <TouchableOpacity onPress={() => { setBannerUrl(image); setBannerLink(link); setBannerCta((banner as any)?.cta || ''); setEditingBannerIndex(idx); setPreviewError(false); }} style={styles.iconBtn}>
                        <FontAwesome5 name="edit" size={12} color="#0B6E6B" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={async () => {
                          const updated = banners.filter((_, i) => i !== idx);
                          setBanners(updated);
                          try {
                            await saveBanners(updated);
                            show('Banner removed', { type: 'success' });
                          } catch (e) {
                            show('Failed to update banners', { type: 'error' });
                          }
                        }}
                        style={[styles.iconBtn, { backgroundColor: '#FEF2F2' }]}
                      >
                        <FontAwesome5 name="trash" size={12} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.sectionTitle}>Categories</Text>
              <Text style={styles.sectionSub}>Create categories and reuse them on products.</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              placeholder="New category name"
              value={categoryInput}
              onChangeText={setCategoryInput}
              style={[styles.input, { flex: 1 }]}
            />
            <TouchableOpacity
              style={[styles.button, { paddingVertical: 12 }]}
              onPress={async () => {
                const trimmed = categoryInput.trim();
                if (!trimmed) return;
                try {
                  if (editingCategoryId) {
                    const existing = categories.find((c) => c.id === editingCategoryId);
                    await updateCategory(editingCategoryId, trimmed);
                    setCategories((prev) => prev.map((cat) => (cat.id === editingCategoryId ? { ...cat, name: trimmed } : cat)));
                    setCategoriesSelected((prev) => prev.map((name) => (existing && name === existing.name ? trimmed : name)));
                    if (existing && category === existing.name) setCategory(trimmed);
                    show('Category updated', { type: 'success' });
                  } else {
                    const created = await createCategory(trimmed);
                    setCategories((prev) => [...prev, created]);
                    show('Category added', { type: 'success' });
                  }
                  setCategoryInput('');
                  setEditingCategoryId(null);
                } catch (e: any) {
                  show(e?.message || 'Could not save category', { type: 'error' });
                }
              }}
            >
              <Text style={styles.buttonText}>{editingCategoryId ? 'Update' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
          {editingCategoryId ? (
            <Text style={styles.helperTextSmall}>Editing existing category. Save or cancel to reset.</Text>
          ) : null}
          {categories.length ? (
            <View style={styles.categoryList}>
              {categories.map((cat) => (
                <View key={cat.id} style={styles.categoryRow}>
                  <TouchableOpacity
                    style={[styles.catChip, category === cat.name && styles.catChipActive]}
                    onPress={() => setCategory(cat.name)}
                  >
                    <Text style={[styles.catChipText, category === cat.name && { color: '#fff' }]}>{cat.name}</Text>
                  </TouchableOpacity>
                  <View style={styles.bannerActions}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingCategoryId(cat.id);
                        setCategoryInput(cat.name);
                      }}
                      style={styles.iconBtn}
                    >
                      <FontAwesome5 name="edit" size={12} color="#0B6E6B" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteCategory(cat)}
                      style={[styles.iconBtn, { backgroundColor: '#FEF2F2' }]}
                    >
                      <FontAwesome5 name="trash" size={12} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No categories yet.</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.sectionTitle}>{editingProduct ? 'Update Product' : 'Create Product'}</Text>
              <Text style={styles.sectionSub}>Add new toilets or edit existing listings.</Text>
            </View>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://imgbb.com/')}
              style={styles.linkChip}
            >
              <FontAwesome5 name="external-link-alt" size={12} color="#0B6E6B" />
              <Text style={styles.linkChipText}>Image to URL</Text>
            </TouchableOpacity>
          </View>
          <TextInput placeholder="Title" value={title} onChangeText={setTitle} style={styles.input} />
          <TextInput placeholder="Price" value={price} onChangeText={setPrice} style={styles.input} keyboardType="numeric" />
          <TextInput placeholder="Image URL (optional)" value={imageUrl} onChangeText={setImageUrl} style={styles.input} />
          <Text style={styles.helperTextSmall}>
            Tip: Use a direct HTTPS image link (imgbb “Direct Link” works great) for instant preview in the product card.
          </Text>
          <TextInput
            placeholder="Additional image URLs (comma or new line separated)"
            value={imagesInput}
            onChangeText={setImagesInput}
            style={[styles.input, { height: 80 }]}
            multiline
          />
          {categories.length ? (
            <View style={{ gap: 8, marginBottom: 4 }}>
              <Text style={styles.helperTextSmall}>Select up to 4 categories</Text>
              <View style={styles.chipRow}>
                {categories.map((cat) => {
                  const active = categoriesSelected.includes(cat.name);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catChip, active && styles.catChipActive]}
                      onPress={() => {
                        if (active) {
                          setCategoriesSelected((prev) => prev.filter((c) => c !== cat.name));
                        } else {
                          setCategoriesSelected((prev) => (prev.length >= 4 ? prev : [...prev, cat.name]));
                        }
                      }}
                    >
                      <Text style={[styles.catChipText, active && { color: '#fff' }]}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <TextInput placeholder="Category (e.g. VIP, Standard)" value={category} onChangeText={setCategory} style={styles.input} />
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.catChip, inStock ? styles.catChipActive : null]}
              onPress={() => setInStock(true)}
            >
              <FontAwesome5 name="check-circle" size={12} color={inStock ? '#fff' : '#0B6E6B'} />
              <Text style={[styles.catChipText, inStock && { color: '#fff' }]}>In stock</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.catChip, !inStock ? styles.catChipActive : null]}
              onPress={() => setInStock(false)}
            >
              <FontAwesome5 name="times-circle" size={12} color={!inStock ? '#fff' : '#0B6E6B'} />
              <Text style={[styles.catChipText, !inStock && { color: '#fff' }]}>Out of stock</Text>
            </TouchableOpacity>
          </View>
          <TextInput placeholder="Description" value={description} onChangeText={setDescription} style={[styles.input, { height: 100 }]} multiline />
          <TouchableOpacity style={[styles.button, submitting && { opacity: 0.7 }]} onPress={saveProduct} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.sectionTitle}>Products</Text>
              <View style={styles.countPill}><Text style={styles.countPillText}>{products.length}</Text></View>
            </View>
          </View>
          {loadingProducts ? (
            <Text style={styles.emptyText}>Loading products...</Text>
          ) : products.length === 0 ? (
            <Text style={styles.emptyText}>No products found.</Text>
          ) : (
            products.map((prod) => (
              <View key={prod.id} style={styles.productRow}>
                <View style={styles.productThumb}>
                  {prod.imageUrl ? (
                    <Image source={{ uri: prod.imageUrl }} style={{ width: '100%', height: '100%', borderRadius: 10 }} resizeMode="cover" />
                  ) : (
                    <FontAwesome5 name="image" size={22} color="#0B6E6B" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productTitle}>{prod.title}</Text>
                  <Text style={styles.productPrice}>NGN {prod.price}</Text>
                  <View style={styles.metaRow}>
                    {prod.categories && prod.categories.length
                      ? prod.categories.slice(0, 2).map((cat) => (
                          <Text key={cat} style={styles.metaChip}>{cat}</Text>
                        ))
                      : prod.category
                      ? <Text style={styles.metaChip}>{prod.category}</Text>
                      : null}
                    <Text style={[styles.metaChip, { backgroundColor: prod.inStock === false ? '#FEF2F2' : '#E6F4F3', color: prod.inStock === false ? '#EF4444' : '#0B6E6B' }]}>
                      {prod.inStock === false ? 'Out of stock' : 'In stock'}
                    </Text>
                  </View>
                  {prod.description ? <Text style={styles.productDesc} numberOfLines={2}>{prod.description}</Text> : null}
                </View>
                <View style={styles.productActions}>
                  <TouchableOpacity onPress={() => startEditProduct(prod)} style={styles.actionBtn}>
                    <FontAwesome5 name="edit" size={12} color="#0B6E6B" />
                    <Text style={styles.actionBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteProduct(prod.id)} style={[styles.actionBtn, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}>
                    <FontAwesome5 name="trash" size={12} color="#EF4444" />
                    <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Orders</Text>
            <Text style={styles.sectionSub}>Live updates. Tap a status to change.</Text>
          </View>
          {loadingOrders ? (
            <Text style={styles.emptyText}>Loading orders...</Text>
          ) : orders.length === 0 ? (
            <Text style={styles.emptyText}>No orders yet.</Text>
          ) : (
            orders.map((order) => {
              const chip = statusChip(order.status);
              return (
                <View key={order.id} style={styles.orderRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.orderTitle}>{order.productTitle || order.productId}</Text>
                    {order.customerName || order.customerAddress || order.customerPhone ? (
                      <Text style={styles.orderMeta}>
                        {order.customerName ? `${order.customerName} • ` : ''}
                        {order.customerPhone ? `${order.customerPhone} • ` : ''}
                        {order.customerAddress || ''}
                      </Text>
                    ) : null}
                    <Text style={styles.orderMeta}>Type: {order.type}</Text>
                    <Text style={styles.orderMeta}>Payment: {order.paymentMethod}</Text>
                    <View style={[styles.statusChip, { backgroundColor: chip.bg }]}>
                      <Text style={[styles.statusChipText, { color: chip.color }]}>{chip.label}</Text>
                    </View>
                    {order.price ? <Text style={styles.orderPrice}>NGN {order.price}</Text> : null}
                    {order.reference ? <Text style={styles.orderMeta}>Ref: {order.reference}</Text> : null}
                    {order.rentalStartDate || order.rentalEndDate ? (
                      <Text style={styles.orderMeta}>
                        Rental: {order.rentalStartDate || '—'} to {order.rentalEndDate || '—'}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.orderActions}>
                    {[
                      { label: 'Processing', value: 'processing' },
                      { label: 'Dispatched', value: 'dispatched' },
                      { label: 'In transit', value: 'in_transit' },
                      { label: order.type === 'rent' ? 'Returning' : 'Delivered', value: order.type === 'rent' ? 'returning' : 'delivered' },
                      { label: 'Completed', value: 'completed' },
                    ].map((btn) => (
                      <TouchableOpacity
                        key={btn.value}
                        onPress={() => updateOrderStatus(order.id, btn.value)}
                        style={[styles.orderActionBtn, btn.value === 'completed' && styles.orderActionPrimary]}
                        disabled={updatingOrder === order.id}
                      >
                        <Text style={[styles.orderActionText, btn.value === 'completed' && { color: '#fff' }]}>
                          {updatingOrder === order.id ? 'Updating...' : btn.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => cancelOrder(order.id)}
                        style={[styles.orderActionBtn, { borderColor: '#EF4444', backgroundColor: '#FEF2F2' }]}
                        disabled={updatingOrder === order.id}
                      >
                        <Text style={[styles.orderActionText, { color: '#EF4444' }]}>
                          {updatingOrder === order.id ? 'Updating...' : 'Cancel'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteOrder(order.id)}
                        style={[styles.orderActionBtn, { borderColor: '#0F172A', backgroundColor: '#0F172A' }]}
                        disabled={updatingOrder === order.id}
                      >
                        <Text style={[styles.orderActionText, { color: '#fff' }]}>
                          {updatingOrder === order.id ? 'Deleting...' : 'Delete'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={newOrderModal.visible} transparent animationType="fade" onRequestClose={() => setNewOrderModal({ visible: false })}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={styles.modalIcon}>
                <FontAwesome5 name="bell" size={14} color="#0B6E6B" />
              </View>
              <Text style={styles.modalTitle}>New order received</Text>
            </View>
            <Text style={styles.modalText}>
              {newOrderModal.order?.productTitle || newOrderModal.order?.productId || 'New order'} •{' '}
              {newOrderModal.order?.customerName || 'Customer'}
            </Text>
            {newOrderModal.order?.customerAddress ? (
              <Text style={[styles.modalText, { color: '#475569' }]}>Deliver to: {newOrderModal.order.customerAddress}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setNewOrderModal({ visible: false })}
                style={[styles.orderActionBtn, { paddingHorizontal: 12 }]}
              >
                <Text style={styles.orderActionText}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setNewOrderModal({ visible: false });
                  // scroll to orders section or simply keep focus
                }}
                style={[styles.orderActionBtn, styles.orderActionPrimary, { paddingHorizontal: 12 }]}
              >
                <Text style={[styles.orderActionText, { color: '#fff' }]}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ title, value, icon, accent }: { title: string; value: any; icon: any; accent?: boolean }) {
  return (
    <View style={[styles.statCard, accent && { backgroundColor: '#0B6E6B' }]}>
      <View style={styles.statIcon}>
        <FontAwesome5 name={icon} size={12} color={accent ? '#0B6E6B' : '#0B6E6B'} />
      </View>
      <Text style={[styles.statTitle, accent && { color: '#d9f5f4' }]}>{title}</Text>
      <Text style={[styles.statValue, accent && { color: '#fff' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFBFB' },
  container: { flex: 1, backgroundColor: '#FAFBFB' },
  pageEyebrow: { color: '#0B6E6B', fontWeight: '700', fontSize: 12 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#0B6E6B' },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topActions: { flexDirection: 'row', gap: 8 },
  navChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E6F4F3',
    borderWidth: 1,
    borderColor: '#D1E7E5',
  },
  navChipText: { color: '#0B6E6B', fontWeight: '700', fontSize: 12 },
  statGrid: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    gap: 6,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E6F4F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTitle: { fontSize: 12, color: '#475569', fontWeight: '600' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#0B6E6B' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0B6E6B' },
  sectionSub: { fontSize: 12, color: '#475569' },
  title: { fontSize: 20, fontWeight: '700', color: '#0B6E6B', marginBottom: 12 },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E6F4F3',
    borderColor: '#0B6E6B',
    borderWidth: 1,
  },
  countPillText: { color: '#0B6E6B', fontWeight: '800', fontSize: 12 },
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  button: { backgroundColor: '#0B6E6B', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  linkChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#E6F4F3', borderWidth: 1, borderColor: '#D1E7E5' },
  linkChipText: { color: '#0B6E6B', fontWeight: '700', fontSize: 12 },
  emptyText: { color: '#666', marginVertical: 8 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  bannerThumb: { width: 80, height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: '#e0e0e0' },
  bannerUrl: { flex: 1, fontSize: 13, color: '#0B6E6B' },
  bannerCta: { fontSize: 12, color: '#0B6E6B', fontWeight: '600' },
  bannerLink: { fontSize: 12, color: '#475569' },
  bannerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3F7F7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    gap: 12,
  },
  productThumb: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#E6F4F3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1E7E5',
  },
  productTitle: { fontSize: 15, fontWeight: '700', color: '#0B6E6B' },
  productPrice: { fontSize: 13, color: '#0B6E6B', fontWeight: '700', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaChip: { fontSize: 11, color: '#475569', backgroundColor: '#F3F7F7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  productDesc: { fontSize: 12, color: '#475569', marginTop: 4 },
  productActions: { gap: 6 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#0B6E6B',
    backgroundColor: '#E6F4F3',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: { color: '#0B6E6B', fontWeight: '700', fontSize: 12 },
  orderRow: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 10, flexDirection: 'row', justifyContent: 'space-between' },
  orderTitle: { fontWeight: '800', fontSize: 15, color: '#0B6E6B' },
  orderMeta: { color: '#1E293B', fontSize: 12 },
  orderPrice: { color: '#0B6E6B', fontWeight: '700' },
  statusChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusChipText: { fontWeight: '700', fontSize: 12 },
  orderActions: { gap: 6, alignItems: 'flex-end', flex: 1 },
  orderActionBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#F3F7F7' },
  orderActionPrimary: { backgroundColor: '#0B6E6B', borderColor: '#0B6E6B' },
  orderActionText: { color: '#0B6E6B', fontWeight: '700', fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  modalIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E6F4F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontWeight: '800', fontSize: 16, color: '#0B6E6B' },
  modalText: { fontSize: 13, color: '#0F172A' },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  previewImage: { width: 90, height: 50, borderRadius: 8, backgroundColor: '#e0e0e0' },
  helperTextSmall: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 8,
  },
  categoryList: { gap: 8, marginTop: 8 },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 8,
    backgroundColor: '#F8FAFC',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F3F7F7',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  catChipActive: {
    backgroundColor: '#0B6E6B',
    borderColor: '#0B6E6B',
  },
  catChipText: { color: '#0B6E6B', fontWeight: '700', fontSize: 12 },
});
