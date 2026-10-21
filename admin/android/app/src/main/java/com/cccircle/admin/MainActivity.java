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
    if(!path.matches("/(index\\.html|app\\.js|style\\.css|logo\\.svg)"))return new WebResourceResponse("text/plain","UTF-8",404,"Not found",null,null);
    String mime=path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".svg")?"image/svg+xml":"text/html";
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
  @JavascriptInterface public void openAuth(String value){
   Uri uri=Uri.parse(value);
   if("https".equals(uri.getScheme()) && uri.getHost()!=null && uri.getHost().endsWith(".supabase.co") && "/auth/v1/authorize".equals(uri.getPath()))runOnUiThread(()->openBrowser(uri));
  }
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
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);web.removeJavascriptInterface("CircleAndroid");web.destroy();super.onDestroy();}
}
