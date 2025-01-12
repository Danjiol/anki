import { GEMINI_API_KEY } from '@env';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  Image,
  StyleSheet,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

// Utility function to convert image to Base64
const imageToBase64 = async (uri) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const base64Data = result.split(',')[1]; // Remove the Data-URL prefix
          resolve(base64Data);
        } else {
          reject(new Error('Failed to read file as base64 string.'));
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to Base64:', error);
    throw error;
  }
};

// Function to interact with Gemini
const askLLM = async ({ prompt, base64Image, jsonMode = false, useWebSearch = false }) => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

  try {
    let contents = [{
      parts: [{ text: prompt }]
    }];

    if (base64Image) {
      contents[0].parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      });
    }

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contents }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to get response from Gemini');
    }

    const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!result) {
      throw new Error('No response from Gemini.');
    }

    return result;
  } catch (error) {
    console.error('Error in askLLM:', error);
    throw new Error('Failed to get a response from Gemini.');
  }
};

// Function to send a request to FlashExp
const sendRequestToFlashExp = async (userPrompt, base64Image = undefined) => {
  try {
    const response = await askLLM({
      prompt: userPrompt,
      base64Image,
      jsonMode: false,
      useWebSearch: false,
    });
    return response;
  } catch (error) {
    console.error('Error sending request to GPT-4o:', error);
    throw new Error('Failed to get a response from GPT-4o.');
  }
};

// Function to send a request to the backend API
const sendRequestToApi = async (vocabulary, deckName) => {
  try {
    const vocabObject = {};
    vocabulary.forEach(entry => {
      vocabObject[entry.translated.trim()] = entry.original.trim();
    });

    const payload = {
      deck_name: deckName || 'Default Deck',
      vocabulary: vocabObject,
    };

    const response = await axios.post(
      'https://dianjeol.pythonanywhere.com/api/convert-direct',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || 'Invalid API response');
    }

    return response.data;
  } catch (error) {
    console.error('API request error:', error);
    let errorMessage = 'An unexpected error occurred.';

    if (error.response) {
      switch (error.response.status) {
        case 400:
          errorMessage = 'Bad Request: Please check the provided vocabulary.';
          break;
        case 413:
          errorMessage = 'The vocabulary list is too large.';
          break;
        case 429:
          errorMessage = 'Too many requests. Please wait and try again.';
          break;
        case 500:
          errorMessage = 'The server encountered an error. Please try again later.';
          break;
        default:
          errorMessage = `Server Error (${error.response.status}): ${error.response.data?.message || 'Unknown error'}`;
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'The request timed out. Please try again.';
    } else if (error.request) {
      errorMessage = 'No response received from the server.';
    }

    throw new Error(errorMessage);
  }
};

// Language data
const languages = [
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'am', name: 'አማርኛ', flag: '🇪🇹' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fa-AF', name: 'دری', flag: '🇦🇫' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ka', name: 'ქართული', flag: '🇬🇪' },
  { code: 'ku', name: 'Kurdî', flag: '🏳️' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'so', name: 'Soomaali', flag: '🇸🇴' },
  { code: 'ti', name: 'ትግርኛ', flag: '🇪🇷' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
].sort((a, b) => a.name.localeCompare(b.name));

