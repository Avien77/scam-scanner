import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';

const STORAGE_TOKEN = 'scam_scanner_token';
const STORAGE_EMAIL = 'scam_scanner_email';

/** Abort slow `/api/auth/me` and use saved token so the app opens quickly (e.g. screenshots). */
const AUTH_ME_TIMEOUT_MS = 1500;

/**
 * Metro tells us the IP of the machine running the dev server (your PC).
 * Physical phones cannot use 127.0.0.1 — that points at the phone itself.
 *
 * Override: create mobile/.env with EXPO_PUBLIC_API_URL=http://192.168.x.x:3001
 */
function getHostIpFromExpo() {
  const go = Constants.expoGoConfig;
  if (go && typeof go === 'object') {
    const raw = go.debuggerHost || go.hostUri;
    if (raw) return String(raw).split(':')[0];
  }
  const m = Constants.manifest;
  if (m?.debuggerHost) return String(m.debuggerHost).split(':')[0];
  if (m?.hostUri) return String(m.hostUri).split(':')[0];
  const m2 = Constants.manifest2;
  const dbg = m2?.extra?.expoGo?.debuggerHost;
  if (dbg) return String(dbg).split(':')[0];
  const uri = Constants.expoConfig?.hostUri;
  if (uri) return String(uri).split(':')[0];
  return null;
}

function resolveApiBase() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const metroIp = getHostIpFromExpo();
  const usable = metroIp && metroIp !== '127.0.0.1' && metroIp !== 'localhost';

  if (Platform.OS === 'android') {
    if (usable) return `http://${metroIp}:3001`;
    return 'http://10.0.2.2:3001';
  }

  if (usable) return `http://${metroIp}:3001`;
  return 'http://127.0.0.1:3001';
}

const API_BASE = resolveApiBase();
const EXTRACT_URL = `${API_BASE}/api/upload/extract-text`;
const CLASSIFY_URL = `${API_BASE}/api/scan/classify`;
const LOGIN_URL = `${API_BASE}/api/auth/login`;
const REGISTER_URL = `${API_BASE}/api/auth/register`;
const ME_URL = `${API_BASE}/api/auth/me`;
const DEV_BYPASS_URL = `${API_BASE}/api/auth/dev-bypass`;
const HISTORY_URL = `${API_BASE}/api/scan/history`;

