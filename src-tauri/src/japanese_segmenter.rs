use std::io::Cursor;
use std::sync::OnceLock;

use ruzstd::decoding::StreamingDecoder;
use ruzstd::io::Read as _;
use vibrato::{Dictionary, Tokenizer};

const SYSTEM_DIC_ZST: &[u8] =
    include_bytes!("../resources/vibrato/ipadic-mecab-2_7_0-small/system.dic.zst");
const MAX_SEGMENT_INPUT_CHARS: usize = 240;

static TOKENIZER: OnceLock<Result<Tokenizer, String>> = OnceLock::new();

#[derive(Clone)]
struct RawSegment {
    surface: String,
    pos: String,
}

#[tauri::command]
pub fn segment_japanese_sentence(text: String) -> Result<Vec<String>, String> {
    let normalized = normalize_listening_text(&text);
    if normalized.is_empty() {
        return Ok(Vec::new());
    }

    if normalized.chars().count() > MAX_SEGMENT_INPUT_CHARS {
        return Err("听力句子过长，无法分词".to_string());
    }

    let tokenizer = get_tokenizer()?;
    let mut worker = tokenizer.new_worker();
    worker.reset_sentence(&normalized);
    worker.tokenize();

    let mut raw_segments = Vec::with_capacity(worker.num_tokens());
    for token in worker.token_iter() {
        let surface = normalize_listening_text(token.surface());
        if surface.is_empty() {
            continue;
        }

        raw_segments.push(RawSegment {
            pos: parse_pos(token.surface(), token.feature()),
            surface,
        });
    }

    let segments = merge_for_listening(raw_segments);
    if segments.len() < 2 || segments.join("") != normalized {
        return Err("日语句子分词结果不可用".to_string());
    }

    Ok(segments)
}

pub fn warm_up_tokenizer() -> Result<(), String> {
    get_tokenizer().map(|_| ())
}

fn get_tokenizer() -> Result<&'static Tokenizer, String> {
    match TOKENIZER.get_or_init(load_tokenizer) {
        Ok(tokenizer) => Ok(tokenizer),
        Err(message) => Err(message.clone()),
    }
}

fn load_tokenizer() -> Result<Tokenizer, String> {
    let mut compressed = SYSTEM_DIC_ZST;
    let mut decoder = StreamingDecoder::new(&mut compressed)
        .map_err(|err| format!("日语分词词典解压失败：{err}"))?;
    let mut dictionary_bytes = Vec::new();
    decoder
        .read_to_end(&mut dictionary_bytes)
        .map_err(|err| format!("日语分词词典读取失败：{err}"))?;

    let dictionary = Dictionary::read(Cursor::new(dictionary_bytes))
        .map_err(|err| format!("日语分词词典加载失败：{err}"))?;

    Ok(Tokenizer::new(dictionary).max_grouping_len(24))
}

fn normalize_listening_text(text: &str) -> String {
    text.chars()
        .filter(|ch| !is_listening_punctuation(*ch))
        .collect()
}

fn is_listening_punctuation(ch: char) -> bool {
    ch.is_whitespace()
        || matches!(
            ch,
            '。'
                | '、'
                | '，'
                | ','
                | '.'
                | '！'
                | '!'
                | '？'
                | '?'
                | '「'
                | '」'
                | '『'
                | '』'
                | '（'
                | '）'
                | '('
                | ')'
                | '［'
                | '］'
                | '['
                | ']'
                | '【'
                | '】'
                | '《'
                | '》'
                | '〈'
                | '〉'
                | '“'
                | '”'
                | '"'
                | '‘'
                | '’'
                | '\''
                | '・'
                | '…'
                | '‥'
                | ':'
                | '：'
                | ';'
                | '；'
        )
}

fn parse_pos(surface: &str, feature: &str) -> String {
    let mut fields = feature.split(',');
    let first = fields.next().unwrap_or("");

    if first == surface {
        fields.next().unwrap_or(first).to_string()
    } else {
        first.to_string()
    }
}

fn merge_for_listening(raw_segments: Vec<RawSegment>) -> Vec<String> {
    let mut merged: Vec<RawSegment> = Vec::new();

    for segment in raw_segments {
        if should_merge_with_previous(&merged, &segment) {
            if let Some(previous) = merged.last_mut() {
                previous.surface.push_str(&segment.surface);
                previous.pos = segment.pos;
            }
        } else {
            merged.push(segment);
        }
    }

    merged.into_iter().map(|segment| segment.surface).collect()
}

fn should_merge_with_previous(merged: &[RawSegment], current: &RawSegment) -> bool {
    let Some(previous) = merged.last() else {
        return false;
    };

    if current.pos == "助動詞" || current.pos == "接尾" {
        return true;
    }

    if current.pos == "動詞" {
        return is_light_verb_after_content_word(previous, &current.surface)
            || is_auxiliary_verb_after_te_form(previous, &current.surface);
    }

    current.pos == "助詞" && is_te_form_particle(previous, &current.surface)
}

fn is_light_verb_after_content_word(previous: &RawSegment, surface: &str) -> bool {
    matches!(surface, "し" | "する")
        && matches!(
            previous.pos.as_str(),
            "名詞" | "動詞" | "接頭詞" | "接尾" | "未知語"
        )
}

fn is_auxiliary_verb_after_te_form(previous: &RawSegment, surface: &str) -> bool {
    matches!(surface, "い" | "いる" | "あり" | "ある")
        && (previous.surface.ends_with('て') || previous.surface.ends_with('で'))
}

fn is_te_form_particle(previous: &RawSegment, surface: &str) -> bool {
    matches!(surface, "て" | "で") && matches!(previous.pos.as_str(), "動詞" | "助動詞")
}

#[cfg(test)]
mod tests {
    use super::{normalize_listening_text, segment_japanese_sentence};

    #[test]
    fn segments_sentence_with_embedded_dictionary() {
        let segments = segment_japanese_sentence("私は日本語を勉強しています。".to_string())
            .expect("embedded Vibrato dictionary should segment a common sentence");

        assert_eq!(segments.join(""), normalize_listening_text("私は日本語を勉強しています。"));
        assert!(segments.len() < "私は日本語を勉強しています".chars().count());
        assert!(segments.iter().any(|segment| segment == "日本語"));
    }
}
