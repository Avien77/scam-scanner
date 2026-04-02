import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';

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
  const usable =
    metroIp &&
    metroIp !== '127.0.0.1' &&
    metroIp !== 'localhost';

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

export default function App() {
  const [imageUri, setImageUri] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scamVerdict, setScamVerdict] = useState(null);

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
    if (!imageUri) {
      Alert.alert('No image', 'Choose a screenshot or take a photo first.');
      return;
    }

    setLoading(true);
    setExtractedText('');
    setLines([]);
    setScamVerdict(null);

    try {
      // Textract sync API supports JPEG/PNG/TIFF — not HEIC/WebP. iPhone photos are often HEIC.
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
        },
      });

      const data = await response.json().catch(() => ({}));

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
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ text }),
          });
          const clsData = await clsRes.json().catch(() => ({}));
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

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>Scam Scanner</Text>
      <Text style={styles.hint}>API: {API_BASE}</Text>
      {__DEV__ && API_BASE.includes('127.0.0.1') ? (
        <Text style={styles.warn}>
          On a physical phone, 127.0.0.1 will not work. Set EXPO_PUBLIC_API_URL in mobile/.env to
          http://YOUR_PC_IP:3001 (same Wi‑Fi).
        </Text>
      ) : null}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0716',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 24,
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
});
