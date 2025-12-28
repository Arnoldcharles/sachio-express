import React, { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Animated,
  Easing,
  View,
  Text,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  Modal,
  TouchableWithoutFeedback,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { getProducts, Product } from "../lib/products";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import { FontAwesome } from "@expo/vector-icons";
import { auth } from "../lib/firebase";

const CART_KEY = "cart_items";
const rentish = (val?: string | null) =>
  !!val && val.toLowerCase().includes("rent");

export default function ProductPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [cardAnim] = useState(new Animated.Value(0));
  const outOfStock = product?.inStock === false;
  const [cartCount, setCartCount] = useState(0);
  const [inCart, setInCart] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const isRentProduct = useMemo(
    () =>
      rentish(product?.category) ||
      (product?.categories || []).some((c) => rentish(c)),
    [product]
  );

  const addToCart = async () => {
    if (!product) return;
    if (inCart) return;
    if (!auth.currentUser) {
      alert("Please log in to continue.");
      router.push("/auth/login");
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(CART_KEY);
      const parsed = raw ? (JSON.parse(raw) as any[]) : [];
      const idx = parsed.findIndex((p) => p.id === product.id);
      if (idx >= 0) {
        parsed[idx].qty = (parsed[idx].qty || 1) + quantity;
      } else {
        parsed.push({
          id: product.id,
          title: product.title,
          price: product.price,
          imageUrl:
            product.imageUrl || (product.images && product.images[0]) || "",
          qty: quantity,
        });
      }
      await AsyncStorage.setItem(CART_KEY, JSON.stringify(parsed));
      const count = parsed.reduce((sum, item) => sum + (item.qty || 1), 0);
      setCartCount(count);
      setInCart(true);
    } catch (e) {
      // ignore cart errors
    }
  };

  const loadCartState = useCallback(async () => {
    const raw = await AsyncStorage.getItem(CART_KEY);
    const parsed = raw ? (JSON.parse(raw) as any[]) : [];
    const count = parsed.reduce((sum, item) => sum + (item.qty || 1), 0);
    setCartCount(count);
    setInCart(!!parsed.find((item) => item.id === product?.id));
  }, [product?.id]);

  const gallery = useMemo(() => {
    const urls: string[] = [];
    if (product?.images && Array.isArray(product.images)) {
      product.images.forEach((u) => {
        const s = (u || "").trim();
        if (s) urls.push(s);
      });
    }
    if (!urls.length && product?.imageUrl) {
      const s = (product.imageUrl || "").trim();
      if (s) urls.push(s);
    }
    return Array.from(new Set(urls));
  }, [product]);

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      const products = await getProducts();
      const found = products.find((p) => p.id === id);
      setProduct(found || null);
      setLoading(false);
    }
    fetchProduct();
    loadCartState();
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
    // Load favorite state from AsyncStorage
    AsyncStorage.getItem(`fav_${id}`).then((val) => {
      setFavorite(val === "true");
    });
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadCartState();
    }, [loadCartState])
  );

  useEffect(() => {
    if (!product) return;
    getProducts().then((all) => {
      if (product.category) {
        setRecommended(
          all
            .filter((p) => p.category === product.category && p.id !== id)
            .slice(0, 10)
        );
      } else {
        setRecommended(all.filter((p) => p.id !== id).slice(0, 10));
      }
    });
  }, [product, id]);

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={colors.background}
        />
        <View style={styles.container}>
          <View style={styles.imageSkeleton} />
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, { width: 140 }]} />
        </View>
      </SafeAreaView>
    );
  }
  if (!product)
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={colors.background}
        />
        <View style={[styles.container, { justifyContent: "center" }]}>
          <Text style={styles.emptyTitle}>Product not found.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace("/(tabs)/home")}
          >
            <Text style={styles.primaryBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => router.back()}
          >
            <FontAwesome5 name="arrow-left" size={16} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={styles.cartIconWrap}>
              <TouchableOpacity
                style={styles.circleBtn}
                onPress={() => router.push("/cart")}
              >
                <FontAwesome5
                  name="shopping-cart"
                  size={16}
                  color={colors.primary}
                />
              </TouchableOpacity>
              {cartCount > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.circleBtn}
              onPress={async () => {
                const newFav = !favorite;
                setFavorite(newFav);
                await AsyncStorage.setItem(
                  `fav_${id}`,
                  newFav ? "true" : "false"
                );
              }}
            >
              <FontAwesome
                name={favorite ? "heart" : "heart-o"}
                size={18}
                color={favorite ? colors.danger : colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero image */}
        <Animated.View
          style={[
            styles.heroCard,
            {
              opacity: cardAnim,
              transform: [
                {
                  scale: cardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              setLightboxIndex(0);
              setLightboxVisible(true);
            }}
          >
            {gallery.length ? (
              <Image
                source={{ uri: gallery[lightboxIndex] }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.heroImage, styles.imageFallback]}>
                <FontAwesome5 name="toilet" size={56} color={colors.primary} />
              </View>
            )}
          </TouchableOpacity>

          {/* Thumbnails */}
          {gallery.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbRow}
            >
              {gallery.map((img, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setLightboxIndex(idx)}
                  style={[
                    styles.thumbItem,
                    lightboxIndex === idx && styles.thumbItemActive,
                  ]}
                >
                  <Image
                    source={{ uri: img }}
                    style={styles.thumbImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </Animated.View>

        {/* Content */}
        <View style={styles.detailCard}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{product.title}</Text>
              <View style={styles.metaPills}>
                {product.category ? (
                  <View style={styles.chip}>
                    <FontAwesome5
                      name="tags"
                      size={12}
                      color={colors.primary}
                    />
                    <Text style={styles.chipText}>{product.category}</Text>
                  </View>
                ) : null}
                <View style={styles.chip}>
                  <FontAwesome5
                    name="check-circle"
                    size={12}
                    color={colors.primary}
                  />
                  <Text style={styles.chipText}>
                    {outOfStock ? "Out of stock" : "In stock"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          {!isRentProduct ? (
            <View style={styles.pricePillRow}>
              <View style={styles.pricePill}>
                <Text style={styles.priceLarge}>
                  {product.price != null && product.price !== ""
                    ? `NGN ${Number(product.price).toLocaleString()}`
                    : "Contact"}
                </Text>
              </View>
            </View>
          ) : null}

          {outOfStock ? (
            <View style={styles.alertBox}>
              <FontAwesome5
                name="exclamation-circle"
                size={14}
                color={colors.danger}
              />
              <Text style={styles.alertText}>
                This item is currently out of stock and cannot be purchased.
              </Text>
            </View>
          ) : null}

          {/* Description */}
          <View style={{ marginTop: 8 }}>
            <Text style={styles.desc}>
              {showFullDesc || (product.description || "").length < 220
                ? product.description
                : `${(product.description || "").slice(0, 220)}...`}
            </Text>
            <TouchableOpacity onPress={() => setShowFullDesc((v) => !v)}>
              <Text style={styles.moreLink}>
                {showFullDesc ? "Hide description" : "More Description"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quantity */}
          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <View style={styles.qtyControl}>
              <TouchableOpacity
                style={[styles.qtyBtn, quantity <= 1 && { opacity: 0.5 }]}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <FontAwesome5 name="minus" size={12} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => q + 1)}
              >
                <FontAwesome5 name="plus" size={12} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.primaryActions}>
            <TouchableOpacity
              style={[
                styles.ctaButton,
                styles.purchaseBtn,
                (outOfStock || inCart) && styles.buttonDisabled,
              ]}
              disabled={outOfStock || inCart}
              onPress={() => {
                if (outOfStock || inCart) return;
                if (!auth.currentUser) {
                  alert("Please log in to continue.");
                  router.push("/auth/login");
                  return;
                }
                addToCart();
                router.push("/cart");
              }}
            >
              <Text style={styles.ctaText}>
                {inCart ? "In Cart" : "Purchase"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Share */}
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => {
              const shareText = isRentProduct
                ? `Book this toilet: ${product.title}`
                : `Check out this product: ${product.title} for NGN ${product.price}`;
              Share.share({
                title: product.title,
                message: shareText,
                url: product.imageUrl || "",
              }).catch(() => {
                alert("Share not supported on this device");
              });
            }}
          >
            <FontAwesome5 name="share" size={14} color={colors.primary} />
            <Text style={styles.shareText}>Share</Text>
          </TouchableOpacity>

          {/* Recommended Products Section */}
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>Recommended</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 6 }}
            >
              {recommended.length === 0 ? (
                <Text style={{ color: colors.muted, marginLeft: 12 }}>
                  No recommendations yet.
                </Text>
              ) : (
                recommended.map((prod) => (
                  <TouchableOpacity
                    key={prod.id}
                    style={styles.relatedCard}
                    onPress={() => router.push(`/product?id=${prod.id}`)}
                  >
                    {prod.imageUrl ? (
                      <Image
                        source={{ uri: prod.imageUrl }}
                        style={{
                          width: 70,
                          height: 70,
                          borderRadius: 10,
                          marginBottom: 6,
                        }}
                      />
                    ) : (
                      <FontAwesome5
                        name="toilet"
                        size={32}
                        color={colors.primary}
                        style={{ marginBottom: 6 }}
                      />
                    )}
                    <Text style={styles.relatedText} numberOfLines={2}>
                      {prod.title}
                    </Text>
                    {!rentish(prod.category) &&
                    !(prod.categories || []).some(rentish) ? (
                      <Text style={styles.relatedPrice} numberOfLines={1}>
                        {prod.price != null && prod.price !== ""
                          ? `NGN ${Number(prod.price).toLocaleString()}`
                          : "View"}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
        <View style={styles.spacerBottom} />
      </ScrollView>
      <Modal
        visible={lightboxVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxVisible(false)}
      >
        <View style={styles.lightboxBackdrop}>
          <TouchableWithoutFeedback onPress={() => setLightboxVisible(false)}>
            <View style={styles.lightboxCloseArea} />
          </TouchableWithoutFeedback>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: lightboxIndex * 360, y: 0 }}
            style={styles.lightboxScroller}
          >
            {gallery.map((img, idx) => (
              <View key={idx} style={styles.lightboxSlide}>
                <Image
                  source={{ uri: img }}
                  style={styles.lightboxImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.lightboxClose}
            onPress={() => setLightboxVisible(false)}
          >
            <FontAwesome5 name="times" size={16} color={colors.primary} />
            <Text style={styles.lightboxCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    badgeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      marginBottom: 8,
    },
    featuredBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 8,
      alignSelf: "flex-start",
      backgroundColor: colors.primary,
    },
    badgeText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
    favoriteBtn: {
      padding: 6,
    },
    ratingsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    ratingsText: {
      fontSize: 13,
      color: colors.muted,
      marginLeft: 8,
    },
    buttonOutline: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 8,
    },
    buttonOutlineText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "bold",
    },
    relatedSection: {
      marginTop: 24,
      width: "100%",
    },
    relatedTitle: {
      fontSize: 17,
      fontWeight: "bold",
      color: colors.primary,
      marginBottom: 8,
    },
    relatedCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      marginRight: 12,
      alignItems: "center",
      width: 100,
    },
    relatedText: {
      fontSize: 13,
      color: colors.text,
      marginTop: 6,
      textAlign: "center",
    },
    actionsVertical: {
      flexDirection: "column",
      gap: 14,
      marginTop: 8,
      justifyContent: "center",
      alignItems: "stretch",
      width: "100%",
    },
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 24,
      alignItems: "stretch",
    },
    breadcrumbsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      alignSelf: "stretch",
    },
    backBtn: { marginRight: 10, padding: 6 },
    breadcrumbs: { fontSize: 14, color: colors.primary, fontWeight: "600" },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginTop: 8,
      marginBottom: 16,
      shadowColor: isDark ? "#000" : colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
      alignItems: "center",
      width: "100%",
    },
    imageCard: {
      width: 320,
      height: 260,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      marginRight: 12,
      shadowColor: isDark ? "#000" : colors.primary,
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    imageFallback: {
      width: 320,
      height: 260,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.primary,
      marginBottom: 10,
      backgroundColor: colors.surface,
      justifyContent: "center",
      alignItems: "center",
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      alignSelf: "stretch",
      marginVertical: 16,
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 16,
      marginBottom: 8,
    },
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    metaText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: "600",
    },
  title: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
    color: colors.text,
    textAlign: "left",
  },
    price: {
      fontSize: 20,
      color: colors.primary,
      marginBottom: 8,
      textAlign: "center",
    },
    desc: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      marginBottom: 16,
      textAlign: "left",
    },
    ctaBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.surface,
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexDirection: "row",
      gap: 10,
      justifyContent: "center",
    },
    spacerBottom: {
      height: 80,
    },
    actions: {
      flexDirection: "row",
      gap: 16,
      marginTop: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
    buttonDisabled: { opacity: 0.5 },
    imageSkeleton: {
      backgroundColor: isDark ? "#1f2937" : "#e0e0e0",
      borderRadius: 16,
      marginBottom: 16,
      width: 260,
      height: 260,
    },
    skeletonLine: {
      height: 12,
      backgroundColor: colors.border,
      borderRadius: 8,
      marginBottom: 8,
      width: 180,
    },
    priceCard: {
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    priceLabel: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 4,
      fontWeight: "600",
    },
    priceActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 6,
      flexWrap: "wrap",
    },
    miniPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    miniPillText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: "600",
    },
    highlights: {
      alignSelf: "stretch",
      gap: 10,
    },
    alertBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: isDark ? "#2a1414" : "#FEF2F2",
      borderColor: isDark ? "#7f1d1d" : "#FECACA",
      borderWidth: 1,
      padding: 10,
      borderRadius: 10,
      marginBottom: 10,
      alignSelf: "stretch",
    },
    alertText: {
      color: colors.danger,
      fontWeight: "700",
      flex: 1,
      fontSize: 12,
    },
    highlightsTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.primary,
    },
    highlightItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    highlightText: {
      fontSize: 13,
      color: colors.text,
    },
    relatedPrice: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
      textAlign: "center",
    },
    metaPills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      alignSelf: "stretch",
      marginBottom: 10,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: isDark ? "#0f1f1e" : "#E6F4F3",
    },
    chipText: {
      color: colors.primary,
      fontWeight: "600",
      fontSize: 12,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primary,
      marginVertical: 12,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 10,
    },
    primaryBtnText: {
      color: "#fff",
      fontWeight: "700",
    },
    lightboxBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.82)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    lightboxScroller: { flexGrow: 0 },
    lightboxSlide: {
      width: 360,
      height: 360,
      justifyContent: "center",
      alignItems: "center",
    },
    lightboxImage: { width: "100%", height: "100%" },
    lightboxClose: {
      position: "absolute",
      top: 30,
      right: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    lightboxCloseText: { color: colors.primary, fontWeight: "700" },
    lightboxCloseArea: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 6,
      marginBottom: 6,
    },
    circleBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    cartIconWrap: {
      position: "relative",
    },
    cartBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      backgroundColor: colors.danger,
      borderRadius: 999,
      paddingHorizontal: 5,
      minWidth: 16,
      height: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    cartBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
    heroCard: {
      marginHorizontal: 16,
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: isDark ? "#000" : colors.primary,
      shadowOpacity: isDark ? 0.2 : 0.06,
      shadowRadius: 10,
      elevation: 2,
      padding: 12,
      marginBottom: 12,
    },
    heroImage: {
      width: "100%",
      height: 280,
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    thumbRow: { gap: 10, paddingTop: 12 },
    thumbItem: {
      width: 60,
      height: 60,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      marginRight: 8,
    },
    thumbItemActive: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    thumbImage: { width: "100%", height: "100%" },
    detailCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: 16,
      paddingVertical: 16,
      paddingHorizontal: 18,
      shadowColor: isDark ? "#000" : colors.primary,
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  pricePillRow: {
    marginBottom: 10,
  },
  priceLarge: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary,
  },
  pricePill: {
    alignSelf: "flex-start",
    backgroundColor: isDark ? "#0f1f1e" : "#E6F4F3",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
    moreLink: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 13,
      marginBottom: 6,
    },
    qtyRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 12,
    },
    qtyLabel: { fontSize: 14, color: colors.text, fontWeight: "700" },
    qtyControl: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    qtyBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? "#0f1f1e" : "#E6F4F3",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    qtyValue: { fontWeight: "800", color: colors.text, fontSize: 14 },
    primaryActions: {
      flexDirection: "row",
      gap: 12,
      marginTop: 16,
    },
    ctaButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    purchaseBtn: { backgroundColor: isDark ? "#FBBF24" : "#F6B22F" },
    rentBtn: { backgroundColor: colors.primary },
    ctaText: { color: "#fff", fontWeight: "800", fontSize: 15 },
    shareBtn: {
      marginTop: 12,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    shareText: { color: colors.primary, fontWeight: "700" },
  });
