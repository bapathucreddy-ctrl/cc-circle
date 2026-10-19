import java.io.*;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;

// Create a workspace-local truststore using the JDK roots plus public Windows roots.
class TrustedRoots {
  public static void main(String[] args) throws Exception {
    char[] password = "changeit".toCharArray();
    KeyStore store = KeyStore.getInstance(new File(args[0]), password);
    try (InputStream input = new FileInputStream(args[1])) {
      int index = 0;
      for (java.security.cert.Certificate certificate : CertificateFactory.getInstance("X.509").generateCertificates(input)) {
        store.setCertificateEntry("system-root-" + index++, certificate);
      }
    }
    try (OutputStream output = new FileOutputStream(args[2])) { store.store(output, password); }
    System.out.println("Created workspace-local truststore with public system certificates.");
  }
}
