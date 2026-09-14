import { ThemedText } from '@/components/themed-text';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

interface ProductProps {
  item: {
    id: number | string;
    name: string;
    price: number | string;
    image_url?: string; // 👈 1. เพิ่มรองรับชื่อฟิลด์จาก Database
    image?: string;     // รองรับชื่อฟิลด์แบบเดิม
  };
  onEdit?: (item: ProductProps['item']) => void;
}

export function ProductCard({ item, onEdit }: ProductProps) {
  // 👈 2. เลือกใช้ image_url ก่อน ถ้าไม่มีค่อยไปใช้ image
  const imageUrl = item.image_url || item.image;

  return (
    <View style={styles.productCard}>
      <Image
        source={{ uri: imageUrl }}
        style={styles.productImage}
        resizeMode="cover"
      />

      <View style={styles.productInfo}>
        <ThemedText style={styles.productName}>{item.name}</ThemedText>
        <ThemedText style={styles.productPrice}>
          {typeof item.price === 'number' ? `฿${item.price.toLocaleString()}` : item.price}
        </ThemedText>
      </View>

      {onEdit ? (
        <TouchableOpacity
          style={styles.editButton}
          activeOpacity={0.6}
          onPress={() => onEdit(item)}
          hitSlop={6}>
          <ThemedText style={styles.editButtonText}>✎</ThemedText>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.viewButton} activeOpacity={0.6}>
        <ThemedText style={styles.viewButtonText}>ดูเลย</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  productImage: {
    width: 55,
    height: 55,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  productPrice: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  viewButton: {
    backgroundColor: '#E5F1FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  viewButtonText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#F2F2F7',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  editButtonText: {
    color: '#1C1C1E',
    fontSize: 13,
  },
});