// Translations for UI text
const translations = {
  en: {
    'Vocabulary Card Creator': 'Vocabulary Card Creator',
    'Create Anki flashcards from text or images': 'Create Anki flashcards from text or images',
    'Get Started': 'Get Started',
    'Select Target Language': 'Select Target Language',
    'Choose Input Method': 'Choose Input Method',
    'Upload Image': 'Upload Image',
    'Enter Text': 'Enter Text',
    'Paste your text here...': 'Paste your text here...',
    'Create Flashcards': 'Create Flashcards',
    'Select Words': 'Select Words',
    'Success!': 'Success!',
    'Your Anki deck is ready': 'Your Anki deck is ready',
    'Download .apkg file': 'Download .apkg file',
    'Create new deck': 'Create new deck',
    'Take Photo': 'Take Photo',
    'Choose Deck Type': 'Choose Deck Type',
    'What type of cards do you want to create?': 'What type of cards do you want to create?',
    'Vocabulary Cards': 'Vocabulary Cards',
    'Q&A Cards': 'Q&A Cards',
    // Add more translations as needed
  },
  de: {
    'Vocabulary Card Creator': 'Vokabelkarten-Ersteller',
    'Create Anki flashcards from text or images': 'Erstelle Anki-Karten aus Text oder Bildern',
    'Get Started': 'Loslegen',
    'Select Target Language': 'Zielsprache auswählen',
    'Choose Input Method': 'Eingabemethode wählen',
    'Upload Image': 'Bild hochladen',
    'Enter Text': 'Text eingeben',
    'Paste your text here...': 'Füge deinen Text hier ein...',
    'Create Flashcards': 'Karteikarten erstellen',
    'Select Words': 'Wörter auswählen',
    'Success!': 'Erfolg!',
    'Your Anki deck is ready': 'Dein Anki-Deck ist fertig',
    'Download .apkg file': '.apkg-Datei herunterladen',
    'Create new deck': 'Neues Deck erstellen',
    'Take Photo': 'Foto aufnehmen',
    'Q&A Mode': 'Frage & Antwort Modus',
    'Ask a Question': 'Stelle eine Frage',
    'Type your question here...': 'Gib deine Frage hier ein...',
    'Ask': 'Fragen',
    'Choose Deck Type': 'Wähle Kartentyp',
    'What type of cards do you want to create?': 'Welche Art von Karten möchtest du erstellen?',
    'Vocabulary Cards': 'Vokabelkarten',
    'Q&A Cards': 'Frage-Antwort-Karten',
    // Add more translations as needed
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
    height: 50,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 10,
  },
  languageButton: {
    width: '48%',
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
    height: 70,
    justifyContent: 'center',
  },
  languageButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  languageFlag: {
    fontSize: 24,
    marginBottom: 2,
  },
  inputButton: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    height: 60,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  fixedButtonContainer: {
    ...Platform.select({
      web: {
        position: 'relative',
        bottom: 0,
        left: 0,
        right: 0,
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
      }
    })
  },
  progressText: {
    fontSize: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  wordListPreview: {
    fontSize: 16,
    padding: 10,
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
    height: 50,
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  wordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  wordInputs: {
    marginLeft: 10,
    flex: 1,
  },
  textInputMultiline: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    marginBottom: 5,
    fontSize: 16,
  },
  answer: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
});

