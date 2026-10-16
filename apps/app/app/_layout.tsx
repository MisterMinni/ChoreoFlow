import React from 'react';
import {Stack} from 'expo-router';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppProvider} from '../src/state';
export default function Layout(){return <SafeAreaProvider><AppProvider><Stack screenOptions={{headerShown:false}}/></AppProvider></SafeAreaProvider>;}
