import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Animated, Easing, Dimensions, Platform, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, FlatList, ImageBackground, PanResponder, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, ScrollView } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar, LocaleConfig } from 'react-native-calendars';

LocaleConfig.locales['fr'] = {
  monthNames: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  monthNamesShort: ['Janv.','Févr.','Mars','Avril','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'],
  dayNames: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],
  dayNamesShort: ['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.'],
  today: 'Aujourd\'hui'
};
LocaleConfig.defaultLocale = 'fr';

const { width } = Dimensions.get('window');

const getFighterClass = (author) => {
  const name = (author || "ANONYME").toUpperCase();
  if (name.includes("SUN TZU")) return "SAGE DE GUERRE";
  if (name.includes("NIETZSCHE")) return "PHILOSOPHE IMPÉRIAL";
  if (name.includes("MARC AURÈLE")) return "EMPEREUR STOÏQUE";
  if (name.includes("CONFUCIUS")) return "MAÎTRE ZEN";
  if (name.includes("GANDHI")) return "GUERRIER PACIFIQUE";
  return "CHAMPION SOUMIS";
};

const getFighterEndurance = (text) => {
  const val = (text || "").length;
  return (val % 30) + 120; // range 120-150 HP
};

const getFighterRatio = (text) => {
  const val = (text || "").length;
  return (val % 20) + 68; // range 68-87 % win rate
};

const getFighterStreak = (text) => {
  const val = (text || "").length;
  return (val % 4) + 1; // range 1-4 round survival streak
};

