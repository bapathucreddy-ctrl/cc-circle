import React from 'react';
import {View} from 'react-native';
import type {DateFieldProps} from './DateField';
import {Text,c,s} from './UI';
export default function DateField({label,value,onChange,minimum}:DateFieldProps){return <View style={{marginBottom:18}}><Text style={s.label}>{label}</Text><input aria-label={label} type="date" value={value} min={minimum} onChange={e=>onChange(e.currentTarget.value)} style={{boxSizing:'border-box',width:'100%',minHeight:50,fontFamily:'Inter-Regular, sans-serif',fontSize:15,color:c.ink,background:c.paper,border:`1px solid ${c.line}`,borderRadius:10,padding:'12px 14px'}}/></View>}