export default function App() {
  const [session, setSession] = useState(null);
  /** Only true while validating an existing saved token (not on first paint). */
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [imageUri, setImageUri] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scamVerdict, setScamVerdict] = useState(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  const [historyScans, setHistoryScans] = useState([]);
  const [historySelectedId, setHistorySelectedId] = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);

  const meAbortRef = useRef(null);
  /** When true, ignore late /api/auth/me results so they do not clear storage after Skip. */
  const skipHydrationRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    skipHydrationRef.current = false;
    const ac = new AbortController();
    meAbortRef.current = ac;

    (async () => {
      const token = await AsyncStorage.getItem(STORAGE_TOKEN);
      const email = await AsyncStorage.getItem(STORAGE_EMAIL);
      if (!token || !email) {
        return;
      }

      if (!cancelled) setAuthLoading(true);

      const timeoutId = setTimeout(() => {
        ac.abort();
      }, AUTH_ME_TIMEOUT_MS);

      try {
        const r = await fetch(ME_URL, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          signal: ac.signal,
        });
        clearTimeout(timeoutId);
        if (cancelled || skipHydrationRef.current) return;

        if (!r.ok) {
          if (skipHydrationRef.current) return;
          await AsyncStorage.multiRemove([STORAGE_TOKEN, STORAGE_EMAIL]);
          return;
        }

        setSession({ token, email });
      } catch {
        clearTimeout(timeoutId);
        if (cancelled || skipHydrationRef.current) return;
        if (token && email) {
          setSession({ token, email });
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
      meAbortRef.current = null;
    };
  }, []);

  const persistSession = useCallback(async (token, email) => {
    await AsyncStorage.setItem(STORAGE_TOKEN, token);
    await AsyncStorage.setItem(STORAGE_EMAIL, email);
    setSession({ token, email });
  }, []);

  /** Passwordless demo JWT — backend enables this by default when NODE_ENV is not production. */
  const openDemoSession = useCallback(async () => {
    skipHydrationRef.current = true;
    meAbortRef.current?.abort();
    try {
      const res = await fetch(DEV_BYPASS_URL, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      if (!data.token || !data.user?.email) {
        throw new Error('Unexpected server response.');
      }
      await persistSession(data.token, data.user.email);
      setPasswordInput('');
      setEmailInput('');
      setAuthLoading(false);
    } catch (e) {
      Alert.alert(
        'Could not open app',
        `${e.message || 'Unknown error'}\n\n` +
          '• Start backend from repo root: npm run backend\n' +
          '• Phone + PC same Wi‑Fi, or set EXPO_PUBLIC_API_URL\n' +
          '• Production: set ALLOW_DEV_LOGIN_BYPASS=true in backend/.env',
      );
    }
  }, [persistSession]);

  const skipAuthLoadingWait = useCallback(async () => {
    skipHydrationRef.current = true;
    meAbortRef.current?.abort();
    try {
      const token = await AsyncStorage.getItem(STORAGE_TOKEN);
      const email = await AsyncStorage.getItem(STORAGE_EMAIL);
      if (token && email) {
        setSession({ token, email });
      } else {
        await openDemoSession();
      }
    } catch {
      // openDemoSession already surfaced an alert
    } finally {
      setAuthLoading(false);
    }
  }, [openDemoSession]);

  const logout = useCallback(async () => {
    skipHydrationRef.current = false;
    await AsyncStorage.multiRemove([STORAGE_TOKEN, STORAGE_EMAIL]);
    setSession(null);
    setEmailInput('');
    setPasswordInput('');
    setHistoryOpen(false);
    setHistoryScans([]);
    setHistoryDetail(null);
    setHistorySelectedId(null);
  }, []);

  const closeHistoryModal = useCallback(() => {
    setHistoryOpen(false);
    setHistoryDetail(null);
    setHistorySelectedId(null);
    setHistoryDetailLoading(false);
  }, []);

  const loadHistoryList = useCallback(
    async (opts = {}) => {
      const fromRefresh = opts.fromRefresh === true;
      if (!session?.token) return;
      if (fromRefresh) {
        setHistoryRefreshing(true);
      } else {
        setHistoryLoading(true);
      }
      try {
        const res = await fetch(`${HISTORY_URL}?limit=30`, {
          headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          await logout();
          return;
        }
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        setHistoryScans(Array.isArray(data.scans) ? data.scans : []);
      } catch (e) {
        Alert.alert('History', e.message || 'Could not load scans.');
      } finally {
        setHistoryLoading(false);
        setHistoryRefreshing(false);
      }
    },
    [session?.token, logout],
  );

  const openHistoryModal = useCallback(() => {
    setHistoryDetail(null);
    setHistorySelectedId(null);
    setHistoryOpen(true);
    loadHistoryList();
  }, [loadHistoryList]);

  const openHistoryDetail = useCallback(
    async (id) => {
      if (!session?.token) return;
      setHistorySelectedId(id);
      setHistoryDetailLoading(true);
      setHistoryDetail(null);
      try {
        const res = await fetch(`${HISTORY_URL}/${id}`, {
          headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          await logout();
          return;
        }
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        if (data.scan) {
          setHistoryDetail(data.scan);
        }
      } catch (e) {
        Alert.alert('Scan', e.message || 'Could not load this scan.');
        setHistorySelectedId(null);
      } finally {
        setHistoryDetailLoading(false);
      }
    },
    [session?.token, logout],
  );

  const submitAuth = async () => {
    const email = emailInput.trim();
    const password = passwordInput;
    if (!email || !password) {
      Alert.alert('Missing fields', 'Enter email and password.');
      return;
    }
    setAuthBusy(true);
    try {
      const url = authMode === 'login' ? LOGIN_URL : REGISTER_URL;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      if (!data.token || !data.user?.email) {
        throw new Error('Unexpected server response.');
      }
      await persistSession(data.token, data.user.email);
      setPasswordInput('');
    } catch (e) {
      Alert.alert(authMode === 'login' ? 'Sign in failed' : 'Registration failed', e.message || 'Unknown error');
    } finally {
      setAuthBusy(false);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required to pick a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
      setExtractedText('');
      setLines([]);
      setScamVerdict(null);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
      setExtractedText('');
      setLines([]);
      setScamVerdict(null);
    }
  };

  const uploadAndExtract = async () => {
    if (!session?.token) {
      Alert.alert('Session expired', 'Please sign in again.');
      return;
    }
    if (!imageUri) {
      Alert.alert('No image', 'Choose a screenshot or take a photo first.');
      return;
    }

    setLoading(true);
    setExtractedText('');
    setLines([]);
    setScamVerdict(null);

    const authHeader = { Authorization: `Bearer ${session.token}` };

    try {
      const prepared = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
      );

      const formData = new FormData();
      formData.append('image', {
        uri: prepared.uri,
        name: 'scan.jpg',
        type: 'image/jpeg',
      });

      const response = await fetch(EXTRACT_URL, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
          ...authHeader,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        await logout();
        Alert.alert('Session expired', 'Please sign in again.');
        return;
      }

      if (!response.ok) {
        throw new Error(data.details || data.error || `HTTP ${response.status}`);
      }

      const text = data.text || '';
      setExtractedText(text);
      setLines(Array.isArray(data.lines) ? data.lines : []);

      if (text.trim()) {
        try {
          const clsRes = await fetch(CLASSIFY_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...authHeader,
            },
            body: JSON.stringify({ text }),
          });
          const clsData = await clsRes.json().catch(() => ({}));
          if (clsRes.status === 401) {
            await logout();
            Alert.alert('Session expired', 'Please sign in again.');
            return;
          }
          if (clsRes.ok) {
            setScamVerdict({
              label: clsData.label,
              score: clsData.score,
              threshold: clsData.threshold,
            });
          } else {
            setScamVerdict({
              error: clsData.error || `Classify HTTP ${clsRes.status}`,
            });
          }
        } catch (clsErr) {
          setScamVerdict({ error: clsErr.message || 'Classify request failed' });
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert(
        'Upload failed',
        `${e.message}\n\nUsing API: ${API_BASE}\n\n` +
          '• Phone and PC must be on the same Wi‑Fi.\n' +
          '• Run backend from repo root: npm run backend\n' +
          '• Windows: allow port 3001 in Firewall.\n' +
          '• Or set mobile/.env: EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:3001',
      );
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <View style={[styles.container, styles.loadingRoot]}>
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={styles.loadingScrollContent}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.demoPrimaryBtn}
            onPress={() => void openDemoSession()}
            activeOpacity={0.9}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.demoPrimaryBtnText}>Open app now — demo (no password)</Text>
          </TouchableOpacity>
          <Text style={styles.demoPrimaryHint}>
            Gets a preview token from the backend so Textract + scan history work. Backend must be running.
          </Text>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => void skipAuthLoadingWait()}
            activeOpacity={0.85}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.skipBtnText}>Skip check — use saved login only</Text>
          </TouchableOpacity>
          <Text style={styles.skipHint}>
            If you already signed in before, this opens the app without waiting for the server (UI may 401 if the
            token expired).
          </Text>

          <ActivityIndicator color="#fff" size="large" style={{ marginVertical: 20 }} />
          <Text style={styles.hint}>Checking sign-in with server…</Text>
        </ScrollView>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Scam Scanner</Text>
          <Text style={styles.authHeadline}>{authMode === 'login' ? 'Sign in' : 'Create account'}</Text>
          <Text style={styles.hint}>API: {API_BASE}</Text>

          <TouchableOpacity
            style={styles.demoPrimaryBtn}
            onPress={() => void openDemoSession()}
            activeOpacity={0.9}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.demoPrimaryBtnText}>Open app now — demo (no password)</Text>
          </TouchableOpacity>
          <Text style={styles.demoPrimaryHint}>
            Use this to reach the scanner and scan history for screenshots. Requires the backend running (same
            Wi‑Fi or EXPO_PUBLIC_API_URL).
          </Text>

          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={emailInput}
            onChangeText={setEmailInput}
            placeholder="you@example.com"
            placeholderTextColor="#6b5b7d"
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          <Text style={styles.inputLabel}>Password (min 8 characters)</Text>
          <TextInput
            style={styles.input}
            value={passwordInput}
            onChangeText={setPasswordInput}
            placeholder="••••••••"
            placeholderTextColor="#6b5b7d"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btnPrimary, authBusy && styles.btnDisabled]}
            onPress={submitAuth}
            disabled={authBusy}
          >
            {authBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{authMode === 'login' ? 'Sign in' : 'Create account'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            disabled={authBusy}
          >
            <Text style={styles.linkText}>
              {authMode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Scam Scanner</Text>
          <Text style={styles.signedIn} numberOfLines={1}>
            Signed in as {session.email}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>API: {API_BASE}</Text>
      {__DEV__ && API_BASE.includes('127.0.0.1') ? (
        <Text style={styles.warn}>
          On a physical phone, 127.0.0.1 will not work. Set EXPO_PUBLIC_API_URL in mobile/.env to
          http://YOUR_PC_IP:3001 (same Wi‑Fi).
        </Text>
      ) : null}

      <TouchableOpacity style={styles.historyOutlineBtn} onPress={openHistoryModal}>
        <Text style={styles.historyOutlineText}>Scan history</Text>
      </TouchableOpacity>

      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={pickFromLibrary}>
          <Text style={styles.btnText}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={takePhoto}>
          <Text style={styles.btnText}>Camera</Text>
        </TouchableOpacity>
      </View>

      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
      ) : (
        <Text style={styles.placeholder}>No image selected</Text>
      )}

      {scamVerdict?.label ? (
        <View style={styles.verdictBox}>
          <Text style={styles.verdictTitle}>ML verdict (logistic regression)</Text>
          <Text
            style={[
              styles.verdictLabel,
              scamVerdict.label === 'scam' ? styles.verdictScam : styles.verdictOk,
            ]}
          >
            {scamVerdict.label === 'scam' ? 'Likely scam / spam' : 'Likely legitimate'}
          </Text>
          <Text style={styles.verdictMeta}>
            score {typeof scamVerdict.score === 'number' ? scamVerdict.score.toFixed(3) : '—'} (threshold{' '}
            {scamVerdict.threshold ?? '—'})
          </Text>
          <Text style={styles.verdictDisclaimer}>Educational model only — not professional advice.</Text>
        </View>
      ) : scamVerdict?.error ? (
        <Text style={styles.verdictError}>Classifier: {scamVerdict.error}</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.btnPrimary, loading && styles.btnDisabled]}
        onPress={uploadAndExtract}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Extract text (Textract)</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Extracted text</Text>
      <ScrollView style={styles.textScroll} contentContainerStyle={styles.textScrollContent}>
        <Text style={styles.extracted}>
          {extractedText ||
            (lines.length ? lines.join('\n') : '— Run extract after choosing an image —')}
        </Text>
      </ScrollView>

      <Modal visible={historyOpen} animationType="slide" transparent onRequestClose={closeHistoryModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {historySelectedId ? 'Scan detail' : 'Recent scans'}
              </Text>
              <TouchableOpacity onPress={closeHistoryModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            {historySelectedId ? (
              <>
                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => {
                    setHistoryDetail(null);
                    setHistorySelectedId(null);
                  }}
                >
                  <Text style={styles.backLinkText}>← Back to list</Text>
                </TouchableOpacity>
                {historyDetailLoading || !historyDetail ? (
                  <ActivityIndicator color="#9b7df0" style={{ marginVertical: 24 }} />
                ) : (
                  <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                    <Text style={styles.detailMeta}>
                      {new Date(historyDetail.createdAt).toLocaleString()} ·{' '}
                      <Text
                        style={
                          historyDetail.label === 'scam' ? styles.detailScam : styles.detailOk
                        }
                      >
                        {historyDetail.label === 'scam' ? 'Likely scam' : 'Likely legitimate'}
                      </Text>
                      {' · '}
                      score {typeof historyDetail.score === 'number' ? historyDetail.score.toFixed(3) : '—'}
                    </Text>
                    <Text style={styles.detailBody}>{historyDetail.text || '—'}</Text>
                  </ScrollView>
                )}
              </>
            ) : historyLoading ? (
              <ActivityIndicator color="#9b7df0" style={{ marginVertical: 32 }} />
            ) : (
              <FlatList
                data={historyScans}
                keyExtractor={(item) => item.id}
                style={styles.historyList}
                refreshControl={
                  <RefreshControl
                    refreshing={historyRefreshing}
                    onRefresh={() => loadHistoryList({ fromRefresh: true })}
                    tintColor="#9b7df0"
                  />
                }
                ListEmptyComponent={
                  <Text style={styles.historyEmpty}>No scans yet. Run Textract on an image to build history.</Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.historyRow}
                    onPress={() => openHistoryDetail(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.historyRowDate}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                    <Text
                      style={[
                        styles.historyRowVerdict,
                        item.label === 'scam' ? styles.detailScam : styles.detailOk,
                      ]}
                    >
                      {item.label === 'scam' ? 'Scam' : 'OK'} ·{' '}
                      {typeof item.score === 'number' ? item.score.toFixed(2) : '—'}
                    </Text>
                    <Text style={styles.historyRowPreview} numberOfLines={3}>
                      {item.preview || '—'}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFill: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingRoot: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 20,
  },
  loadingScrollContent: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  demoPrimaryBtn: {
    backgroundColor: '#6c3ce7',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  demoPrimaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  demoPrimaryHint: {
    color: '#8b7a9e',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 22,
    textAlign: 'center',
  },
  skipHint: {
    color: '#8b7a9e',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 20,
    marginBottom: 16,
  },
  skipBtn: {
    backgroundColor: '#271E37',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d2f55',
  },
  skipBtnText: {
    color: '#e8e0f0',
    fontWeight: '700',
    fontSize: 15,
  },
  container: {
    flex: 1,
    backgroundColor: '#0D0716',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 8,
  },
  signedIn: {
    fontSize: 12,
    color: '#a898c4',
    marginTop: 2,
  },
  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#271E37',
    marginTop: 4,
  },
  logoutText: {
    color: '#e8e0f0',
    fontWeight: '600',
    fontSize: 13,
  },
  authHeadline: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e8e0f0',
    marginBottom: 8,
  },
  inputLabel: {
    color: '#c4b8d4',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#170D27',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3d2f55',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#e8e0f0',
    fontSize: 16,
  },
  linkBtn: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: '#9b7df0',
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  hint: {
    fontSize: 11,
    color: '#8b7a9e',
    marginBottom: 16,
  },
  warn: {
    fontSize: 12,
    color: '#ffb020',
    marginBottom: 12,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  btn: {
    flex: 1,
    backgroundColor: '#271E37',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: '#6c3ce7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  preview: {
    width: '100%',
    height: 200,
    backgroundColor: '#170D27',
    borderRadius: 12,
    marginBottom: 16,
  },
  placeholder: {
    color: '#6b5b7d',
    textAlign: 'center',
    paddingVertical: 72,
    marginBottom: 16,
  },
  verdictBox: {
    backgroundColor: '#1a1228',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#3d2f55',
  },
  verdictTitle: {
    color: '#a898c4',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  verdictLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  verdictScam: {
    color: '#ff6b6b',
  },
  verdictOk: {
    color: '#69db7c',
  },
  verdictMeta: {
    color: '#c4b8d4',
    fontSize: 13,
    marginBottom: 6,
  },
  verdictDisclaimer: {
    color: '#6b5b7d',
    fontSize: 11,
  },
  verdictError: {
    color: '#ffb020',
    fontSize: 12,
    marginBottom: 12,
  },
  sectionLabel: {
    color: '#c4b8d4',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textScroll: {
    flex: 1,
    backgroundColor: '#170D27',
    borderRadius: 12,
  },
  textScrollContent: {
    padding: 14,
  },
  extracted: {
    color: '#e8e0f0',
    fontSize: 15,
    lineHeight: 22,
  },
  historyOutlineBtn: {
    borderWidth: 1,
    borderColor: '#3d2f55',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#1a1228',
  },
  historyOutlineText: {
    color: '#c4b8d4',
    fontWeight: '600',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#120a1c',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: '#2d2240',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalClose: {
    color: '#9b7df0',
    fontSize: 16,
    fontWeight: '600',
  },
  historyList: {
    maxHeight: 480,
  },
  historyEmpty: {
    color: '#6b5b7d',
    textAlign: 'center',
    paddingVertical: 32,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  historyRow: {
    backgroundColor: '#170D27',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2d2240',
  },
  historyRowDate: {
    color: '#8b7a9e',
    fontSize: 11,
    marginBottom: 4,
  },
  historyRowVerdict: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  historyRowPreview: {
    color: '#c4b8d4',
    fontSize: 13,
    lineHeight: 18,
  },
  backLink: {
    marginBottom: 10,
  },
  backLinkText: {
    color: '#9b7df0',
    fontSize: 15,
    fontWeight: '600',
  },
  modalScroll: {
    maxHeight: 420,
  },
  detailMeta: {
    color: '#a898c4',
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 20,
  },
  detailScam: {
    color: '#ff6b6b',
    fontWeight: '700',
  },
  detailOk: {
    color: '#69db7c',
    fontWeight: '700',
  },
  detailBody: {
    color: '#e8e0f0',
    fontSize: 14,
    lineHeight: 22,
  },
});
