package com.cccircle.admin;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;

/** Runs only packaged UI. OAuth stays in the system browser, with PKCE callbacks. */
public final class MainActivity extends Activity {
 private static final String HOST = "circle-admin.local";
 private WebView web;
 private String pendingAuth;
 private boolean ready;
 private ValueCallback<Uri[]> fileCallback;

 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  FrameLayout root = new FrameLayout(this);
  root.setFitsSystemWindows(true);
  web = new WebView(this);
  root.addView(web, new FrameLayout.LayoutParams(-1,-1));
  setContentView(root);
  getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
  root.setOnApplyWindowInsetsListener((view,insets)->{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
  WebSettings settings = web.getSettings();
  settings.setJavaScriptEnabled(true);
  settings.setDomStorageEnabled(true);
  settings.setAllowFileAccess(false);
  settings.setAllowContentAccess(true);
  settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  settings.setSupportMultipleWindows(false);
  WebView.setWebContentsDebuggingEnabled(false);
  web.addJavascriptInterface(new AuthBridge(), "CircleAndroid");
  web.setWebViewClient(new WebViewClient() {
   @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
    Uri uri=request.getUrl();
    if(!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost())) return null;
    String path=uri.getPath();
    if(path==null || path.equals("/"))path="/index.html";
    if(!path.matches("/(index\\.html|launch-splash\\.html|launch-splash\\.js|app\\.js|style\\.css|profile\\.css|mobile\\.css|reference\\.css|logo\\.svg|service-defaults/[a-z-]+\\.jpg)"))return new WebResourceResponse("text/plain","UTF-8",404,"Not found",null,null);
    String mime=path.endsWith(".jpg")?"image/jpeg":path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".svg")?"image/svg+xml":"text/html";
    try {
     Map<String,String> headers=new HashMap<>();
     headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; object-src 'none'; base-uri 'none'");
     headers.put("X-Content-Type-Options","nosniff");
     return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,getAssets().open(path.substring(1)));
    }catch(Exception ignored){return new WebResourceResponse("text/plain","UTF-8",404,"Not found",null,null);}
   }
   @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
    Uri uri=request.getUrl();
    if("https".equals(uri.getScheme()) && HOST.equals(uri.getHost()))return false;
    if(request.isForMainFrame() && "https".equals(uri.getScheme()))openBrowser(uri);
    return true;
   }
   @Override public void onPageFinished(WebView view,String url){ready=true;deliverAuth();}
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(fileCallback!=null)fileCallback.onReceiveValue(null);
    fileCallback=callback;
    Intent picker=new Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
    picker.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/jpeg","image/png","image/webp"});
    try{startActivityForResult(Intent.createChooser(picker,"Choose banner artwork"),42);return true;}
    catch(Exception ignored){fileCallback.onReceiveValue(null);fileCallback=null;return false;}
   }
  });
  acceptAuth(getIntent());
  web.loadUrl("https://"+HOST+"/");
 }
 private void openBrowser(Uri uri){try{startActivity(new Intent(Intent.ACTION_VIEW,uri).addCategory(Intent.CATEGORY_BROWSABLE));}catch(Exception ignored){android.widget.Toast.makeText(this,"Install a browser to sign in",android.widget.Toast.LENGTH_LONG).show();}}
 public final class AuthBridge {
  @JavascriptInterface public String getAuthItem(String key){
   if(!key.startsWith("circle-banner-admin"))return null;
   String value=getSharedPreferences("circle-admin-auth",MODE_PRIVATE).getString(key,null);if(value==null)return null;
   try{String[] parts=value.split(":");javax.crypto.Cipher cipher=javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");cipher.init(javax.crypto.Cipher.DECRYPT_MODE,authKey(),new javax.crypto.spec.GCMParameterSpec(128,android.util.Base64.decode(parts[0],android.util.Base64.NO_WRAP)));return new String(cipher.doFinal(android.util.Base64.decode(parts[1],android.util.Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8);}catch(Exception ignored){return null;}
  }
  @JavascriptInterface public void setAuthItem(String key,String value){
   if(!key.startsWith("circle-banner-admin"))return;
   try{javax.crypto.Cipher cipher=javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");cipher.init(javax.crypto.Cipher.ENCRYPT_MODE,authKey());String encrypted=android.util.Base64.encodeToString(cipher.getIV(),android.util.Base64.NO_WRAP)+":"+android.util.Base64.encodeToString(cipher.doFinal(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)),android.util.Base64.NO_WRAP);if(!getSharedPreferences("circle-admin-auth",MODE_PRIVATE).edit().putString(key,encrypted).commit())throw new IllegalStateException("Unable to save sign-in");}catch(Exception ignored){throw new IllegalStateException("Unable to save sign-in securely");}
  }
  @JavascriptInterface public void removeAuthItem(String key){if(key.startsWith("circle-banner-admin"))getSharedPreferences("circle-admin-auth",MODE_PRIVATE).edit().remove(key).commit();}
  @JavascriptInterface public void setAppearance(String value){runOnUiThread(()->{
   boolean dark="dark".equals(value);int color=android.graphics.Color.parseColor(dark?"#101010":"#f4f4f4");
   getWindow().setStatusBarColor(color);getWindow().setNavigationBarColor(color);
   getWindow().getDecorView().setBackgroundColor(color);web.setBackgroundColor(color);
   getWindow().getDecorView().setSystemUiVisibility(dark?0:android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
  });}
  @JavascriptInterface public void openAuth(String value){
   Uri uri=Uri.parse(value);
   if("https".equals(uri.getScheme()) && uri.getHost()!=null && uri.getHost().endsWith(".supabase.co") && "/auth/v1/authorize".equals(uri.getPath()))runOnUiThread(()->openBrowser(uri));
  }
 }
 private synchronized javax.crypto.SecretKey authKey() throws Exception {
  java.security.KeyStore store=java.security.KeyStore.getInstance("AndroidKeyStore");store.load(null);
  if(store.containsAlias("circle-admin-auth-v1"))return (javax.crypto.SecretKey)store.getKey("circle-admin-auth-v1",null);
  javax.crypto.KeyGenerator generator=javax.crypto.KeyGenerator.getInstance("AES","AndroidKeyStore");
  generator.init(new android.security.keystore.KeyGenParameterSpec.Builder("circle-admin-auth-v1",android.security.keystore.KeyProperties.PURPOSE_ENCRYPT|android.security.keystore.KeyProperties.PURPOSE_DECRYPT).setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE).build());return generator.generateKey();
 }
 private void acceptAuth(Intent intent){
  Uri uri=intent==null?null:intent.getData();
  if(uri!=null && "cccircle-admin".equals(uri.getScheme()) && "auth".equals(uri.getHost()) && "/callback".equals(uri.getPath()))pendingAuth=uri.toString();
 }
 private void deliverAuth(){
  if(!ready || pendingAuth==null)return;
  String callback=JSONObject.quote(pendingAuth);pendingAuth=null;
  web.evaluateJavascript("if(window.CircleAdminReceiveAuth){window.CircleAdminReceiveAuth("+callback+");}else{window.CircleAdminPendingAuth="+callback+";}",null);
 }
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);acceptAuth(intent);deliverAuth();}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==42 && fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));fileCallback=null;}}
 @Override public void onBackPressed(){web.evaluateJavascript("Boolean(window.CircleAdminBack && window.CircleAdminBack())",result->{if(!"true".equals(result)){if(web.canGoBack())web.goBack();else MainActivity.super.onBackPressed();}});}
 @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);web.removeJavascriptInterface("CircleAndroid");web.destroy();super.onDestroy();}
}
