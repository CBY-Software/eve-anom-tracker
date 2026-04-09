use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::AppHandle;
use tiny_http::{Response, Server};
use chrono::{DateTime, Utc, Duration};
use reqwest::Client;

const REDIRECT_PORT: u16 = 11925;
const REDIRECT_URI: &str = "http://localhost:11925/callback";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct EsiTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct EsiCharacter {
    pub character_id: i32,
    pub character_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct EsiAccountLink {
    pub character: EsiCharacter,
    pub tokens: EsiTokens,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CharacterPublicInfo {
    pub name: String,
    pub corporation_id: i32,
    pub corporation_name: String,
    pub alliance_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: i64,
    refresh_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct VerifyResponse {
    #[serde(rename = "CharacterID")]
    character_id: i32,
    #[serde(rename = "CharacterName")]
    character_name: String,
}

#[tauri::command]
pub async fn link_eve_character(_app: AppHandle, client_id: String) -> Result<EsiAccountLink, String> {
    let state = format!("{:x}", rand::random::<u64>());
    let auth_url = format!(
        "https://login.eveonline.com/v2/oauth/authorize/?response_type=code&redirect_uri={}&client_id={}&scope=esi-wallet.read_character_wallet.v1&state={}&prompt=consent",
        urlencoding::encode(REDIRECT_URI),
        client_id,
        state
    );

    // Open browser
    let _ = webbrowser::open(&auth_url);

    // Start local server to catch callback
    let server = Server::http(format!("127.0.0.1:{}", REDIRECT_PORT)).map_err(|e| e.to_string())?;
    
    for request in server.incoming_requests() {
        let url = request.url();
        if url.starts_with("/callback") {
            let query = url.split('?').nth(1).unwrap_or("");
            let params: HashMap<String, String> = query
                .split('&')
                .map(|s| {
                    let mut parts = s.split('=');
                    (parts.next().unwrap_or("").to_string(), parts.next().unwrap_or("").to_string())
                })
                .collect();

            if params.get("state").unwrap_or(&"".to_string()) != &state {
                let _ = request.respond(Response::from_string("Invalid state"));
                return Err("Invalid state".to_string());
            }

            if let Some(code) = params.get("code") {
                // Exchange code for tokens
                let tokens = exchange_code(&client_id, code).await?;
                let character = verify_token(&tokens.access_token).await?;
                
                let _ = request.respond(Response::from_string("Link successful! You can close this window."));
                
                return Ok(EsiAccountLink {
                    character,
                    tokens,
                });
            }
        }
        let _ = request.respond(Response::from_string("Link failed"));
        break;
    }

    Err("Timeout or failed to link".to_string())
}

async fn exchange_code(client_id: &str, code: &str) -> Result<EsiTokens, String> {
    let client = Client::new();
    let response = client.post("https://login.eveonline.com/v2/oauth/token")
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("client_id", client_id),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        return Err(format!("Token exchange failed: {}", err_body));
    }

    let token_resp: TokenResponse = response.json().await.map_err(|e| e.to_string())?;
    
    Ok(EsiTokens {
        access_token: token_resp.access_token,
        refresh_token: token_resp.refresh_token,
        expires_at: Utc::now() + Duration::seconds(token_resp.expires_in),
    })
}

async fn verify_token(access_token: &str) -> Result<EsiCharacter, String> {
    let client = Client::new();
    let response = client.get("https://login.eveonline.com/oauth/verify")
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err("Verification failed".to_string());
    }

    let verify_resp: VerifyResponse = response.json().await.map_err(|e| e.to_string())?;
    
    Ok(EsiCharacter {
        character_id: verify_resp.character_id,
        character_name: verify_resp.character_name,
    })
}

#[tauri::command]
pub async fn refresh_esi_token(client_id: String, refresh_token: String) -> Result<EsiTokens, String> {
    let client = Client::new();
    let response = client.post("https://login.eveonline.com/v2/oauth/token")
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", &refresh_token),
            ("client_id", &client_id),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err("Token refresh failed".to_string());
    }

    let token_resp: TokenResponse = response.json().await.map_err(|e| e.to_string())?;
    
    Ok(EsiTokens {
        access_token: token_resp.access_token,
        refresh_token: token_resp.refresh_token,
        expires_at: Utc::now() + Duration::seconds(token_resp.expires_in),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JournalEntry {
    pub id: i64,
    pub date: String,
    pub amount: f64,
    pub ref_type: String,
    pub description: Option<String>,
}

#[tauri::command]
pub async fn sync_wallet_journal(
    character_id: i32,
    access_token: String,
) -> Result<Vec<JournalEntry>, String> {
    let client = Client::new();
    let url = format!(
        "https://esi.evetech.net/latest/characters/{}/wallet/journal/?datasource=tranquility",
        character_id
    );

    let response = client.get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        return Err(format!("Failed to fetch journal: {}", err_body));
    }

    let entries: Vec<JournalEntry> = response.json().await.map_err(|e| e.to_string())?;
    
    Ok(entries)
}

#[tauri::command]
pub async fn get_character_public_info(character_id: i32) -> Result<CharacterPublicInfo, String> {
    let client = Client::new();
    
    // Fetch character public info
    let char_url = format!("https://esi.evetech.net/latest/characters/{}/", character_id);
    let char_resp = client.get(char_url).send().await.map_err(|e| e.to_string())?;
    
    if !char_resp.status().is_success() {
        return Err("Failed to fetch character info".to_string());
    }
    
    let char_data: serde_json::Value = char_resp.json().await.map_err(|e| e.to_string())?;
    let name = char_data["name"].as_str().unwrap_or("Unknown").to_string();
    let corp_id = char_data["corporation_id"].as_i64().unwrap_or(0) as i32;
    
    // Fetch corporation name
    let corp_url = format!("https://esi.evetech.net/latest/corporations/{}/", corp_id);
    let corp_resp = client.get(corp_url).send().await.map_err(|e| e.to_string())?;
    
    let mut corporation_name = "Unknown Corporation".to_string();
    if corp_resp.status().is_success() {
        let corp_data: serde_json::Value = corp_resp.json().await.map_err(|e| e.to_string())?;
        corporation_name = corp_data["name"].as_str().unwrap_or("Unknown").to_string();
    }
    
    // Fetch alliance name if present
    let mut alliance_name = None;
    if let Some(alliance_id) = char_data["alliance_id"].as_i64() {
        let alliance_url = format!("https://esi.evetech.net/latest/alliances/{}/", alliance_id);
        if let Ok(alliance_resp) = client.get(alliance_url).send().await {
            if alliance_resp.status().is_success() {
                if let Ok(alliance_data) = alliance_resp.json::<serde_json::Value>().await {
                    alliance_name = alliance_data["name"].as_str().map(|s| s.to_string());
                }
            }
        }
    }
    
    Ok(CharacterPublicInfo {
        name,
        corporation_id: corp_id,
        corporation_name,
        alliance_name,
    })
}
