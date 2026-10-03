import React from 'react';
import {Platform,StyleSheet,Text as NativeText,TextProps} from 'react-native';
export const headingFont=Platform.OS==='android'?'serif':'Georgia';
export function Text({style,...props}:TextProps){const flat=StyleSheet.flatten(style);const weight=flat?.fontWeight;const bold=weight==='bold'||Number(weight)>=600;const fontFamily=flat?.fontFamily||(props.accessibilityRole==='header'?headingFont:undefined);return <NativeText {...props} style={[{fontSize:15,lineHeight:23},style,{fontWeight:fontFamily?weight:'normal',fontFamily:fontFamily||(bold?'Inter-SemiBold':'Inter-Regular')}]}/>}
