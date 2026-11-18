package com.webhook.simulator;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class HttpsWebhookSmokeTest {

    @LocalServerPort
    private int httpPort;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void httpsRequestIsRecordedAndCertificateNamesLocalhost() throws Exception {
        SSLContext ssl = SSLContext.getInstance("TLS");
        ssl.init(null, new TrustManager[]{trustAll()}, new SecureRandom());

        HttpsURLConnection https = (HttpsURLConnection) new URL("https://127.0.0.1:8443/webhook/secure").openConnection();
        https.setSSLSocketFactory(ssl.getSocketFactory());
        https.setHostnameVerifier(new HostnameVerifier() {
            @Override
            public boolean verify(String hostname, SSLSession session) {
                return true;
            }
        });
        https.setRequestMethod("POST");
        https.setConnectTimeout(5000);
        https.setReadTimeout(5000);
        https.setDoOutput(true);
        https.setRequestProperty("Content-Type", "application/json");
        byte[] payload = "{\"event\":\"https\"}".getBytes(StandardCharsets.UTF_8);
        OutputStream out = https.getOutputStream();
        try {
            out.write(payload);
        } finally {
            out.close();
        }

        assertEquals(200, https.getResponseCode());
        assertEquals("{\"status\":\"received\"}", read(https.getInputStream()));
        https.disconnect();

        SSLSocket socket = (SSLSocket) ssl.getSocketFactory().createSocket("127.0.0.1", 8443);
        try {
            socket.startHandshake();
            X509Certificate cert = (X509Certificate) socket.getSession().getPeerCertificates()[0];
            assertTrue(cert.getSubjectX500Principal().getName().contains("CN=localhost"),
                    cert.getSubjectX500Principal().getName());
        } finally {
            socket.close();
        }

        HttpURLConnection messages = (HttpURLConnection) new URL(
                "http://127.0.0.1:" + httpPort + "/api/messages").openConnection();
        messages.setConnectTimeout(5000);
        messages.setReadTimeout(5000);
        assertEquals(200, messages.getResponseCode());
        List<Map<String, Object>> stored = objectMapper.readValue(
                read(messages.getInputStream()), new TypeReference<List<Map<String, Object>>>() {});
        messages.disconnect();

        boolean found = false;
        for (Map<String, Object> message : stored) {
            if ("/webhook/secure".equals(message.get("path"))) {
                found = true;
                assertEquals("HTTPS", message.get("protocol"));
                assertEquals("POST", message.get("method"));
            }
        }
        assertTrue(found, "HTTPS webhook was not stored");
    }

    private static X509TrustManager trustAll() {
        return new X509TrustManager() {
            @Override
            public void checkClientTrusted(X509Certificate[] chain, String authType) {
            }

            @Override
            public void checkServerTrusted(X509Certificate[] chain, String authType) {
            }

            @Override
            public X509Certificate[] getAcceptedIssuers() {
                return new X509Certificate[0];
            }
        };
    }

    private static String read(InputStream input) throws Exception {
        try {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[256];
            int n;
            while ((n = input.read(chunk)) >= 0) {
                buffer.write(chunk, 0, n);
            }
            return new String(buffer.toByteArray(), StandardCharsets.UTF_8);
        } finally {
            input.close();
        }
    }
}
