import React from 'react';
import WebEffects from '../components/WebEffects';
import {Stack} from 'expo-router';
import {useFonts} from 'expo-font';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {CircleProvider} from '../state/CircleContext';
export default function Layout(){const [loaded,error]=useFonts({'Inter-Regular':require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),'Inter-SemiBold':require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf')});if(!loaded&&!error)return null;return <SafeAreaProvider><CircleProvider><WebEffects/><Stack screenOptions={{headerShown:false}}/></CircleProvider></SafeAreaProvider>}
