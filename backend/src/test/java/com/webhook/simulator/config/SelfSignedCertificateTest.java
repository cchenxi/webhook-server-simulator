package com.webhook.simulator.config;

import org.junit.jupiter.api.Test;

import java.security.KeyStore;
import java.security.cert.X509Certificate;
import java.util.Collection;
import java.util.Enumeration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SelfSignedCertificateTest {

    @Test
    void certificateHasLocalhostIdentityAndOneYearValidity() throws Exception {
        KeyStore keyStore = HttpsConnectorConfig.generateSelfSignedCertificate();
        Enumeration<String> aliases = keyStore.aliases();
        assertTrue(aliases.hasMoreElements());
        X509Certificate cert = (X509Certificate) keyStore.getCertificate(aliases.nextElement());

        String dn = cert.getSubjectX500Principal().getName();
        assertTrue(dn.contains("CN=localhost"), dn);
        assertTrue(dn.contains("Webhook Simulator"), dn);
        assertEquals(dn, cert.getIssuerX500Principal().getName());
        assertTrue(cert.getSigAlgName().toUpperCase().contains("SHA256"), cert.getSigAlgName());

        long days = (cert.getNotAfter().getTime() - cert.getNotBefore().getTime()) / (24L * 60 * 60 * 1000);
        assertEquals(365L, days);

        boolean dns = false;
        boolean ip = false;
        Collection<List<?>> sans = cert.getSubjectAlternativeNames();
        assertTrue(sans != null && !sans.isEmpty());
        for (List<?> san : sans) {
            int type = ((Number) san.get(0)).intValue();
            if (type == 2 && "localhost".equals(san.get(1))) {
                dns = true;
            }
            if (type == 7 && isLoopback(san.get(1))) {
                ip = true;
            }
        }
        assertTrue(dns, "missing DNS SAN localhost");
        assertTrue(ip, "missing IP SAN 127.0.0.1");
    }

    private static boolean isLoopback(Object value) {
        if ("127.0.0.1".equals(value)) {
            return true;
        }
        if (value instanceof byte[]) {
            byte[] bytes = (byte[]) value;
            return bytes.length == 4
                    && (bytes[0] & 0xff) == 127
                    && bytes[1] == 0
                    && bytes[2] == 0
                    && (bytes[3] & 0xff) == 1;
        }
        return false;
    }
}
