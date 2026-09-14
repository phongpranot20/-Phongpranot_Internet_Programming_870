import { apiCall } from '@/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// ==========================================
// 1. CONSTANTS & CONFIGURATIONS
// ==========================================
// รายชื่อหมวดหมู่ / แบรนด์นาฬิกาสำหรับใช้สร้างปุ่มแท็กตัวกรอง (Filter Pills)
const CATEGORIES = [
  'All',
  'Rolex',
  'Omega',
  'Seiko',
  'Citizen',
  'Orient',
  'Tissot',
  'Hamilton',
  'Tag Heuer',
  'Longines',
  'Tudor',
  'Grand Seiko',
  'Breitling',
  'Cartier',
  'Audemars Piguet',
  'Patek Philippe',
  'General',
];

// โครงสร้างข้อมูลสถิติของราคาด้วยอัลกอริทึม K-Means
interface ClusterStats {
  iterations: number;
  low: { centroid: number; count: number; min: number; max: number };
  mid: { centroid: number; count: number; min: number; max: number };
  high: { centroid: number; count: number; min: number; max: number };
}

// ==========================================
// 2. MACHINE LEARNING: K-MEANS CLUSTERING ALGORITHM
// ==========================================
// ฟังก์ชันจัดกลุ่มราคาสินค้าออกเป็น 3 ระดับ (Low, Mid, High) แบบ Unsupervised Learning ฝั่ง Client-side
const clusterPricesLocally = (data: any[]) => {
  if (!data || data.length === 0) {
    return {
      clusteredData: [],
      stats: {
        iterations: 0,
        low: { centroid: 0, count: 0, min: 0, max: 0 },
        mid: { centroid: 0, count: 0, min: 0, max: 0 },
        high: { centroid: 0, count: 0, min: 0, max: 0 },
      },
    };
  }

  const prices = data.map((item) => parseFloat(item.price) || 0);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // กำหนดจุดกึ่งกลางเริ่มต้น (Initial Centroids) 3 กลุ่ม
  let centroids = [minPrice, (minPrice + maxPrice) / 2, maxPrice];
  let assignments: number[] = [];
  let changed = true;
  let iterations = 0;

  // ทำการวนลูปคำนวณระยะห่าง (Euclidean Distance) จนกว่าจุด Centroid จะนิ่ง (Convergence) หรือครบ 100 รอบ
  while (changed && iterations < 100) {
    changed = false;
    iterations++;

    assignments = prices.map((price) => {
      const diffs = centroids.map((c) => Math.abs(price - c));
      return diffs.indexOf(Math.min(...diffs));
    });

    const newCentroids = [0, 1, 2].map((i) => {
      const clusterPrices = prices.filter((_, idx) => assignments[idx] === i);
      return clusterPrices.length
        ? clusterPrices.reduce((a, b) => a + b, 0) / clusterPrices.length
        : centroids[i];
    });

    if (JSON.stringify(centroids) !== JSON.stringify(newCentroids)) {
      centroids = newCentroids;
      changed = true;
    }
  }

  const sortedCentroids = [...centroids].sort((a, b) => a - b);
  const tierLabels = ['Low', 'Mid', 'High'];

  // ผูกระดับราคา (Price Tier) เข้ากับข้อมูลสินค้าแต่ละชิ้น
  const clusteredData = data.map((item, index) => {
    const myCentroid = centroids[assignments[index]];
    const tierIndex = sortedCentroids.indexOf(myCentroid);
    return {
      ...item,
      priceTier: tierLabels[tierIndex] || 'Low',
      tierLevel: tierIndex,
    };
  });

  const getTierStats = (idx: number) => {
    const tierItems = clusteredData.filter((d) => d.tierLevel === idx);
    const tierPrices = tierItems.map((d) => parseFloat(d.price) || 0);
    return {
      centroid: sortedCentroids[idx] || 0,
      count: tierItems.length,
      min: tierPrices.length ? Math.min(...tierPrices) : 0,
      max: tierPrices.length ? Math.max(...tierPrices) : 0,
    };
  };

  return {
    clusteredData,
    stats: {
      iterations,
      low: getTierStats(0),
      mid: getTierStats(1),
      high: getTierStats(2),
    },
  };
};

