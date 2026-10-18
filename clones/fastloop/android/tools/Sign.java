import com.android.apksig.ApkSigner;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Signs the packaged APK with a local debug key.
 *
 * apksig 2.3.0 is the newest build published to Maven Central. Only scheme v2
 * is used here, for two reasons: Android requires v2 or higher for apps
 * targeting API 30+, and this build's v1 path calls
 * sun.security.pkcs.PKCS7#encodeSignedData, which no longer exists in modern
 * JDKs. v1 only matters below API 24, and minSdk is 24.
 */
public final class Sign {
  public static void main(String[] args) throws Exception {
    String keystore = args[0], storePass = args[1], alias = args[2], keyPass = args[3];
    File input = new File(args[4]), output = new File(args[5]);
    int minSdk = Integer.parseInt(args[6]);

    KeyStore ks = KeyStore.getInstance("PKCS12");
    try (FileInputStream in = new FileInputStream(keystore)) {
      ks.load(in, storePass.toCharArray());
    }
    PrivateKey key = (PrivateKey) ks.getKey(alias, keyPass.toCharArray());
    if (key == null) throw new IllegalStateException("Ключ не найден в хранилище: " + alias);

    List<X509Certificate> certs = new ArrayList<>();
    for (Certificate cert : ks.getCertificateChain(alias)) certs.add((X509Certificate) cert);

    ApkSigner.SignerConfig config =
        new ApkSigner.SignerConfig.Builder("fastloop", key, certs).build();

    new ApkSigner.Builder(Collections.singletonList(config))
        .setInputApk(input)
        .setOutputApk(output)
        .setMinSdkVersion(minSdk)
        .setV1SigningEnabled(false)
        .setV2SigningEnabled(true)
        .build()
        .sign();

    System.out.println("подписано: " + output.getName());
  }
}
