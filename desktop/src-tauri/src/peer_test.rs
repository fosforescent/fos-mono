#[cfg(test)]
mod tests {
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

    /// Test that we can parse a browser-formatted offer
    #[test]
    fn test_parse_browser_offer_format() {
        // This is the format browsers send
        let browser_offer = serde_json::json!({
            "type": "offer",
            "sdp": "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=mid:0\r\na=setup:actpass\r\na=ice-ufrag:test\r\na=ice-pwd:testpassword\r\na=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r\na=sctp-port:5000\r\n"
        });

        let base64_offer = BASE64.encode(browser_offer.to_string().as_bytes());
        println!("Base64 offer: {}", &base64_offer[..100.min(base64_offer.len())]);

        // Decode it like the Rust code does
        let decoded_bytes = BASE64.decode(&base64_offer).expect("Failed to decode base64");
        let decoded_str = String::from_utf8(decoded_bytes).expect("Failed to convert to UTF-8");
        println!("Decoded JSON: {}", &decoded_str[..200.min(decoded_str.len())]);

        let parsed: serde_json::Value = serde_json::from_str(&decoded_str).expect("Failed to parse JSON");
        println!("Parsed JSON keys: {:?}", parsed.as_object().map(|o| o.keys().collect::<Vec<_>>()));

        let sdp_type = parsed.get("type")
            .or_else(|| parsed.get("sdp_type"))
            .and_then(|v| v.as_str())
            .expect("Missing type");
        println!("SDP type: {}", sdp_type);

        assert_eq!(sdp_type, "offer");

        let sdp = parsed.get("sdp")
            .and_then(|v| v.as_str())
            .expect("Missing sdp");
        println!("SDP length: {}", sdp.len());

        assert!(sdp.contains("m=application"));
    }

    /// Test FosPath serialization
    #[test]
    fn test_fospath_serialization() {
        use crate::peer::FosPath;

        // Empty path
        let empty_path: FosPath = vec![];
        let json = serde_json::to_string(&empty_path).unwrap();
        println!("Empty path JSON: {}", json);
        assert_eq!(json, "[]");

        // Path with one element
        let path: FosPath = vec![("cid1".to_string(), "cid2".to_string())];
        let json = serde_json::to_string(&path).unwrap();
        println!("Path with one element JSON: {}", json);
        assert_eq!(json, r#"[["cid1","cid2"]]"#);

        // Deserialize from JavaScript format
        let js_format = r#"[["abc123","def456"],["ghi789","jkl012"]]"#;
        let deserialized: FosPath = serde_json::from_str(js_format).unwrap();
        println!("Deserialized path: {:?}", deserialized);
        assert_eq!(deserialized.len(), 2);
        assert_eq!(deserialized[0].0, "abc123");
        assert_eq!(deserialized[0].1, "def456");
    }

    /// Test the exact format that would come from the browser
    #[test]
    fn test_real_browser_offer() {
        // This is a real offer captured from a browser
        let real_browser_offer = r#"{"type":"offer","sdp":"v=0\r\no=- 9156383259012239999 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\na=extmap-allow-mixed\r\na=msid-semantic: WMS\r\nm=application 60969 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 98.234.217.39\r\na=candidate:1671225741 1 udp 2113937151 97e25fa9-d68d-4a31-a1c4-3bcaa1b08e1f.local 60969 typ host generation 0 network-cost 999\r\na=ice-ufrag:0Ijp\r\na=ice-pwd:TASY9WhJ5QR+OU4vxPazwFdT\r\na=ice-options:trickle\r\na=fingerprint:sha-256 45:DA:8A:AF:09:45:32:46:79:F0:D3:FD:15:DB:34:A6:98:23:05:B0:52:9F:39:09:A5:DB:85:86:DF:C9:33:70\r\na=setup:actpass\r\na=mid:0\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n"}"#;

        let base64_offer = BASE64.encode(real_browser_offer.as_bytes());
        println!("Real browser offer base64 length: {}", base64_offer.len());

        // Decode and parse
        let decoded_bytes = BASE64.decode(&base64_offer).expect("Failed to decode base64");
        let decoded_str = String::from_utf8(decoded_bytes).expect("Failed to convert to UTF-8");

        let parsed: serde_json::Value = serde_json::from_str(&decoded_str).expect("Failed to parse JSON");

        let sdp_type = parsed.get("type").and_then(|v| v.as_str()).expect("Missing type");
        assert_eq!(sdp_type, "offer");

        let sdp = parsed.get("sdp").and_then(|v| v.as_str()).expect("Missing sdp");
        assert!(sdp.contains("m=application"));
        assert!(sdp.contains("a=fingerprint"));
        assert!(sdp.contains("a=ice-ufrag"));

        println!("Real browser offer parsed successfully!");
    }
}
