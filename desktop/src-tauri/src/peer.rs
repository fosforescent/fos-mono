use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;

/// Path type matching FosPath from TypeScript: Array<[string, string]>
/// Each element is a (content CID, children CID) pair
pub type FosPath = Vec<(String, String)>;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use webrtc::api::interceptor_registry::register_default_interceptors;
use webrtc::api::media_engine::MediaEngine;
use webrtc::api::setting_engine::SettingEngine;
use webrtc::api::APIBuilder;
use webrtc::data_channel::data_channel_message::DataChannelMessage;
use webrtc::data_channel::RTCDataChannel;
// DTLSRole removed - letting webrtc-rs auto-negotiate based on SDP
use webrtc::ice_transport::ice_server::RTCIceServer;
use webrtc::interceptor::registry::Registry;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::peer_connection_state::RTCPeerConnectionState;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use webrtc::peer_connection::RTCPeerConnection;

/// Message types for peer communication
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum PeerMessage {
    /// Key exchange - sent immediately after connection
    #[serde(rename = "KEY_EXCHANGE")]
    KeyExchange { public_key: String },
    #[serde(rename = "ROOT_ADDRESS_REQUEST")]
    RootAddressRequest,
    #[serde(rename = "ROOT_ADDRESS_RESPONSE")]
    RootAddressResponse { root_address: Option<String> },
    #[serde(rename = "ROOT_ADDRESS_CHANGED")]
    RootAddressChanged { root_address: String },
    #[serde(rename = "NODE_DATA")]
    NodeData { path: FosPath, data: String },
    #[serde(rename = "NODE_REQUEST")]
    NodeRequest { path: FosPath },
    // DHT-based sync
    #[serde(rename = "ROOT_CID")]
    RootCid { cid: String },
    #[serde(rename = "WANT_NODES")]
    WantNodes { cids: Vec<String> },
    #[serde(rename = "HAVE_NODES")]
    HaveNodes { nodes: HashMap<String, String> },
    // Keepalive
    #[serde(rename = "PING")]
    Ping,
    #[serde(rename = "PONG")]
    Pong,
    // Proposal/Consensus messages
    /// A new proposal has been created
    #[serde(rename = "PROPOSAL_CREATED")]
    ProposalCreated {
        proposal_id: String,
        target_node_cid: String,
        proposed_content: String, // JSON-serialized FosNodeContent
        proposer_peer_id: String,
        color: String,
    },
    /// A member has approved a proposal
    #[serde(rename = "PROPOSAL_APPROVAL")]
    ProposalApproval {
        proposal_id: String,
        approver_peer_id: String,
        signature: String, // Base64-encoded Ed25519 signature
    },
    /// A proposal has been accepted (unanimous approval)
    #[serde(rename = "PROPOSAL_ACCEPTED")]
    ProposalAccepted {
        proposal_id: String,
        new_node_cid: String,
    },
    /// Members have been updated on a node
    #[serde(rename = "MEMBERS_UPDATE")]
    MembersUpdate {
        node_cid: String,
        members: Vec<String>,
    },
}


/// Connection state for a peer
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConnectionState {
    #[serde(rename = "new")]
    New,
    #[serde(rename = "connecting")]
    Connecting,
    #[serde(rename = "connected")]
    Connected,
    #[serde(rename = "disconnected")]
    Disconnected,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "closed")]
    Closed,
}

/// Info about a single peer connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub id: String,
    pub path: FosPath,
    pub state: ConnectionState,
    /// Base64-encoded public key of the remote peer (if exchanged)
    pub public_key: Option<String>,
}

/// A single peer connection
pub struct Peer {
    pub id: String,
    pub path: FosPath,
    pub connection: Arc<RTCPeerConnection>,
    pub data_channel: Arc<Mutex<Option<Arc<RTCDataChannel>>>>,
    pub state: Arc<RwLock<ConnectionState>>,
    /// Remote peer's public key (set after key exchange)
    pub remote_public_key: Arc<RwLock<Option<VerifyingKey>>>,
}

