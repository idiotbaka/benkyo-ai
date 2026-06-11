mod japanese_segmenter;

const VOLCENGINE_TTS_URL_PREFIX: &str = "https://openspeech.bytedance.com/api/v3/tts/";
const VOLCENGINE_TTS_TIMEOUT_SECS: u64 = 20;

#[tauri::command]
async fn proxy_volcengine_tts(
    endpoint: String,
    api_key: String,
    resource_id: String,
    body: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let endpoint = endpoint.trim();
    let api_key = normalize_bearer_token(&api_key);
    let resource_id = resource_id.trim();

    if !endpoint.starts_with(VOLCENGINE_TTS_URL_PREFIX) {
        return Err("火山语音代理仅允许 openspeech.bytedance.com 的 TTS V3 接口".to_string());
    }
    if api_key.is_empty() {
        return Err("请先填写 TTS API 密钥".to_string());
    }
    if resource_id.is_empty() {
        return Err("请先填写 TTS 模型 ID".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(VOLCENGINE_TTS_TIMEOUT_SECS))
        .build()
        .map_err(|err| format!("火山语音客户端初始化失败：{err}"))?;

    let res = client
        .post(endpoint)
        .header("Content-Type", "application/json")
        .header("X-Api-Key", api_key)
        .header("X-Api-Resource-Id", resource_id)
        .json(&body)
        .send()
        .await
        .map_err(|err| format!("火山语音请求失败：{err}"))?;

    let status = res.status();
    let text = res
        .text()
        .await
        .map_err(|err| format!("火山语音响应读取失败：{err}"))?;

    if !status.is_success() {
        return Err(format!(
            "HTTP {}: {}",
            status.as_u16(),
            text.chars().take(240).collect::<String>()
        ));
    }

    parse_volcengine_tts_response(&text)
}

fn normalize_bearer_token(api_key: &str) -> String {
    let trimmed = api_key.trim();
    trimmed
        .strip_prefix("Bearer ")
        .or_else(|| trimmed.strip_prefix("bearer "))
        .unwrap_or(trimmed)
        .trim()
        .to_string()
}

fn parse_volcengine_tts_response(text: &str) -> Result<serde_json::Value, String> {
    let mut values = Vec::new();
    let stream = serde_json::Deserializer::from_str(text).into_iter::<serde_json::Value>();

    for item in stream {
        let value = item.map_err(|err| {
            format!(
                "火山语音响应不是有效 JSON：{}；响应片段：{}",
                err,
                text.chars().take(160).collect::<String>()
            )
        })?;
        values.push(value);
    }

    match values.len() {
        0 => Err("火山语音响应为空".to_string()),
        1 => {
            let value = values.remove(0);
            let code = value.get("code").and_then(|v| v.as_i64()).unwrap_or(0);
            if code == 20_000_000 {
                Err("火山语音响应已结束，但未收到音频数据".to_string())
            } else {
                Ok(value)
            }
        }
        _ => merge_volcengine_tts_chunks(values),
    }
}

fn merge_volcengine_tts_chunks(
    values: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let mut chunks = Vec::new();
    let mut message = String::new();
    let mut is_finished = false;

    for value in values {
        let code = value.get("code").and_then(|v| v.as_i64()).unwrap_or(0);
        if code == 20_000_000 {
            is_finished = true;
            continue;
        }

        if code != 0 {
            return Ok(value);
        }

        if message.is_empty() {
            message = value
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
        }

        if let Some(data) = value.get("data").and_then(|v| v.as_str()) {
            if !data.is_empty() {
                chunks.push(serde_json::Value::String(data.to_string()));
            }
        }
    }

    if chunks.is_empty() {
        if is_finished {
            return Err("火山语音响应已结束，但未收到音频数据".to_string());
        }
        return Err("火山语音响应未包含音频数据".to_string());
    }

    Ok(serde_json::json!({
        "code": 0,
        "message": message,
        "data_chunks": chunks,
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            proxy_volcengine_tts,
            japanese_segmenter::segment_japanese_sentence
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