export default function App() {
  let [fontsLoaded] = useFonts({
    BebasNeue: BebasNeue_400Regular,
  });

  const [hasVoted, setHasVoted] = useState(false);
  const [votes, setVotes] = useState({ q1: 0, q2: 0 });
  const [activeQuotes, setActiveQuotes] = useState({
    q1: null,
    q2: null
  });
  const [customQuote, setCustomQuote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isAdminVisible, setIsAdminVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoginVisible, setIsLoginVisible] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [userNickname, setUserNickname] = useState('ANONYME');
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);

  // Card Flip States and Values
  const [isFlippedQ1, setIsFlippedQ1] = useState(false);
  const [isFlippedQ2, setIsFlippedQ2] = useState(false);
  const flipQ1Val = useRef(new Animated.Value(0)).current;
  const flipQ2Val = useRef(new Animated.Value(0)).current;

  // Front & Back interpolations for 3D flip effect
  const frontInterpolateQ1 = flipQ1Val.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg']
  });
  const backInterpolateQ1 = flipQ1Val.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg']
  });

  const frontInterpolateQ2 = flipQ2Val.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg']
  });
  const backInterpolateQ2 = flipQ2Val.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg']
  });

  const toggleFlipQ1 = () => {
    const nextFlipped = !isFlippedQ1;
    setIsFlippedQ1(nextFlipped);
    Animated.spring(flipQ1Val, {
      toValue: nextFlipped ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  };

  const toggleFlipQ2 = () => {
    const nextFlipped = !isFlippedQ2;
    setIsFlippedQ2(nextFlipped);
    Animated.spring(flipQ2Val, {
      toValue: nextFlipped ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  };

  const vsScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.4)).current;
  const instructionOpacity = useRef(new Animated.Value(1)).current;

  // Fake voting simulation refs
  const simTimerRef = useRef(null);
  const simIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearTimeout(simTimerRef.current);
      if (simIntervalRef.current) clearTimeout(simIntervalRef.current);
    };
  }, []);

  // Neon card pulsing border animation values
  const glowQ1Val = useRef(new Animated.Value(0.4)).current;
  const glowQ2Val = useRef(new Animated.Value(0.4)).current;

  // Slide entrance challenger animation values
  const slideQ1Val = useRef(new Animated.Value(0)).current;
  const slideQ2Val = useRef(new Animated.Value(0)).current;

  // Track quote changes to trigger challenger animations
  const prevQ1Text = useRef("");
  const prevQ2Text = useRef("");

  // Broadcast channel ref for real-time push (no DB table needed)
  const broadcastChannelRef = useRef(null);

  const fetchActiveQuotes = async () => {
    try {
      // Fetch active combat state from user_quotes where slot is marked
      const { data, error } = await supabase
        .from('user_quotes')
        .select('*')
        .not('active_slot', 'is', null);

      if (error) throw error;

      const newQuotes = { q1: null, q2: null };
      if (data && data.length > 0) {
        data.forEach(item => {
          const slot = item.active_slot;
          if (slot === 'q1' || slot === 'q2') {
            // Parse "text — author" format or use text + author columns
            const parts = item.quote.split(' — ');
            newQuotes[slot] = {
              text: parts[0] || item.quote,
              author: parts[1] || item.author || 'ANONYME'
            };
          }
        });
      }
      setActiveQuotes(newQuotes);

      // Count votes
      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select('quote_id');
      if (!votesError && votesData) {
        let q1Count = 0;
        let q2Count = 0;
        votesData.forEach(v => {
          if (v.quote_id === 'q1') q1Count++;
          if (v.quote_id === 'q2') q2Count++;
        });
        setVotes({ q1: q1Count, q2: q2Count });
      }
    } catch (e) {
      console.log('Error fetching active combat quotes:', e);
    }
  };

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

    // Pulse loops for Q1 and Q2 neon card borders
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowQ1Val, {
          toValue: 0.95,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowQ1Val, {
          toValue: 0.35,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowQ2Val, {
          toValue: 0.95,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowQ2Val, {
          toValue: 0.35,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();

    const checkOnboarding = async () => {
      try {
        const onboardingComplete = await AsyncStorage.getItem('@onboarding_complete');
        const nickname = await AsyncStorage.getItem('@user_nickname');

        if (nickname) {
          setUserNickname(nickname);
        }

        if (onboardingComplete !== 'true') {
          setShowOnboarding(true);
        } else if (!nickname) {
          setShowNicknameModal(true);
        }

        // Fetch persisted active quotes from DB
        await fetchActiveQuotes();
      } catch (e) {
        console.log('Error checking onboarding/quotes:', e);
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

    // --- REALTIME: Broadcast channel for instant quote+vote updates ---
    const channel = supabase
      .channel('battle-arena-realtime')
      // Listen for admin pushing new active quotes
      .on('broadcast', { event: 'quotes_updated' }, (payload) => {
        setActiveQuotes(payload.payload);
        setVotes({ q1: 0, q2: 0 });
        setHasVoted(false);
      })
      // Listen for new votes broadcast
      .on('broadcast', { event: 'vote_cast' }, (payload) => {
        setVotes(payload.payload);
      })
      // Also listen to DB changes on user_quotes and votes as fallback
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_quotes' },
        () => { fetchActiveQuotes(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes' },
        () => { fetchActiveQuotes(); }
      )
      .subscribe();

    broadcastChannelRef.current = channel;

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };

  }, [vsScale, glowOpacity]);

  useEffect(() => {
    if (activeQuotes.q1) {
      const text = activeQuotes.q1.text || activeQuotes.q1;
      if (text !== prevQ1Text.current) {
        prevQ1Text.current = text;

        // Reset card flip to front face instantly
        setIsFlippedQ1(false);
        flipQ1Val.setValue(0);

        slideQ1Val.setValue(350); // slide Q1 in from the right
        Animated.spring(slideQ1Val, {
          toValue: 0,
          tension: 30,
          friction: 7,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [activeQuotes.q1]);

  useEffect(() => {
    if (activeQuotes.q2) {
      const text = activeQuotes.q2.text || activeQuotes.q2;
      if (text !== prevQ2Text.current) {
        prevQ2Text.current = text;

        // Reset card flip to front face instantly
        setIsFlippedQ2(false);
        flipQ2Val.setValue(0);

        slideQ2Val.setValue(-350); // slide Q2 in from the left
        Animated.spring(slideQ2Val, {
          toValue: 0,
          tension: 30,
          friction: 7,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [activeQuotes.q2]);

  const handleVote = async (choice) => {
    if (hasVoted) return;
    setHasVoted(true);

    // Optimistic local update
    setVotes(prev => ({
      q1: prev.q1 + (choice === 'q1' ? 1 : 0),
      q2: prev.q2 + (choice === 'q2' ? 1 : 0),
    }));

    try {
      await supabase.from('votes').insert([{ quote_id: choice }]);

      // Fetch accurate DB totals and broadcast to ALL users
      const { data: votesData } = await supabase.from('votes').select('quote_id');
      if (votesData) {
        let q1Count = 0;
        let q2Count = 0;
        votesData.forEach(v => {
          if (v.quote_id === 'q1') q1Count++;
          if (v.quote_id === 'q2') q2Count++;
        });
        const accurateVotes = { q1: q1Count, q2: q2Count };
        setVotes(accurateVotes);

        // Broadcast accurate counts to every connected user instantly
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.send({
            type: 'broadcast',
            event: 'vote_cast',
            payload: accurateVotes,
          });
        }
      }

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
      const cleanQuote = quoteText.trim();
      const quoteWithAuthor = `${cleanQuote} — ${userNickname}`;

      // Check if this quote already exists in the database
      const { data: existing, error: checkError } = await supabase
        .from('user_quotes')
        .select('quote')
        .ilike('quote', `%${cleanQuote}%`);

      if (!checkError && existing && existing.length > 0) {
        Alert.alert('Doublon', 'Cette citation a déjà été partagée ! Proposez-en une autre.');
        return;
      }

      const { error } = await supabase.from('user_quotes').insert([{ quote: quoteWithAuthor }]);
      if (error) throw error;
      setQuoteSubmitted(true);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de soumettre la citation.');
      console.log('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveNickname = async (nickname) => {
    if (!nickname || !nickname.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un surnom.');
      return;
    }
    const cleanNickname = nickname.trim().toUpperCase();
    try {
      await AsyncStorage.setItem('@user_nickname', cleanNickname);
      setUserNickname(cleanNickname);
      setShowNicknameModal(false);
    } catch (e) {
      console.log('Error saving nickname:', e);
      Alert.alert('Erreur', 'Impossible d\'enregistrer le surnom.');
    }
  };

  const startFakeVotingSimulation = () => {
    // 1. Choose a random delay between 15 and 180 seconds
    const randomDelaySeconds = Math.floor(Math.random() * (180 - 15 + 1)) + 15;
    console.log(`[SIMULATOR] Scheduling fake votes simulation to start in ${randomDelaySeconds} seconds...`);
    
    // Clear any existing active simulation timers to prevent overlap
    if (simTimerRef.current) clearTimeout(simTimerRef.current);
    if (simIntervalRef.current) clearTimeout(simIntervalRef.current);

    simTimerRef.current = setTimeout(async () => {
      // 2. Choose a random number of votes to simulate (between 10 and 50 votes)
      const numVotes = Math.floor(Math.random() * (50 - 10 + 1)) + 10;
      console.log(`[SIMULATOR] Starting simulation of ${numVotes} fake user votes...`);
      
      let votesCast = 0;
      // 3. Lay out these votes over short random intervals (cast a vote every 1.5 to 5.5 seconds)
      const castNextVote = async () => {
        if (votesCast >= numVotes) {
          console.log(`[SIMULATOR] Finished simulating ${numVotes} votes!`);
          return;
        }

        votesCast++;
        const choice = Math.random() > 0.5 ? 'q1' : 'q2';
        
        try {
          await supabase.from('votes').insert([{ quote_id: choice }]);
          
          // Fetch accurate DB totals and broadcast to ALL users
          const { data: votesData, error: countErr } = await supabase
            .from('votes')
            .select('quote_id');

          if (!countErr && votesData) {
            let q1Count = 0;
            let q2Count = 0;
            votesData.forEach(v => {
              if (v.quote_id === 'q1') q1Count++;
              if (v.quote_id === 'q2') q2Count++;
            });
            const accurateVotes = { q1: q1Count, q2: q2Count };
            setVotes(accurateVotes);

            // Broadcast accurate counts to every connected user instantly
            if (broadcastChannelRef.current) {
              broadcastChannelRef.current.send({
                type: 'broadcast',
                event: 'vote_cast',
                payload: accurateVotes,
              });
            }
          }
          console.log(`[SIMULATOR] Cast simulated vote ${votesCast}/${numVotes} for ${choice}`);
        } catch (err) {
          console.log('[SIMULATOR] Error inserting simulated vote:', err);
        }

        // Schedule next vote after a short random interval (e.g. 1500ms to 5500ms)
        const nextVoteInterval = Math.floor(Math.random() * (5500 - 1500 + 1)) + 1500;
        simIntervalRef.current = setTimeout(castNextVote, nextVoteInterval);
      };

      // Start the cascading vote simulation
      castNextVote();

    }, randomDelaySeconds * 1000);
  };

  const handleSetQuote = async (quoteText, authorText, slot) => {
    const author = authorText || "ANONYME";

    // Check if the other slot already has the exact same quote text to prevent duplicates in active combat
    const otherSlot = slot === 'q1' ? 'q2' : 'q1';
    const otherQuote = activeQuotes[otherSlot];
    if (
      otherQuote &&
      otherQuote.text &&
      otherQuote.text.trim().toLowerCase() === quoteText.trim().toLowerCase()
    ) {
      Alert.alert('Doublon', 'Cette citation est déjà active dans l\'arène ! Sélectionnez un autre adversaire.');
      return;
    }

    // Check if the admin is trying to replace the winning quote
    const voteQ1 = votes.q1 || 0;
    const voteQ2 = votes.q2 || 0;
    if (voteQ1 !== voteQ2) {
      const winnerSlot = voteQ1 > voteQ2 ? 'q1' : 'q2';
      if (slot === winnerSlot) {
        Alert.alert(
          'Action Bloquée',
          `La citation de la Quote ${slot === 'q1' ? '1' : '2'} est actuellement gagnante ! Vous ne pouvez remplacer que la citation vaincue.`
        );
        return;
      }
    }

    const newQuotes = { ...activeQuotes, [slot]: { text: quoteText, author } };
    setActiveQuotes(newQuotes);
    setVotes({ q1: 0, q2: 0 });
    setHasVoted(false);

    // Start fake voter simulation if both quotes are active
    if (newQuotes.q1 && newQuotes.q2) {
      startFakeVotingSimulation();
    }

    // --- INSTANT BROADCAST to all connected users ---
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'quotes_updated',
        payload: newQuotes,
      });
    }

    // --- PERSIST to DB via user_quotes.active_slot for new users joining ---
    try {
      // Clear existing active slot for this position
      await supabase
        .from('user_quotes')
        .update({ active_slot: null })
        .eq('active_slot', slot);

      // Insert new active quote row (or update if same text exists)
      await supabase
        .from('user_quotes')
        .insert({ quote: `${quoteText} — ${author}`, active_slot: slot });

      // Reset votes in DB
      await supabase.from('votes').delete().neq('id', 0);
    } catch (e) {
      console.log('Error persisting active quote:', e);
      // Broadcast already sent so users still see it live - DB persistence failed silently
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
            {!activeQuotes.q1 || !activeQuotes.q2 ? (
              <View style={styles.emptyArenaContainer}>
                <MaterialCommunityIcons name="sword-cross" size={80} color="#ff3b30" style={{ marginBottom: 15 }} />
                <Text style={styles.emptyArenaTitle}>L'ARÈNE EST VIDE</Text>
                <Text style={styles.emptyArenaSubtitle}>Aucun combat en cours</Text>
                <Text style={styles.emptyArenaDescription}>
                  L'admin (me@you.com) doit sélectionner deux citations dans le panel d'administration pour lancer le premier combat !
                </Text>
                {isAdmin && (
                  <TouchableOpacity
                    style={styles.emptyArenaAdminBtn}
                    onPress={() => setIsAdminVisible(true)}
                  >
                    <Text style={styles.emptyArenaAdminBtnText}>ACCÉDER AU PANEL ADMIN</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                {/* Quote 1 */}
                <Animated.View style={{ transform: [{ translateX: slideQ1Val }], marginVertical: 6, marginHorizontal: 10 }}>
                  <View style={{ position: 'relative' }}>
                    {/* FRONT FACE */}
                    <Animated.View
                      pointerEvents={isFlippedQ1 ? 'none' : 'auto'}
                      style={[
                        styles.cardFace,
                        { transform: [{ rotateY: frontInterpolateQ1 }], backfaceVisibility: 'hidden' }
                      ]}
                    >
                      <TouchableOpacity
                        style={[styles.quoteContainer, { marginVertical: 0, marginHorizontal: 0 }]}
                        onPress={() => handleVote('q1')}
                        activeOpacity={0.8}
                      >
                        {/* Pulsing Neon Border */}
                        <Animated.View
                          style={[styles.glowBorder, styles.quoteCardQ1, { opacity: glowQ1Val }]}
                          pointerEvents="none"
                        />

                        {/* Stats Flip Trigger */}
                        <TouchableOpacity
                          style={styles.statsTrigger}
                          onPress={(e) => {
                            e.stopPropagation(); // prevent casting vote when clicking STATS!
                            toggleFlipQ1();
                          }}
                        >
                          <MaterialCommunityIcons name="chart-bar" size={14} color="#ff3b30" />
                          <Text style={[styles.statsTriggerText, { color: '#ff3b30' }]}>STATS</Text>
                        </TouchableOpacity>

                        <View style={styles.quoteMarkContainerLeft}>
                          <Text style={[styles.quoteMark, { color: 'rgba(255, 59, 48, 0.25)' }]}>“</Text>
                        </View>
                        <Text style={[styles.quoteText, { color: '#ff3b30' }]}>
                          {activeQuotes.q1.text || activeQuotes.q1}
                        </Text>
                        {(activeQuotes.q1.author || false) && (
                          <Text style={[styles.authorText, { color: 'rgba(255, 59, 48, 0.75)' }]}>
                            — {activeQuotes.q1.author}
                          </Text>
                        )}
                        <View style={styles.quoteMarkContainerRight}>
                          <Text style={[styles.quoteMark, { color: 'rgba(255, 59, 48, 0.25)' }]}>”</Text>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>

                    {/* BACK FACE */}
                    <Animated.View
                      pointerEvents={isFlippedQ1 ? 'auto' : 'none'}
                      style={[
                        styles.cardFace,
                        styles.cardFaceBack,
                        { transform: [{ rotateY: backInterpolateQ1 }], backfaceVisibility: 'hidden' }
                      ]}
                    >
                      <TouchableOpacity
                        style={[styles.quoteContainer, { marginVertical: 0, marginHorizontal: 0 }]}
                        onPress={toggleFlipQ1} // click anywhere on back to flip it back!
                        activeOpacity={0.9}
                      >
                        {/* Pulsing Neon Border */}
                        <Animated.View
                          style={[styles.glowBorder, styles.quoteCardQ1, { opacity: glowQ1Val }]}
                          pointerEvents="none"
                        />



                        {/* Combatant Stats content */}
                        <Text style={[styles.statsTitle, { color: '#ff3b30' }]}>FICHE TECHNIQUE</Text>

                        <View style={styles.statRow}>
                          <Text style={styles.statLabel}>CLASSE :</Text>
                          <Text style={[styles.statValue, { color: '#ff3b30' }]}>{getFighterClass(activeQuotes.q1.author)}</Text>
                        </View>
                        <View style={styles.statRow}>
                          <Text style={styles.statLabel}>ENDURANCE :</Text>
                          <Text style={styles.statValue}>{getFighterEndurance(activeQuotes.q1.text)} HP</Text>
                        </View>
                        <View style={styles.statRow}>
                          <Text style={styles.statLabel}>RATIO VICTOIRE :</Text>
                          <Text style={styles.statValue}>{getFighterRatio(activeQuotes.q1.text)}%</Text>
                        </View>
                        <View style={styles.statRow}>
                          <Text style={styles.statLabel}>SÉRIE DE VICTOIRES :</Text>
                          <Text style={[styles.statValue, { color: '#ff3b30' }]}>🔥 {getFighterStreak(activeQuotes.q1.text)} SURVIES</Text>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </Animated.View>

                {/* VS Divider */}
                <View style={styles.vsContainer}>
                  <View style={styles.dividerSide}>
                    {(votes.q1 + votes.q2) > 0 && (
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
                    {(votes.q1 + votes.q2) > 0 && (
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
                <Animated.View style={{ transform: [{ translateX: slideQ2Val }], marginVertical: 6, marginHorizontal: 10 }}>
                  <View style={{ position: 'relative' }}>
                    {/* FRONT FACE */}
                    <Animated.View
                      pointerEvents={isFlippedQ2 ? 'none' : 'auto'}
                      style={[
                        styles.cardFace,
                        { transform: [{ rotateY: frontInterpolateQ2 }], backfaceVisibility: 'hidden' }
                      ]}
                    >
                      <TouchableOpacity
                        style={[styles.quoteContainer, { marginVertical: 0, marginHorizontal: 0 }]}
                        onPress={() => handleVote('q2')}
                        activeOpacity={0.8}
                      >
                        {/* Pulsing Neon Border */}
                        <Animated.View
                          style={[styles.glowBorder, styles.quoteCardQ2, { opacity: glowQ2Val }]}
                          pointerEvents="none"
                        />

                        {/* Stats Flip Trigger */}
                        <TouchableOpacity
                          style={styles.statsTrigger}
                          onPress={(e) => {
                            e.stopPropagation(); // prevent casting vote when clicking STATS!
                            toggleFlipQ2();
                          }}
                        >
                          <MaterialCommunityIcons name="chart-bar" size={14} color="#fcd53f" />
                          <Text style={[styles.statsTriggerText, { color: '#fcd53f' }]}>STATS</Text>
                        </TouchableOpacity>

                        <View style={styles.quoteMarkContainerLeft}>
                          <Text style={[styles.quoteMark, { color: 'rgba(252, 213, 63, 0.25)' }]}>“</Text>
                        </View>
                        <Text style={[styles.quoteText, { color: '#fcd53f' }]}>
                          {activeQuotes.q2.text || activeQuotes.q2}
                        </Text>
                        {(activeQuotes.q2.author || false) && (
                          <Text style={[styles.authorText, { color: 'rgba(252, 213, 63, 0.75)' }]}>
                            — {activeQuotes.q2.author}
                          </Text>
                        )}
                        <View style={styles.quoteMarkContainerRight}>
                          <Text style={[styles.quoteMark, { color: 'rgba(252, 213, 63, 0.25)' }]}>”</Text>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>

                    {/* BACK FACE */}
                    <Animated.View
                      pointerEvents={isFlippedQ2 ? 'auto' : 'none'}
                      style={[
                        styles.cardFace,
                        styles.cardFaceBack,
                        { transform: [{ rotateY: backInterpolateQ2 }], backfaceVisibility: 'hidden' }
                      ]}
                    >
                      <TouchableOpacity
                        style={[styles.quoteContainer, { marginVertical: 0, marginHorizontal: 0 }]}
                        onPress={toggleFlipQ2} // click anywhere on back to flip it back!
                        activeOpacity={0.9}
                      >
                        {/* Pulsing Neon Border */}
                        <Animated.View
                          style={[styles.glowBorder, styles.quoteCardQ2, { opacity: glowQ2Val }]}
                          pointerEvents="none"
                        />



                        {/* Combatant Stats content */}
                        <Text style={[styles.statsTitle, { color: '#fcd53f' }]}>FICHE TECHNIQUE</Text>

                        <View style={styles.statRow}>
                          <Text style={styles.statLabel}>CLASSE :</Text>
                          <Text style={[styles.statValue, { color: '#fcd53f' }]}>{getFighterClass(activeQuotes.q2.author)}</Text>
                        </View>
                        <View style={styles.statRow}>
                          <Text style={styles.statLabel}>ENDURANCE :</Text>
                          <Text style={styles.statValue}>{getFighterEndurance(activeQuotes.q2.text)} HP</Text>
                        </View>
                        <View style={styles.statRow}>
                          <Text style={styles.statLabel}>RATIO VICTOIRE :</Text>
                          <Text style={styles.statValue}>{getFighterRatio(activeQuotes.q2.text)}%</Text>
                        </View>
                        <View style={styles.statRow}>
                          <Text style={styles.statLabel}>SÉRIE DE VICTOIRES :</Text>
                          <Text style={[styles.statValue, { color: '#fcd53f' }]}>🔥 {getFighterStreak(activeQuotes.q2.text)} SURVIES</Text>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </Animated.View>
              </>
            )}
          </View>

          {/* Vote Section / Submit Section */}
          <View style={styles.voteSection}>
            <View style={styles.bottomStateContainer}>
              {!hasVoted && activeQuotes.q1 && activeQuotes.q2 && (
                <Animated.View style={[styles.bottomInstructionContainer, { opacity: instructionOpacity }]}>
                  <MaterialCommunityIcons name="lightning-bolt" size={20} color="#ff3b30" />
                  <Animated.Text style={[styles.tapToVoteText, { opacity: glowOpacity }]}>
                    VOTE ET ENTRE DANS LA BATTLE
                  </Animated.Text>
                  <MaterialCommunityIcons name="lightning-bolt" size={20} color="#ff3b30" />
                </Animated.View>
              )}
              {(!activeQuotes.q1 || !activeQuotes.q2) && (
                <Animated.View style={[styles.bottomInstructionContainer, { opacity: instructionOpacity }]}>
                  <MaterialCommunityIcons name="lock-outline" size={20} color="#666" />
                  <Text style={[styles.tapToVoteText, { color: '#666', textShadowColor: 'transparent' }]}>
                    COMBAT VERROUILLÉ
                  </Text>
                  <MaterialCommunityIcons name="lock-outline" size={20} color="#666" />
                </Animated.View>
              )}
            </View>

            <BattleQuoteModal
              visible={isModalVisible}
              onClose={() => setIsModalVisible(false)}
              results={{ q1: q1Percent, q2: q2Percent }}
              onSubmit={submitCustomQuote}
              nickname={userNickname}
            />
          </View>

          <OnboardingModal
            visible={showOnboarding}
            onClose={async () => {
              setShowOnboarding(false);
              await AsyncStorage.setItem('@onboarding_complete', 'true');
              const nickname = await AsyncStorage.getItem('@user_nickname');
              if (!nickname) {
                setShowNicknameModal(true);
              }
            }}
          />

          <NicknameModal
            visible={showNicknameModal}
            onSubmit={handleSaveNickname}
          />

          <TouchableOpacity 
            style={styles.calendarBtn}
            onPress={() => setIsCalendarVisible(true)}
          >
            <Ionicons name="calendar" size={24} color="#fcd53f" />
          </TouchableOpacity>

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
            onSetQuote={handleSetQuote}
            activeQuotes={activeQuotes}
            votes={votes}
          />

          <LoginModal
            visible={isLoginVisible}
            onClose={() => setIsLoginVisible(false)}
          />

          <CalendarModal 
            visible={isCalendarVisible}
            onClose={() => setIsCalendarVisible(false)}
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={adminStyles.overlay}
        >
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
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const PREDEFINED_QUOTES = [
  { text: "L'ART DE LA GUERRE C'EST DE SOUMETTRE L'ENNEMI SANS COMBATTRE.", author: "SUN TZU" },
  { text: "LES MOTS SONT DES PIÈGES POUR LES FOUS, DES ARMES POUR LES SAGES.", author: "ANONYME" },
  { text: "CE QUI NE ME TUE PAS ME REND PLUS FORT.", author: "NIETZSCHE" },
  { text: "LA MEILLEURE DÉFENSE EST UNE ATTAQUE EXPLOSIVE.", author: "SUN TZU" },
  { text: "UN GUERRIER NE RENONCE PAS À CE QU'IL AIME, IL TROUVE L'AMOUR DANS CE QU'IL FAIT.", author: "GUERRIER PACIFIQUE" },
  { text: "L'OBSTACLE EST LE CHEMIN DE LA VICTOIRE.", author: "MARC AURÈLE" },
  { text: "LA FORCE NE VIENT PAS DE LA CAPACITÉ PHYSIQUE, MAIS D'UNE VOLONTÉ INDOMPTABLE.", author: "GANDHI" },
  { text: "IL N'Y A PAS DE VICTOIRE SANS SACRIFICE.", author: "ANONYME" },
  { text: "LA SAGESSE COMMENCE DANS LE SILENCE DE LA BATAILLE.", author: "CONFUCIUS" },
  { text: "LE SEUL VÉRITABLE ÉCHEC EST D'ARRÊTER DE COMBATTRE.", author: "ANONYME" }
];

function AdminHeader({
  activeQuotes,
  votes,
  q1Percent,
  q2Percent,
  showPredefined,
  setShowPredefined,
  newQuoteText,
  setNewQuoteText,
  newQuoteAuthor,
  setNewQuoteAuthor,
  handleApprove
}) {
  return (
    <View style={{ paddingBottom: 10 }}>
      {/* CURRENT BATTLE SECTION */}
      <View style={adminStyles.sectionContainer}>
        <Text style={adminStyles.sectionTitle}>COMBAT ACTUEL :</Text>
        <View style={adminStyles.battleRow}>
          {/* Quote 1 (Red) Status */}
          <View style={[adminStyles.battleCard, { borderColor: '#ff3b30' }]}>
            <Text style={[adminStyles.battleCardTitle, { color: '#ff3b30' }]}>QUOTE 1 (ROUGE)</Text>
            {activeQuotes?.q1 ? (
              <>
                <Text style={adminStyles.battleCardText} numberOfLines={3}>
                  "{activeQuotes.q1.text}"
                </Text>
                <Text style={adminStyles.battleCardAuthor}>— {activeQuotes.q1.author}</Text>
                <View style={adminStyles.voteIndicator}>
                  <Text style={{ color: '#ff3b30', fontFamily: 'BebasNeue', fontSize: 18 }}>
                    {votes?.q1 || 0} VOTE(S) ({q1Percent}%)
                  </Text>
                </View>
              </>
            ) : (
              <Text style={adminStyles.battleCardTextEmpty}>[ VIDE / EN ATTENTE ]</Text>
            )}
          </View>

          {/* Quote 2 (Yellow) Status */}
          <View style={[adminStyles.battleCard, { borderColor: '#fcd53f' }]}>
            <Text style={[adminStyles.battleCardTitle, { color: '#fcd53f' }]}>QUOTE 2 (JAUNE)</Text>
            {activeQuotes?.q2 ? (
              <>
                <Text style={adminStyles.battleCardText} numberOfLines={3}>
                  "{activeQuotes.q2.text}"
                </Text>
                <Text style={adminStyles.battleCardAuthor}>— {activeQuotes.q2.author}</Text>
                <View style={adminStyles.voteIndicator}>
                  <Text style={{ color: '#fcd53f', fontFamily: 'BebasNeue', fontSize: 18 }}>
                    {votes?.q2 || 0} VOTE(S) ({q2Percent}%)
                  </Text>
                </View>
              </>
            ) : (
              <Text style={adminStyles.battleCardTextEmpty}>[ VIDE / EN ATTENTE ]</Text>
            )}
          </View>
        </View>
      </View>

      {/* 10 PRE-DEFINED CHAMPIONS */}
      <View style={[adminStyles.sectionContainer, { marginTop: 15 }]}>
        <TouchableOpacity
          style={adminStyles.predefinedHeader}
          onPress={() => setShowPredefined(!showPredefined)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="sword" size={20} color="#ff3b30" style={{ marginRight: 8 }} />
            <Text style={adminStyles.sectionTitle}>10 CHAMPIONNES DE DÉPART :</Text>
          </View>
          <Ionicons name={showPredefined ? "chevron-up" : "chevron-down"} size={20} color="#ff3b30" />
        </TouchableOpacity>

        {showPredefined && (
          <View style={adminStyles.predefinedList}>
            {PREDEFINED_QUOTES.map((item, idx) => (
              <View key={idx} style={adminStyles.predefinedItem}>
                <Text style={adminStyles.predefinedText}>"{item.text}"</Text>
                <Text style={adminStyles.predefinedAuthor}>— {item.author}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                  <TouchableOpacity
                    style={[adminStyles.approveButton, { flex: 1, marginRight: 5, backgroundColor: 'rgba(255, 59, 48, 0.2)' }]}
                    onPress={() => handleApprove(item.text, item.author, 'q1')}
                  >
                    <Text style={[adminStyles.approveButtonText, { color: '#ff3b30' }]}>SET Q1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[adminStyles.approveButton, { flex: 1, marginLeft: 5, backgroundColor: 'rgba(252, 213, 63, 0.2)' }]}
                    onPress={() => handleApprove(item.text, item.author, 'q2')}
                  >
                    <Text style={[adminStyles.approveButtonText, { color: '#fcd53f' }]}>SET Q2</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ADD MANUAL CUSTOM QUOTE */}
      <View style={[adminStyles.sectionContainer, { marginTop: 20 }]}>
        <Text style={adminStyles.sectionTitle}>AJOUTER UNE NOUVELLE CITATION :</Text>
        <TextInput
          style={modalStyles.input}
          placeholder="Écris la nouvelle citation ici..."
          placeholderTextColor="#888"
          multiline
          value={newQuoteText}
          onChangeText={setNewQuoteText}
        />
        <TextInput
          style={[modalStyles.input, { marginTop: 10, height: 50 }]}
          placeholder="Auteur (ex: Sun Tzu)"
          placeholderTextColor="#888"
          value={newQuoteAuthor}
          onChangeText={setNewQuoteAuthor}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <TouchableOpacity
            style={[adminStyles.approveButton, { flex: 1, marginRight: 5, backgroundColor: 'rgba(255, 59, 48, 0.2)' }]}
            onPress={() => handleApprove(newQuoteText, newQuoteAuthor, 'q1')}
          >
            <Text style={[adminStyles.approveButtonText, { color: '#ff3b30' }]}>SET Q1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[adminStyles.approveButton, { flex: 1, marginLeft: 5, backgroundColor: 'rgba(252, 213, 63, 0.2)' }]}
            onPress={() => handleApprove(newQuoteText, newQuoteAuthor, 'q2')}
          >
            <Text style={[adminStyles.approveButtonText, { color: '#fcd53f' }]}>SET Q2</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[adminStyles.sectionTitle, { borderTopWidth: 1, borderTopColor: '#222', paddingTop: 20, marginTop: 25, marginBottom: 10 }]}>
        CITATIONS SOUMISES :
      </Text>
    </View>
  );
}

function AdminSettingsModal({ visible, onClose, onSetQuote, activeQuotes, votes }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newQuoteText, setNewQuoteText] = useState("");
  const [newQuoteAuthor, setNewQuoteAuthor] = useState("");
  const [showPredefined, setShowPredefined] = useState(false);

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

  const handleApprove = (quoteText, authorText, slot) => {
    if (!quoteText || !quoteText.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une citation.');
      return;
    }

    // Check if the other slot already has the exact same quote text to prevent duplicates in active combat
    const otherSlot = slot === 'q1' ? 'q2' : 'q1';
    const otherQuote = activeQuotes[otherSlot];
    if (
      otherQuote &&
      otherQuote.text &&
      otherQuote.text.trim().toLowerCase() === quoteText.trim().toLowerCase()
    ) {
      Alert.alert('Doublon', 'Cette citation est déjà active dans l\'arène ! Sélectionnez un autre adversaire.');
      return;
    }

    // Check if the admin is trying to replace the winning quote
    const voteQ1 = votes?.q1 || 0;
    const voteQ2 = votes?.q2 || 0;
    if (voteQ1 !== voteQ2) {
      const winnerSlot = voteQ1 > voteQ2 ? 'q1' : 'q2';
      if (slot === winnerSlot) {
        Alert.alert(
          'Action Bloquée',
          `La citation de la Quote ${slot === 'q1' ? '1' : '2'} est actuellement gagnante ! Vous ne pouvez remplacer que la citation vaincue.`
        );
        return;
      }
    }

    Alert.alert(
      'Confirmer',
      `Voulez-vous définir cette citation comme Quote ${slot === 'q1' ? '1 (Rouge)' : '2 (Jaune)'} ?\n\n"${quoteText}"\n— ${authorText || 'ANONYME'}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'VALIDER',
          onPress: () => {
            onSetQuote(quoteText, authorText, slot);
            setNewQuoteText(""); // clear input
            setNewQuoteAuthor("");
            Alert.alert('Succès', `La citation a été définie pour la Quote ${slot === 'q1' ? '1' : '2'} !`);
          }
        }
      ]
    );
  };

  const totalVotes = (votes?.q1 || 0) + (votes?.q2 || 0);
  const q1Percent = totalVotes > 0 ? Math.round(((votes?.q1 || 0) / totalVotes) * 100) : 0;
  const q2Percent = totalVotes > 0 ? Math.round(((votes?.q2 || 0) / totalVotes) * 100) : 0;



  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={adminStyles.overlay}
        >
          <View style={adminStyles.container}>
            <View style={adminStyles.header}>
              <Text style={adminStyles.title}>PANEL ADMIN</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={async () => {
                    Alert.alert(
                      "Déconnexion",
                      "Voulez-vous vous déconnecter du panel Admin ?",
                      [
                        { text: "Annuler", style: "cancel" },
                        {
                          text: "Déconnexion",
                          style: "destructive",
                          onPress: async () => {
                            await supabase.auth.signOut();
                            onClose();
                          }
                        }
                      ]
                    );
                  }}
                  style={{ marginRight: 15 }}
                >
                  <Ionicons name="log-out-outline" size={24} color="#ff3b30" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose}>
                  <Text style={adminStyles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {loading && submissions.length === 0 ? (
              <ActivityIndicator size="large" color="#ff3b30" style={{ marginTop: 50 }} />
            ) : (
              <FlatList
                data={submissions}
                keyExtractor={(item) => item.id.toString()}
                ListHeaderComponent={
                  <AdminHeader
                    activeQuotes={activeQuotes}
                    votes={votes}
                    q1Percent={q1Percent}
                    q2Percent={q2Percent}
                    showPredefined={showPredefined}
                    setShowPredefined={setShowPredefined}
                    newQuoteText={newQuoteText}
                    setNewQuoteText={setNewQuoteText}
                    newQuoteAuthor={newQuoteAuthor}
                    setNewQuoteAuthor={setNewQuoteAuthor}
                    handleApprove={handleApprove}
                  />
                }
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const parts = item.quote.split(' — ');
                  const quoteText = parts[0];
                  const authorText = parts[1] || 'ANONYME';
                  return (
                    <View style={adminStyles.quoteItem}>
                      <Text style={adminStyles.quoteText}>"{quoteText}"</Text>
                      <Text style={{ color: '#ff3b30', fontFamily: 'BebasNeue', fontSize: 16, marginTop: 5, textTransform: 'uppercase' }}>
                        PAR : {authorText}
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
                        <TouchableOpacity
                          style={[adminStyles.approveButton, { flex: 1, marginRight: 5, backgroundColor: 'rgba(255, 59, 48, 0.2)' }]}
                          onPress={() => handleApprove(quoteText, authorText, 'q1')}
                        >
                          <Text style={[adminStyles.approveButtonText, { color: '#ff3b30' }]}>SET Q1</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[adminStyles.approveButton, { flex: 1, marginLeft: 5, backgroundColor: 'rgba(252, 213, 63, 0.2)' }]}
                          onPress={() => handleApprove(quoteText, authorText, 'q2')}
                        >
                          <Text style={[adminStyles.approveButtonText, { color: '#fcd53f' }]}>SET Q2</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <Text style={adminStyles.emptyText}>Aucune citation soumise pour le moment.</Text>
                }
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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

function BattleQuoteModal({ visible, onClose, onSubmit, results, nickname }) {
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={modalStyles.overlay}
        >
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

            <Text style={{ color: '#aaa', fontFamily: 'BebasNeue', fontSize: 16, marginTop: 5, marginBottom: 15, alignSelf: 'flex-start', textTransform: 'uppercase' }}>
              AUTEUR : <Text style={{ color: '#ff3b3b' }}>{nickname || 'ANONYME'}</Text>
            </Text>

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
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function NicknameModal({ visible, onSubmit }) {
  const [nickname, setNickname] = useState("");

  const handleSubmit = () => {
    if (!nickname.trim()) {
      Alert.alert("Erreur", "Veuillez entrer un surnom.");
      return;
    }
    onSubmit(nickname);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={onboardingStyles.overlay}
        >
          <LinearGradient
            colors={['#1a0a0a', '#050505']}
            style={onboardingStyles.container}
          >
            <View style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <MaterialCommunityIcons name="account-circle-outline" size={100} color="#ff3b30" />
              <Text style={onboardingStyles.title}>TON SURNOM DANS L'ARÈNE</Text>
              <Text style={[onboardingStyles.description, { marginBottom: 40 }]}>
                Choisis un pseudo. Il sera utilisé comme signature d'auteur lorsque tu soumettras tes propres citations.
              </Text>

              <TextInput
                style={[
                  modalStyles.input,
                  {
                    width: '100%',
                    borderColor: '#ff3b30',
                    borderWidth: 1.5,
                    fontSize: 22,
                    fontFamily: 'BebasNeue',
                    color: '#fff',
                    textAlign: 'center',
                    paddingVertical: 12,
                    marginBottom: 20
                  }
                ]}
                placeholder="MON PSEUDO..."
                placeholderTextColor="#666"
                maxLength={15}
                autoCapitalize="characters"
                value={nickname}
                onChangeText={setNickname}
              />

              <TouchableOpacity
                onPress={handleSubmit}
                style={onboardingStyles.buttonWrapper}
              >
                <ImageBackground
                  source={require('./assets/paint.png')}
                  style={onboardingStyles.buttonImage}
                  resizeMode="stretch"
                >
                  <View style={onboardingStyles.buttonTextWrapper}>
                    <Text style={onboardingStyles.buttonText}>C'EST PARTI !</Text>
                  </View>
                </ImageBackground>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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
    minHeight: 170,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    paddingHorizontal: 30,
    paddingTop: 35,
    paddingBottom: 25,
    marginVertical: 6,
    marginHorizontal: 10,
    justifyContent: 'center',
    position: 'relative',
  },
  glowBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    borderWidth: 1.8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 6,
  },
  quoteCardQ1: {
    borderColor: 'rgba(255, 59, 48, 0.45)',
    shadowColor: '#ff3b30',
  },
  quoteCardQ2: {
    borderColor: 'rgba(252, 213, 63, 0.45)',
    shadowColor: '#fcd53f',
  },
  quoteText: {
    fontFamily: 'BebasNeue',
    fontSize: width > 380 ? 21 : 18,
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 1.2,
    lineHeight: width > 380 ? 27 : 23,
    zIndex: 2,
    textTransform: 'uppercase',
  },
  authorText: {
    fontFamily: 'BebasNeue',
    fontSize: 15,
    marginTop: 45,
    alignSelf: 'center',
    letterSpacing: 2,
    zIndex: 2,
    textTransform: 'uppercase',
  },
  quoteMarkContainerLeft: {
    position: 'absolute',
    top: 5,
    left: 10,
    zIndex: 1,
  },
  quoteMarkContainerRight: {
    position: 'absolute',
    bottom: 5,
    right: 10,
    zIndex: 1,
  },
  quoteMark: {
    fontFamily: 'BebasNeue',
    fontSize: 70,
    lineHeight: 70,
  },
  cardFace: {
    width: '100%',
    backfaceVisibility: 'hidden',
  },
  cardFaceBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  statsTrigger: {
    position: 'absolute',
    bottom: 12,
    left: 15,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statsTriggerText: {
    fontFamily: 'BebasNeue',
    fontSize: 11,
    marginLeft: 4,
    letterSpacing: 1,
  },
  statsTitle: {
    fontFamily: 'BebasNeue',
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 15,
    textTransform: 'uppercase',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
    marginHorizontal: 10,
  },
  statLabel: {
    fontFamily: 'BebasNeue',
    fontSize: 14,
    color: '#888888',
    letterSpacing: 1.5,
  },
  statValue: {
    fontFamily: 'BebasNeue',
    fontSize: 14,
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    height: 50,
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
    fontSize: 45,
    color: '#ff0000',
    textShadowColor: 'rgba(255, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    fontStyle: 'italic',
  },
  glow: {
    position: 'absolute',
    width: 50,
    height: 50,
    backgroundColor: '#ff0000',
    borderRadius: 25,
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
    left: 20,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
  },
  calendarBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(252, 213, 63, 0.3)',
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
  emptyArenaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#0a0a0a',
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 59, 48, 0.2)',
    paddingVertical: 40,
    marginVertical: 20,
  },
  emptyArenaTitle: {
    fontFamily: 'BebasNeue',
    fontSize: 36,
    color: '#fff',
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 59, 48, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  emptyArenaSubtitle: {
    fontFamily: 'BebasNeue',
    fontSize: 20,
    color: '#ff3b30',
    letterSpacing: 1,
    marginTop: 5,
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  emptyArenaDescription: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  emptyArenaAdminBtn: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  emptyArenaAdminBtnText: {
    fontFamily: 'BebasNeue',
    fontSize: 16,
    color: '#ff3b30',
    letterSpacing: 1,
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
  },
  sectionContainer: {
    backgroundColor: '#111',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#222',
  },
  sectionTitle: {
    fontFamily: 'BebasNeue',
    fontSize: 18,
    color: '#aaa',
    marginBottom: 10,
    letterSpacing: 1,
  },
  battleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  battleCard: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 10,
    marginHorizontal: 4,
    justifyContent: 'space-between',
  },
  battleCardTitle: {
    fontFamily: 'BebasNeue',
    fontSize: 12,
    marginBottom: 8,
    letterSpacing: 1,
  },
  battleCardText: {
    color: '#eee',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  battleCardTextEmpty: {
    color: '#555',
    fontSize: 11,
    fontFamily: 'BebasNeue',
    textAlign: 'center',
    marginVertical: 15,
  },
  battleCardAuthor: {
    fontFamily: 'BebasNeue',
    fontSize: 11,
    color: '#888',
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  voteIndicator: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 5,
    alignItems: 'center',
  },
  predefinedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  predefinedList: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 10,
  },
  predefinedItem: {
    backgroundColor: '#151515',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  predefinedText: {
    color: '#ccc',
    fontSize: 13,
    fontStyle: 'italic',
  },
  predefinedAuthor: {
    fontFamily: 'BebasNeue',
    fontSize: 11,
    color: '#ff3b30',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
});

// -- Calendar Modal Component --
const getMockBattleForDate = (targetDateString) => {
  const quotes = [
    { text: "L'art suprême de la guerre est de soumettre l'ennemi sans combattre.", author: "SUN TZU" },
    { text: "Ce qui ne me tue pas me rend plus fort.", author: "FRIEDRICH NIETZSCHE" },
    { text: "La meilleure vengeance est de ne pas ressembler à celui qui cause la blessure.", author: "MARC AURÈLE" },
    { text: "Exige beaucoup de toi-même et attends peu des autres.", author: "CONFUCIUS" },
    { text: "La force ne vient pas des capacités physiques, elle vient d'une volonté invincible.", author: "GANDHI" },
    { text: "Il est plus difficile de vaincre ses passions que de vaincre le monde.", author: "ALEXANDRE LE GRAND" },
    { text: "Un voyage de mille lieues commence toujours par un premier pas.", author: "LAO TSEU" },
    { text: "L'enfer, c'est les autres.", author: "JEAN-PAUL SARTRE" },
    { text: "Je pense, donc je suis.", author: "RENÉ DESCARTES" },
    { text: "Le courage n'est pas l'absence de peur, mais la capacité de la vaincre.", author: "NELSON MANDELA" }
  ];

  const epoch = new Date('2026-01-01T00:00:00Z');
  const targetDate = new Date(targetDateString + 'T00:00:00Z');
  
  if (targetDate < epoch) {
    return null;
  }

  const diffTime = targetDate.getTime() - epoch.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let currentChampion = quotes[0];
  let currentChallengerIndex = 1;
  let battleResult = null;

  for (let i = 0; i <= diffDays; i++) {
    const currentChallenger = quotes[currentChallengerIndex % quotes.length];
    
    // Deterministic simulation for day `i`
    const hash = (i * 13) % 100;
    
    // Challenger wins if hash < 35 (35% win rate for challenger)
    const challengerWins = hash < 35;
    
    let champPercent, challPercent;
    if (challengerWins) {
      challPercent = 51 + (hash % 15);
      champPercent = 100 - challPercent;
    } else {
      champPercent = 51 + (hash % 20);
      challPercent = 100 - champPercent;
    }

    battleResult = {
      q1: currentChampion,
      q2: currentChallenger,
      q1Percent: champPercent,
      q2Percent: challPercent,
      winner: challengerWins ? 'q2' : 'q1'
    };

    if (challengerWins) {
      currentChampion = currentChallenger;
    }
    currentChallengerIndex++;
  }

  return battleResult;
};

function CalendarModal({ visible, onClose }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [battleOfDay, setBattleOfDay] = useState(null);

  const handleDayPress = (day) => {
    const today = new Date().toISOString().split('T')[0];
    if (day.dateString > today) {
      Alert.alert('Mystère', 'Ce combat n\'a pas encore eu lieu !');
      return;
    }
    setSelectedDate(day.dateString);
    setBattleOfDay(getMockBattleForDate(day.dateString));
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.container, { padding: 20, maxHeight: '85%' }]}>
          <TouchableOpacity style={[modalStyles.closeBtn, { zIndex: 10 }]} onPress={onClose}>
            <Text style={modalStyles.closeText}>✕</Text>
          </TouchableOpacity>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            <Text style={modalStyles.title}>📅 ARCHIVES DES COMBATS</Text>

            <Calendar
              onDayPress={handleDayPress}
              maxDate={new Date().toISOString().split('T')[0]}
              markedDates={{
                [selectedDate]: { selected: true, selectedColor: '#ff3b30' }
              }}
              theme={{
                backgroundColor: '#0a0a0a',
                calendarBackground: '#0a0a0a',
                textSectionTitleColor: '#a0a0a0',
                selectedDayBackgroundColor: '#ff3b30',
                selectedDayTextColor: '#ffffff',
                todayTextColor: '#fcd53f',
                dayTextColor: '#ffffff',
                textDisabledColor: '#333333',
                dotColor: '#ff3b30',
                selectedDotColor: '#ffffff',
                arrowColor: '#ff3b30',
                monthTextColor: '#ffffff',
                indicatorColor: '#ff3b30',
                textDayFontFamily: 'BebasNeue',
                textMonthFontFamily: 'BebasNeue',
                textDayHeaderFontFamily: 'BebasNeue',
                textMonthFontWeight: 'bold',
                textDayFontSize: 16,
                textMonthFontSize: 24,
                textDayHeaderFontSize: 14
              }}
            />

            {battleOfDay && (
              <View style={{ marginTop: 20 }}>
                <Text style={{ fontFamily: 'BebasNeue', color: '#ff3b30', fontSize: 18, textAlign: 'center', marginBottom: 10 }}>
                  COMBAT DU {selectedDate}
                </Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, padding: 10, backgroundColor: '#111', borderRadius: 8, borderWidth: 1, borderColor: battleOfDay.winner === 'q1' ? '#ff3b30' : '#222' }}>
                    <Text style={{ color: '#fff', fontStyle: 'italic', fontSize: 12 }}>"{battleOfDay.q1.text}"</Text>
                    <Text style={{ fontFamily: 'BebasNeue', color: '#a0a0a0', marginTop: 5, fontSize: 12 }}>— {battleOfDay.q1.author}</Text>
                    <Text style={{ fontFamily: 'BebasNeue', color: battleOfDay.winner === 'q1' ? '#ff3b30' : '#888', marginTop: 5, fontSize: 16 }}>{battleOfDay.q1Percent}%</Text>
                  </View>
                  
                  <View style={{ justifyContent: 'center', paddingHorizontal: 5 }}>
                    <Text style={{ fontFamily: 'BebasNeue', color: '#fcd53f', fontSize: 20 }}>VS</Text>
                  </View>

                  <View style={{ flex: 1, padding: 10, backgroundColor: '#111', borderRadius: 8, borderWidth: 1, borderColor: battleOfDay.winner === 'q2' ? '#fcd53f' : '#222' }}>
                    <Text style={{ color: '#fff', fontStyle: 'italic', fontSize: 12 }}>"{battleOfDay.q2.text}"</Text>
                    <Text style={{ fontFamily: 'BebasNeue', color: '#a0a0a0', marginTop: 5, fontSize: 12 }}>— {battleOfDay.q2.author}</Text>
                    <Text style={{ fontFamily: 'BebasNeue', color: battleOfDay.winner === 'q2' ? '#fcd53f' : '#888', marginTop: 5, fontSize: 16 }}>{battleOfDay.q2Percent}%</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

