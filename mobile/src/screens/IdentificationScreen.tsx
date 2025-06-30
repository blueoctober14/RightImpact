import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { FriendsStackParamList } from '../types/navigation.types';
import { theme } from '../theme';
import { Card, List, Button, RadioButton, Checkbox } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import {
  fetchIdentificationQuestions,
  IdQuestion,
  submitIdentificationAnswer,
  fetchContactAnswers,
  ContactAnswer,
} from '../services/identification';

// Route params type
interface IdentificationRouteParams {
  contact: any;
}

type IdentificationRouteProp = RouteProp<FriendsStackParamList, 'Identification'>;

const IdentificationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<IdentificationRouteProp>();
  const { contact } = route.params as IdentificationRouteParams;

  const [questions, setQuestions] = useState<IdQuestion[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);

  // Replace variables like %contactfirst% with actual values
  const replaceVars = (txt: string) => {
    if (!txt) return '';
    return txt
      .replace(/%contactfirst%/gi, contact.first_name || '')
      .replace(/%contactlast%/gi, contact.last_name || '');
  };

  useEffect(() => {
    navigation.setOptions({ title: `${contact.first_name} ${contact.last_name}`.trim() || 'Identification' });
  }, [navigation, contact]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Load questions
        const qs = await fetchIdentificationQuestions();
        setQuestions(qs);
        
        // Load previous answers for this contact
        const contactId = contact.shared_contact_id || contact.id;
        if (contactId) {
          try {
            const previousAnswers = await fetchContactAnswers(contactId);
            if (previousAnswers && previousAnswers.length > 0) {
              // Convert array of answers to a map keyed by question_id
              const answersMap: Record<number, any> = {};
              previousAnswers.forEach(answer => {
                answersMap[answer.question_id] = {
                  selected_choices: answer.selected_choices || [],
                  slider_answer: answer.slider_answer,
                  text_answer: answer.text_answer,
                  notes: answer.notes,
                };
              });
              setAnswers(answersMap);
            }
          } catch (answerErr) {
            console.error('Failed to load previous answers:', answerErr);
            // Continue even if we can't load previous answers
          }
        }
        
        // Expand first question if only one exists
        if (qs.length === 1) {
          setExpandedId(qs[0].id);
        }
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to load questions');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [contact]);

  const handleSave = async (question: IdQuestion) => {
    const answerData = answers[question.id];
    if (!answerData) {
      Alert.alert('Error', 'Please provide an answer');
      return;
    }
    try {
      await submitIdentificationAnswer(question.id, {
        shared_contact_id: contact.shared_contact_id || contact.id,
        ...answerData,
      });
      Alert.alert('Saved', 'Answer submitted', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to submit answer');
    }
  };

  const renderQuestionBody = (question: IdQuestion) => {
    switch (question.response_type) {
      case 'SLIDER': {
        const val = answers[question.id]?.slider_answer ?? 5;
        return (
          <View style={styles.sliderContainer}>
            <Slider
              style={{ width: '100%' }}
              minimumValue={1}
              maximumValue={10}
              step={1}
              minimumTrackTintColor={theme.colors.primary}
              value={val}
              onValueChange={(v: number) =>
                setAnswers((prev) => ({ ...prev, [question.id]: { ...prev[question.id], slider_answer: v } }))
              }
            />
            <Text style={styles.sliderValue}>{val}</Text>
          </View>
        );
      }
      case 'MC_SINGLE': {
        const selected = answers[question.id]?.selected_choices?.[0] || '';
        return (
          <RadioButton.Group
            onValueChange={(value) =>
              setAnswers((prev) => ({
                ...prev,
                [question.id]: { ...prev[question.id], selected_choices: [value] },
              }))
            }
            value={selected}
          >
            {question.possible_choices.map((choice) => (
              <RadioButton.Item key={choice} label={replaceVars(choice)} value={choice} />
            ))}
          </RadioButton.Group>
        );
      }
      case 'MC_MULTI': {
        const selectedArr: string[] = answers[question.id]?.selected_choices || [];
        return (
          <View>
            {question.possible_choices.map((choice) => {
              const checked = selectedArr.includes(choice);
              return (
                <View
                  key={choice}
                  style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}
                >
                  <Checkbox
                    status={checked ? 'checked' : 'unchecked'}
                    onPress={() =>
                      setAnswers((prev) => {
                        const current = prev[question.id]?.selected_choices || [];
                        const newArr = checked
                          ? current.filter((c: string) => c !== choice)
                          : [...current, choice];
                        return {
                          ...prev,
                          [question.id]: { ...prev[question.id], selected_choices: newArr },
                        };
                      })
                    }
                  />
                  <Text>{replaceVars(choice)}</Text>
                </View>
              );
            })}
          </View>
        );
      }
      case 'TEXT':
      default: {
        return (
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="Type your answer..."
            placeholderTextColor="#888"
            onChangeText={(t) =>
              setAnswers((prev) => ({ ...prev, [question.id]: { ...prev[question.id], text_answer: t } }))
            }
            value={answers[question.id]?.text_answer || ''}
          />
        );
      }
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {loading ? (
        <Text style={styles.loadingText}>Loading...</Text>
      ) : (
        questions.map((q) => (
          <Card key={q.id} style={styles.card}>
            <List.Accordion
              title={replaceVars(q.title)}
              titleStyle={styles.cardTitle}
              expanded={expandedId === q.id}
              onPress={() => setExpandedId(expandedId === q.id ? null : q.id)}
            >
              <View style={styles.cardContent}>
                <Text style={styles.questionText}>{replaceVars(q.question_text)}</Text>
                {renderQuestionBody(q)}
                {q.notes_enabled && (
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Notes (optional)"
                    placeholderTextColor="#888"
                    multiline
                    onChangeText={(t) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], notes: t } }))
                    }
                    value={answers[q.id]?.notes || ''}
                  />
                )}
                <Button
                  mode="contained"
                  onPress={() => handleSave(q)}
                  style={{ marginTop: 12, alignSelf: 'flex-start' }}
                >
                  Save
                </Button>
              </View>
            </List.Accordion>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 32,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  questionText: {
    fontSize: 14,
    marginBottom: 12,
    color: theme.colors.text,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    minHeight: 60,
    textAlignVertical: 'top',
    color: theme.colors.text,
  },
  sliderContainer: {
    paddingVertical: 8,
  },
  sliderValue: {
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    minHeight: 40,
    marginTop: 12,
    textAlignVertical: 'top',
    color: theme.colors.text,
  },
});

export default IdentificationScreen;
