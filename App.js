import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Animated, Easing, Dimensions, Platform, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, FlatList, ImageBackground, PanResponder } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function App() {
  let [fontsLoaded] = useFonts({
    BebasNeue: BebasNeue_400Regular,
  });

  const [hasVoted, setHasVoted] = useState(false);
  const [votes, setVotes] = useState({ q1: 154, q2: 98 });
  const [customQuote, setCustomQuote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isAdminVisible, setIsAdminVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoginVisible, setIsLoginVisible] = useState(false);
  const [tapCount, setTapCount] = useState(0);

  const vsScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.4)).current;
  const instructionOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Instruction fade out after 2 seconds
    setTimeout(() => {
      Animated.timing(instructionOpacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    }, 2000);
    Animated.loop(
      Animated.sequence([
        Animated.timing(vsScale, {
          toValue: 1.15,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(vsScale, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ]),
      { iterations: 2 }
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.8,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.2,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ]),
      { iterations: 2 }
    ).start();

    const checkOnboarding = async () => {
      try {
        // ⚠️ TEMPORARY - Remove this line after testing onboarding
        await AsyncStorage.removeItem('@onboarding_complete');
        const value = await AsyncStorage.getItem('@onboarding_complete');
        if (value !== 'true') {
          setShowOnboarding(true);
        }
      } catch (e) {
        console.log('Error checking onboarding:', e);
      }
    };
    checkOnboarding();

    const signInAnonymously = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        // If we have an error or no session, try to sign in
        if (sessionError || !session) {
          // Clear any dead session tokens first
          await supabase.auth.signOut();
          const { error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError) throw signInError;
        }
      } catch (error) {
        console.log('Auth recovery error:', error.message);
        // Last resort: force sign in anonymously
        await supabase.auth.signInAnonymously();
      }
    };

    // Auth listener to check for Admin status
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      const isAdminByMeta = user?.user_metadata?.is_admin === true;
      const adminIDs = [
        'cff47bf2-627f-43d9-b860-5d0db091ad2a',
        '0be24c4f-0bcd-44b3-9322-703681d270c4'
      ];
      const isAdminByID = adminIDs.includes(user?.id);

      if (isAdminByMeta || isAdminByID) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });

    signInAnonymously();

    return () => {
      subscription.unsubscribe();
    };

  }, [vsScale, glowOpacity]);

  const handleVote = async (choice) => {
    if (hasVoted) return;
    setHasVoted(true);
    setVotes(prev => ({
      ...prev,
      [choice]: prev[choice] + 1
    }));

    try {
      await supabase.from('votes').insert([{ quote_id: choice }]);
      setTimeout(() => setIsModalVisible(true), 500);
    } catch (error) {
      console.log('Error recording vote:', error);
    }
  };

  const submitCustomQuote = async (quoteText) => {
    if (!quoteText || !quoteText.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une citation.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('user_quotes').insert([{ quote: quoteText }]);
      if (error) throw error;
      setQuoteSubmitted(true);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de soumettre la citation.');
      console.log('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalVotes = votes.q1 + votes.q2;
  const q1Percent = totalVotes > 0 ? Math.round((votes.q1 / totalVotes) * 100) : 0;
  const q2Percent = totalVotes > 0 ? Math.round((votes.q2 / totalVotes) * 100) : 0;

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <LinearGradient colors={['#1a0a0a', '#000000', '#1a0a0a']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.headerContainer}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {
                const newCount = tapCount + 1;
                if (newCount >= 5) {
                  setIsLoginVisible(true);
                  setTapCount(0);
                } else {
                  setTapCount(newCount);
                  setTimeout(() => setTapCount(0), 2000); // Reset after 2s
                }
              }}
              style={styles.header}
            >
              <MaterialCommunityIcons name="sword-cross" size={20} color="#a0a0a0" />
              <Text style={styles.headerText}>BATTLE QUOTES</Text>
              <MaterialCommunityIcons name="sword-cross" size={20} color="#a0a0a0" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Quote 1 */}
            <TouchableOpacity style={[styles.quoteContainer, { marginTop: 60 }]} onPress={() => handleVote('q1')} activeOpacity={0.8}>
              <View style={styles.quoteMarkContainerLeft}>
                <Text style={[styles.quoteMark, { color: '#ff3b30' }]}>“</Text>
              </View>
              <Text style={[styles.quoteText, { color: '#ff3b30' }]}>
                TU VEUX DES RÉSULTATS ?{'\n'}
                ARRÊTE DE NÉGOCIER{'\n'}
                AVEC TES EFFORTS.
              </Text>
              <View style={styles.quoteMarkContainerRight}>
                <Text style={[styles.quoteMark, { color: '#ff3b30' }]}>”</Text>
              </View>
            </TouchableOpacity>

            {/* VS Divider */}
            <View style={styles.vsContainer}>
              <View style={styles.dividerSide}>
                {hasVoted && (
                  <Text style={[styles.vsPercent, { color: '#ff3b30', textAlign: 'left' }]}>{q1Percent}%</Text>
                )}
                <View style={styles.dividerLineWrapper}>
                  <LinearGradient
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    colors={['transparent', 'rgba(255, 0, 0, 0.8)', 'transparent']}
                    style={styles.dividerLineGradient}
                  />
                </View>
              </View>

              <Animated.View style={[styles.vsTextContainer, { transform: [{ scale: vsScale }] }]}>
                <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
                <Text style={styles.vsText}>VS</Text>
              </Animated.View>

              <View style={styles.dividerSide}>
                {hasVoted && (
                  <Text style={[styles.vsPercent, { color: '#fcd53f', textAlign: 'right' }]}>{q2Percent}%</Text>
                )}
                <View style={styles.dividerLineWrapper}>
                  <LinearGradient
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    colors={['transparent', 'rgba(255, 0, 0, 0.8)', 'transparent']}
                    style={styles.dividerLineGradient}
                  />
                </View>
              </View>
            </View>

            {/* Quote 2 */}
            <TouchableOpacity style={styles.quoteContainer} onPress={() => handleVote('q2')} activeOpacity={0.8}>
              <View style={styles.quoteMarkContainerLeft}>
                <Text style={[styles.quoteMark, { color: '#fcd53f' }]}>“</Text>
              </View>
              <Text style={[styles.quoteText, { color: '#fcd53f' }]}>
                LES EXCUSES TE RASSURENT,{'\n'}
                MAIS ELLES NE TE FERONT{'\n'}
                JAMAIS AVANCER.
              </Text>
              <View style={styles.quoteMarkContainerRight}>
                <Text style={[styles.quoteMark, { color: '#fcd53f' }]}>”</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Vote Section / Submit Section */}
          <View style={styles.voteSection}>
            <View style={styles.bottomStateContainer}>
              {!hasVoted && (
                <Animated.View style={[styles.bottomInstructionContainer, { opacity: instructionOpacity }]}>
                  <MaterialCommunityIcons name="lightning-bolt" size={20} color="#ff3b30" />
                  <Animated.Text style={[styles.tapToVoteText, { opacity: glowOpacity }]}>
                    VOTE ET ENTRE DANS LA BATTLE
                  </Animated.Text>
                  <MaterialCommunityIcons name="lightning-bolt" size={20} color="#ff3b30" />
                </Animated.View>
              )}
            </View>

            <BattleQuoteModal
              visible={isModalVisible}
              onClose={() => setIsModalVisible(false)}
              results={{ q1: q1Percent, q2: q2Percent }}
              onSubmit={submitCustomQuote}
            />
          </View>

          <OnboardingModal
            visible={showOnboarding}
            onClose={async () => {
              setShowOnboarding(false);
              await AsyncStorage.setItem('@onboarding_complete', 'true');
            }}
          />

          {/* Admin Gear Button - Only visible to Admins */}
          {isAdmin && (
            <TouchableOpacity
              style={styles.adminGear}
              onPress={() => setIsAdminVisible(true)}
            >
              <Ionicons name="settings" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          )}

          <AdminSettingsModal
            visible={isAdminVisible}
            onClose={() => setIsAdminVisible(false)}
          />

          <LoginModal
            visible={isLoginVisible}
            onClose={() => setIsLoginVisible(false)}
          />
        </SafeAreaView>
        <StatusBar style="light" />
      </LinearGradient>
    </SafeAreaProvider>
  );
}

