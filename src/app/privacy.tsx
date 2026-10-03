import {Text} from '../components/Typography';
import React from 'react';
import {View} from 'react-native';
import {Page,Title,c,s} from '../components/UI';
export default function Privacy(){return <Page><Title eyebrow="CC Circle" title="Privacy and verification." subtitle="A plain-language product summary. Final legal terms must be approved before public launch."/>{[
 ['Public profile','Your name, crafts, specialties, city, bio, rates, availability, self-reported credits, optional profile photo, media URLs discovered from your public portfolio links and those links are visible to people browsing talent. Your email and password are never in the public profile.'],
 ['Hiring conversations','Inquiries are visible to the buyer who sent them and the talent who received them. Project briefs are public when posted.'],
 ['Review evidence','A live camera photo and linked public work are reviewed privately by authorized reviewers. No automatic face match is performed. A badge only means the profile and portfolio link were checked; it is not a skill or legal identity certification.'],
 ['Control','You can edit your profile, curate or hide portfolio items, remove links and their discovered media, and delete your account in Settings. Review evidence is removed with account deletion.'],
 ['Projects & conversations','Project briefs are public. Applications and replies are private to the creator and hiring team. A shared shortlist link exposes its project name and public creator profiles to anyone with the link; resetting the link revokes prior access. Following and saved searches are stored with your account.'],
 ['External platforms','When you add a public profile URL, our server reads its publicly available HTML to find image and video URLs. We store those URLs and show up to ten of each. We do not download or store the media files. Some platforms block automated access or image embedding. A YouTube or professional Instagram connection imports public media after owner authorization. Access tokens are used for the import and are not stored; reconnect to update that source.']
 ].map(([h,b])=><View key={h} style={s.panel}><Text style={{color:c.ink,fontWeight:'900',fontSize:16}}>{h}</Text><Text style={{color:c.muted,lineHeight:21,marginTop:8}}>{b}</Text></View>)}</Page>}
