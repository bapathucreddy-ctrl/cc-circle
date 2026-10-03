import React from 'react';
import {Platform} from 'react-native';
import {WebView} from 'react-native-webview';
import appConfig from '../../app.json';
import {allowVideoNavigation} from '../lib/media';

export default function EmbeddedVideo({url,onError}:{url:string;onError:()=>void}){
 const appId=Platform.OS==='ios'?appConfig.expo.ios.bundleIdentifier:appConfig.expo.android.package;
 return <WebView
  style={{flex:1,backgroundColor:'#000'}}
  source={{uri:url,headers:{Referer:`https://${appId.toLowerCase()}/`}}}
  allowsInlineMediaPlayback allowsFullscreenVideo mediaPlaybackRequiresUserAction
  // Route every attempted URL through our guard, including app deep links.
  originWhitelist={['*']}
  javaScriptCanOpenWindowsAutomatically={false}
  onOpenWindow={()=>{}}
  allowsLinkPreview={false}
  onError={onError} onHttpError={onError}
  onShouldStartLoadWithRequest={request=>allowVideoNavigation(request,url)}
 />;
}