impl Peer {
    /// Send a message to this peer (raw JSON, no signing wrapper)
    pub async fn send(&self, message: &PeerMessage) -> Result<(), String> {
        let dc_guard = self.data_channel.lock().await;
        if let Some(dc) = dc_guard.as_ref() {
            let json = serde_json::to_string(message).map_err(|e| e.to_string())?;
            dc.send_text(json)
                .await
                .map_err(|e| format!("Failed to send: {}", e))?;
            Ok(())
        } else {
            Err("Data channel not ready".to_string())
        }
    }

    /// Set the remote peer's public key
    pub async fn set_remote_public_key(&self, key: VerifyingKey) {
        *self.remote_public_key.write().await = Some(key);
    }

    /// Get the remote peer's public key
    pub async fn get_remote_public_key(&self) -> Option<VerifyingKey> {
        self.remote_public_key.read().await.clone()
    }

    /// Verify a proposal signature from this peer
    /// Returns Ok(()) if signature is valid, Err if invalid or no public key
    pub async fn verify_proposal_signature(&self, content: &str, signature_b64: &str) -> Result<(), String> {
        let remote_key = self.remote_public_key.read().await;
        let key = remote_key.as_ref().ok_or("No remote public key set")?;

        let sig_bytes = BASE64.decode(signature_b64)
            .map_err(|e| format!("Failed to decode signature: {}", e))?;
        let signature = Signature::from_slice(&sig_bytes)
            .map_err(|e| format!("Invalid signature format: {}", e))?;

        key.verify(content.as_bytes(), &signature)
            .map_err(|_| "Signature verification failed".to_string())
    }

    pub async fn get_state(&self) -> ConnectionState {
        self.state.read().await.clone()
    }

    pub async fn get_info(&self) -> PeerInfo {
        let remote_key = self.remote_public_key.read().await;
        let public_key = remote_key.as_ref().map(|k| BASE64.encode(k.to_bytes()));
        PeerInfo {
            id: self.id.clone(),
            path: self.path.clone(),
            state: self.state.read().await.clone(),
            public_key,
        }
    }
}

/// Incoming message from a peer
#[derive(Debug, Clone)]
pub struct IncomingMessage {
    pub peer_id: String,
    pub message: PeerMessage,
}

/// Manager for all peer connections
pub struct PeerManager {
    peers: RwLock<HashMap<String, Arc<Peer>>>,
    message_tx: mpsc::UnboundedSender<IncomingMessage>,
    pub message_rx: Mutex<mpsc::UnboundedReceiver<IncomingMessage>>,
    /// Our Ed25519 signing key (used for signing proposals)
    pub signing_key: SigningKey,
    /// Our public key (for sharing with peers)
    pub public_key: VerifyingKey,
}

impl PeerManager {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        let signing_key = SigningKey::generate(&mut OsRng);
        let public_key = signing_key.verifying_key();

        log::info!(
            "[Peer] Generated keypair, public key: {}",
            BASE64.encode(public_key.to_bytes())
        );

