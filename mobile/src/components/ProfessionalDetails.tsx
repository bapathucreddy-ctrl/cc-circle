import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { Professional } from '../domain';
import { professionalFacts } from '../lib/professionalFacts';
import { Card, TextButton, useTheme } from '../ui';

export function ProfessionalDetails({ person, availability, footer }: { person: Professional; availability?: string; footer?: ReactNode }) {
  const { styles, colors } = useTheme(); const [expanded, setExpanded] = useState(false);
  const facts = professionalFacts(person);
  return <Card><Text style={styles.heading}>About this professional</Text>
    <View style={styles.between}><Text style={styles.muted}>{person.city}</Text>{availability && <Text style={styles.text}>{availability}</Text>}</View>
    {person.specialties.length > 0 && <Text style={styles.text}>{person.specialties.join(' · ')}</Text>}
    {(expanded ? facts : facts.slice(0, 4)).map(fact => <View key={fact.id} style={{ gap: 5, paddingTop: 10, borderTopWidth: 1, borderColor: colors.line }}><Text style={[styles.muted, { fontSize: 12 }]}>{fact.label}</Text><Text style={styles.text}>{fact.value}</Text></View>)}
    {facts.length > 4 && <TextButton title={expanded ? 'Show less' : 'More details'} onPress={() => setExpanded(value => !value)} />}
    {footer}
  </Card>;
}
