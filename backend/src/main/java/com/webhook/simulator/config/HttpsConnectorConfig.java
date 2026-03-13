package com.webhook.simulator.config;

import org.apache.catalina.connector.Connector;
import org.apache.coyote.http11.Http11NioProtocol;
import org.apache.tomcat.util.net.SSLHostConfig;
import org.apache.tomcat.util.net.SSLHostConfigCertificate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import sun.security.x509.*;

import java.math.BigInteger;
import java.security.*;
import java.security.cert.X509Certificate;
import java.util.Date;

@Configuration
public class HttpsConnectorConfig {

    private static final Logger log = LoggerFactory.getLogger(HttpsConnectorConfig.class);

    private static final int HTTPS_PORT = 8443;
    private static final String KEYSTORE_PASSWORD = "changeit";

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> httpsConnectorCustomizer() {
        return factory -> {
            try {
                Connector connector = createHttpsConnector();
                factory.addAdditionalTomcatConnectors(connector);
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

    @SuppressWarnings("restriction")
    private KeyStore generateSelfSignedCertificate() throws Exception {
        KeyPairGenerator keyPairGen = KeyPairGenerator.getInstance("RSA");
        keyPairGen.initialize(2048, new SecureRandom());
        KeyPair keyPair = keyPairGen.generateKeyPair();

        X500Name owner = new X500Name("CN=localhost, O=Webhook Simulator, L=Dev");

        long now = System.currentTimeMillis();
        Date notBefore = new Date(now);
        Date notAfter = new Date(now + 365L * 24 * 60 * 60 * 1000);

        CertificateValidity validity = new CertificateValidity(notBefore, notAfter);

        BigInteger serialNumber = new BigInteger(64, new SecureRandom());

        X509CertInfo certInfo = new X509CertInfo();
        certInfo.set(X509CertInfo.VALIDITY, validity);
        certInfo.set(X509CertInfo.SERIAL_NUMBER, new CertificateSerialNumber(serialNumber));
        certInfo.set(X509CertInfo.SUBJECT, owner);
        certInfo.set(X509CertInfo.ISSUER, owner);
        certInfo.set(X509CertInfo.KEY, new CertificateX509Key(keyPair.getPublic()));
        certInfo.set(X509CertInfo.VERSION, new CertificateVersion(CertificateVersion.V3));

        AlgorithmId algorithm = AlgorithmId.get("SHA256withRSA");
        certInfo.set(X509CertInfo.ALGORITHM_ID, new CertificateAlgorithmId(algorithm));

        GeneralNames generalNames = new GeneralNames();
        generalNames.add(new GeneralName(new DNSName("localhost")));
        generalNames.add(new GeneralName(new IPAddressName("127.0.0.1")));
        SubjectAlternativeNameExtension sanExt = new SubjectAlternativeNameExtension(generalNames);
        CertificateExtensions extensions = new CertificateExtensions();
        extensions.set(SubjectAlternativeNameExtension.NAME, sanExt);
        certInfo.set(X509CertInfo.EXTENSIONS, extensions);

        X509CertImpl cert = new X509CertImpl(certInfo);
        cert.sign(keyPair.getPrivate(), "SHA256withRSA");

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
        log.info("HTTP  server started on port 8080");
        log.info("HTTPS server started on port {} (self-signed certificate)", HTTPS_PORT);
        log.info("Try: curl -k https://localhost:{}/webhook/test -H \"Content-Type: application/json\" -d '{{\"event\":\"test\"}}'", HTTPS_PORT);
    }
}
