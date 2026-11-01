import { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { launchSplashHtml } from './launchSplashHtml';
export function LaunchSplash({ onFinish, ready = true }: { onFinish: () => void; ready?: boolean }) {
 const finished=useRef(false);
 const finish=useCallback(()=>{if(!finished.current){finished.current=true;onFinish();}},[onFinish]);
 useEffect(()=>{if(!ready)return;finished.current=false;const deadline=setTimeout(finish,6500);return()=>{finished.current=true;clearTimeout(deadline);};},[ready,finish]);
 return <View testID="launch-splash" accessibilityLabel="Artist House is opening" style={{position:'absolute',inset:0,zIndex:100,backgroundColor:'#ffffff'}}>{ready&&<WebView source={{html:launchSplashHtml}} originWhitelist={['about:*']} javaScriptEnabled scrollEnabled={false} bounces={false} setSupportMultipleWindows={false} allowFileAccess={false} onShouldStartLoadWithRequest={request=>request.url==='about:blank'} onMessage={event=>{if(event.nativeEvent.data==='artist-house-splash-complete')finish();}} onError={finish} onContentProcessDidTerminate={finish} style={{flex:1,backgroundColor:'#ffffff'}}/>}</View>;
}
