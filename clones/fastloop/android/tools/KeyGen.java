import java.io.FileOutputStream;
import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.Date;
import sun.security.x509.AlgorithmId;
import sun.security.x509.CertificateAlgorithmId;
import sun.security.x509.CertificateSerialNumber;
import sun.security.x509.CertificateValidity;
import sun.security.x509.CertificateVersion;
import sun.security.x509.CertificateX509Key;
import sun.security.x509.X500Name;
import sun.security.x509.X509CertImpl;
import sun.security.x509.X509CertInfo;

/**
 * Builds the signing key deterministically, from a seed written down here.
 *
 * Android refuses to install an update whose signing certificate differs from
 * the installed one. The previous script generated a random key and kept it
 * only in the build container, so every rebuilt container produced an APK
 * that could not update the one already on the phone — the update simply
 * failed. Deriving the key from a fixed seed, with a fixed serial number and
 * fixed validity dates, makes the certificate identical in every container.
 *
 * This is not a secret and is not treated as one: anyone with this file can
 * regenerate the key. It is a debug key for a sideloaded personal build, and
 * its only job is to let one build update another. Nothing is signed for
 * distribution with it, and nothing is kept in the repository.
 */
public final class KeyGen {
  /** Changing any of these changes the certificate and breaks updates. */
  private static final String SEED = "fastloop-debug-signing-key-v1";
  private static final String DN = "CN=FastLoop Debug, OU=FastLoop, O=FastLoop, C=RU";
  private static final BigInteger SERIAL = new BigInteger("5741073010000001");
  private static final long NOT_BEFORE = 1_700_000_000_000L; // 2023-11-14
  private static final long NOT_AFTER = 4_102_444_800_000L;  // 2100-01-01

  public static void main(String[] args) throws Exception {
    String out = args[0], storePass = args[1], alias = args[2];

    SecureRandom random = SecureRandom.getInstance("SHA1PRNG", "SUN");
    random.setSeed(SEED.getBytes("UTF-8"));
    KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048, random);
    KeyPair pair = generator.generateKeyPair();

    X509CertInfo info = new X509CertInfo();
    info.setVersion(new CertificateVersion(CertificateVersion.V3));
    info.setSerialNumber(new CertificateSerialNumber(SERIAL));
    info.setSubject(new X500Name(DN));
    info.setIssuer(new X500Name(DN));
    info.setKey(new CertificateX509Key(pair.getPublic()));
    info.setValidity(new CertificateValidity(new Date(NOT_BEFORE), new Date(NOT_AFTER)));
    info.setAlgorithmId(new CertificateAlgorithmId(AlgorithmId.get("SHA256withRSA")));

    X509CertImpl cert = X509CertImpl.newSigned(info, pair.getPrivate(), "SHA256withRSA");

    KeyStore store = KeyStore.getInstance("PKCS12");
    store.load(null, storePass.toCharArray());
    store.setKeyEntry(
        alias,
        pair.getPrivate(),
        storePass.toCharArray(),
        new X509Certificate[] {cert});
    try (FileOutputStream file = new FileOutputStream(out)) {
      store.store(file, storePass.toCharArray());
    }

    java.security.MessageDigest sha = java.security.MessageDigest.getInstance("SHA-256");
    byte[] digest = sha.digest(cert.getEncoded());
    StringBuilder hex = new StringBuilder();
    for (byte b : digest) hex.append(String.format("%02X", b));
    System.out.println(hex);
  }
}