        Self {
            peers: RwLock::new(HashMap::new()),
            message_tx: tx,
            message_rx: Mutex::new(rx),
            signing_key,
            public_key,
        }
    }

    /// Get our public key as base64
    pub fn get_public_key_base64(&self) -> String {
        BASE64.encode(self.public_key.to_bytes())
    }

    /// Get a peer by ID
    pub async fn get_peer(&self, peer_id: &str) -> Option<Arc<Peer>> {
        self.peers.read().await.get(peer_id).cloned()
    }

    /// Process a key exchange message - set the remote public key
    /// Returns true if this is a NEW key exchange (we didn't have their key before)
    pub async fn process_key_exchange(&self, peer_id: &str, public_key_b64: &str) -> Result<bool, String> {
        let peer = self.get_peer(peer_id).await.ok_or("Peer not found")?;

        // Check if we already have their key
        let already_had_key = peer.get_remote_public_key().await.is_some();

        let key_bytes = BASE64.decode(public_key_b64)
            .map_err(|e| format!("Failed to decode public key: {}", e))?;

        let key_array: [u8; 32] = key_bytes.try_into()
            .map_err(|_| "Invalid public key length")?;

        let verifying_key = VerifyingKey::from_bytes(&key_array)
            .map_err(|e| format!("Invalid public key: {}", e))?;

        peer.set_remote_public_key(verifying_key).await;
        log::info!("[Peer {}] Remote public key set (new: {})", peer_id, !already_had_key);

        Ok(!already_had_key)
    }

    /// Send our public key to a peer
    pub async fn send_key_exchange(&self, peer_id: &str) -> Result<(), String> {
        let msg = PeerMessage::KeyExchange {
            public_key: self.get_public_key_base64(),
        };
        self.send_to_peer(peer_id, &msg).await
    }

    /// Take the message receiver for spawning a consumer task.
    /// Can only be called once - subsequent calls return None.
    pub async fn take_message_receiver(&self) -> Option<mpsc::UnboundedReceiver<IncomingMessage>> {
        let mut guard = self.message_rx.lock().await;
        // Create a new dummy channel and swap out the real receiver
        let (_, dummy_rx) = mpsc::unbounded_channel();
        let real_rx = std::mem::replace(&mut *guard, dummy_rx);
        Some(real_rx)
    }

    fn create_rtc_config() -> RTCConfiguration {
        RTCConfiguration {
            ice_servers: vec![
                RTCIceServer {
                    urls: vec!["stun:stun.l.google.com:19302".to_string()],
                    ..Default::default()
                },
                RTCIceServer {
                    urls: vec!["stun:stun1.l.google.com:19302".to_string()],
                    ..Default::default()
                },
            ],
            ..Default::default()
        }
    }

    async fn create_peer_connection(is_offerer: bool) -> Result<Arc<RTCPeerConnection>, String> {
        let mut m = MediaEngine::default();
        m.register_default_codecs()
            .map_err(|e| format!("Failed to register codecs: {}", e))?;

        let mut registry = Registry::new();
        registry = register_default_interceptors(registry, &mut m)
            .map_err(|e| format!("Failed to register interceptors: {}", e))?;

        // Configure SettingEngine for browser compatibility
        let mut setting_engine = SettingEngine::default();

        // Use media-level fingerprints for browser compatibility
        // This helps with compatibility with some webrtc implementations (like browsers)
        setting_engine.set_sdp_media_level_fingerprints(true);

        // Let webrtc-rs auto-negotiate DTLS role based on SDP exchange
        // The offerer sends a=setup:actpass, answerer chooses active/passive
        // webrtc-rs should handle this automatically based on the received SDP

        log::info!("[Peer] Creating peer connection, is_offerer: {}", is_offerer);

        let api = APIBuilder::new()
            .with_media_engine(m)
            .with_interceptor_registry(registry)
            .with_setting_engine(setting_engine)
            .build();

        let config = Self::create_rtc_config();
        let pc = api
            .new_peer_connection(config)
            .await
            .map_err(|e| format!("Failed to create peer connection: {}", e))?;

        Ok(Arc::new(pc))
    }

    /// Create an offer to initiate a connection
    pub async fn create_offer(&self, path: FosPath) -> Result<(String, String), String> {
        let peer_id = uuid::Uuid::new_v4().to_string();
        let pc = Self::create_peer_connection(true).await?;  // is_offerer = true

        // Create data channel
        let dc = pc
            .create_data_channel("fos-sync", None)
            .await
            .map_err(|e| format!("Failed to create data channel: {}", e))?;

        // Log data channel state changes
        let dc_id = dc.id();
        dc.on_open(Box::new(move || {
            log::info!("[Peer] Data channel {} OPENED", dc_id);
            Box::pin(async {})
        }));

        dc.on_error(Box::new(move |err| {
            log::error!("[Peer] Data channel error: {}", err);
            Box::pin(async {})
        }));

        let peer = Arc::new(Peer {
            id: peer_id.clone(),
            path: path.clone(),
            connection: pc.clone(),
            data_channel: Arc::new(Mutex::new(Some(dc))),
            state: Arc::new(RwLock::new(ConnectionState::New)),
            remote_public_key: Arc::new(RwLock::new(None)),
        });

        // Set up event handlers
        self.setup_peer_handlers(peer.clone()).await;

        // Create offer
        let offer = pc
            .create_offer(None)
            .await
            .map_err(|e| format!("Failed to create offer: {}", e))?;

        pc.set_local_description(offer.clone())
            .await
            .map_err(|e| format!("Failed to set local description: {}", e))?;

        // Wait for ICE gathering to complete
        let mut gather_complete = pc.gathering_complete_promise().await;
        let _ = gather_complete.recv().await;

        // Get the complete local description with ICE candidates
        let local_desc = pc
            .local_description()
            .await
            .ok_or("No local description")?;

        // Log offer SDP details for debugging
        let sdp = &local_desc.sdp;
        if let Some(setup_line) = sdp.lines().find(|l| l.starts_with("a=setup:")) {
            log::info!("[Peer] Offer {}", setup_line);
        }
        if let Some(fp_line) = sdp.lines().find(|l| l.starts_with("a=fingerprint:")) {
            log::info!("[Peer] Offer fingerprint: {}...", &fp_line[..fp_line.len().min(50)]);
        }
        if let Some(app_line) = sdp.lines().find(|l| l.starts_with("m=application")) {
            log::info!("[Peer] Offer {}", app_line);
        }

        let sdp_json = serde_json::to_string(&local_desc).map_err(|e| e.to_string())?;
        let offer_string = BASE64.encode(sdp_json.as_bytes());

        // Store the peer
        self.peers.write().await.insert(peer_id.clone(), peer);

        Ok((peer_id, offer_string))
    }

    /// Accept an offer and generate an answer
    pub async fn accept_offer(
        &self,
        offer_string: String,
        path: FosPath,
    ) -> Result<(String, String), String> {
        log::info!("[Peer] accept_offer called, offer length: {}", offer_string.len());

        let peer_id = uuid::Uuid::new_v4().to_string();
        let pc = Self::create_peer_connection(false).await?;  // is_offerer = false (we're answering)

        // Decode the offer
        let offer_bytes = BASE64.decode(&offer_string)
            .map_err(|e| {
                log::error!("[Peer] Failed to decode offer: {}", e);
                format!("Failed to decode offer: {}", e)
            })?;

        let offer_json = String::from_utf8(offer_bytes)
            .map_err(|e| {
                log::error!("[Peer] Invalid UTF-8 in offer: {}", e);
                format!("Invalid UTF-8 in offer: {}", e)
            })?;

        log::info!("[Peer] Offer JSON (first 200 chars): {}", &offer_json[..offer_json.len().min(200)]);

        let offer: RTCSessionDescription =
            serde_json::from_str(&offer_json).map_err(|e| {
                log::error!("[Peer] Failed to parse offer: {}", e);
                format!("Failed to parse offer: {}", e)
            })?;

        log::info!("[Peer] Offer parsed successfully");

        // Set remote description (the offer)
        pc.set_remote_description(offer)
            .await
            .map_err(|e| format!("Failed to set remote description: {}", e))?;

        let peer = Arc::new(Peer {
            id: peer_id.clone(),
            path: path.clone(),
            connection: pc.clone(),
            data_channel: Arc::new(Mutex::new(None)),
            state: Arc::new(RwLock::new(ConnectionState::Connecting)),
            remote_public_key: Arc::new(RwLock::new(None)),
        });

        // Set up event handlers (including data channel handler)
        self.setup_peer_handlers(peer.clone()).await;

        // Create answer
        let answer = pc
            .create_answer(None)
            .await
            .map_err(|e| format!("Failed to create answer: {}", e))?;

        pc.set_local_description(answer.clone())
            .await
            .map_err(|e| format!("Failed to set local description: {}", e))?;

        // Wait for ICE gathering
        let mut gather_complete = pc.gathering_complete_promise().await;
        let _ = gather_complete.recv().await;

        let local_desc = pc
            .local_description()
            .await
            .ok_or("No local description")?;

        let sdp_json = serde_json::to_string(&local_desc).map_err(|e| e.to_string())?;
        let answer_string = BASE64.encode(sdp_json.as_bytes());

        // Store the peer
        self.peers.write().await.insert(peer_id.clone(), peer);

        Ok((peer_id, answer_string))
    }

    /// Accept an answer to complete the connection (for the offerer)
    pub async fn accept_answer(&self, peer_id: String, answer_string: String) -> Result<(), String> {
        log::info!("[Peer] accept_answer called for peer: {}", peer_id);

        let peers = self.peers.read().await;
        let peer = peers
            .get(&peer_id)
            .ok_or("Peer not found")?;

        let answer_bytes = BASE64.decode(&answer_string)
            .map_err(|e| format!("Failed to decode answer: {}", e))?;

        let answer_json = String::from_utf8(answer_bytes)
            .map_err(|e| format!("Invalid UTF-8 in answer: {}", e))?;

        log::info!("[Peer] Answer JSON (first 200 chars): {}", &answer_json[..answer_json.len().min(200)]);

        // Log critical SDP sections for debugging
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&answer_json) {
            if let Some(sdp) = parsed.get("sdp").and_then(|s| s.as_str()) {
                // Find a=setup line
                if let Some(setup_line) = sdp.lines().find(|l| l.starts_with("a=setup:")) {
                    log::info!("[Peer] Answer {}", setup_line);
                }
                // Find fingerprint
                if let Some(fp_line) = sdp.lines().find(|l| l.starts_with("a=fingerprint:")) {
                    log::info!("[Peer] Answer fingerprint: {}...", &fp_line[..fp_line.len().min(50)]);
                }
            }
        }

        let answer: RTCSessionDescription =
            serde_json::from_str(&answer_json).map_err(|e| {
                log::error!("[Peer] Failed to parse answer: {}", e);
                format!("Failed to parse answer: {}", e)
            })?;

        log::info!("[Peer] Answer parsed successfully, setting remote description...");

        peer.connection
            .set_remote_description(answer)
            .await
            .map_err(|e| {
                log::error!("[Peer] Failed to set remote description: {}", e);
                format!("Failed to set remote description: {}", e)
            })?;

        log::info!("[Peer] Remote description set successfully");
        Ok(())
    }

    async fn setup_peer_handlers(&self, peer: Arc<Peer>) {
        let state = peer.state.clone();
        let peer_id = peer.id.clone();
        let message_tx = self.message_tx.clone();
        let data_channel = peer.data_channel.clone();

        // Handle connection state changes
        let state_clone = state.clone();
        let peer_id_for_log = peer_id.clone();
        peer.connection.on_peer_connection_state_change(Box::new(
            move |s: RTCPeerConnectionState| {
                let state = state_clone.clone();
                let pid = peer_id_for_log.clone();
                Box::pin(async move {
                    log::info!("[Peer {}] Connection state changed to: {:?}", pid, s);
                    if s == RTCPeerConnectionState::Failed {
                        log::error!("[Peer {}] CONNECTION FAILED - DTLS handshake may have failed", pid);
                    }
                    let new_state = match s {
                        RTCPeerConnectionState::New => ConnectionState::New,
                        RTCPeerConnectionState::Connecting => ConnectionState::Connecting,
                        RTCPeerConnectionState::Connected => ConnectionState::Connected,
                        RTCPeerConnectionState::Disconnected => ConnectionState::Disconnected,
                        RTCPeerConnectionState::Failed => ConnectionState::Failed,
                        RTCPeerConnectionState::Closed => ConnectionState::Closed,
                        _ => ConnectionState::New,
                    };
                    *state.write().await = new_state;
                })
            },
        ));

        // Handle ICE connection state changes
        let peer_id_ice = peer_id.clone();
        peer.connection.on_ice_connection_state_change(Box::new(
            move |s| {
                let pid = peer_id_ice.clone();
                Box::pin(async move {
                    log::info!("[Peer {}] ICE connection state: {:?}", pid, s);
                })
            },
        ));

        // Handle incoming data channels (for the answerer)
        let dc_clone = data_channel.clone();
        let tx_clone = message_tx.clone();
        let peer_id_clone = peer_id.clone();
        peer.connection.on_data_channel(Box::new(move |dc| {
            let dc_clone2 = dc_clone.clone();
            let tx = tx_clone.clone();
            let pid = peer_id_clone.clone();

            Box::pin(async move {
                // Store the data channel
                *dc_clone2.lock().await = Some(dc.clone());

                // Set up message handler
                let tx2 = tx.clone();
                let pid2 = pid.clone();
                dc.on_message(Box::new(move |msg: DataChannelMessage| {
                    let tx3 = tx2.clone();
                    let pid3 = pid2.clone();
                    Box::pin(async move {
                        if let Ok(text) = String::from_utf8(msg.data.to_vec()) {
                            // Parse as raw PeerMessage
                            if let Ok(peer_message) = serde_json::from_str::<PeerMessage>(&text) {
                                log::info!("[Peer {}] Received message: {:?}", pid3, peer_message);
                                let _ = tx3.send(IncomingMessage {
                                    peer_id: pid3,
                                    message: peer_message,
                                });
                            } else {
                                log::warn!("[Peer] Failed to parse message: {}", &text[..text.len().min(100)]);
                            }
                        }
                    })
                }));
            })
        }));

        // Set up message handler for offerer's data channel
        let dc_opt = data_channel.lock().await.clone();
        if let Some(dc) = dc_opt {
            let tx = message_tx.clone();
            let pid = peer_id.clone();
            dc.on_message(Box::new(move |msg: DataChannelMessage| {
                let tx2 = tx.clone();
                let pid2 = pid.clone();
                Box::pin(async move {
                    if let Ok(text) = String::from_utf8(msg.data.to_vec()) {
                        // Parse as raw PeerMessage
                        if let Ok(peer_message) = serde_json::from_str::<PeerMessage>(&text) {
                            log::info!("[Peer {}] Received message: {:?}", pid2, peer_message);
                            let _ = tx2.send(IncomingMessage {
                                peer_id: pid2,
                                message: peer_message,
                            });
                        } else {
                            log::warn!("[Peer] Failed to parse message: {}", &text[..text.len().min(100)]);
                        }
                    }
                })
            }));
        }
    }

    /// Send a message to a specific peer
    pub async fn send_to_peer(&self, peer_id: &str, message: &PeerMessage) -> Result<(), String> {
        let peers = self.peers.read().await;
        let peer = peers.get(peer_id).ok_or("Peer not found")?;
        peer.send(message).await
    }

    /// Broadcast a message to all peers for a specific path
    pub async fn broadcast_to_path(&self, path: &FosPath, message: &PeerMessage) -> Result<(), String> {
        let peers = self.peers.read().await;
        for peer in peers.values() {
            if &peer.path == path {
                let _ = peer.send(message).await;
            }
        }
        Ok(())
    }

    /// Get info about all peers
    pub async fn get_peers(&self) -> Vec<PeerInfo> {
        let peers = self.peers.read().await;
        let mut result = Vec::new();
        for peer in peers.values() {
            result.push(peer.get_info().await);
        }
        result
    }

    /// Get info about peers for a specific path
    pub async fn get_peers_for_path(&self, path: &FosPath) -> Vec<PeerInfo> {
        let peers = self.peers.read().await;
        let mut result = Vec::new();
        for peer in peers.values() {
            if &peer.path == path {
                result.push(peer.get_info().await);
            }
        }
        result
    }

    /// Close a specific peer connection
    pub async fn close_peer(&self, peer_id: &str) -> Result<(), String> {
        let mut peers = self.peers.write().await;
        if let Some(peer) = peers.remove(peer_id) {
            peer.connection
                .close()
                .await
                .map_err(|e| format!("Failed to close connection: {}", e))?;
        }
        Ok(())
    }

    /// Close all peer connections
    pub async fn close_all(&self) -> Result<(), String> {
        let mut peers = self.peers.write().await;
        for peer in peers.values() {
            let _ = peer.connection.close().await;
        }
        peers.clear();
        Ok(())
    }

    /// Sign content using our signing key (for proposal approvals)
    pub fn sign_content(&self, content: &str) -> String {
        let signature = self.signing_key.sign(content.as_bytes());
        BASE64.encode(signature.to_bytes())
    }

    /// Verify a proposal signature from a specific peer
    pub async fn verify_proposal_signature(
        &self,
        peer_id: &str,
        content: &str,
        signature_b64: &str,
    ) -> Result<(), String> {
        let peer = self.get_peer(peer_id).await.ok_or("Peer not found")?;
        peer.verify_proposal_signature(content, signature_b64).await
    }
}