function LoginModal({ visible, onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      onClose();
      Alert.alert("Succès", "Vous êtes maintenant connecté en tant qu'administrateur.");
    } catch (e) {
      Alert.alert("Erreur", "Identifiants invalides.");
      console.log("Login error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={adminStyles.overlay}>
        <View style={[adminStyles.container, { height: 'auto', marginBottom: 20, borderRadius: 20 }]}>
          <View style={adminStyles.header}>
            <Text style={adminStyles.title}>ACCÈS ADMIN</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={adminStyles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={modalStyles.input}
            placeholder="Email"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <TextInput
            style={modalStyles.input}
            placeholder="Mot de passe"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[modalStyles.button, { opacity: loading ? 0.5 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={modalStyles.buttonText}>SE CONNECTER</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function AdminSettingsModal({ visible, onClose }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchSubmissions();
    }
  }, [visible]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // If it's a "table not found" error, we show a specific message
        if (error.code === 'PGRST116' || error.message.includes('not found')) {
          Alert.alert('Configuration Requise', 'La table "user_quotes" n\'existe pas encore dans votre base Supabase.');
        } else {
          throw error;
        }
      }
      setSubmissions(data || []);
    } catch (e) {
      console.log('Error fetching submissions:', e);
      Alert.alert('Erreur', 'Impossible de charger les citations. Vérifiez votre connexion ou la configuration de votre base.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (quote) => {
    Alert.alert(
      'Confirmer',
      `Voulez-vous que cette citation devienne la prochaine challenger ?\n\n"${quote.quote}"`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'VALLIDER',
          onPress: () => {
            // Logic to update the "active battle" would go here
            // For now, we just acknowledge the choice
            Alert.alert('Succès', 'La citation a été sélectionnée pour la prochaine battle !');
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={adminStyles.overlay}>
        <View style={adminStyles.container}>
          <View style={adminStyles.header}>
            <Text style={adminStyles.title}>PANEL ADMIN</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={adminStyles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#ff3b30" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={submissions}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={adminStyles.quoteItem}>
                  <Text style={adminStyles.quoteText}>"{item.quote}"</Text>
                  <TouchableOpacity
                    style={adminStyles.approveButton}
                    onPress={() => handleApprove(item)}
                  >
                    <Text style={adminStyles.approveButtonText}>DÉFINIR COMME CHALLENGER</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <Text style={adminStyles.emptyText}>Aucune citation soumise pour le moment.</Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function OnboardingModal({ visible, onClose }) {
  const [step, setStep] = useState(0);
  const flatListRef = useRef(null);

  const steps = [
    {
      title: "L'ARÈNE DES QUOTES",
      description: "Dans cette arène, les mots sont des armes. Deux citations s'affrontent pour la gloire.",
      icon: "sword-cross",
      color: "#ff3b30"
    },
    {
      title: "DÉCIDE DU VAINQUEUR",
      description: "Tappe sur ta citation préférée pour lui donner la force de gagner.",
      icon: "lightning-bolt",
      color: "#fcd53f"
    },
    {
      title: "ENTRE DANS LA BATTLE",
      description: "T'as mieux ? Propose ta propre quote pour détrôner les champions actuels.",
      icon: "fire",
      color: "#ff3b30"
    }
  ];

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems[0]) {
      setStep(viewableItems[0].index);
    }
  }).current;
  
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const ITEM_WIDTH = width - 60; // container padding is 30 on each side

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={onboardingStyles.overlay}>
        <LinearGradient
          colors={['#1a0a0a', '#050505']}
          style={onboardingStyles.container}
        >
          <View style={{ flex: 1, width: '100%' }}>
            <FlatList
              ref={flatListRef}
              data={steps}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item }) => (
                <View style={{ width: ITEM_WIDTH, justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialCommunityIcons name={item.icon} size={80} color={item.color} />
                  <Text style={onboardingStyles.title} numberOfLines={1} adjustsFontSizeToFit>{item.title}</Text>
                  <Text style={onboardingStyles.description}>{item.description}</Text>
                </View>
              )}
            />
          </View>

          {/* Pagination dots above button */}
          <View style={[onboardingStyles.progressContainer, { marginTop: 20 }]}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[
                  onboardingStyles.progressDot,
                  { backgroundColor: i === step ? '#ff3b30' : 'rgba(255,255,255,0.1)' }
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            onPress={() => {
              if (step < steps.length - 1) {
                flatListRef.current?.scrollToIndex({ index: step + 1, animated: true });
              } else {
                onClose();
              }
            }}
            style={onboardingStyles.buttonWrapper}
          >
            <ImageBackground
              source={require('./assets/paint.png')}
              style={onboardingStyles.buttonImage}
              resizeMode="stretch"
            >
              <View style={onboardingStyles.buttonTextWrapper}>
                <Text style={onboardingStyles.buttonText}>
                  {step < steps.length - 1 ? "SUIVANT" : "ENTRER DANS L'ARÈNE"}
                </Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
}

function BattleQuoteModal({ visible, onClose, onSubmit, results }) {
  const [quote, setQuote] = useState("");
  const riseAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      // Start the rise animation after a slight delay
      Animated.spring(riseAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
        delay: 300,
      }).start();
    } else {
      riseAnim.setValue(500);
    }
  }, [visible]);

  const handleSubmit = () => {
    if (!quote.trim()) return;
    onSubmit(quote);
    setQuote("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          {/* Main Modal Content */}
          <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose}>
            <Text style={modalStyles.closeText}>✕</Text>
          </TouchableOpacity>

          <Text style={modalStyles.title}>⚔️   T'AS MIEUX ?</Text>
          <Text style={modalStyles.subtitle}>
            DROP  TA  <Text style={{ color: "#ff3b3b" }}>QUOTE</Text>
          </Text>

          <Text style={modalStyles.description}>
            Entre dans l'arène et affronte la gagnante.
          </Text>

          <TextInput
            style={modalStyles.input}
            placeholder="Écris ta quote ici..."
            placeholderTextColor="#888"
            multiline
            value={quote}
            onChangeText={setQuote}
          />

          <TouchableOpacity style={modalStyles.button} onPress={handleSubmit}>
            <Text style={modalStyles.buttonText}>🔥 ENTRER DANS LA BATTLE</Text>
          </TouchableOpacity>

          <Text style={modalStyles.footer}>
            Ta quote pourrait devenir la prochaine championne 👑
          </Text>
        </View>

        {/* Results Box - slides up behind the main box */}
        {results && (
          <Animated.View
            style={[
              modalStyles.dropBox,
              { transform: [{ translateY: riseAnim }] }
            ]}
          >
            <View style={modalStyles.dropResults}>
              <Text style={[modalStyles.dropPercent, { color: '#fcd53f' }]}>{results.q2}%</Text>
              <Text style={modalStyles.dropVs}>VS</Text>
              <Text style={[modalStyles.dropPercent, { color: '#ff3b30' }]}>{results.q1}%</Text>
            </View>
            <View style={modalStyles.dropIndicatorContainer}>
              <View style={[modalStyles.dropBar, { flex: results.q2, backgroundColor: '#fcd53f' }]} />
              <View style={[modalStyles.dropBar, { flex: results.q1, backgroundColor: '#ff3b30' }]} />
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 20,
  },
  headerContainer: {
    marginTop: 20,
    marginBottom: 10,
    alignItems: 'center',
  },
  headerStateContainer: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  headerResultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPercent: {
    fontFamily: 'BebasNeue',
    fontSize: 28,
    marginHorizontal: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerVs: {
    fontFamily: 'BebasNeue',
    fontSize: 16,
    color: '#888',
  },
  smallHeaderPercent: {
    fontFamily: 'BebasNeue',
    fontSize: 22,
    width: 50,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerText: {
    fontFamily: 'BebasNeue',
    fontSize: 28,
    color: '#dcdcdc',
    marginHorizontal: 15,
    letterSpacing: 2,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    opacity: 0.5,
  },
  content: {
    flex: 1,
    justifyContent: 'space-evenly',
  },
  instructionText: {
    fontFamily: 'BebasNeue',
    fontSize: 16,
    color: '#ff3b30',
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(255, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  quoteContainer: {
    position: 'relative',
    marginVertical: 10,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  quoteText: {
    fontFamily: 'BebasNeue',
    fontSize: width > 380 ? 32 : 28,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: width > 380 ? 38 : 34,
    letterSpacing: 1,
    zIndex: 2,
    opacity: 0.7,
  },
  quoteMarkContainerLeft: {
    position: 'absolute',
    top: -15,
    left: 20,
    opacity: 0.8,
  },
  quoteMarkContainerRight: {
    position: 'absolute',
    bottom: -25,
    right: 20,
    opacity: 0.8,
  },
  quoteMark: {
    fontFamily: 'BebasNeue',
    fontSize: 60,
    color: '#cc0000',
    lineHeight: 60,
  },
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    height: 80,
  },
  dividerSide: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  vsPercent: {
    fontFamily: 'BebasNeue',
    fontSize: 24,
    marginBottom: 5,
    paddingHorizontal: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  dividerLineWrapper: {
    width: '100%',
    height: 2,
  },
  dividerLineGradient: {
    flex: 1,
    height: '100%',
  },
  vsTextContainer: {
    paddingHorizontal: 20,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    fontFamily: 'BebasNeue',
    fontSize: 65,
    color: '#ff0000',
    textShadowColor: 'rgba(255, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    fontStyle: 'italic',
  },
  glow: {
    position: 'absolute',
    width: 80,
    height: 80,
    backgroundColor: '#ff0000',
    borderRadius: 40,
    opacity: 0.5,
  },
  voteSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  bottomStateContainer: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  adminGear: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
  },
  bottomInstructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapToVoteText: {
    fontFamily: 'BebasNeue',
    fontSize: 22,
    color: '#ff3b30',
    textAlign: 'center',
    letterSpacing: 2,
    marginHorizontal: 15,
    textShadowColor: 'rgba(255, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  resultsContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  progressBarContainer: {
    flex: 1,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    marginHorizontal: 15,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  progressBarQ1: {
    backgroundColor: '#ff3b30',
  },
  progressBarQ2: {
    backgroundColor: '#fcd53f',
  },
  resultPercent: {
    fontFamily: 'BebasNeue',
    fontSize: 24,
    color: '#fff',
    width: 45,
    textAlign: 'right',
  },
  submitSection: {
    marginTop: 20,
    width: '100%',
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 217, 100, 0.1)',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4cd964',
  },
  successText: {
    fontFamily: 'BebasNeue',
    fontSize: 20,
    color: '#4cd964',
    marginLeft: 10,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "90%",
    backgroundColor: "#0b0b0b",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#ff3b3b",
    zIndex: 2,
  },
  closeBtn: {
    position: "absolute",
    top: 10,
    right: 15
  },
  closeText: {
    color: "#ff3b3b",
    fontSize: 20
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 10,
    fontFamily: 'BebasNeue',
  },
  subtitle: {
    color: "#ccc",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 10,
    fontFamily: 'BebasNeue',
    letterSpacing: 1.5,
  },
  description: {
    color: "#888",
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#111",
    color: "#fff",
    borderRadius: 10,
    padding: 15,
    height: 100,
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 20,
    fontFamily: 'BebasNeue',
    fontSize: 18,
  },
  button: {
    backgroundColor: "#ff3b3b",
    padding: 15,
    borderRadius: 10,
    alignItems: "center"
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontFamily: 'BebasNeue',
    fontSize: 20,
  },
  footer: {
    color: "#666",
    fontSize: 12,
    textAlign: "center",
    marginTop: 10
  },
  dropBox: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#151515",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#333",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 1,
    zIndex: 1,
    alignItems: 'center',
  },
  dropResults: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dropPercent: {
    fontFamily: 'BebasNeue',
    fontSize: 28,
    marginHorizontal: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  dropVs: {
    fontFamily: 'BebasNeue',
    fontSize: 14,
    color: '#888',
  },
  dropIndicatorContainer: {
    flexDirection: 'row',
    width: '80%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dropBar: {
    height: '100%',
  },
  miniResults: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  miniResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  miniBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  miniBar: {
    height: '100%',
    borderRadius: 3,
  },
  miniPercent: {
    fontFamily: 'BebasNeue',
    color: '#fff',
    fontSize: 14,
    width: 35,
    textAlign: 'right',
  }
});

const onboardingStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  progressContainer: {
    flexDirection: 'row',
    marginBottom: 50,
  },
  progressDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 5,
  },
  title: {
    fontFamily: 'BebasNeue',
    fontSize: 32,
    color: '#fff',
    marginTop: 30,
    textAlign: 'center',
    letterSpacing: 2,
    width: '100%',
  },
  description: {
    fontSize: 18,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 80,
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  buttonWrapper: {
    width: '100%',
    height: 150,
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  buttonTextWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 30,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'BebasNeue',
    fontSize: 18,
    color: '#fff',
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});

const adminStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0b0b0b',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '85%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontFamily: 'BebasNeue',
    fontSize: 28,
    color: '#ff3b30',
  },
  closeText: {
    color: '#fff',
    fontSize: 24,
  },
  quoteItem: {
    backgroundColor: '#151515',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#222',
  },
  quoteText: {
    color: '#eee',
    fontSize: 16,
    marginBottom: 15,
    fontStyle: 'italic',
  },
  approveButton: {
    backgroundColor: '#ff3b30',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButtonText: {
    fontFamily: 'BebasNeue',
    fontSize: 18,
    color: '#fff',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
  }
});
