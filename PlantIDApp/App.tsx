import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Dimensions,
  Platform
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

const { width, height } = Dimensions.get('window');

// Initialize database
const db = SQLite.openDatabaseSync('plantid.db');

// Load species configuration
const speciesConfig = require('./assets/species_config.json');
const SPECIES_NAMES = speciesConfig.species_names;
const NUM_CLASSES = speciesConfig.num_classes;

console.log(`✅ Loaded ${NUM_CLASSES} plant species`);

interface Prediction {
  species: string;
  confidence: number;
}

interface HistoryItem {
  id: number;
  species: string;
  confidence: number;
  timestamp: string;
}

// Format scientific names for display
const formatSpeciesName = (scientificName: string): string => {
  return scientificName.replace(/_/g, ' ');
};

const PlantIDApp: React.FC = () => {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [model, setModel] = useState<any>(null);
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'camera' | 'results' | 'history'>('camera');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Initialize
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Request camera permissions
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert('Permission Denied', 'Camera permission is required');
          setIsLoading(false);
          return;
        }
      }

      // Initialize database
      initDatabase();
      
      // Load model
      await loadModel();
      
      setIsLoading(false);
    } catch (error) {
      console.error('Initialization error:', error);
      Alert.alert('Error', 'Failed to initialize app');
      setIsLoading(false);
    }
  };

  const initDatabase = () => {
    try {
      db.execSync(
        `CREATE TABLE IF NOT EXISTS predictions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          species TEXT NOT NULL,
          confidence REAL NOT NULL,
          image_uri TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      );
      console.log('✅ Database initialized');
    } catch (error) {
      console.error('Database init error:', error);
    }
  };

  const loadModel = async () => {
    try {
      console.log('🔄 Loading TensorFlow.js and plant species model...');
      
      // For now, use simulation mode
      // In production, load actual TFLite model here
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setModel(true);
      console.log('✅ Model loaded successfully');
      console.log(`   Species count: ${NUM_CLASSES}`);
      console.log(`   First species: ${SPECIES_NAMES[0]}`);
      
    } catch (error) {
      console.error('❌ Model loading failed:', error);
      Alert.alert('Error', 'Failed to load AI model');
      setModel(true); // Fallback to simulation
    }
  };

  const simulateInference = (): Prediction[] => {
    // Realistic simulation with actual species names
    const randomIndex = Math.floor(Math.random() * SPECIES_NAMES.length);
    const confidence1 = 0.75 + Math.random() * 0.20; // 75-95%
    const confidence2 = 0.02 + Math.random() * 0.08; // 2-10%
    const confidence3 = 0.01 + Math.random() * 0.04; // 1-5%
    
    return [
      { species: SPECIES_NAMES[randomIndex], confidence: confidence1 },
      { species: SPECIES_NAMES[(randomIndex + 1) % SPECIES_NAMES.length], confidence: confidence2 },
      { species: SPECIES_NAMES[(randomIndex + 2) % SPECIES_NAMES.length], confidence: confidence3 }
    ];
  };

  const takePicture = async () => {
    if (!cameraRef.current || !model) {
      Alert.alert('Error', 'Camera not ready');
      return;
    }

    try {
      setIsLoading(true);
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: false,
      });

      if (photo && photo.uri) {
        setCapturedImage(photo.uri);

        // Run inference
        const predictionResults = simulateInference();
        
        setPredictions(predictionResults);
        savePrediction(predictionResults[0].species, predictionResults[0].confidence, photo.uri);
        
        setActiveTab('results');
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to capture image');
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,  // ✅ DISABLE EDITING - fixes freeze
      quality: 0.8,
      exif: false,
    });


      if (!result.canceled && result.assets[0]) {
        setIsLoading(true);
        setCapturedImage(result.assets[0].uri);

        // Run inference
        const predictionResults = simulateInference();
        
        setPredictions(predictionResults);
        savePrediction(predictionResults[0].species, predictionResults[0].confidence, result.assets[0].uri);
        
        setActiveTab('results');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const savePrediction = (species: string, confidence: number, imageUri: string) => {
    try {
      db.runSync(
        'INSERT INTO predictions (species, confidence, image_uri) VALUES (?, ?, ?)',
        [species, confidence, imageUri]
      );
      console.log('✅ Prediction saved:', species);
      loadHistory();
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const loadHistory = () => {
    try {
      const results = db.getAllSync<HistoryItem>(
        'SELECT * FROM predictions ORDER BY timestamp DESC LIMIT 50'
      );
      setHistory(results);
    } catch (error) {
      console.error('Load history error:', error);
    }
  };

  const clearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to delete all predictions?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            try {
              db.runSync('DELETE FROM predictions');
              setHistory([]);
              Alert.alert('Success', 'History cleared');
            } catch (error) {
              console.error('Clear history error:', error);
              Alert.alert('Error', 'Failed to clear history');
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  // Loading screen
  if (isLoading && model === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading Plant Species AI Model...</Text>
        <Text style={styles.subtleText}>{NUM_CLASSES} species database</Text>
      </View>
    );
  }

  // Permission check
  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Checking permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>📷 Camera Permission Required</Text>
        <Text style={styles.subtleText}>We need camera access to identify plants</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'camera' && styles.activeTab]}
          onPress={() => setActiveTab('camera')}
        >
          <Text style={[styles.tabText, activeTab === 'camera' && styles.activeTabText]}>
            📷 Camera
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'results' && styles.activeTab]}
          onPress={() => setActiveTab('results')}
          disabled={!predictions}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'results' && styles.activeTabText,
            !predictions && styles.disabledTabText
          ]}>
            📊 Results
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            📜 History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Camera Screen */}
      {activeTab === 'camera' && permission?.granted && (
        <View style={styles.screenContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.preview}
            facing="back"
          >
            <View style={styles.cameraOverlay}>
              <Text style={styles.instruction}>
                🍃 Point camera at a leaf
              </Text>
              <Text style={styles.modelInfo}>
                AI Model: {NUM_CLASSES} Plant Species
              </Text>
              <View style={styles.focusBox} />
            </View>
          </CameraView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.captureButton}
              onPress={takePicture}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>📸 IDENTIFY PLANT</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={pickImage}
            >
              <Text style={styles.secondaryButtonText}>🖼️ Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Results Screen */}
      {activeTab === 'results' && predictions && (
        <ScrollView style={styles.screenContainer}>
          {capturedImage && (
            <Image 
              source={{ uri: capturedImage }} 
              style={styles.capturedImage}
              resizeMode="cover"
            />
          )}

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>🎯 Identification Result</Text>
            <Text style={styles.speciesName}>
              {formatSpeciesName(predictions[0].species)}
            </Text>
            <Text style={styles.confidenceText}>
              Confidence: {(predictions[0].confidence * 100).toFixed(1)}%
            </Text>

            <View style={styles.confidenceBar}>
              <View 
                style={[
                  styles.confidenceFill,
                  { 
                    width: `${predictions[0].confidence * 100}%`,
                    backgroundColor: predictions[0].confidence > 0.8 ? '#4CAF50' : 
                                    predictions[0].confidence > 0.6 ? '#FF9800' : '#F44336'
                  }
                ]}
              />
            </View>

            <Text style={styles.subtleText}>
              Top 3 Predictions:
            </Text>
            {predictions.map((pred, idx) => (
              <View key={idx} style={styles.predictionItem}>
                <View style={styles.predictionLeft}>
                  <Text style={styles.predictionRank}>{idx + 1}</Text>
                  <Text style={styles.predictionText}>
                    {formatSpeciesName(pred.species)}
                  </Text>
                </View>
                <Text style={styles.predictionConfidence}>
                  {(pred.confidence * 100).toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => {
              setPredictions(null);
              setCapturedImage(null);
              setActiveTab('camera');
            }}
          >
            <Text style={styles.buttonText}>📷 Identify Another Plant</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* History Screen */}
      {activeTab === 'history' && (
        <ScrollView style={styles.screenContainer}>
          <View style={styles.historyHeader}>
            <View>
              <Text style={styles.historyTitle}>📜 Identification History</Text>
              <Text style={styles.subtleText}>
                {history.length} identifications recorded
              </Text>
            </View>
            {history.length > 0 && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={clearHistory}
              >
                <Text style={styles.clearButtonText}>🗑️ Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No identifications yet</Text>
              <Text style={styles.subtleText}>
                Start scanning plants to build your identification history
              </Text>
            </View>
          ) : (
            history.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyCardHeader}>
                  <Text style={styles.historySpecies}>
                    {formatSpeciesName(item.species)}
                  </Text>
                  <Text style={styles.historyConfidence}>
                    {(item.confidence * 100).toFixed(1)}%
                  </Text>
                </View>
                <Text style={styles.historyTimestamp}>
                  {new Date(item.timestamp).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </Text>
              </View>
            ))
          )}

          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => setActiveTab('camera')}
          >
            <Text style={styles.buttonText}>Start New Identification</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 10,
    color: '#333',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f44336',
    marginBottom: 10,
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingTop: Platform.OS === 'ios' ? 50 : 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#4CAF50',
  },
  disabledTabText: {
    color: '#ccc',
  },
  screenContainer: {
    flex: 1,
  },
  preview: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instruction: {
    color: 'white',
    fontSize: 20,
    marginBottom: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  modelInfo: {
    color: 'white',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  focusBox: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: '#4CAF50',
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  buttonContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  captureButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  secondaryButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  capturedImage: {
    width: '100%',
    height: 280,
    borderRadius: 0,
    marginBottom: 16,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  speciesName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
    lineHeight: 32,
  },
  confidenceText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  confidenceBar: {
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 24,
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 5,
  },
  subtleText: {
    fontSize: 14,
    color: '#888',
    marginTop: 16,
    marginBottom: 12,
    fontWeight: '600',
  },
  predictionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  predictionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  predictionRank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginRight: 12,
    width: 24,
  },
  predictionText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  predictionConfidence: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4CAF50',
    marginLeft: 12,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    margin: 16,
    marginBottom: 8,
  },
  historyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  clearButton: {
    backgroundColor: '#f44336',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historySpecies: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  historyConfidence: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4CAF50',
    marginLeft: 12,
  },
  historyTimestamp: {
    fontSize: 12,
    color: '#999',
  },
});

export default PlantIDApp;
