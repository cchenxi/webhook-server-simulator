package com.webhook.simulator.config;

import org.apache.catalina.connector.Connector;
import org.apache.coyote.http11.Http11NioProtocol;
import org.apache.tomcat.util.net.SSLHostConfig;
import org.apache.tomcat.util.net.SSLHostConfigCertificate;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.asn1.x509.GeneralName;
import org.bouncycastle.asn1.x509.GeneralNames;
import org.bouncycastle.cert.X509v3CertificateBuilder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;

import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.Date;

@Configuration
public class HttpsConnectorConfig {

    private static final Logger log = LoggerFactory.getLogger(HttpsConnectorConfig.class);

    private static final int HTTPS_PORT = 8443;
    private static final String KEYSTORE_PASSWORD = "changeit";

    private boolean httpsEnabled = false;

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> httpsConnectorCustomizer() {
        return factory -> {
            try {
                Connector connector = createHttpsConnector();
                factory.addAdditionalTomcatConnectors(connector);
                httpsEnabled = true;
            } catch (Exception e) {
                log.error("Failed to create HTTPS connector: {}", e.getMessage(), e);
            }
        };
    }

    private Connector createHttpsConnector() throws Exception {
        KeyStore keyStore = generateSelfSignedCertificate();

        Connector connector = new Connector(Http11NioProtocol.class.getName());
        connector.setScheme("https");
        connector.setSecure(true);
        connector.setPort(HTTPS_PORT);

        Http11NioProtocol protocol = (Http11NioProtocol) connector.getProtocolHandler();

        SSLHostConfig sslHostConfig = new SSLHostConfig();
        SSLHostConfigCertificate cert = new SSLHostConfigCertificate(
                sslHostConfig, SSLHostConfigCertificate.Type.RSA);
        cert.setCertificateKeystore(keyStore);
        cert.setCertificateKeystorePassword(KEYSTORE_PASSWORD);
        sslHostConfig.addCertificate(cert);

        protocol.addSslHostConfig(sslHostConfig);
        protocol.setSSLEnabled(true);

        return connector;
    }

    /**
     * RSA 2048 self-signed certificate, CN=localhost, SAN localhost and 127.0.0.1, valid for one year.
     * Built with BouncyCastle so the same bytecode runs on JDK 8, 17, and 21.
     */
    static KeyStore generateSelfSignedCertificate() throws Exception {
        KeyPairGenerator keyPairGen = KeyPairGenerator.getInstance("RSA");
        keyPairGen.initialize(2048, new SecureRandom());
        KeyPair keyPair = keyPairGen.generateKeyPair();

        X500Name owner = new X500Name("CN=localhost, O=Webhook Simulator, L=Dev");

        long now = System.currentTimeMillis();
        Date notBefore = new Date(now);
        Date notAfter = new Date(now + 365L * 24 * 60 * 60 * 1000);

        BigInteger serialNumber = new BigInteger(63, new SecureRandom());
        if (serialNumber.signum() == 0) {
            serialNumber = BigInteger.ONE;
        }

        GeneralNames sans = new GeneralNames(new GeneralName[]{
                new GeneralName(GeneralName.dNSName, "localhost"),
                new GeneralName(GeneralName.iPAddress, "127.0.0.1")
        });

        X509v3CertificateBuilder builder = new JcaX509v3CertificateBuilder(
                owner, serialNumber, notBefore, notAfter, owner, keyPair.getPublic());
        builder.addExtension(Extension.subjectAlternativeName, false, sans);

        ContentSigner signer = new JcaContentSignerBuilder("SHA256withRSA").build(keyPair.getPrivate());
        X509Certificate cert = new JcaX509CertificateConverter().getCertificate(builder.build(signer));

        KeyStore keyStore = KeyStore.getInstance(KeyStore.getDefaultType());
        keyStore.load(null, KEYSTORE_PASSWORD.toCharArray());
        keyStore.setKeyEntry("webhook-simulator",
                keyPair.getPrivate(),
                KEYSTORE_PASSWORD.toCharArray(),
                new X509Certificate[]{cert});

        return keyStore;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (httpsEnabled) {
            log.info("HTTPS server started on port {} (self-signed certificate)", HTTPS_PORT);
            log.info("Try: curl -k https://localhost:{}/webhook/test -H \"Content-Type: application/json\" -d '{{\"event\":\"test\"}}'", HTTPS_PORT);
        } else {
            log.warn("HTTPS server failed to start, running HTTP only");
        }
    }
}