// UI Components
const WelcomeScreen = ({ onNext, selectedLanguage }) => {
  const t = (text) =>
    translations[selectedLanguage?.code || 'en']?.[text] || text;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('Vocabulary Card Creator')}</Text>
      <Text style={styles.subtitle}>
        {t('Create Anki flashcards from text or images')}
      </Text>
      <TouchableOpacity onPress={onNext} style={styles.button}>
        <Text style={styles.buttonText}>{t('Get Started')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const LanguageScreen = ({ onSelectLanguage, selectedLanguage }) => {
  const t = (text) =>
    translations[selectedLanguage?.code || 'en']?.[text] || text;
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t('Select Target Language')}</Text>
      <View style={styles.languageGrid}>
        {languages.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={styles.languageButton}
            onPress={() => onSelectLanguage(lang)}
          >
            <Text style={styles.languageFlag}>{lang.flag}</Text>
            <Text style={styles.languageButtonText}>{t(lang.name)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const InputScreen = ({ onImageUpload, onTakePhoto, onTextInput, onQAMode, selectedLanguage }) => {
  const t = (text) =>
    translations[selectedLanguage?.code || 'en']?.[text] || text;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('Choose Input Method')}</Text>
      <TouchableOpacity style={styles.inputButton} onPress={onImageUpload}>
        <Ionicons name="images" size={24} color="white" />
        <Text style={styles.buttonText}>{t('Upload Image')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.inputButton} onPress={onTakePhoto}>
        <Ionicons name="camera" size={24} color="white" />
        <Text style={styles.buttonText}>{t('Take Photo')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.inputButton} onPress={onTextInput}>
        <Ionicons name="create" size={24} color="white" />
        <Text style={styles.buttonText}>{t('Enter Text')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.inputButton} onPress={onQAMode}>
        <Ionicons name="chatbubbles" size={24} color="white" />
        <Text style={styles.buttonText}>{t('Q&A Mode')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const TextInputScreen = ({ onSubmit, selectedLanguage }) => {
  const t = (text) =>
    translations[selectedLanguage?.code || 'en']?.[text] || text;
  const [text, setText] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('Enter Text')}</Text>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
      >
        <TextInput
          style={styles.textInput}
          multiline
          placeholder={t('Paste your text here...')}
          value={text}
          onChangeText={setText}
        />
      </ScrollView>
      <View style={styles.fixedButtonContainer}>
        <TouchableOpacity
          style={[styles.button, !text && styles.buttonDisabled]}
          onPress={() => text && onSubmit(text)}
          disabled={!text}
        >
          <Text style={styles.buttonText}>{t('Create Flashcards')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ProcessingScreen = ({ progress, selectedLanguage }) => {
  const t = (text) =>
    translations[selectedLanguage?.code || 'en']?.[text] || text;
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.progressText}>{t(progress)}</Text>
    </View>
  );
};

const PreviewScreen = ({ wordList, onConfirm, onBack, selectedLanguage }) => {
  const t = (text) =>
    translations[selectedLanguage?.code || 'en']?.[text] || text;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('Preview Word List')}</Text>
      <ScrollView 
        style={[styles.scrollContainer, { marginBottom: 140 }]}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <Text style={styles.wordListPreview}>{wordList}</Text>
      </ScrollView>
      <View style={[styles.fixedButtonContainer, { backgroundColor: '#fff' }]}>
        <TouchableOpacity style={styles.button} onPress={onConfirm}>
          <Text style={styles.buttonText}>{t('Confirm and Send')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t('Back')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const SelectionScreen = ({
  words,
  onSubmit,
  setProcessing,
  deckName,
  selectedLanguage,
}) => {
  const t = (text) =>
    translations[selectedLanguage?.code || 'en']?.[text] || text;
  const [selectedWords, setSelectedWords] = useState(
    words.map((w) => ({ ...w, selected: true })),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [inputHeights, setInputHeights] = useState({});

  const handleContentSizeChange = (index, field, contentHeight) => {
    setInputHeights(prev => ({
      ...prev,
      [`${index}-${field}`]: Math.max(40, contentHeight + 10)
    }));
  };

  const updateWord = (index, field, value) => {
    setSelectedWords((prev) =>
      prev.map((word, i) => (i === index ? { ...word, [field]: value } : word)),
    );
  };

  const toggleWord = (index) => {
    setSelectedWords((prev) =>
      prev.map((word, i) =>
        i === index ? { ...word, selected: !word.selected } : word,
      ),
    );
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    const finalWords = selectedWords.filter((w) => w.selected);
    console.log('Selected words count:', finalWords.length);

    if (finalWords.length === 0) {
      Alert.alert(t('Error'), t('Please select at least one word.'));
      setIsLoading(false);
      return;
    }

    try {
      setProcessing(t('Generating Anki deck...'));
      console.log('Sending to API:', finalWords.length, 'words');
      const result = await sendRequestToApi(finalWords, deckName);
      console.log('API response received');

      if (result.download_url) {
        onSubmit(result.download_url);
        Alert.alert(t('Success!'), t('Your Anki deck is ready!'));
      } else {
        throw new Error('Invalid API response: Missing download URL');
      }
    } catch (error) {
      console.error('Error creating Anki deck:', error);
      let errorMessage = t('An unexpected error has occurred.');

      if (error.code === 'ECONNABORTED') {
        errorMessage = t(
          'The connection to the server was interrupted. Please check your internet connection and try again.',
        );
      } else if (error.response) {
        switch (error.response.status) {
          case 400:
            errorMessage = t(
              'Bad Request: Please check the format of the selected words.',
            );
            break;
          case 413:
            errorMessage = t(
              'The file is too large. Please reduce the number of selected words.',
            );
            break;
          case 429:
            errorMessage = t(
              'Too many requests. Please wait a moment and try again.',
            );
            break;
          case 500:
            errorMessage = t(
              'The server could not process your request. Please try again later.',
            );
            break;
          default:
            errorMessage = t(
              `Error communicating with the server (Status: ${error.response.status}).`,
            );
        }
      } else if (error.request) {
        errorMessage = t(
          'No response received from the server. Please check your internet connection.',
        );
      }

      Alert.alert(t('Error'), errorMessage);
    } finally {
      setProcessing('');
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t('Select Words')}</Text>
      <Text style={styles.subtitle}>{t('Select Words and Translations')}</Text>
      {selectedWords.map((word, index) => (
        <View key={index} style={styles.wordItem}>
          <TouchableOpacity onPress={() => toggleWord(index)}>
            <Ionicons
              name={word.selected ? 'checkbox' : 'square-outline'}
              size={24}
              color="#007AFF"
            />
          </TouchableOpacity>
          <View style={styles.wordInputs}>
            <TextInput
              style={[
                styles.textInputMultiline,
                {
                  height: inputHeights[`${index}-translated`] || 40,
                },
              ]}
              value={word.translated}
              placeholder={t('Translation')}
              onChangeText={(text) => updateWord(index, 'translated', text)}
              multiline
              textAlignVertical="top"
              onContentSizeChange={(e) =>
                handleContentSizeChange(
                  index,
                  'translated',
                  e.nativeEvent.contentSize.height,
                )
              }
            />
            <TextInput
              style={[
                styles.textInputMultiline,
                {
                  height: inputHeights[`${index}-original`] || 40,
                },
              ]}
              value={word.original}
              placeholder={t('Original')}
              onChangeText={(text) => updateWord(index, 'original', text)}
              multiline
              textAlignVertical="top"
              onContentSizeChange={(e) =>
                handleContentSizeChange(
                  index,
                  'original',
                  e.nativeEvent.contentSize.height,
                )
              }
            />
          </View>
        </View>
      ))}
      {isLoading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : (
        <TouchableOpacity
          style={[
            styles.button,
            selectedWords.filter((w) => w.selected).length === 0 &&
              styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={
            selectedWords.filter((w) => w.selected).length === 0 || isLoading
          }
        >
          <Text style={styles.buttonText}>{t('Next')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const ResultScreen = ({ downloadUrl, onReset, selectedLanguage }) => {
  const t = (text) =>
    translations[selectedLanguage?.code || 'en']?.[text] || text;

  const handleDownload = () => {
    if (Platform.OS === 'web') {
      window.open(downloadUrl, '_blank');
    } else {
      // Handle native download
    }
  };

  return (
    <View style={styles.container}>
      <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
      <Text style={styles.title}>{t('Success!')}</Text>
      <Text style={styles.subtitle}>{t('Your Anki deck is ready')}</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handleDownload}
      >
        <Text style={styles.buttonText}>{t('Download Anki deck')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={onReset}>
        <Text style={styles.secondaryButtonText}>{t('Create new deck')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const QAScreen = ({ selectedLanguage }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const t = (text) =>
    translations[selectedLanguage?.code || 'en']?.[text] || text;

  const handleAsk = async () => {
    if (!question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    setIsLoading(true);
    try {
      const response = await askLLM({
        prompt: question,
        useWebSearch: false,
      });
      setAnswer(response);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('Ask a Question')}</Text>
      <TextInput
        style={[styles.textInput, { height: 100 }]}
        multiline
        placeholder={t('Type your question here...')}
        value={question}
        onChangeText={setQuestion}
      />
      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleAsk}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? '...' : t('Ask')}
        </Text>
      </TouchableOpacity>
      
      {answer && (
        <ScrollView style={{ marginTop: 20, flex: 1 }}>
          <Text style={styles.answer}>{answer}</Text>
        </ScrollView>
      )}
    </View>
  );
};

const DeckTypeScreen = ({ onSelectType, content, selectedLanguage }) => {
  const t = (text) =>
    translations[selectedLanguage?.code || 'en']?.[text] || text;

  const handleVocabulary = () => {
    onSelectType('vocabulary', content);
  };

  const handleQA = () => {
    onSelectType('qa', content);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('Choose Deck Type')}</Text>
      <Text style={styles.subtitle}>{t('What type of cards do you want to create?')}</Text>
      
      <TouchableOpacity style={styles.inputButton} onPress={handleVocabulary}>
        <Ionicons name="book" size={24} color="white" />
        <Text style={styles.buttonText}>{t('Vocabulary Cards')}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.inputButton} onPress={handleQA}>
        <Ionicons name="chatbubbles" size={24} color="white" />
        <Text style={styles.buttonText}>{t('Q&A Cards')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const RootApp = () => {
  const [step, setStep] = useState('language');
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [processing, setProcessing] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [extractedWords, setExtractedWords] = useState([]);
  const [deckName, setDeckName] = useState('');
  const [inputText, setInputText] = useState('');

  const handleTakePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Could not take photo. Please try again.');
    }
  };

  const handleImageUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Could not upload image. Please try again.');
    }
  };

  const processImage = async (uri) => {
    try {
      setProcessing('Processing image...');
      
      // Convert image to base64
      const base64Image = await imageToBase64(uri);
      
      const response = await askLLM({
        prompt: `Please analyze this image and extract any text or words you can find. Format the output as a simple list of words.`,
        base64Image,
        useWebSearch: false,
      });

      if (response) {
        setInputText(response);
        setProcessing('');
        handleTextProcessing(response);
      } else {
        throw new Error('Invalid API response');
      }
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'The image could not be processed. Please try again.');
      setProcessing('');
    }
  };

  const handleTextProcessing = async (text) => {
    try {
      setProcessing('Processing text...');
      setInputText(text); // Store the processed text
      setStep('deckType'); // Go to deck type selection instead of directly to selection
    } catch (error) {
      console.error('Error processing text:', error);
      Alert.alert(
        'Error',
        'Failed to process text. Please try again.',
      );
    } finally {
      setProcessing('');
    }
  };

  const handleDeckTypeSelection = async (type, content) => {
    setProcessing('Generating cards...');
    try {
      if (type === 'vocabulary') {
        // Existing vocabulary processing
        const prompt = `Extract vocabulary words from this text and translate them to ${selectedLanguage.name}. Return ONLY a simple list where each line contains the word in the original language, followed by a semicolon, and then the word in ${selectedLanguage.name}. Example format:
original_word;translated_word

Here is the text:
${content}`;

        const wordList = await sendRequestToFlashExp(prompt);
        const words = wordList
          .split('\n')
          .map((w) => w.trim())
          .filter(Boolean)
          .map((line) => {
            const [original, translated] = line.split(';').map((w) => w.trim());
            return { original, translated };
          });

        setExtractedWords(words);
        setStep('selection');
      } else if (type === 'qa') {
        // Angepasster Prompt für alle Sprachen
        const prompt = `You are an expert in creating Anki flashcards. Create question-answer pairs from the following text.
        The text is in the original language. Create questions and answers in the original language, 
        and add ${selectedLanguage.name} translations in parentheses.

        Follow these Anki best practices:
        - Questions should be specific and clear
        - Each question should test one concept
        - Answers should be concise
        - Avoid yes/no questions
        - Use the minimum information principle
        
        Format EXACTLY like this:
        F: [Original Question] (${selectedLanguage.name} translation of question)
        A: [Original Answer] (${selectedLanguage.name} translation of answer)

        Example format:
        F: Wo liegt Paris? (Where is Paris?)
        A: Paris liegt in Frankreich (Paris is in France)
        
        Text to process:
        ${content}`;

        const response = await askLLM({
          prompt: prompt,
          useWebSearch: false,
        });

        const pairs = response
          .split('\n\n')
          .filter(Boolean)
          .map(pair => {
            const [question, answer] = pair.split('\n');
            return {
              translated: question.replace('F: ', '').trim(),
              original: answer.replace('A: ', '').trim()
            };
          });

        setExtractedWords(pairs);
        setStep('selection');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to generate cards. Please try again.');
    } finally {
      setProcessing('');
    }
  };

  const resetApp = () => {
    setStep('language');
    setSelectedLanguage(null);
    setProcessing('');
    setDownloadUrl('');
    setExtractedWords([]);
  };

  if (processing) {
    return <ProcessingScreen progress={processing} selectedLanguage={selectedLanguage} />;
  }

  switch (step) {
    case 'language':
      return (
        <LanguageScreen
          onSelectLanguage={(lang) => {
            setSelectedLanguage(lang);
            setStep('input');
          }}
          selectedLanguage={selectedLanguage}
        />
      );
    case 'input':
      return (
        <InputScreen
          onImageUpload={handleImageUpload}
          onTakePhoto={handleTakePhoto}
          onTextInput={() => setStep('text')}
          onQAMode={() => setStep('qa')}
          selectedLanguage={selectedLanguage}
        />
      );
    case 'text':
      return (
        <TextInputScreen
          onSubmit={(text) => {
            setInputText(text);
            handleTextProcessing(text);
          }}
          selectedLanguage={selectedLanguage}
        />
      );
    case 'selection':
      return (
        <SelectionScreen
          words={extractedWords}
          deckName={deckName}
          onSubmit={(downloadUrl) => {
            setDownloadUrl(downloadUrl);
            setStep('result');
          }}
          setProcessing={setProcessing}
          selectedLanguage={selectedLanguage}
        />
      );
    case 'result':
      return <ResultScreen downloadUrl={downloadUrl} onReset={resetApp} selectedLanguage={selectedLanguage} />;
    case 'qa':
      return <QAScreen selectedLanguage={selectedLanguage} />;
    case 'deckType':
      return (
        <DeckTypeScreen
          onSelectType={handleDeckTypeSelection}
          content={inputText}
          selectedLanguage={selectedLanguage}
        />
      );
    default:
      return null;
  }
};

export default RootApp;
