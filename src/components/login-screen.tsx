import { apiCall } from '@/api';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export function LoginScreen({
  onLoginSuccess,
}: {
  onLoginSuccess: (token: string, user: any) => void;
}) {
  // สลับโหมดระหว่าง 'login' หรือ 'register'
  const [isRegister, setIsRegister] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMsg('กรุณากรอก Username และ Password');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (isRegister) {
      // ===== สมัครสมาชิก =====
      try {
        const res = await apiCall('/register', {
          method: 'POST',
          body: JSON.stringify({ username, password, name }),
        });

        if (res.success) {
          setSuccessMsg('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
          setIsRegister(false); // เด้งกลับมาหน้า login
          setPassword('');
        } else {
          setErrorMsg(res.error || 'สมัครสมาชิกไม่สำเร็จ');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'ไม่สามารถเชื่อมต่อ Server ได้');
      } finally {
        setLoading(false);
      }
    } else {
      // ===== เข้าสู่ระบบ =====
      try {
        const data = await apiCall('/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });

        if (data.success) {
          onLoginSuccess(data.token, data.user);
        } else {
          setErrorMsg(data.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'ไม่สามารถเชื่อมต่อ Server ได้');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <View style={styles.pageBackground}>
      <View style={styles.phoneFrame}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandIconWrapper}>
            <Text style={styles.brandIcon}>⌚</Text>
          </View>
          <Text style={styles.title}>
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text style={styles.subtitle}>
            {isRegister
              ? 'Sign up to start using the system'
              : 'Sign in to manage your inventory'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          ) : null}

          {isRegister && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Display Name</Text>
              <TextInput
                placeholder="Enter your name"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
                style={styles.input}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              placeholder="Enter username"
              placeholderTextColor="#94a3b8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              placeholder="Enter password"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
            />
          </View>

          <TouchableOpacity
            style={[styles.actionButton, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.actionButtonText}>
                {isRegister ? 'Sign Up' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          {/* ปุ่มสลับหน้า Login / Register */}
          <TouchableOpacity
            style={styles.switchModeBtn}
            onPress={() => {
              setIsRegister(!isRegister);
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            <Text style={styles.switchModeText}>
              {isRegister
                ? 'Already have an account? Sign In'
                : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Inventory Management System</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageBackground: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  phoneFrame: {
    width: 390,
    height: 800,
    backgroundColor: '#ffffff',
    borderRadius: 36,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 6,
    borderColor: '#e2e8f0',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 36,
  },
  header: {
    alignItems: 'center',
    marginTop: 10,
  },
  brandIconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandIcon: {
    fontSize: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  successText: {
    color: '#16a34a',
    fontSize: 13,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    height: 46,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
    outlineStyle: 'none' as any,
  },
  actionButton: {
    height: 48,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    cursor: 'pointer' as any,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  switchModeBtn: {
    marginTop: 14,
    alignItems: 'center',
    padding: 6,
    cursor: 'pointer' as any,
  },
  switchModeText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
  },
});