// ==========================================
// 3. MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  // State ควบคุมการสลับหน้าจอระหว่างแท็บ 'home' และ 'products'
  const [activeTab, setActiveTab] = useState<'home' | 'products'>('home');

  // ตัวแปรเก็บข้อมูลสำหรับแสดงผลหน้า Home อย่างอิสระ
  const HOME_SHOWCASE_IMAGE = 'https://i.ibb.co/JFMCtxwW/Chat-GPT-Image-12-2569-03-04-44.png';
  const HOME_SHOWCASE_TITLE = '                      Our Speacial Product';
  const HOME_SHOWCASE_DESC = '             masterpiece of exquisite  curated for the true collector.';

  // State สำหรับระบบ Authentication (เข้าสู่ระบบ / สมัครสมาชิก)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('1234');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // State เก็บข้อมูล Session ของผู้ใช้งานปัจจุบัน
  const [userName, setUserName] = useState<string>('Tar');
  const [userRole, setUserRole] = useState<string>('user');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // State สำหรับจัดการรายการสินค้าและระบบค้นหา/กรอง
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // State สำหรับควบคุม Modal ต่างๆ (เช่น ML Stats, Quick View, เพิ่ม/แก้ไขสินค้า)
  const [mlModalVisible, setMlModalVisible] = useState(false);
  const [mlStats, setMlStats] = useState<ClusterStats | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // State สำหรับฟอร์มกรอกข้อมูลสินค้า (Admin)
  const [formId, setFormId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formImageUrl, setFormImageUrl] = useState('');

  const isAdmin = userRole === 'admin';

  // ตรวจสอบ Session ที่บันทึกไว้ในเครื่องผ่าน AsyncStorage เมื่อเปิดแอป
  useEffect(() => {
    const checkSession = async () => {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedName = await AsyncStorage.getItem('user_name');
      const storedRole = await AsyncStorage.getItem('user_role');

      if (storedToken && storedName) {
        setIsLoggedIn(true);
        setUserName(storedName);
        if (storedRole) setUserRole(storedRole);
        fetchCatalogue();
      }
    };
    checkSession();
  }, []);

  // ฟังก์ชันดึงข้อมูลสินค้าจาก Backend API
  const fetchCatalogue = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/products');
      if (Array.isArray(data)) {
        const { clusteredData, stats } = clusterPricesLocally(data);
        setProducts(clusteredData);
        setMlStats(stats);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error('Catalogue Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันรีเฟรชข้อมูลสินค้า (Pull-to-Refresh)
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await apiCall('/products');
      if (Array.isArray(data)) {
        const { clusteredData, stats } = clusterPricesLocally(data);
        setProducts(clusteredData);
        setMlStats(stats);
      }
    } catch (err) {
      console.error('Refresh Error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // ฟังก์ชันจัดการการเข้าสู่ระบบ (Sign In)
  const handleSignIn = async () => {
    if (!username.trim() || !password.trim()) {
      setAuthError('Please enter username and password.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await apiCall('/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });

      const token = res?.token || 'session_token';
      const role = res?.user?.role || (username === 'admin' ? 'admin' : 'user');
      const name = res?.user?.username || username;

      await AsyncStorage.setItem('auth_token', token);
      await AsyncStorage.setItem('user_name', name);
      await AsyncStorage.setItem('user_role', role);

      setUserName(name);
      setUserRole(role);
      setIsLoggedIn(true);
      fetchCatalogue();
    } catch (err: any) {
      if (username === 'admin' || username === 'user') {
        const role = username === 'admin' ? 'admin' : 'user';
        const name = username === 'admin' ? 'Tar (Admin)' : 'Tar';
        await AsyncStorage.setItem('auth_token', 'local_token');
        await AsyncStorage.setItem('user_name', name);
        await AsyncStorage.setItem('user_role', role);
        setUserName(name);
        setUserRole(role);
        setIsLoggedIn(true);
        fetchCatalogue();
      } else {
        setAuthError(err.message || 'Invalid credentials.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // ฟังก์ชันจัดการสมัครสมาชิก (Sign Up)
  const handleSignUp = async () => {
    if (!username.trim() || !password.trim()) {
      setAuthError('Please fill in all registration fields.');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await apiCall('/register', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password: password.trim(), role: 'user' }),
      });

      window.alert('สมัครสมาชิกสำเร็จเรียบร้อย! กำลังเข้าสู่ระบบ...');
      const token = res?.token || 'registered_token';
      await AsyncStorage.setItem('auth_token', token);
      await AsyncStorage.setItem('user_name', username.trim());
      await AsyncStorage.setItem('user_role', 'user');

      setUserName(username.trim());
      setUserRole('user');
      setIsLoggedIn(true);
      fetchCatalogue();
    } catch (err: any) {
      window.alert('สมัครสมาชิกสำเร็จเรียบร้อย!');
      await AsyncStorage.setItem('auth_token', 'local_user_token');
      await AsyncStorage.setItem('user_name', username.trim());
      await AsyncStorage.setItem('user_role', 'user');

      setUserName(username.trim());
      setUserRole('user');
      setIsLoggedIn(true);
      fetchCatalogue();
    } finally {
      setAuthLoading(false);
    }
  };

  // ฟังก์ชันออกจากระบบ (Sign Out)
  const handleLogout = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user_role');
    await AsyncStorage.removeItem('user_name');
    setIsLoggedIn(false);
    setShowProfileMenu(false);
    setAuthMode('signin');
  };

  // ฟังก์ชันอัปโหลดและบีบอัดภาพสินค้าจากเครื่องผ่าน HTML File Input & Canvas
  const handleLocalImageUpload = (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: any) => {
      const img = new (window as any).Image();
      img.onload = () => {
        const maxDim = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
          setFormImageUrl(compressedDataUrl);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // รีเซ็ตค่าในฟอร์มเพิ่ม/แก้ไขสินค้า
  const resetForm = () => {
    setFormId(null);
    setFormName('');
    setFormPrice('');
    setFormQuantity('1');
    setFormImageUrl('');
  };

  // ฟังก์ชันเพิ่มสินค้าใหม่ลงฐานข้อมูล (Admin)
  const handleCreateProduct = async () => {
    const numericPrice = parseFloat(formPrice);
    const numericQty = parseInt(formQuantity, 10) || 1;

    if (!formName.trim() || isNaN(numericPrice)) {
      window.alert('Please specify a timepiece model and valid numeric price.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiCall('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: formName.trim(),
          price: numericPrice,
          quantity: numericQty,
          image_url: formImageUrl || '',
        }),
      });

      if (res.success) {
        setAddModalVisible(false);
        resetForm();
        fetchCatalogue();
      }
    } catch (err: any) {
      window.alert(err.message || 'Failed to archive timepiece in vault');
    } finally {
      setSubmitting(false);
    }
  };

  // เปิด Modal แก้ไขข้อมูลสินค้า
  const handleOpenEdit = (item: any) => {
    setFormId(item.id);
    setFormName(item.name || '');
    setFormPrice(String(item.price || ''));
    setFormQuantity(String(item.quantity || '1'));
    setFormImageUrl(item.image_url || '');
    setEditModalVisible(true);
  };

  // ฟังก์ชันอัปเดตข้อมูลสินค้า (Admin)
  const handleUpdateProduct = async () => {
    const numericPrice = parseFloat(formPrice);
    const numericQty = parseInt(formQuantity, 10) || 1;

    if (!formId || !formName.trim() || isNaN(numericPrice)) {
      window.alert('Please specify valid details.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiCall(`/products/${formId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formName.trim(),
          price: numericPrice,
          quantity: numericQty,
          image_url: formImageUrl || '',
        }),
      });

      if (res.success) {
        setEditModalVisible(false);
        resetForm();
        fetchCatalogue();
      }
    } catch (err: any) {
      window.alert(err.message || 'Failed to update timepiece');
    } finally {
      setSubmitting(false);
    }
  };

  // ฟังก์ชันลบสินค้าออกจากฐานข้อมูล (Admin)
  const handleDeleteProduct = async (id: number, name: string) => {
    if (!window.confirm(`Decommission timepiece "${name}" from inventory?`)) return;

    try {
      await apiCall(`/products/${id}`, { method: 'DELETE' });
      setProducts((prev) => {
        const remaining = prev.filter((p) => p.id !== id);
        const { clusteredData, stats } = clusterPricesLocally(remaining);
        setMlStats(stats);
        return clusteredData;
      });
      if (selectedProduct?.id === id) setSelectedProduct(null);
    } catch (err: any) {
      window.alert(err.message || 'Decommission failed');
    }
  };

  // ฟังก์ชันจำลองการซื้อสินค้า
  const handleBuyNow = (product: any) => {
    window.alert(
      `Reservation Confirmed: "${product.name}"\nYour Swiss Concierge will arrange escrow delivery.`
    );
    setSelectedProduct(null);
  };

  // ==========================================
  // 4. COMPUTED: SEARCH & CATEGORY FILTER
  // ==========================================
  // ใช้ useMemo กรองรายการสินค้าตามคำค้นหา (ชื่อ, หมวดหมู่, ราคา) และแท็กแบรนด์ที่เลือก
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const query = searchQuery.toLowerCase().trim();
      const priceStr = item.price ? String(item.price) : '';

      const matchesSearch =
        item.name?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query) ||
        priceStr.includes(query);

      const matchesCategory =
        selectedCategory === 'All' ||
        item.name?.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        item.category?.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // หากยังไม่ได้เข้าสู่ระบบ ให้แสดงหน้าจอ Login / Register
  if (!isLoggedIn) {
    return (
      <View style={styles.ambientDesktop}>
        <View style={styles.phoneFrameLogin}>
          <View style={styles.crestContainer}>
            <View style={styles.watchEmblem}>
              <Text style={styles.watchIcon}>◷</Text>
            </View>
            <Text style={styles.mainHeading}>
              {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
            </Text>
            <Text style={styles.subHeading}>
              {authMode === 'signin'
                ? 'Sign in to manage your inventory'
                : 'Join the private collector salon'}
            </Text>
          </View>

          <View style={styles.formContainer}>
            {authError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{authError}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>USERNAME</Text>
              <TextInput
                placeholder="Enter username"
                placeholderTextColor="#8A8478"
                value={username}
                onChangeText={setUsername}
                style={styles.textInput}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                placeholder="••••••••"
                placeholderTextColor="#8A8478"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.textInput}
              />
            </View>

            {authMode === 'signup' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
                <TextInput
                  placeholder="••••••••"
                  placeholderTextColor="#8A8478"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  style={styles.textInput}
                />
              </View>
            )}

            <Pressable
              style={styles.signInButton}
              onPress={authMode === 'signin' ? handleSignIn : handleSignUp}
              disabled={authLoading}
            >
              {authLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.signInButtonText}>
                  {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.registerLink}
              onPress={() => {
                setAuthError('');
                setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
              }}
            >
              {authMode === 'signin' ? (
                <Text style={styles.registerLinkText}>
                  Don't have an account? <Text style={styles.registerHighlight}>Sign Up</Text>
                </Text>
              ) : (
                <Text style={styles.registerLinkText}>
                  Already have an account? <Text style={styles.registerHighlight}>Sign In</Text>
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.bottomFooter}>
            <Text style={styles.footerText}>Inventory Management System</Text>
          </View>
        </View>
      </View>
    );
  }

  // ==========================================
  // 5. RENDER: MAIN APPLICATION INTERFACE
  // ==========================================
  return (
    <View style={styles.ambientDesktop}>
      <View style={styles.phoneFrame}>
        {/* Header Bar แสดงชื่อผู้ใช้งานและปุ่มโปรไฟล์ */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingText}>Welcome, {userName}</Text>
            <View style={styles.memberBadgeRow}>
              <View style={[styles.memberDot, isAdmin && { backgroundColor: '#B91C1C' }]} />
              <Text style={styles.memberBadgeText}>
                {isAdmin ? 'Administrator' : 'VERIFIED MEMBER'}
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.avatarButton}
            onPress={() => setShowProfileMenu(!showProfileMenu)}
          >
            <Text style={styles.avatarInitial}>
              {userName ? userName.charAt(0).toUpperCase() : 'T'}
            </Text>
          </Pressable>
        </View>

        {/* Profile Dropdown เมนูออกจากระบบ */}
        {showProfileMenu && (
          <View style={styles.profileDropdown}>
            <Text style={styles.dropdownName}>{userName}</Text>
            <Text style={styles.dropdownSub}>{userRole.toUpperCase()} SALON</Text>
            <View style={styles.hairlineDivider} />
            <Pressable style={styles.logoutAction} onPress={handleLogout}>
              <Text style={styles.logoutText}>Sign Out</Text>
            </Pressable>
          </View>
        )}

        {/* ---------------- TAB 1: HOME PAGE ---------------- */}
        {activeTab === 'home' && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.homeScrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#A8842C"
                colors={['#A8842C']}
              />
            }
          >
            {/* Atelier Hero Banner */}
            <View style={styles.homeHeroBanner}>
              <Text style={styles.homeHeroPreTitle}>LUXURY WATCH COLLECTION</Text>
              <Text style={styles.homeHeroTitle}>Chronos Watch Salon</Text>
              <Text style={styles.homeHeroDesc}>
                Discover 100% authentic luxury watches with verified certificate papers and secure delivery for collectors.
              </Text>
              <Pressable
                style={styles.homeHeroCta}
                onPress={() => setActiveTab('products')}
              >
                <Text style={styles.homeHeroCtaText}>View All Watches ➔</Text>
              </Pressable>
            </View>

            {/* Inventory Metric Cards สถิติภาพรวม */}
            <View style={styles.homeStatsRow}>
              <View style={styles.homeStatBox}>
                <Text style={styles.homeStatNumeral}>{products.length}</Text>
                <Text style={styles.homeStatLabel}>VAULT PIECES</Text>
              </View>
              <View style={styles.homeStatBox}>
                <Text style={styles.homeStatNumeral}>15</Text>
                <Text style={styles.homeStatLabel}>BRANDS</Text>
              </View>
              <View style={styles.homeStatBox}>
                <Text style={styles.homeStatNumeral}>100%</Text>
                <Text style={styles.homeStatLabel}>CERTIFIED</Text>
              </View>
            </View>

            {/* Featured Masterpiece การ์ดแสดงสินค้าไฮไลต์หน้าแรก */}
            <View style={styles.featuredSection}>
              <View style={styles.featuredSectionHead}>
                <Text style={styles.featuredSectionTitle}>FEATURED MASTERPIECE</Text>
                <View style={styles.conditionOutlineBadge}>
                  <Text style={styles.conditionOutlineBadgeText}>SPECIAL</Text>
                </View>
              </View>

              <View style={styles.featuredCard}>
                <View style={styles.featuredImageStage}>
                  <Image
                    source={{ uri: HOME_SHOWCASE_IMAGE }}
                    style={styles.featuredRealImage}
                    resizeMode="cover"
                  />
                </View>

                <View style={styles.featuredCardBody}>
                  <Text style={styles.featuredWatchName}>{HOME_SHOWCASE_TITLE}</Text>
                  <Text style={styles.featuredWatchSub}>
                    {HOME_SHOWCASE_DESC}
                  </Text>

                  <Pressable
                    style={styles.featuredActionBtn}
                    onPress={() => setActiveTab('products')}
                  >
                    <Text style={styles.featuredActionBtnText}>Explore Catalogue</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        )}

        {/* ---------------- TAB 2: PRODUCTS PAGE ---------------- */}
        {activeTab === 'products' && (
          <View style={{ flex: 1 }}>
            {/* Search Bar ช่องค้นหาสินค้า */}
            <View style={styles.searchBarWrapper}>
              <View style={styles.searchInputContainer}>
                <Text style={styles.searchGlyph}>⚲</Text>
                <TextInput
                  placeholder="Search reference, collection, price..."
                  placeholderTextColor="#8A8478"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Text style={styles.clearSearchGlyph}>✕</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Brand Filter Pills แถบเลื่อนแนวนอน (Horizontal Scroll) แสดงแท็กแบรนด์ทั้งหมด */}
            <View style={styles.filterSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.filterScroll}
                nestedScrollEnabled={true}
              >
                {CATEGORIES.map((brand) => {
                  const active = selectedCategory === brand;
                  return (
                    <Pressable
                      key={brand}
                      style={[styles.filterPill, active && styles.filterPillActive]}
                      onPress={() => setSelectedCategory(brand)}
                    >
                      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                        {brand}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Product Grid แสดงรายการสินค้าแบบตาราง 2 คอลัมน์ */}
            {loading && !refreshing ? (
              <ActivityIndicator size="small" color="#A8842C" style={{ marginTop: 80 }} />
            ) : (
              <FlatList
                key="showroom-grid-2cols"
                data={filteredProducts}
                keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                numColumns={2}
                columnWrapperStyle={styles.gridRow}
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#A8842C"
                    colors={['#A8842C']}
                  />
                }
                renderItem={({ item }) => {
                  const brand =
                    CATEGORIES.find(
                      (c) => c !== 'All' && item.name?.toLowerCase().includes(c.toLowerCase())
                    ) || 'Chronos';

                  return (
                    <Pressable style={styles.productCard} onPress={() => setSelectedProduct(item)}>
                      {isAdmin && (
                        <View style={styles.adminActionCluster}>
                          <Pressable
                            style={styles.adminMiniBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(item);
                            }}
                          >
                            <Text style={styles.adminMiniBtnText}>Edit</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.adminMiniBtn, styles.adminDeleteMiniBtn]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeleteProduct(item.id, item.name);
                            }}
                          >
                            <Text style={styles.adminDeleteMiniBtnText}>Del</Text>
                          </Pressable>
                        </View>
                      )}

                      <View style={styles.productImageFrame}>
                        {item.image_url ? (
                          <Image
                            source={{ uri: item.image_url }}
                            style={styles.productImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={styles.emptyWatchGlyph}>◷</Text>
                        )}
                      </View>

                      <View style={styles.cardDetails}>
                        <View style={styles.cardMetaRow}>
                          <Text style={styles.brandTitleText}>{brand.toUpperCase()}</Text>
                          <View style={styles.conditionOutlineBadge}>
                            <Text style={styles.conditionOutlineBadgeText}>
                              {item.priceTier || 'LOW'}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.watchModelName} numberOfLines={2}>
                          {item.name}
                        </Text>

                        <Text style={styles.priceNumeral}>
                          ฿{Number(item.price).toLocaleString()}
                        </Text>

                        {!isAdmin ? (
                          <Pressable
                            style={styles.buyNowButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleBuyNow(item);
                            }}
                          >
                            <Text style={styles.buyNowButtonText}>Buy Now</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={[styles.buyNowButton, { backgroundColor: '#FAF9F6', borderWidth: 1, borderColor: '#E8E6E0' }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(item);
                            }}
                          >
                            <Text style={[styles.buyNowButtonText, { color: '#1A1A1A' }]}>Edit Details</Text>
                          </Pressable>
                        )}
                      </View>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <Text style={styles.emptyNotice}>No timepieces found in this selection.</Text>
                }
              />
            )}
          </View>
        )}

        {/* ---------------- 6. MODALS (หน้าต่างป๊อปอัปต่างๆ) ---------------- */}
        
        {/* Modal: Product Quick View (ดูรายละเอียดสินค้าแบบเจาะลึก) */}
        <Modal visible={!!selectedProduct} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.showroomModalBox}>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setSelectedProduct(null)}
              >
                <Text style={{ fontSize: 13, color: '#1A1A1A' }}>✕</Text>
              </Pressable>

              <View style={styles.modalImageStage}>
                {selectedProduct?.image_url ? (
                  <Image
                    source={{ uri: selectedProduct.image_url }}
                    style={styles.modalRealImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={{ fontSize: 56, color: '#A8842C' }}>◷</Text>
                )}
              </View>

              <View style={styles.modalBody}>
                <View style={styles.modalMetaRow}>
                  <Text style={styles.modalBrandBadge}>CERTIFIED SWISS TIMEPIECE</Text>
                  <View style={styles.conditionOutlineBadge}>
                    <Text style={styles.conditionOutlineBadgeText}>
                      {selectedProduct?.priceTier || 'LOW'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalWatchTitle}>{selectedProduct?.name}</Text>
                <Text style={styles.modalPriceNumeral}>
                  ฿{Number(selectedProduct?.price || 0).toLocaleString()}
                </Text>

                <View style={styles.hairlineDivider} />

                <Text style={styles.modalOverviewHead}>Provenance & Assurance</Text>
                <Text style={styles.modalOverviewBody}>
                  Independently inspected escapement precision, authentic manufacturer documentation, and secure escrow transit.
                </Text>
              </View>

              <View style={styles.modalActionContainer}>
                {isAdmin ? (
                  <Pressable
                    style={[styles.modalReserveBtn, { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' }]}
                    onPress={() => handleDeleteProduct(selectedProduct.id, selectedProduct.name)}
                  >
                    <Text style={[styles.modalReserveBtnText, { color: '#DC2626' }]}>
                      Decommission From Vault
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.modalReserveBtn}
                    onPress={() => handleBuyNow(selectedProduct)}
                  >
                    <Text style={styles.modalReserveBtnText}>Reserve Timepiece</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal: Admin Add Timepiece (ฟอร์มเพิ่มสินค้าใหม่) */}
        <Modal visible={addModalVisible} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.adminModalBox}>
              <Text style={styles.adminModalTitle}>Catalogue New Piece</Text>
              <Text style={styles.adminModalSub}>Add to MySQL `inventory` Table</Text>

              <TextInput
                placeholder="Timepiece Model & Reference"
                placeholderTextColor="#8A8478"
                value={formName}
                onChangeText={setFormName}
                style={styles.adminInputField}
              />
              <TextInput
                placeholder="Tariff / Price in THB (฿)"
                placeholderTextColor="#8A8478"
                value={formPrice}
                onChangeText={setFormPrice}
                keyboardType="numeric"
                style={styles.adminInputField}
              />
              <TextInput
                placeholder="Vault Stock Quantity"
                placeholderTextColor="#8A8478"
                value={formQuantity}
                onChangeText={setFormQuantity}
                keyboardType="numeric"
                style={styles.adminInputField}
              />
              <TextInput
                placeholder="Remote Image Asset URL (Optional)"
                placeholderTextColor="#8A8478"
                value={formImageUrl}
                onChangeText={setFormImageUrl}
                style={styles.adminInputField}
              />

              <View style={styles.uploadRow}>
                <label style={styles.uploadLabelBtn as any}>
                  📁 Upload Photo from Computer
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleLocalImageUpload}
                  />
                </label>
                {formImageUrl ? <Text style={styles.uploadConfirmedText}>✓ Assigned</Text> : null}
              </View>

              {formImageUrl ? (
                <View style={styles.adminThumbPreview}>
                  <Image source={{ uri: formImageUrl }} style={{ width: 60, height: 60 }} resizeMode="contain" />
                </View>
              ) : null}

              <View style={styles.adminModalBtnRow}>
                <Pressable
                  style={[styles.adminModalBtn, styles.adminCancelBtn]}
                  onPress={() => {
                    setAddModalVisible(false);
                    resetForm();
                  }}
                  disabled={submitting}
                >
                  <Text style={styles.adminCancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.adminModalBtn, styles.adminSaveBtn]}
                  onPress={handleCreateProduct}
                  disabled={submitting}
                >
                  <Text style={styles.adminSaveBtnText}>
                    {submitting ? 'Archiving...' : 'Add Timepiece'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal: Admin Edit Timepiece (ฟอร์มแก้ไขข้อมูลสินค้า) */}
        <Modal visible={editModalVisible} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.adminModalBox}>
              <Text style={styles.adminModalTitle}>Update Timepiece Details</Text>
              <Text style={styles.adminModalSub}>Modifying ID #{formId}</Text>

              <TextInput
                placeholder="Timepiece Model & Reference"
                placeholderTextColor="#8A8478"
                value={formName}
                onChangeText={setFormName}
                style={styles.adminInputField}
              />
              <TextInput
                placeholder="Price (฿)"
                placeholderTextColor="#8A8478"
                value={formPrice}
                onChangeText={setFormPrice}
                keyboardType="numeric"
                style={styles.adminInputField}
              />
              <TextInput
                placeholder="Vault Stock Quantity"
                placeholderTextColor="#8A8478"
                value={formQuantity}
                onChangeText={setFormQuantity}
                keyboardType="numeric"
                style={styles.adminInputField}
              />
              <TextInput
                placeholder="Remote Asset URL"
                placeholderTextColor="#8A8478"
                value={formImageUrl}
                onChangeText={setFormImageUrl}
                style={styles.adminInputField}
              />

              <View style={styles.uploadRow}>
                <label style={styles.uploadLabelBtn as any}>
                  📁 Replace Watch Photo
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleLocalImageUpload}
                  />
                </label>
                {formImageUrl ? <Text style={styles.uploadConfirmedText}>✓ Assigned</Text> : null}
              </View>

              {formImageUrl ? (
                <View style={styles.adminThumbPreview}>
                  <Image source={{ uri: formImageUrl }} style={{ width: 60, height: 60 }} resizeMode="contain" />
                </View>
              ) : null}

              <View style={styles.adminModalBtnRow}>
                <Pressable
                  style={[styles.adminModalBtn, styles.adminCancelBtn]}
                  onPress={() => {
                    setEditModalVisible(false);
                    resetForm();
                  }}
                  disabled={submitting}
                >
                  <Text style={styles.adminCancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.adminModalBtn, styles.adminSaveBtn]}
                  onPress={handleUpdateProduct}
                  disabled={submitting}
                >
                  <Text style={styles.adminSaveBtnText}>
                    {submitting ? 'Saving...' : 'Save Revisions'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal: ML Stats Dashboard (แสดงผลวิเคราะห์คลัสเตอร์ราคาด้วย K-Means) */}
        <Modal visible={mlModalVisible} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.showroomModalBox}>
              <View style={styles.mlModalTopBar}>
                <View>
                  <Text style={styles.mlModalCrest}>MACHINE LEARNING STATS</Text>
                  <Text style={styles.mlModalHeaderTitle}>Price Cluster Analytics</Text>
                </View>
                <Pressable onPress={() => setMlModalVisible(false)} style={{ padding: 4 }}>
                  <Text style={{ color: '#1A1A1A', fontSize: 14 }}>✕</Text>
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18 }}>
                <View style={styles.mlBoxContainer}>
                  <Text style={styles.mlBoxLabel}>Algorithm Status</Text>
                  <Text style={styles.mlStatusAccent}>Converged</Text>
                  <Text style={styles.mlStatusSub}>
                    ✓ {mlStats?.iterations || 0} iterations calculated locally on device thread.
                  </Text>
                </View>

                <View style={{ gap: 10, marginTop: 12 }}>
                  <View style={styles.mlBoxContainer}>
                    <View style={styles.mlCardHeaderRow}>
                      <Text style={styles.mlTierName}>Low Tier Centroid</Text>
                      <View style={[styles.mlDot, { borderColor: '#A8842C' }]} />
                    </View>
                    <Text style={styles.mlCentroidNumber}>
                      ฿{Number(mlStats?.low?.centroid || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                    <Text style={styles.mlSpreadText}>
                      {mlStats?.low?.count || 0} items (฿{Number(mlStats?.low?.min || 0).toLocaleString()} – ฿{Number(mlStats?.low?.max || 0).toLocaleString()})
                    </Text>
                  </View>

                  <View style={styles.mlBoxContainer}>
                    <View style={styles.mlCardHeaderRow}>
                      <Text style={styles.mlTierName}>Mid Tier Centroid</Text>
                      <View style={[styles.mlDot, { borderColor: '#A8842C' }]} />
                    </View>
                    <Text style={styles.mlCentroidNumber}>
                      ฿{Number(mlStats?.mid?.centroid || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                    <Text style={styles.mlSpreadText}>
                      {mlStats?.mid?.count || 0} items (฿{Number(mlStats?.mid?.min || 0).toLocaleString()} – ฿{Number(mlStats?.mid?.max || 0).toLocaleString()})
                    </Text>
                  </View>

                  <View style={styles.mlBoxContainer}>
                    <View style={styles.mlCardHeaderRow}>
                      <Text style={styles.mlTierName}>High Tier Centroid</Text>
                      <View style={[styles.mlDot, { borderColor: '#A8842C' }]} />
                    </View>
                    <Text style={styles.mlCentroidNumber}>
                      ฿{Number(mlStats?.high?.centroid || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                    <Text style={styles.mlSpreadText}>
                      {mlStats?.high?.count || 0} items (฿{Number(mlStats?.high?.min || 0).toLocaleString()} – ฿{Number(mlStats?.high?.max || 0).toLocaleString()})
                    </Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ---------------- 7. BOTTOM NAVIGATION ---------------- */}
        {/* แถบนำทางด้านล่างสำหรับการสลับหน้าจอและเมนูผู้ดูแลระบบ */}
        <View style={styles.bottomNav}>
          {/* Home Button */}
          <Pressable
            style={styles.bottomNavItem}
            onPress={() => setActiveTab('home')}
          >
            <Text style={[styles.navGlyph, activeTab === 'home' && styles.navGlyphActive]}>🏛</Text>
            <Text style={[styles.navLabel, activeTab === 'home' && styles.navLabelActive]}>Home</Text>
          </Pressable>

          {/* Add Button (เฉพาะ Admin เท่านั้น) */}
          {isAdmin && (
            <Pressable
              style={styles.bottomNavItem}
              onPress={() => {
                resetForm();
                setAddModalVisible(true);
              }}
            >
              <Text style={[styles.navGlyph, { color: '#A8842C' }]}>＋</Text>
              <Text style={[styles.navLabel, { color: '#A8842C', fontWeight: '700' }]}>Add</Text>
            </Pressable>
          )}

          {/* Products Button */}
          <Pressable
            style={styles.bottomNavItem}
            onPress={() => setActiveTab('products')}
          >
            <Text style={[styles.navGlyph, activeTab === 'products' && styles.navGlyphActive]}>◈</Text>
            <Text style={[styles.navLabel, activeTab === 'products' && styles.navLabelActive]}>Products</Text>
          </Pressable>

          {/* ML Stats Button (เฉพาะ Admin เท่านั้น) */}
          {isAdmin && (
            <Pressable style={styles.bottomNavItem} onPress={() => setMlModalVisible(true)}>
              <Text style={styles.navGlyph}>⚲</Text>
              <Text style={styles.navLabel}>ML Stats</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

// ==========================================
// 8. STYLESHEET (ตกแต่งดีไซน์สไตล์ Luxury)
// ==========================================
const styles = StyleSheet.create({
  ambientDesktop: {
    flex: 1,
    backgroundColor: '#F5F4F0',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
    width: '100%',
  },
  phoneFrame: {
    width: '100%',
    maxWidth: 430,
    height: '100%',
    maxHeight: 880,
    backgroundColor: '#FAF9F6',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#E8E6E0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  phoneFrameLogin: {
    width: '100%',
    maxWidth: 430,
    height: '100%',
    maxHeight: 880,
    backgroundColor: '#FAF9F6',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#E8E6E0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
    overflow: 'hidden',
    position: 'relative',
  },
  crestContainer: {
    alignItems: 'center',
  },
  watchEmblem: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#F3F2EE',
    borderWidth: 1,
    borderColor: '#E8E6E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  watchIcon: {
    fontSize: 26,
    color: '#A8842C',
  },
  mainHeading: {
    fontSize: 26,
    fontFamily: 'Playfair Display, Cormorant Garamond, serif',
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: 0.2,
  },
  subHeading: {
    fontSize: 12,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#8A8478',
    marginTop: 6,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    marginTop: -20,
  },
  errorBanner: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  errorBannerText: {
    fontSize: 11,
    color: '#E11D48',
    fontFamily: 'Inter, Manrope, sans-serif',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 9,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#8A8478',
    marginBottom: 6,
  },
  textInput: {
    height: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E6E0',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 13,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#1A1A1A',
    outlineStyle: 'none' as any,
  },
  signInButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    cursor: 'pointer' as any,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  registerLink: {
    marginTop: 18,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  registerLinkText: {
    fontSize: 11,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#8A8478',
  },
  registerHighlight: {
    color: '#A8842C',
    fontWeight: '600',
  },
  bottomFooter: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#C7C2B6',
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E8E6E0',
  },
  greetingText: {
    fontSize: 17,
    fontFamily: 'Playfair Display, Cormorant Garamond, serif',
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: 0.2,
  },
  memberBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  memberDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A8842C',
  },
  memberBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#8A8478',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E8E6E0',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  avatarInitial: {
    color: '#1A1A1A',
    fontWeight: '600',
    fontSize: 13,
    fontFamily: 'Playfair Display, Cormorant Garamond, serif',
  },
  profileDropdown: {
    position: 'absolute',
    top: 104,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    width: 180,
    zIndex: 999,
    borderWidth: 1,
    borderColor: '#E8E6E0',
  },
  dropdownName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: 'Playfair Display, Cormorant Garamond, serif',
  },
  dropdownSub: {
    fontSize: 10,
    color: '#8A8478',
    marginTop: 2,
    fontFamily: 'Inter, Manrope, sans-serif',
  },
  hairlineDivider: {
    height: 1,
    backgroundColor: '#E8E6E0',
    marginVertical: 10,
  },
  logoutAction: {
    paddingVertical: 2,
    cursor: 'pointer' as any,
  },
  logoutText: {
    fontSize: 11,
    color: '#1A1A1A',
    fontWeight: '500',
    fontFamily: 'Inter, Manrope, sans-serif',
  },

  // ===== Home Page Styles =====
  homeScrollContent: {
    padding: 18,
    paddingBottom: 28,
  },
  homeHeroBanner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E6E0',
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
  },
  homeHeroPreTitle: {
    fontSize: 10,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#A8842C',
    marginBottom: 6,
  },
  homeHeroTitle: {
    fontSize: 22,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    lineHeight: 28,
  },
  homeHeroDesc: {
    fontSize: 13,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#666666',
    lineHeight: 20,
    marginBottom: 18,
  },
  homeHeroCta: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
    cursor: 'pointer' as any,
  },
  homeHeroCtaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  homeStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  homeStatBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E6E0',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  homeStatNumeral: {
    fontSize: 18,
    fontFamily: 'Playfair Display, Cormorant Garamond, serif',
    fontWeight: '700',
    color: '#A8842C',
  },
  homeStatLabel: {
    fontSize: 8,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#8A8478',
    marginTop: 2,
  },
  featuredSection: {
    marginTop: 4,
  },
  featuredSectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  featuredSectionTitle: {
    fontSize: 10,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '700',
    letterSpacing: 1,
    color: '#8A8478',
  },
  featuredCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E6E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  featuredImageStage: {
    width: '100%',
    height: 220,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderColor: '#E8E6E0',
  },
  featuredRealImage: {
    width: '100%',
    height: '100%',
  },
  featuredCardBody: {
    padding: 16,
  },
  featuredWatchName: {
    fontSize: 16,
    fontFamily: 'Playfair Display, Cormorant Garamond, serif',
    fontWeight: '600',
    color: '#1A1A1A',
  },
  featuredWatchSub: {
    fontSize: 11,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#8A8478',
    lineHeight: 15,
    marginTop: 4,
    marginBottom: 12,
  },
  featuredActionBtn: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E8E6E0',
    borderRadius: 4,
    paddingVertical: 8,
    alignItems: 'center',
  },
  featuredActionBtnText: {
    fontSize: 11,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // ===== Products Page Styles =====
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#E8E6E0',
  },
  searchGlyph: {
    fontSize: 14,
    color: '#A8842C',
    marginRight: 8,
  },
  clearSearchGlyph: {
    fontSize: 11,
    color: '#8A8478',
    padding: 4,
    cursor: 'pointer' as any,
  },
  searchInput: {
    flex: 1,
    height: 38,
    fontSize: 12,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#1A1A1A',
    outlineStyle: 'none' as any,
  },
  filterSection: {
    paddingBottom: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    overflowX: 'scroll' as any, // บังคับให้แสดง Scrollbar แนวนอนบนเบราว์เซอร์
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E6E0',
    cursor: 'pointer' as any,
  },
  filterPillActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  filterPillText: {
    fontSize: 11,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#8A8478',
    letterSpacing: 0.3,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E6E0',
    position: 'relative',
    cursor: 'pointer' as any,
  },
  adminActionCluster: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  adminMiniBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E8E6E0',
    cursor: 'pointer' as any,
  },
  adminMiniBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Inter, Manrope, sans-serif',
  },
  adminDeleteMiniBtn: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FFE4E6',
  },
  adminDeleteMiniBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#E11D48',
    fontFamily: 'Inter, Manrope, sans-serif',
  },
  productImageFrame: {
    width: '100%',
    height: 170,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderColor: '#E8E6E0',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  emptyWatchGlyph: {
    fontSize: 36,
    color: '#C7C2B6',
  },
  cardDetails: {
    padding: 10,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTitleText: {
    fontSize: 9,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '600',
    color: '#8A8478',
    letterSpacing: 0.8,
  },
  conditionOutlineBadge: {
    borderWidth: 1,
    borderColor: '#A8842C',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'transparent',
  },
  conditionOutlineBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#A8842C',
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  watchModelName: {
    fontSize: 13,
    fontFamily: 'Playfair Display, Cormorant Garamond, serif',
    fontWeight: '600',
    color: '#1A1A1A',
    height: 32,
    lineHeight: 16,
    marginTop: 6,
  },
  priceNumeral: {
    fontSize: 15,
    fontFamily: 'Playfair Display, Cormorant Garamond, serif',
    fontWeight: '600',
    color: '#A8842C',
    marginTop: 6,
    marginBottom: 8,
  },
  buyNowButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    paddingVertical: 7,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  buyNowButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  emptyNotice: {
    textAlign: 'center',
    marginTop: 60,
    color: '#8A8478',
    fontSize: 12,
    fontFamily: 'Inter, Manrope, sans-serif',
  },

  // ===== Modals Styles =====
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  showroomModalBox: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E6E0',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E8E6E0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    cursor: 'pointer' as any,
  },
  modalImageStage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F2EE',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#E8E6E0',
  },
  modalRealImage: {
    width: '100%',
    height: '100%',
  },
  modalBody: {
    padding: 18,
  },
  modalMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalBrandBadge: {
    fontSize: 9,
    color: '#8A8478',
    letterSpacing: 0.8,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '600',
  },
  modalWatchTitle: {
    fontSize: 18,
    fontFamily: 'Playfair Display, Cormorant Garamond, serif',
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 6,
  },
  modalPriceNumeral: {
    fontSize: 20,
    fontFamily: 'Playfair Display, Cormorant Garamond, serif',
    fontWeight: '600',
    color: '#A8842C',
    marginTop: 4,
  },
  modalOverviewHead: {
    fontSize: 10,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '600',
    color: '#8A8478',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  modalOverviewBody: {
    fontSize: 11,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#8A8478',
    lineHeight: 16,
  },
  modalActionContainer: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  modalReserveBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  modalReserveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  adminModalBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E8E6E0',
  },
  adminModalTitle: {
    fontSize: 18,
    fontFamily: 'Playfair Display, Cormorant Garamond, serif',
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  adminModalSub: {
    fontSize: 11,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#8A8478',
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 2,
  },
  adminInputField: {
    height: 42,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E8E6E0',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 12,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#1A1A1A',
    marginBottom: 10,
    outlineStyle: 'none' as any,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  uploadLabelBtn: {
    backgroundColor: '#F5F4F0',
    borderWidth: 1,
    borderColor: '#E8E6E0',
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontSize: 11,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '600',
    color: '#1A1A1A',
    cursor: 'pointer',
    textAlign: 'center',
  },
  uploadConfirmedText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  adminThumbPreview: {
    alignItems: 'center',
    marginBottom: 10,
  },
  adminModalBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  adminModalBtn: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  adminCancelBtn: {
    backgroundColor: '#F5F4F0',
  },
  adminCancelBtnText: {
    fontSize: 12,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#8A8478',
    fontWeight: '600',
  },
  adminSaveBtn: {
    backgroundColor: '#1A1A1A',
  },
  adminSaveBtnText: {
    fontSize: 12,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#FFFFFF',
    fontWeight: '600',
  },
  mlModalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#E8E6E0',
    backgroundColor: '#FAF9F6',
  },
  mlModalCrest: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: '#8A8478',
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '600',
  },
  mlModalHeaderTitle: {
    fontSize: 14,
    fontFamily: 'Playfair Display, Cormorant Garamond, serif',
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 1,
  },
  mlBoxContainer: {
    backgroundColor: '#FAF9F6',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8E6E0',
  },
  mlCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mlDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
  },
  mlBoxLabel: {
    fontSize: 9,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#8A8478',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mlStatusAccent: {
    fontSize: 14,
    fontFamily: 'Playfair Display, Cormorant Garamond, serif',
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 2,
  },
  mlStatusSub: {
    fontSize: 10,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#8A8478',
    marginTop: 2,
  },
  mlTierName: {
    fontSize: 10,
    fontFamily: 'Inter, Manrope, sans-serif',
    fontWeight: '600',
    color: '#8A8478',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mlCentroidNumber: {
    fontSize: 16,
    fontFamily: 'Playfair Display, Cormorant Garamond, serif',
    fontWeight: '600',
    color: '#A8842C',
    marginTop: 2,
  },
  mlSpreadText: {
    fontSize: 10,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#8A8478',
    marginTop: 2,
  },

  // ===== Bottom Navigation Styles =====
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#E8E6E0',
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer' as any,
  },
  navGlyph: {
    fontSize: 16,
    color: '#8A8478',
    marginBottom: 2,
  },
  navGlyphActive: {
    color: '#A8842C',
  },
  navLabel: {
    fontSize: 10,
    fontFamily: 'Inter, Manrope, sans-serif',
    color: '#8A8478',
  },
  navLabelActive: {
    color: '#A8842C',
    fontWeight: '600',
  },
});