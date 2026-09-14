import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';

export type ProductFormValues = {
  name: string;
  price: string;
  stock: string;
  category: string;
  brand: string;
  location: string;
  product_code: string;
  status: string;
  image_url: string;
};

export const EMPTY_PRODUCT_FORM_VALUES: ProductFormValues = {
  name: '',
  price: '',
  stock: '',
  category: '',
  brand: '',
  location: '',
  product_code: '',
  status: '',
  image_url: '',
};

interface ProductFormProps {
  initialValues?: Partial<ProductFormValues>;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: ProductFormValues) => void;
  onCancel: () => void;
}

export function ProductForm({
  initialValues,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>({
    ...EMPTY_PRODUCT_FORM_VALUES,
    ...initialValues,
  });

  const setField = (key: keyof ProductFormValues) => (text: string) =>
    setValues((prev) => ({ ...prev, [key]: text }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field
        label="Name *"
        value={values.name}
        onChangeText={setField('name')}
        placeholder="Enter product name"
      />
      <Field
        label="Price *"
        value={values.price}
        onChangeText={setField('price')}
        placeholder="Enter price"
        keyboardType="numeric"
      />
      <Field
        label="Stock"
        value={values.stock}
        onChangeText={setField('stock')}
        placeholder="Enter stock quantity"
        keyboardType="numeric"
      />
      <Field
        label="Category"
        value={values.category}
        onChangeText={setField('category')}
        placeholder="Enter category"
      />
      <Field
        label="Brand"
        value={values.brand}
        onChangeText={setField('brand')}
        placeholder="Enter brand"
      />
      <Field
        label="Location"
        value={values.location}
        onChangeText={setField('location')}
        placeholder="Enter location"
      />
      <Field
        label="Product Code"
        value={values.product_code}
        onChangeText={setField('product_code')}
        placeholder="Enter product code"
      />
      <Field
        label="Status"
        value={values.status}
        onChangeText={setField('status')}
        placeholder="Active / Inactive"
      />
      <Field
        label="Image URL"
        value={values.image_url}
        onChangeText={setField('image_url')}
        placeholder="https://..."
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={submitting}
          activeOpacity={0.7}>
          <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={() => onSubmit(values)}
          disabled={submitting}
          activeOpacity={0.7}>
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.submitButtonText}>{submitLabel}</ThemedText>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
}) {
  return (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8E8E93"
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1C1C1E',
    backgroundColor: '#F9F9F9',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  cancelButtonText: {
    color: '#1C1C1E',
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
