import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import JapaneseSpeechButton from '../components/UI/JapaneseSpeechButton';
import { JAPANESE_INTRO_BASICS, getJapaneseIntroMiniQuizzes } from '../data/japaneseIntroBasics';
import { createGojuonAudioUrl, getGojuonAudioEntry } from '../lib/gojuon-audio';
import { useIcon } from '../lib/icons';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../lib/sound-effects';
import useJapaneseIntroProgressStore from '../store/japaneseIntroProgressStore';

gsap.registerPlugin(useGSAP);

const TOPIC_IDS = {
  origin: 'kana-kanji-origin',
  writingSystems: 'three-writing-systems',
  sentenceBuilding: 'sentence-building',
  wordOrderParticles: 'word-order-particles',
  moraRhythm: 'mora-rhythm',
  pronunciationBasics: 'pronunciation-basics',
  politePlain: 'polite-and-plain',
  onyomiKunyomi: 'onyomi-kunyomi',
  specialYoonLoanwords: 'special-yoon-loanwords',
};

const KANA_SOUND_SAMPLES = [
  { kana: 'あ', romaji: 'a' },
  { kana: 'い', romaji: 'i' },
  { kana: 'う', romaji: 'u' },
  { kana: 'え', romaji: 'e' },
  { kana: 'お', romaji: 'o' },
];

const FIRST_LESSON_WRITING_SYSTEMS = [
  {
    title: '漢字',
    reading: 'かんじ / kanji',
    color: '#2563EB',
    example: '日本語',
    exampleReading: 'にほんご',
    romaji: 'nihongo',
    body: '看起来像中文汉字，对吧～它主要负责告诉我们“意思”。不用一开始背很多，我会陪你在单词里慢慢认识它★',
  },
  {
    title: 'ひらがな',
    reading: '平假名 / hiragana',
    color: '#16A34A',
    example: 'あいうえお',
    exampleReading: 'あいうえお',
    romaji: 'a i u e o',
    body: '圆圆软软的，就是日语入门最亲切的入口♪ 语法、词尾、初学读物里都会常常见到它。',
  },
  {
    title: 'カタカナ',
    reading: '片假名 / katakana',
    color: '#DB2777',
    example: 'アイウエオ',
    exampleReading: 'アイウエオ',
    romaji: 'a i u e o',
    body: '它的线条更有棱角，读音常常能和平假名配成一对。外来语、人名、拟声词里经常轮到它出场～',
  },
];

const FIRST_LESSON_KANA_PAIRS = [
  { hira: 'あ', kata: 'ア', romaji: 'a' },
  { hira: 'い', kata: 'イ', romaji: 'i' },
  { hira: 'う', kata: 'ウ', romaji: 'u' },
  { hira: 'え', kata: 'エ', romaji: 'e' },
  { hira: 'お', kata: 'オ', romaji: 'o' },
];

const FIRST_LESSON_USAGE = [
  {
    title: '平假名常在“日语自己的部分”出现',
    examples: [
      { jp: 'さくら', reading: 'さくら', romaji: 'sakura', cn: '樱花' },
      { jp: 'です', reading: 'です', romaji: 'desu', cn: '礼貌句尾' },
      { jp: 'を', reading: 'を', romaji: 'o', cn: '助词，标记动作对象' },
    ],
    body: '刚开始可以把平假名当作主线哦～先把它读顺，后面学单词、语法和句子都会轻松很多♪',
  },
  {
    title: '片假名常在“外来或特殊强调的部分”出现',
    examples: [
      { jp: 'テレビ', reading: 'テレビ', romaji: 'terebi', cn: '电视' },
      { jp: 'コーヒー', reading: 'コーヒー', romaji: 'kohii', cn: '咖啡' },
      { jp: 'ワンワン', reading: 'ワンワン', romaji: 'wanwan', cn: '狗叫声' },
    ],
    body: '片假名不是“更高级”的文字啦，它只是另一套写法。很多音和平假名相同，只是出场场景不一样～',
  },
];

const FIRST_LESSON_STUDY_STEPS = [
  {
    title: '先把平假名当作主线',
    body: '我建议先把平假名当主线♪ 它会出现在基础单词、语法和句尾里，读顺之后会很有安全感。',
  },
  {
    title: '再把片假名看成“同音的另一套写法”',
    body: '片假名不是另一套发音系统哦。看到 ア、イ、ウ、エ、オ 时，先把它们和 あ、い、う、え、お 对上就好～',
  },
  {
    title: '汉字先认意思，不急着背全部读法',
    body: '日语汉字会有多个读音，有点调皮。现在先知道它常常负责核心意思，读法之后交给单词一点点积累★',
  },
];

const TERM_CARDS = [
  {
    jp: '日本語',
    kana: 'にほんご',
    romaji: 'nihongo',
    cn: '日语',
    body: '这是你正在学习的语言名字♪ 它有自己的声音、语法和书写习惯，我会一点点带你认识。',
  },
  {
    jp: '文字',
    kana: 'もじ',
    romaji: 'moji',
    cn: '文字、字符',
    body: '这是用来记录语言的符号。学日语文字时，我会先帮你分清“表示意思”和“表示声音”这两件事～',
  },
  {
    jp: '漢字',
    kana: 'かんじ',
    romaji: 'kanji',
    cn: '汉字',
    body: '这是从汉字文化圈传入日本的文字。本来很适合表示意思，后来也被拿来借声音用哦。',
  },
  {
    jp: '仮名',
    kana: 'かな',
    romaji: 'kana',
    cn: '假名',
    body: '这是记录日语声音的文字。先把它理解成“日语自己的声音小积木”就可以啦♪',
  },
  {
    jp: '万葉仮名',
    kana: 'まんようがな',
    romaji: 'man\'yogana',
    cn: '万叶假名',
    body: '这是早期借汉字读音来记录日语的写法。它像一座小桥，能帮我们理解假名从哪里来～',
  },
];

const ORIGIN_TIMELINE = [
  {
    title: '1. 日本先有口语，后来借来汉字',
    body: '很久以前，日本已经有人说自己的语言啦，但还没有今天这样成熟的本土书写系统。后来汉字跟着文书、佛教、制度和学术传入日本。',
  },
  {
    title: '2. 汉字可以表意，也可以借音',
    body: '汉字本来擅长表示意义，例如 山 表示“山”。但为了记录日语自己的声音，人们也会借汉字读音来写日语，这就是万叶假名的思路♪',
  },
  {
    title: '3. 借音写法越来越简化',
    body: '一直用复杂汉字记声音会很辛苦。大家写得更快、更稳定之后，一些简化形慢慢固定下来，就变成今天看到的假名啦～',
  },
  {
    title: '4. 平假名和片假名从不同简化方式中形成',
    body: '平假名多来自草书化的汉字形体，片假名多来自取汉字的一部分。这里先知道“它们有来源”就好，具体分工我放到第 02 讲带你看★',
  },
];

const ORIGIN_EXAMPLES = [
  { kanji: '安', kana: 'あ', romaji: 'a', type: '平假名', note: 'あ 常被解释为来自 安 的草书化，像把汉字写软了一点～' },
  { kanji: '以', kana: 'い', romaji: 'i', type: '平假名', note: 'い 和 以 的草书化来源有关，先把它们当成有亲戚关系就好♪' },
  { kanji: '宇', kana: 'う', romaji: 'u', type: '平假名', note: 'う 和 宇 的草书化来源有关，写法变轻巧之后就留下了现在的样子。' },
  { kanji: '阿', kana: 'ア', audioKana: 'あ', romaji: 'a', type: '片假名', note: 'ア 常被解释为取自 阿 的一部分，像从汉字里剪出一个小片段★' },
  { kanji: '伊', kana: 'イ', audioKana: 'い', romaji: 'i', type: '片假名', note: 'イ 与 伊 的局部形体有关，片假名很多就是这样取一部分形成的。' },
  { kanji: '宇', kana: 'ウ', audioKana: 'う', romaji: 'u', type: '片假名', note: 'ウ 与 宇 的局部形体有关。看到这里，知道“片假名也有来源”就很棒啦～' },
];

const ORIGIN_CHECKS = [
  '假名是日语正文里的文字，不是给汉字临时标音的拼音哦。',
  '假名最核心的工作，是记录日语的声音～',
  '平假名和片假名都属于假名，很多音可以一一配对。',
  '第 01 讲先理解“来源”和“概念”就好，具体分工下一讲我继续带你看★',
];

const SCRIPT_ROLES = [
  {
    title: '漢字',
    reading: 'かんじ / kanji',
    label: '表示核心词义',
    color: '#2563EB',
    body: '汉字通常负责“看一眼就抓住大概意思”的工作。比如 日本、学生、見、飲 这些核心词义，常常会用汉字写～',
    examples: [
      { jp: '日本', reading: 'にほん', romaji: 'nihon', cn: '日本' },
      { jp: '学生', reading: 'がくせい', romaji: 'gakusei', cn: '学生' },
      { jp: '飲む', reading: 'のむ', romaji: 'nomu', cn: '喝' },
    ],
  },
  {
    title: '平仮名',
    reading: 'ひらがな / hiragana',
    label: '连接语法和读音',
    color: '#16A34A',
    body: '平假名常负责助词、词尾变化、没有写汉字的日语词，也会帮汉字标读音。它像语法小丝带，让句子关系变清楚♪',
    examples: [
      { jp: 'は', reading: 'は', romaji: 'wa', cn: '主题助词，实际常读 wa' },
      { jp: 'を', reading: 'を', romaji: 'o', cn: '宾语助词' },
      { jp: 'です', reading: 'です', romaji: 'desu', cn: '礼貌句尾' },
    ],
  },
  {
    title: '片仮名',
    reading: 'かたかな / katakana',
    label: '外来语、拟声词和强调',
    color: '#DB2777',
    body: '片假名常用于外来语、外国地名人名、拟声拟态词，也能像“加粗提示”一样制造强调感。看到它时可以先竖起小耳朵～',
    examples: [
      { jp: 'テレビ', reading: 'テレビ', romaji: 'terebi', cn: '电视' },
      { jp: 'コーヒー', reading: 'コーヒー', romaji: 'kohii', cn: '咖啡' },
      { jp: 'ワンワン', reading: 'ワンワン', romaji: 'wanwan', cn: '狗叫声' },
    ],
  },
];

const PAIRED_KANA = [
  { hira: 'あ', kata: 'ア', romaji: 'a' },
  { hira: 'か', kata: 'カ', romaji: 'ka' },
  { hira: 'さ', kata: 'サ', romaji: 'sa' },
  { hira: 'た', kata: 'タ', romaji: 'ta' },
  { hira: 'な', kata: 'ナ', romaji: 'na' },
];

const WRITING_EXAMPLES = [
  {
    jp: '今日はコーヒーを飲みます。',
    reading: 'きょうはコーヒーをのみます。',
    romaji: 'kyo wa kohii o nomimasu',
    cn: '今天喝咖啡。',
    parts: [
      { label: '今日', role: '汉字：今天', color: '#2563EB' },
      { label: 'は', role: '平假名：提示主题', color: '#16A34A' },
      { label: 'コーヒー', role: '片假名：外来语', color: '#DB2777' },
      { label: 'を', role: '平假名：标记对象', color: '#16A34A' },
      { label: '飲', role: '汉字：动作核心', color: '#2563EB' },
      { label: 'みます', role: '平假名：词尾和礼貌形', color: '#16A34A' },
    ],
  },
  {
    jp: '私は日本語を勉強します。',
    reading: 'わたしはにほんごをべんきょうします。',
    romaji: 'watashi wa nihongo o benkyo shimasu',
    cn: '我学习日语。',
    parts: [
      { label: '私', role: '汉字：我', color: '#2563EB' },
      { label: 'は', role: '平假名：提示主题', color: '#16A34A' },
      { label: '日本語', role: '汉字：日语', color: '#2563EB' },
      { label: 'を', role: '平假名：标记对象', color: '#16A34A' },
      { label: '勉強', role: '汉字：学习', color: '#2563EB' },
      { label: 'します', role: '平假名：动词形式', color: '#16A34A' },
    ],
  },
  {
    jp: '犬がワンワン鳴きます。',
    reading: 'いぬがワンワンなきます。',
    romaji: 'inu ga wanwan nakimasu',
    cn: '狗汪汪地叫。',
    parts: [
      { label: '犬', role: '汉字：狗', color: '#2563EB' },
      { label: 'が', role: '平假名：标记主语', color: '#16A34A' },
      { label: 'ワンワン', role: '片假名：拟声词', color: '#DB2777' },
      { label: '鳴', role: '汉字：叫', color: '#2563EB' },
      { label: 'きます', role: '平假名：词尾和礼貌形', color: '#16A34A' },
    ],
  },
];

const WRITING_CHECKS = [
  '汉字主要帮你先抓住词义。',
  '平假名经常告诉你语法关系和词尾变化～',
  '片假名常提醒你：这可能是外来语、声音词或强调。',
  '一句日语里三套文字一起出现很正常，不是排版出错啦♪',
];

const SENTENCE_TERMS = [
  {
    title: '词语',
    jp: '単語',
    reading: 'たんご',
    romaji: 'tango',
    body: '词语是句子的基本材料，比如 私、学生、水、飲む。它们负责提供人、物、动作、状态这些内容～',
  },
  {
    title: '助词',
    jp: '助詞',
    reading: 'じょし',
    romaji: 'joshi',
    body: '助词是贴在词语后面的小标记，比如 は、が、を、に。它们会悄悄告诉我：前面的词在句子里扮演什么角色♪',
  },
  {
    title: '谓语',
    jp: '述語',
    reading: 'じゅつご',
    romaji: 'jutsugo',
    body: '谓语是句子的收尾核心。日语句子通常会把“是什么、做什么、怎么样”放在句尾，像给句子系上蝴蝶结～',
  },
];

const PREDICATE_TYPES = [
  {
    title: '名词 + です',
    example: '学生です。',
    reading: 'がくせいです。',
    romaji: 'gakusei desu',
    cn: '是学生。',
  },
  {
    title: '动词 + ます',
    example: '飲みます。',
    reading: 'のみます。',
    romaji: 'nomimasu',
    cn: '喝。',
  },
  {
    title: '形容词结尾',
    example: '大きいです。',
    reading: 'おおきいです。',
    romaji: 'okii desu',
    cn: '很大。',
  },
];

const SENTENCE_EXAMPLES = [
  {
    jp: '私は学生です。',
    reading: 'わたしはがくせいです。',
    romaji: 'watashi wa gakusei desu',
    cn: '我是学生。',
    parts: [
      { label: '私', role: '词语：我', color: '#2563EB' },
      { label: 'は', role: '助词：提示话题', color: '#16A34A' },
      { label: '学生です', role: '谓语：是学生', color: '#F59E0B' },
    ],
  },
  {
    jp: '水を飲みます。',
    reading: 'みずをのみます。',
    romaji: 'mizu o nomimasu',
    cn: '喝水。',
    parts: [
      { label: '水', role: '词语：水', color: '#2563EB' },
      { label: 'を', role: '助词：标记动作对象', color: '#16A34A' },
      { label: '飲みます', role: '谓语：喝', color: '#F59E0B' },
    ],
  },
  {
    jp: '明日、学校へ行きます。',
    reading: 'あした、がっこうへいきます。',
    romaji: 'ashita, gakko e ikimasu',
    cn: '明天去学校。',
    parts: [
      { label: '明日', role: '词语：时间', color: '#2563EB' },
      { label: '学校', role: '词语：地点', color: '#2563EB' },
      { label: 'へ', role: '助词：方向', color: '#16A34A' },
      { label: '行きます', role: '谓语：去', color: '#F59E0B' },
    ],
  },
];

const SENTENCE_CHECKS = [
  '日语句子最重要的位置通常在句尾。',
  '助词是贴在词后的小标记，不要随便丢掉它们哦。',
  '先把句子看成“词语 + 助词 + 谓语”的组合，细节之后再慢慢加★',
  '第 03 讲先认识零件，语序和助词对比我会放到第 04 讲继续讲。',
];

const PARTICLE_OVERVIEW = [
  {
    particle: 'は',
    audioKana: 'わ',
    romaji: 'wa',
    title: '提示话题',
    body: '它会把前面的词拿出来，当作这句话要谈的主题。写作 は，但当助词时常读 wa，记得和我一起换读音～',
    example: '私は学生です。',
    reading: 'わたしはがくせいです。',
    exampleRomaji: 'watashi wa gakusei desu',
    cn: '我是学生。',
  },
  {
    particle: 'が',
    romaji: 'ga',
    title: '标记主语或新信息',
    body: '它常用来标记“谁/什么在做这件事”，也常在第一次提出新信息时出场。',
    example: '雨が降ります。',
    reading: 'あめがふります。',
    exampleRomaji: 'ame ga furimasu',
    cn: '下雨。',
  },
  {
    particle: 'を',
    audioKana: 'を',
    romaji: 'o',
    title: '标记动作对象',
    body: '它会放在被动作影响的对象后面。写作 を，现代标准发音通常接近 o，声音要轻轻换一下♪',
    example: '水を飲みます。',
    reading: 'みずをのみます。',
    exampleRomaji: 'mizu o nomimasu',
    cn: '喝水。',
  },
  {
    particle: 'に',
    romaji: 'ni',
    title: '时间、地点、对象',
    body: '它常标记到达点、存在地点、具体时间，或动作面向的对象。先把它记成“指向某个点”的小箭头吧～',
    example: '七時に起きます。',
    reading: 'しちじにおきます。',
    exampleRomaji: 'shichiji ni okimasu',
    cn: '七点起床。',
  },
  {
    particle: 'で',
    romaji: 'de',
    title: '动作发生的场所或手段',
    body: '它常表示“在哪里做”或“用什么做”。可以先把它理解成动作发生的场所或工具背景。',
    example: '学校で勉強します。',
    reading: 'がっこうでべんきょうします。',
    exampleRomaji: 'gakko de benkyo shimasu',
    cn: '在学校学习。',
  },
  {
    particle: 'へ',
    audioKana: 'え',
    romaji: 'e',
    title: '方向',
    body: '它表示动作朝向哪里。写作 へ，但作为助词时常读 e，又是一个会换读音的小家伙～',
    example: '学校へ行きます。',
    reading: 'がっこうへいきます。',
    exampleRomaji: 'gakko e ikimasu',
    cn: '去学校。',
  },
];

const WORD_ORDER_EXAMPLES = [
  {
    jp: '私は学校で日本語を勉強します。',
    reading: 'わたしはがっこうでにほんごをべんきょうします。',
    romaji: 'watashi wa gakko de nihongo o benkyo shimasu',
    cn: '我在学校学习日语。',
    parts: [
      { label: '私', role: '话题：我', color: '#2563EB' },
      { label: 'は', role: '助词：提示话题', color: '#16A34A' },
      { label: '学校', role: '地点：学校', color: '#2563EB' },
      { label: 'で', role: '助词：动作场所', color: '#16A34A' },
      { label: '日本語', role: '对象：日语', color: '#2563EB' },
      { label: 'を', role: '助词：动作对象', color: '#16A34A' },
      { label: '勉強します', role: '谓语：学习', color: '#F59E0B' },
    ],
  },
  {
    jp: '明日、友達に手紙を書きます。',
    reading: 'あした、ともだちにてがみをかきます。',
    romaji: 'ashita, tomodachi ni tegami o kakimasu',
    cn: '明天给朋友写信。',
    parts: [
      { label: '明日', role: '时间：明天', color: '#2563EB' },
      { label: '友達', role: '对象：朋友', color: '#2563EB' },
      { label: 'に', role: '助词：动作面向对象', color: '#16A34A' },
      { label: '手紙', role: '对象：信', color: '#2563EB' },
      { label: 'を', role: '助词：动作对象', color: '#16A34A' },
      { label: '書きます', role: '谓语：写', color: '#F59E0B' },
    ],
  },
];

const PARTICLE_CHECKS = [
  '日语语序可以移动，但助词通常会跟着它前面的词一起移动。',
  '先找句尾谓语，再从前往后看每个“词语 + 助词”～',
  'は、が、を、に、で、へ 先记常见功能，不要一开始追求全部用法。',
  '助词 は、へ、を 的实际读音有点特殊，看到时请多看一眼♪',
];

const MORA_EXAMPLES = [
  {
    title: '普通假名：一个假名通常是一拍',
    items: [
      { text: 'か', romaji: 'ka', mora: '1 拍', audioKana: 'か' },
      { text: 'さ', romaji: 'sa', mora: '1 拍', audioKana: 'さ' },
      { text: 'ま', romaji: 'ma', mora: '1 拍', audioKana: 'ま' },
    ],
  },
  {
    title: '拗音：小ゃゅょ和前一拍合在一起',
    items: [
      { text: 'きゃ', romaji: 'kya', mora: '1 拍', audioKana: 'きゃ' },
      { text: 'しゅ', romaji: 'shu', mora: '1 拍', audioKana: 'しゅ' },
      { text: 'ちょ', romaji: 'cho', mora: '1 拍', audioKana: 'ちょ' },
    ],
  },
  {
    title: '特殊拍：ん、长音、促音也要占时间',
    items: [
      { text: 'ん', romaji: 'n', mora: '1 拍', audioKana: 'ん' },
      { text: 'ー', romaji: 'long vowel', mora: '1 拍', disabled: true },
      { text: 'っ', romaji: 'pause', mora: '1 拍', disabled: true },
    ],
  },
];

const MORA_WORDS = [
  {
    jp: 'おばさん',
    reading: 'おばさん',
    romaji: 'obasan',
    cn: '阿姨、伯母',
    beats: ['お', 'ば', 'さ', 'ん'],
  },
  {
    jp: 'おばあさん',
    reading: 'おばあさん',
    romaji: 'obaasan',
    cn: '奶奶、老奶奶',
    beats: ['お', 'ば', 'あ', 'さ', 'ん'],
  },
  {
    jp: 'きて',
    reading: 'きて',
    romaji: 'kite',
    cn: '来，来一下',
    beats: ['き', 'て'],
  },
  {
    jp: 'きって',
    reading: 'きって',
    romaji: 'kitte',
    cn: '邮票',
    beats: ['き', 'っ', 'て'],
  },
  {
    jp: 'おじさん',
    reading: 'おじさん',
    romaji: 'ojisan',
    cn: '叔叔、伯伯',
    beats: ['お', 'じ', 'さ', 'ん'],
  },
  {
    jp: 'おじいさん',
    reading: 'おじいさん',
    romaji: 'ojiisan',
    cn: '爷爷、老爷爷',
    beats: ['お', 'じ', 'い', 'さ', 'ん'],
  },
];

const MORA_SENTENCES = [
  {
    jp: '切手を買います。',
    reading: 'きってをかいます。',
    romaji: 'kitte o kaimasu',
    cn: '买邮票。',
    parts: [
      { label: '切手', role: 'き・っ・て：促音占一拍', color: '#F59E0B' },
      { label: 'を', role: '助词：动作对象', color: '#16A34A' },
      { label: '買います', role: '谓语：买', color: '#2563EB' },
    ],
  },
  {
    jp: 'コーヒーを飲みます。',
    reading: 'コーヒーをのみます。',
    romaji: 'kohii o nomimasu',
    cn: '喝咖啡。',
    parts: [
      { label: 'コーヒー', role: '长音：コ・ー・ヒ・ー', color: '#DB2777' },
      { label: 'を', role: '助词：动作对象', color: '#16A34A' },
      { label: '飲みます', role: '谓语：喝', color: '#2563EB' },
    ],
  },
];

const LONG_VOWEL_WRITING = [
  {
    title: '平假名里常直接写成多一个元音',
    body: '平假名的长音通常不是写横线，而是把被拉长的元音写出来。先别急着推导规则，看到词时跟我按词记就好～',
    examples: [
      { jp: 'おばあさん', reading: 'おばあさん', romaji: 'obaasan', cn: '奶奶、老奶奶' },
      { jp: 'おじいさん', reading: 'おじいさん', romaji: 'ojiisan', cn: '爷爷、老爷爷' },
      { jp: '高校', reading: 'こうこう', romaji: 'koko', cn: '高中' },
    ],
  },
  {
    title: '片假名里常用长音符号 ー',
    body: '片假名外来语里经常用 ー 表示拉长一拍。它不是装饰线哦，也要稳稳占一拍♪',
    examples: [
      { jp: 'コーヒー', reading: 'コーヒー', romaji: 'kohii', cn: '咖啡' },
      { jp: 'タクシー', reading: 'タクシー', romaji: 'takushii', cn: '出租车' },
      { jp: 'ケーキ', reading: 'ケーキ', romaji: 'keki', cn: '蛋糕' },
    ],
  },
];

const MORA_CHECKS = [
  '日语节奏按“拍”来数，不是按中文音节来数。',
  '长音、促音 っ、拨音 ん 都会占时间，不可以偷偷省略～',
  '小ゃゅょ会和前面的假名合成一拍，例如 きゃ 是一拍。',
  '音拍变了，词义可能会变，所以听和读都要重视长度♪',
];

const GOJUON_STRUCTURE_ROWS = [
  {
    title: 'あ行',
    reading: 'a-gyo',
    body: '这一行没有辅音开头，直接就是五个基本元音。先把它们当成声音地基吧～',
    items: [
      { kana: 'あ', romaji: 'a' },
      { kana: 'い', romaji: 'i' },
      { kana: 'う', romaji: 'u' },
      { kana: 'え', romaji: 'e' },
      { kana: 'お', romaji: 'o' },
    ],
  },
  {
    title: 'か行',
    reading: 'ka-gyo',
    body: '这一行是 k 辅音加五个元音，所以会变成 ka / ki / ku / ke / ko。',
    items: [
      { kana: 'か', romaji: 'ka' },
      { kana: 'き', romaji: 'ki' },
      { kana: 'く', romaji: 'ku' },
      { kana: 'け', romaji: 'ke' },
      { kana: 'こ', romaji: 'ko' },
    ],
  },
  {
    title: 'さ行',
    reading: 'sa-gyo',
    body: '这一行大体是 s 辅音加元音，不过 し 常写作 shi，这是常见罗马音习惯♪',
    items: [
      { kana: 'さ', romaji: 'sa' },
      { kana: 'し', romaji: 'shi' },
      { kana: 'す', romaji: 'su' },
      { kana: 'せ', romaji: 'se' },
      { kana: 'そ', romaji: 'so' },
    ],
  },
];

const GOJUON_STRUCTURE_COLUMNS = [
  { title: 'あ段', reading: 'a-dan', body: '同一列都带 a 的感觉，例如 あ、か、さ、た、な。像排成一列的小队～', items: ['あ', 'か', 'さ', 'た', 'な'] },
  { title: 'い段', reading: 'i-dan', body: '同一列都带 i 的感觉，例如 い、き、し、ち、に。先听共同的 i 音♪', items: ['い', 'き', 'し', 'ち', 'に'] },
  { title: 'う段', reading: 'u-dan', body: '同一列都带 u 的感觉，例如 う、く、す、つ、ぬ。抓住 u 音就不容易迷路啦。', items: ['う', 'く', 'す', 'つ', 'ぬ'] },
];

const BASIC_KANA_ROMAJI = {
  あ: 'a',
  い: 'i',
  う: 'u',
  え: 'e',
  お: 'o',
  か: 'ka',
  き: 'ki',
  く: 'ku',
  け: 'ke',
  こ: 'ko',
  さ: 'sa',
  し: 'shi',
  す: 'su',
  せ: 'se',
  そ: 'so',
  た: 'ta',
  ち: 'chi',
  つ: 'tsu',
  な: 'na',
  に: 'ni',
  ぬ: 'nu',
};

const SOUND_GROUPS = [
  {
    title: '清音',
    reading: 'せいおん / seion',
    body: '没有点点或圈圈的基础音，就是五十音表的主体。先把它当作最原本的声音～',
    rows: [
      { base: 'か', romaji: 'ka' },
      { base: 'さ', romaji: 'sa' },
      { base: 'た', romaji: 'ta' },
      { base: 'は', romaji: 'ha' },
    ],
  },
  {
    title: '浊音',
    reading: 'だくおん / dakuon',
    body: '给部分清音加两个点「゛」，声音就会变浊。小点点很小，但作用很大哦♪',
    rows: [
      { base: 'か', changed: 'が', romaji: 'ka → ga' },
      { base: 'さ', changed: 'ざ', romaji: 'sa → za' },
      { base: 'た', changed: 'だ', romaji: 'ta → da' },
      { base: 'は', changed: 'ば', romaji: 'ha → ba' },
    ],
  },
  {
    title: '半浊音',
    reading: 'はんだくおん / handakuon',
    body: '半浊音只出现在 は 行，加小圈「゜」后会变成 p 音。看到小圈圈就想到 p～',
    rows: [
      { base: 'は', changed: 'ぱ', romaji: 'ha → pa' },
      { base: 'ひ', changed: 'ぴ', romaji: 'hi → pi' },
      { base: 'ふ', changed: 'ぷ', romaji: 'fu → pu' },
      { base: 'ほ', changed: 'ぽ', romaji: 'ho → po' },
    ],
  },
  {
    title: '拗音',
    reading: 'ようおん / yoon',
    body: '拗音由 い 段假名加小ゃ、小ゅ、小ょ组成，要合起来读作一拍。',
    rows: [
      { base: 'き', changed: 'きゃ', romaji: 'ki + ya → kya' },
      { base: 'し', changed: 'しゅ', romaji: 'shi + yu → shu' },
      { base: 'ち', changed: 'ちょ', romaji: 'chi + yo → cho' },
      { base: 'り', changed: 'りゃ', romaji: 'ri + ya → rya' },
    ],
  },
];

const PRONUNCIATION_WORDS = [
  { jp: 'かき', reading: 'かき', romaji: 'kaki', cn: '柿子 / 牡蛎等，依上下文' },
  { jp: 'かぎ', reading: 'かぎ', romaji: 'kagi', cn: '钥匙' },
  { jp: 'はら', reading: 'はら', romaji: 'hara', cn: '腹部、原野等' },
  { jp: 'ばら', reading: 'ばら', romaji: 'bara', cn: '玫瑰' },
  { jp: 'ひゃく', reading: 'ひゃく', romaji: 'hyaku', cn: '一百' },
  { jp: 'びゃく', reading: 'びゃく', romaji: 'byaku', cn: '白，常见于复合读音中' },
];

const PRONUNCIATION_CHECKS = [
  '清音是基础音，浊音是在部分清音上加两个点。',
  '半浊音只在 は 行出现，加圈后读 p 音～',
  '拗音中的小ゃゅょ要和前一个假名合成一拍。',
  '看到点点、圈圈、小假名时，读音可能已经变了，请不要按原来的清音读♪',
];

const POLITENESS_TERMS = [
  {
    title: '敬体',
    jp: '敬体',
    reading: 'けいたい',
    romaji: 'keitai',
    body: '敬体是礼貌、稳妥的表达方式。初学阶段最常见的是 です、ます 结尾，适合课堂、店员、陌生人和不确定关系的场景。',
  },
  {
    title: '普通形',
    jp: '普通形',
    reading: 'ふつうけい',
    romaji: 'futsukei',
    body: '普通形更基础、也更短。字典里的动词通常以普通形出现，很多语法也会接在普通形后面～',
  },
  {
    title: '丁寧',
    jp: '丁寧',
    reading: 'ていねい',
    romaji: 'teinei',
    body: '丁寧的意思是“礼貌、郑重”。看到 丁寧体 时，可以先理解成“礼貌体、敬体”♪',
  },
];

const POLITENESS_PAIRS = [
  {
    label: '名词句',
    polite: { jp: '学生です。', reading: 'がくせいです。', romaji: 'gakusei desu' },
    plain: { jp: '学生だ。', reading: 'がくせいだ。', romaji: 'gakusei da' },
    cn: '是学生。',
    note: 'です 更礼貌；だ 更直接，常见于普通形说明、亲近对话或书面断定。',
  },
  {
    label: '动词肯定',
    polite: { jp: '飲みます。', reading: 'のみます。', romaji: 'nomimasu' },
    plain: { jp: '飲む。', reading: 'のむ。', romaji: 'nomu' },
    cn: '喝。',
    note: 'ます 是礼貌形；飲む 是普通形，也是字典里常见的基本形式。',
  },
  {
    label: '动词否定',
    polite: { jp: '行きません。', reading: 'いきません。', romaji: 'ikimasen' },
    plain: { jp: '行かない。', reading: 'いかない。', romaji: 'ikanai' },
    cn: '不去。',
    note: 'ません 是礼貌否定；ない 是普通否定，以后很多语法会接在 ない 形后面。',
  },
  {
    label: 'い形容词',
    polite: { jp: '大きいです。', reading: 'おおきいです。', romaji: 'ookii desu' },
    plain: { jp: '大きい。', reading: 'おおきい。', romaji: 'ookii' },
    cn: '很大。',
    note: 'い形容词本身就能结句；加 です 会让语气更礼貌。',
  },
  {
    label: 'な形容词',
    polite: { jp: '静かです。', reading: 'しずかです。', romaji: 'shizuka desu' },
    plain: { jp: '静かだ。', reading: 'しずかだ。', romaji: 'shizuka da' },
    cn: '很安静。',
    note: 'な形容词普通形结句常用 だ；敬体用 です。',
  },
];

const POLITENESS_SCENES = [
  {
    title: '先用敬体最安全',
    body: '当你和老师、店员、陌生人、年长者说话，或者你不确定关系远近时，我建议先用 です、ます 形，会更稳妥～',
  },
  {
    title: '普通形不是“不礼貌形”',
    body: '普通形本身不是粗鲁表达哦。它常出现在字典、语法说明、新闻标题、亲近关系对话和句子内部结构里。',
  },
  {
    title: '学习语法离不开普通形',
    body: '很多后续语法会接普通形，例如 飲むこと、行かないで、静かだと思います。现在先建立“同一句话有两套形态”的概念就好★',
  },
];

const POLITENESS_EXAMPLES = [
  {
    jp: 'これは本です。',
    reading: 'これはほんです。',
    romaji: 'kore wa hon desu',
    cn: '这是书。',
    parts: [
      { label: 'これ', role: '这个', color: '#2563EB' },
      { label: 'は', role: '提示话题', color: '#16A34A' },
      { label: '本です', role: '敬体：是书', color: '#F59E0B' },
    ],
  },
  {
    jp: '明日、学校へ行く。',
    reading: 'あした、がっこうへいく。',
    romaji: 'ashita, gakko e iku',
    cn: '明天去学校。',
    parts: [
      { label: '明日', role: '时间：明天', color: '#2563EB' },
      { label: '学校へ', role: '方向：去学校', color: '#16A34A' },
      { label: '行く', role: '普通形：去', color: '#F59E0B' },
    ],
  },
];

const POLITENESS_CHECKS = [
  '初学口语先用 です、ます 形，通常最安全。',
  '普通形不是粗鲁形，它是很多语法和字典形式的基础～',
  '名词和な形容词普通形常用 だ，动词普通形常是字典里的样子。',
  '同一句话换成敬体或普通形，核心意思大致相同，但关系距离和使用场景会不同♪',
];

const KANJI_READING_TERMS = [
  {
    title: '音读',
    jp: '音読み',
    reading: 'おんよみ',
    romaji: 'onyomi',
    body: '可以大致理解成“受汉字传入时读音影响的读法”。它常出现在两个以上汉字组成的词里，例如 学生、電話、日本語。',
  },
  {
    title: '训读',
    jp: '訓読み',
    reading: 'くんよみ',
    romaji: 'kunyomi',
    body: '可以大致理解成“用日本原本的词来读这个汉字的意思”。常见于单个汉字词、动词和形容词里，例如 山、読む、赤い。',
  },
  {
    title: '假名标注',
    jp: '振り仮名',
    reading: 'ふりがな',
    romaji: 'furigana',
    body: '这是标在汉字上方或旁边的小假名，用来告诉你这个汉字词应该怎么读。儿童读物、教材和学习 App 都很爱用它♪',
  },
];

const KANJI_READING_PAIRS = [
  {
    kanji: '山',
    meaning: '山',
    kunyomi: { word: '山', reading: 'やま', romaji: 'yama', cn: '山' },
    onyomi: { word: '富士山', reading: 'ふじさん', romaji: 'fujisan', cn: '富士山' },
  },
  {
    kanji: '人',
    meaning: '人',
    kunyomi: { word: '人', reading: 'ひと', romaji: 'hito', cn: '人' },
    onyomi: { word: '日本人', reading: 'にほんじん', romaji: 'nihonjin', cn: '日本人' },
  },
  {
    kanji: '日',
    meaning: '日、太阳、一天',
    kunyomi: { word: '日', reading: 'ひ', romaji: 'hi', cn: '日、太阳' },
    onyomi: { word: '日本', reading: 'にほん', romaji: 'nihon', cn: '日本' },
  },
  {
    kanji: '生',
    meaning: '生、活',
    kunyomi: { word: '生きる', reading: 'いきる', romaji: 'ikiru', cn: '活着' },
    onyomi: { word: '学生', reading: 'がくせい', romaji: 'gakusei', cn: '学生' },
  },
];

const FURIGANA_EXAMPLES = [
  { text: '日本語', reading: 'にほんご', romaji: 'nihongo', cn: '日语', ruby: [{ base: '日', ruby: 'に' }, { base: '本', ruby: 'ほん' }, { base: '語', ruby: 'ご' }] },
  { text: '勉強', reading: 'べんきょう', romaji: 'benkyo', cn: '学习', ruby: [{ base: '勉', ruby: 'べん' }, { base: '強', ruby: 'きょう' }] },
  { text: '今日', reading: 'きょう', romaji: 'kyo', cn: '今天', ruby: [{ base: '今日', ruby: 'きょう' }] },
  { text: '食べる', reading: 'たべる', romaji: 'taberu', cn: '吃', ruby: [{ base: '食', ruby: 'た' }, { base: 'べる' }] },
];

const KANJI_READING_EXAMPLES = [
  {
    jp: '日本語を勉強します。',
    reading: 'にほんごをべんきょうします。',
    romaji: 'nihongo o benkyo shimasu',
    cn: '学习日语。',
    parts: [
      { label: '日本語', role: 'にほんご：汉字词，常按词整体记读音', color: '#2563EB' },
      { label: 'を', role: '助词：动作对象', color: '#16A34A' },
      { label: '勉強します', role: 'べんきょうします：学习', color: '#F59E0B' },
    ],
  },
  {
    jp: '山を見る。',
    reading: 'やまをみる。',
    romaji: 'yama o miru',
    cn: '看山。',
    parts: [
      { label: '山', role: 'やま：训读', color: '#2563EB' },
      { label: 'を', role: '助词：动作对象', color: '#16A34A' },
      { label: '見る', role: 'みる：看', color: '#F59E0B' },
    ],
  },
];

const KANJI_READING_CHECKS = [
  '汉字有意思，也可能有不止一个读音。',
  '音读常出现在汉字复合词里，训读常出现在日语本土词和带词尾的词里。',
  '假名标注会直接告诉你读法，不要只凭中文汉字猜音哦～',
  '初学阶段按“词”记读音最稳，不需要一次背完某个汉字的所有读法。',
];

const SPECIAL_YOON_CONTEXTS = [
  {
    title: '这是选修，不是入门必背',
    body: '清音、浊音、半浊音和常见拗音已经足够支撑入门学习啦。特殊拗音主要帮你读现代外来语，先了解原理即可～',
  },
  {
    title: '它多出现在片假名外来语里',
    body: '现代日语借入英语、法语、德语等词时，常用片假名记录大致读音。遇到传统五十音不够贴近的声音，就会用小假名组合来补足。',
  },
  {
    title: '它是“接近原音”的妥协',
    body: '日语不是直接复制外语发音，而是把外语声音放进日语能发音、能书写的系统里。ファ、ティ、ウェ 这类写法就是这样出现的♪',
  },
];

const SPECIAL_YOON_PATTERNS = [
  {
    label: 'F 音',
    body: '传统假名里只有 フ（fu）比较接近 f。为了表示 fa、fi、fe、fo，就会用 フ + 小ァィェォ 来补足～',
    items: [
      { kana: 'ファ', audioKana: 'ふぁ', romaji: 'fa' },
      { kana: 'フィ', audioKana: 'ふぃ', romaji: 'fi' },
      { kana: 'フェ', audioKana: 'ふぇ', romaji: 'fe' },
      { kana: 'フォ', audioKana: 'ふぉ', romaji: 'fo' },
    ],
  },
  {
    label: 'T / D 音',
    body: '外来语里常见 ti、di、tu、du。现代片假名会用 ティ、ディ、トゥ、ドゥ 来更接近原词。',
    items: [
      { kana: 'ティ', audioKana: 'てぃ', romaji: 'ti' },
      { kana: 'ディ', audioKana: 'でぃ', romaji: 'di' },
      { kana: 'トゥ', audioKana: 'とぅ', romaji: 'tu' },
      { kana: 'ドゥ', audioKana: 'どぅ', romaji: 'du' },
    ],
  },
  {
    label: 'W / E 音',
    body: 'ウィ、ウェ、ウォ 常用于表示 wi、we、wo；シェ、ジェ、チェ 则常见于 she、je、che 这一类外来语音♪',
    items: [
      { kana: 'ウィ', audioKana: 'うぃ', romaji: 'wi' },
      { kana: 'ウェ', audioKana: 'うぇ', romaji: 'we' },
      { kana: 'ウォ', audioKana: 'うぉ', romaji: 'wo' },
      { kana: 'シェ', audioKana: 'しぇ', romaji: 'she' },
      { kana: 'ジェ', audioKana: 'じぇ', romaji: 'je' },
      { kana: 'チェ', audioKana: 'ちぇ', romaji: 'che' },
    ],
  },
];

const SPECIAL_YOON_EXAMPLES = [
  { jp: 'フェイス', reading: 'フェイス', romaji: 'feisu', cn: 'face；脸、页面/产品里的“面”' },
  { jp: 'ティー', reading: 'ティー', romaji: 'tii', cn: 'tea / tee；茶、T 形物等语境' },
  { jp: 'ウェブ', reading: 'ウェブ', romaji: 'webu', cn: 'web；网络' },
  { jp: 'シェア', reading: 'シェア', romaji: 'shea', cn: 'share；分享、份额' },
  { jp: 'ジェット', reading: 'ジェット', romaji: 'jetto', cn: 'jet；喷气式、喷射' },
  { jp: 'フォーク', reading: 'フォーク', romaji: 'foku', cn: 'fork；叉子' },
];

const SPECIAL_YOON_CONTRASTS = [
  {
    title: 'Fight 和 Height 不应该读成一团',
    body: '如果只能粗略写成 ハイト，fight 和 height 的开头就容易混在一起。ファ 能让日语更清楚地表现 f 开头的外来语～',
    left: { jp: 'ファイト', reading: 'ファイト', romaji: 'faito', cn: 'fight；也常表示“加油”' },
    right: { jp: 'ハイト', reading: 'ハイト', romaji: 'haito', cn: 'height；高度，常见于设计/尺寸语境' },
  },
  {
    title: 'Face 需要 fe，Tea 需要 ti',
    body: 'フェ、ティ 不是基础五十音里的格子，而是为了让外来语更接近原词声音。看到小ァィゥェォ时，先把它和前一个假名合成一拍读♪',
    left: { jp: 'フェイス', reading: 'フェイス', romaji: 'feisu', cn: 'face' },
    right: { jp: 'ティー', reading: 'ティー', romaji: 'tii', cn: 'tea / tee' },
  },
];

const SPECIAL_YOON_STUDY_GUIDE = [
  {
    title: '先会认，不急着全部背',
    body: '你只要知道“前一个片假名 + 小ァィゥェォ”通常是在模拟外来语声音即可。真正记忆可以等遇到单词时再完成～',
  },
  {
    title: '把它当作一拍或一组声音读',
    body: 'ファ 是 fa，不是 フ + ア 两个完整音。ティー 里的 ティ 是 ti，后面的 ー 再把声音拉长一拍。',
  },
  {
    title: '外来语仍然是日语读法',
    body: '即使写得更接近原词，发音仍会服从日语节奏。例如 フェイス 会读成 fe-i-su 的节奏，不会完全等同英语 face。',
  },
];

const SPECIAL_YOON_CHECKS = [
  '特殊拗音是选修知识，入门阶段不需要全部背下来。',
  '它主要服务于现代片假名外来语，用来更接近原词发音～',
  'ファ、フィ、フェ、フォ 能帮助区分 f 系声音，例如 ファイト 和 ハイト。',
  '看到小ァィゥェォ时，通常要和前一个片假名合成一组声音读♪',
];

export default function JapaneseIntroTopicPage() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const cakeImg = useIcon('sd/sd_cake.png');
  const contentRef = useRef(null);

  const topic = useMemo(
    () => JAPANESE_INTRO_BASICS.find(item => item.id === topicId),
    [topicId],
  );

  useGSAP(() => {
    gsap.fromTo(
      contentRef.current,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.36, ease: 'back.out(1.8)' },
    );
  }, [topicId]);

  return (
    <div data-ui-click-sfx className="h-full overflow-y-auto scroll-y" style={{ background: '#F5F3FF' }}>
      <div
        style={{
          background: 'white',
          padding: '14px 20px 14px',
          boxShadow: '0 2px 12px rgba(91,79,233,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="btn-press"
            onClick={() => navigate('/vocab/japanese-intro')}
            aria-label="返回日语入门"
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: 'none',
              background: '#F3F2FF',
              color: 'var(--tp)',
              fontSize: 22,
              fontWeight: 900,
              lineHeight: 1,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ‹
          </button>
          <img src={cakeImg} alt="" width={30} height={30} style={{ objectFit: 'contain', flexShrink: 0 }} />
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1E1B4B', margin: 0, minWidth: 0 }}>
            基础知识
          </h1>
        </div>
      </div>

      <div ref={contentRef} style={{ padding: '18px 16px 28px' }}>
        {topic?.id === TOPIC_IDS.origin ? (
          <KanaOriginLesson topic={topic} />
        ) : topic?.id === TOPIC_IDS.writingSystems ? (
          <WritingSystemsLesson topic={topic} />
        ) : topic?.id === TOPIC_IDS.sentenceBuilding ? (
          <SentenceBuildingLesson topic={topic} />
        ) : topic?.id === TOPIC_IDS.wordOrderParticles ? (
          <WordOrderParticlesLesson topic={topic} />
        ) : topic?.id === TOPIC_IDS.moraRhythm ? (
          <MoraRhythmLesson topic={topic} />
        ) : topic?.id === TOPIC_IDS.pronunciationBasics ? (
          <PronunciationBasicsLesson topic={topic} />
        ) : topic?.id === TOPIC_IDS.politePlain ? (
          <PolitePlainLesson topic={topic} />
        ) : topic?.id === TOPIC_IDS.onyomiKunyomi ? (
          <OnyomiKunyomiLesson topic={topic} />
        ) : topic?.id === TOPIC_IDS.specialYoonLoanwords ? (
          <SpecialYoonLoanwordsLesson topic={topic} />
        ) : topic ? (
          <PlaceholderTopic topic={topic} />
        ) : (
          <MissingTopic />
        )}
      </div>
    </div>
  );
}

function KanaOriginLesson({ topic }) {
  return (
    <LessonArticle>
      <LessonHero topic={topic} lessonNumber="01">
        我是勉強ちゃん～这一讲先带你看懂日语文字的第一张地图：汉字、平假名和片假名会一起出场。
        不用急着背完五十音，先知道它们长什么样、读音怎么对应、为什么会出现就好啦★
      </LessonHero>

      <SectionCard title="先看一眼：日语有三类常见文字" eyebrow="FIRST LOOK">
        <p style={paragraphStyle}>
          如果你完全没学过日语，可能会先被这件事吓一跳：一句日语里会同时出现像中文的字、圆圆的字、方方的字。
          别担心～这不是乱码，而是现代日语很正常的写法。
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {FIRST_LESSON_WRITING_SYSTEMS.map(item => (
            <WritingSystemIntroCard key={item.title} item={item} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="什么是假名？先把它理解成“声音文字”" eyebrow="KANA">
        <p style={paragraphStyle}>
          假名，就是日语用来记录“声音”的文字。你可以把每个假名想成一颗小声音糖，
          例如 <InlineKana kana="あ" romaji="a" /> 读作 <strong>a</strong>，
          <InlineKana kana="か" romaji="ka" /> 读作 <strong>ka</strong>。
        </p>
        <p style={paragraphStyle}>
          我想让你先记住一个关键点：<strong>假名不是中文拼音</strong>。拼音通常是给汉字标读音的辅助工具；
          但假名本身就是日语正文里的文字，会直接写进句子里哦。
        </p>
        <div style={kanaGridStyle}>
          {KANA_SOUND_SAMPLES.map(item => (
            <KanaTile key={item.kana} kana={item.kana} romaji={item.romaji} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={0} />

      <SectionCard title="平假名和片假名：读音相同，写法不同" eyebrow="HIRAGANA / KATAKANA">
        <p style={paragraphStyle}>
          日语有两套假名：<strong>平假名</strong>和<strong>片假名</strong>。很多时候，它们像同音的双胞胎：
          <strong> あ </strong>和<strong> ア </strong>都读 a，<strong> か </strong>和<strong> カ </strong>都读 ka。
        </p>
        <p style={paragraphStyle}>
          你可以先把它理解成“同一种声音，有两套衣服”。真正的区别不在读音，而在使用场景～
        </p>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {FIRST_LESSON_KANA_PAIRS.map(pair => (
            <PairedKanaRow key={pair.hira} pair={pair} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={1} />

      <SectionCard title="什么时候看到平假名？什么时候看到片假名？" eyebrow="USAGE">
        <div style={{ display: 'grid', gap: 10 }}>
          {FIRST_LESSON_USAGE.map(item => (
            <KanaUsageBlock key={item.title} item={item} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="这一讲我想让你认识的 5 个词" eyebrow="BASIC WORDS">
        <div style={{ display: 'grid', gap: 10 }}>
          {TERM_CARDS.map(term => (
            <TermCard key={term.jp} term={term} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="日语为什么会用汉字？" eyebrow="HISTORY">
        <p style={paragraphStyle}>
          现在你已经知道“假名是声音文字”啦。接下来再看来源就容易多了：古代日本有自己的口语，
          但还没有像今天这样成熟的本土书写系统。后来汉字传入日本，成为记录文书和知识的重要工具。
        </p>
        <p style={paragraphStyle}>
          可是日语和中文不是同一种语言。只用汉字表示意思还不够，还需要记录日语自己的声音。于是，人们开始借汉字的音来写日语♪
        </p>
        <Timeline items={ORIGIN_TIMELINE} />
      </SectionCard>

      <SectionCard title="从汉字到假名" eyebrow="ORIGIN">
        <p style={paragraphStyle}>
          早期借汉字记音的方式，被称为 <strong>万葉仮名（まんようがな / man&apos;yogana）</strong>。
          后来大家越写越简化，慢慢形成了平假名和片假名。
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {ORIGIN_EXAMPLES.map(item => (
            <OriginCard key={`${item.kanji}-${item.kana}`} item={item} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="学完这一讲，我建议这样上手" eyebrow="NEXT">
        <div style={{ display: 'grid', gap: 10 }}>
          {FIRST_LESSON_STUDY_STEPS.map((step, index) => (
            <StudyStepCard key={step.title} step={step} index={index} />
          ))}
        </div>
      </SectionCard>

      <ChecklistCard title="第 01 讲先记住" items={ORIGIN_CHECKS} />
    </LessonArticle>
  );
}

function WritingSystemsLesson({ topic }) {
  return (
    <LessonArticle>
      <LessonHero topic={topic} lessonNumber="02">
        这一讲我来专门讲现代日语里三套文字怎么分工。看到一句日语时，先跟我判断每一块文字大概在做什么～
      </LessonHero>

      <SectionCard title="同一个音，可能有两种假名写法" eyebrow="KANA PAIRS">
        <p style={paragraphStyle}>
          平假名和片假名是两套不同的假名。它们常常一一对应，读音相同，但形状和使用场景不同，像换了衣服的小声音♪
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {PAIRED_KANA.map(pair => (
            <PairedKanaRow key={pair.hira} pair={pair} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="三套文字各自负责什么？" eyebrow="ROLES">
        <div style={{ display: 'grid', gap: 10 }}>
          {SCRIPT_ROLES.map(role => (
            <ScriptRoleBlock key={role.title} role={role} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={0} />

      <SectionCard title="放进句子里看" eyebrow="MIXED WRITING">
        <p style={paragraphStyle}>
          现代日语经常混写。下面的例句可以播放整句 TTS，也可以跟我一起看每一块文字正在做什么。
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {WRITING_EXAMPLES.map(example => (
            <SentenceExample key={example.jp} example={example} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={1} />

      <ChecklistCard title="第 02 讲先记住" items={WRITING_CHECKS} />
    </LessonArticle>
  );
}

function SentenceBuildingLesson({ topic }) {
  return (
    <LessonArticle>
      <LessonHero topic={topic} lessonNumber="03">
        这一讲我先带你认识日语句子的基本零件：词语、助词和谓语。助词差异和语序细节，我们放到第 04 讲慢慢拆♪
      </LessonHero>

      <SectionCard title="日语句子最重要的提示：看句尾" eyebrow="PREDICATE">
        <p style={paragraphStyle}>
          中文常常靠语序帮助理解：“我 喝 水”。日语也有语序，但刚入门时，我建议你先注意句尾。
          日语句子的结尾通常会告诉你这句话是在说“是什么、做什么、怎么样”。
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {PREDICATE_TYPES.map(item => (
            <PredicateCard key={item.example} item={item} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={0} />

      <SectionCard title="先认识三个零件" eyebrow="PARTS">
        <div style={{ display: 'grid', gap: 10 }}>
          {SENTENCE_TERMS.map(term => (
            <SentenceTermCard key={term.jp} term={term} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={1} />

      <SectionCard title="把零件拼成句子" eyebrow="EXAMPLES">
        <p style={paragraphStyle}>
          下面的例句我先按“词语 + 助词 + 谓语”拆开。你暂时不需要记住每个助词的全部用法，只要知道它们是角色标记就好～
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {SENTENCE_EXAMPLES.map(example => (
            <SentenceExample key={example.jp} example={example} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="为什么有些句子没有“我”？" eyebrow="OMISSION">
        <p style={paragraphStyle}>
          日语经常省略上下文里已经知道的信息。比如 <strong>水を飲みます。</strong> 可以理解为“喝水”，
          如果对话里已经知道主语是“我”，就不一定再说 <strong>私は</strong>。
        </p>
        <p style={paragraphStyle}>
          所以刚开始不要急着把每句日语都逐字翻成中文。先找句尾谓语，再看前面的词和助词给了哪些信息♪
        </p>
      </SectionCard>

      <ChecklistCard title="第 03 讲先记住" items={SENTENCE_CHECKS} />
    </LessonArticle>
  );
}

function WordOrderParticlesLesson({ topic }) {
  return (
    <LessonArticle>
      <LessonHero topic={topic} lessonNumber="04">
        这一讲我把第 03 讲提到的“助词”展开一点：日语不是只靠词的顺序，而是靠助词标记前面词语的角色。
      </LessonHero>

      <SectionCard title="先抓住一个核心规则" eyebrow="RULE">
        <p style={paragraphStyle}>
          中文常靠语序判断关系，例如“我喝水”和“水喝我”完全不同。日语也有常见语序，
          但更关键的是 <strong>助词会贴在词语后面，标记这个词在句子里的角色</strong>。
        </p>
        <p style={paragraphStyle}>
          也就是说，看到 <strong>水を</strong>，我就知道“水”是动作对象；看到 <strong>学校で</strong>，
          我就知道“学校”是动作发生的场所。助词通常要和它前面的词贴在一起理解～
        </p>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={0} />

      <SectionCard title="最先认识的 6 个助词" eyebrow="PARTICLES">
        <div style={{ display: 'grid', gap: 10 }}>
          {PARTICLE_OVERVIEW.map(item => (
            <ParticleCard key={item.particle} item={item} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="语序可以动，助词要跟着走" eyebrow="WORD ORDER">
        <p style={paragraphStyle}>
          刚开始可以先用一个保守顺序：<strong>话题 / 时间 / 地点 / 对象 / 谓语</strong>。
          但真正让句子关系清楚的，是每个词后面那颗小小的助词♪
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {WORD_ORDER_EXAMPLES.map(example => (
            <SentenceExample key={example.jp} example={example} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="读音特殊的助词" eyebrow="SOUND">
        <p style={paragraphStyle}>
          有几个助词的读音和普通假名读音不完全一样：<InlineKana kana="は" romaji="wa" />、
          <InlineKana kana="へ" romaji="e" />、<InlineKana kana="を" romaji="o" />。
          它们写法保留历史形式，但在助词位置时要按助词读音读，别被外表骗到啦～
        </p>
        <div style={kanaGridStyle}>
          {[
            { kana: 'は', romaji: 'wa', audioKana: 'わ' },
            { kana: 'へ', romaji: 'e', audioKana: 'え' },
            { kana: 'を', romaji: 'o' },
          ].map(item => (
            <KanaTile key={item.kana} kana={item.kana} romaji={item.romaji} audioKana={item.audioKana} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={1} />

      <ChecklistCard title="第 04 讲先记住" items={PARTICLE_CHECKS} />
    </LessonArticle>
  );
}

function MoraRhythmLesson({ topic }) {
  return (
    <LessonArticle>
      <LessonHero topic={topic} lessonNumber="05">
        这一讲我带你学习日语发音的节奏单位：音拍。日语里“短一拍、长一拍、停一拍”都可能改变词义哦。
      </LessonHero>

      <SectionCard title="什么是音拍？" eyebrow="MORA">
        <p style={paragraphStyle}>
          音拍可以理解为日语发音时的“节拍”。很多普通假名各占一拍，例如
          <InlineKana kana="か" romaji="ka" /> 是一拍，<InlineKana kana="な" romaji="na" /> 也是一拍。
        </p>
        <p style={paragraphStyle}>
          但不是“一个大字就是一拍”哦。小ゃゅょ会和前面的假名合成一拍；而
          <strong> ん、长音、促音 っ</strong> 虽然看起来小或不明显，也会占一拍～
        </p>
      </SectionCard>

      <SectionCard title="三类音拍先这样数" eyebrow="COUNTING">
        <div style={{ display: 'grid', gap: 10 }}>
          {MORA_EXAMPLES.map(group => (
            <MoraGroup key={group.title} group={group} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={0} />

      <SectionCard title="音拍变了，词义可能变" eyebrow="COMPARE">
        <p style={paragraphStyle}>
          下面这些词看起来很像，但长音或促音多一拍，意思就会变。你可以播放整词，和我一起听差别♪
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {MORA_WORDS.map(word => (
            <MoraWordCard key={word.jp} word={word} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={1} />

      <SectionCard title="长音到底怎么写？" eyebrow="LONG VOWEL">
        <p style={paragraphStyle}>
          刚入门最容易漏掉长音，因为中文里不会用同样方式标记“多一拍”。日语里长音的写法会因平假名、片假名而不同。
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {LONG_VOWEL_WRITING.map(group => (
            <LongVowelBlock key={group.title} group={group} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="放进句子里听" eyebrow="SENTENCES">
        <div style={{ display: 'grid', gap: 10 }}>
          {MORA_SENTENCES.map(example => (
            <SentenceExample key={example.jp} example={example} />
          ))}
        </div>
      </SectionCard>

      <ChecklistCard title="第 05 讲先记住" items={MORA_CHECKS} />
    </LessonArticle>
  );
}

function PronunciationBasicsLesson({ topic }) {
  return (
    <LessonArticle>
      <LessonHero topic={topic} lessonNumber="06">
        这一讲我把五十音表之外最常见的读音变化放到一张地图里：清音、浊音、半浊音和拗音。
      </LessonHero>

      <SectionCard title="先看懂五十音表的行和段" eyebrow="TABLE">
        <p style={paragraphStyle}>
          五十音表不是随机排列哦。横向常叫 <strong>行（ぎょう / gyo）</strong>，
          纵向常叫 <strong>段（だん / dan）</strong>。先理解这个坐标，后面的浊音和拗音会更好记♪
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {GOJUON_STRUCTURE_ROWS.map(row => (
            <GojuonStructureCard key={row.title} group={row} />
          ))}
          {GOJUON_STRUCTURE_COLUMNS.map(column => (
            <GojuonColumnCard key={column.title} column={column} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="先看四组读音变化" eyebrow="SOUNDS">
        <p style={paragraphStyle}>
          清音是基础；加两个点会变成浊音；は 行加圈会变成半浊音；い 段假名加小ゃゅょ会形成拗音。
          点每个假名都可以播放内置 gojuon 音频，听一听会更好记～
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {SOUND_GROUPS.map(group => (
            <SoundGroupCard key={group.title} group={group} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={0} />

      <SectionCard title="为什么要单独学这些？" eyebrow="MEANING">
        <p style={paragraphStyle}>
          因为这些小变化会直接影响听力和词义。比如 <strong>かき</strong> 和 <strong>かぎ</strong>，
          只差一个点点，读音和意思就不同；<strong>きや</strong> 和 <strong>きゃ</strong> 的节奏也不同。小符号真的很有存在感★
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {PRONUNCIATION_WORDS.map(word => (
            <WordExampleRow key={word.jp} example={word} color="#2563EB" />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="拗音要当作一拍读" eyebrow="YOON">
        <p style={paragraphStyle}>
          拗音里的 ゃ、ゅ、ょ 必须写小，和前面的假名合成一个音。例如
          <InlineKana kana="きゃ" romaji="kya" /> 是一拍，不是 き + や 两拍。请把它们抱成一组读♪
        </p>
        <div style={kanaGridStyle}>
          {[
            { kana: 'きゃ', romaji: 'kya' },
            { kana: 'しゅ', romaji: 'shu' },
            { kana: 'ちょ', romaji: 'cho' },
            { kana: 'りゃ', romaji: 'rya' },
            { kana: 'ぎゅ', romaji: 'gyu' },
          ].map(item => (
            <KanaTile key={item.kana} kana={item.kana} romaji={item.romaji} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={1} />

      <ChecklistCard title="第 06 讲先记住" items={PRONUNCIATION_CHECKS} />
    </LessonArticle>
  );
}

function PolitePlainLesson({ topic }) {
  return (
    <LessonArticle>
      <LessonHero topic={topic} lessonNumber="07">
        这一讲我带你学习同一句话的两种常见表达层级：敬体更礼貌稳妥，普通形更基础，也更常出现在字典和语法连接里。
      </LessonHero>

      <SectionCard title="先认识三个关键词" eyebrow="TERMS">
        <div style={{ display: 'grid', gap: 10 }}>
          {POLITENESS_TERMS.map(term => (
            <SentenceTermCard key={term.jp} term={term} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={0} />

      <SectionCard title="敬体和普通形怎么对应？" eyebrow="PAIRS">
        <p style={paragraphStyle}>
          先不要急着背所有变化规则。你只需要看出：敬体常用 <strong>です / ます</strong>，
          普通形更短，也更接近字典或语法书里的基本形。先认脸就很棒啦～
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {POLITENESS_PAIRS.map(pair => (
            <PolitenessPairCard key={pair.label} pair={pair} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={1} />

      <SectionCard title="什么时候用哪一种？" eyebrow="SCENES">
        <div style={{ display: 'grid', gap: 10 }}>
          {POLITENESS_SCENES.map(item => (
            <InfoBlock key={item.title} item={item} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="放进句子里看语气" eyebrow="EXAMPLES">
        <p style={paragraphStyle}>
          下面两句分别展示敬体和普通形。它们的核心意思不难，但给人的关系距离会不一样♪
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {POLITENESS_EXAMPLES.map(example => (
            <SentenceExample key={example.jp} example={example} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="初学者的使用策略" eyebrow="GUIDE">
        <p style={paragraphStyle}>
          开口说话时，如果你不知道该用哪一种，我建议先用敬体。学习语法时，也不要害怕普通形，因为它会成为后续变化的基础。
        </p>
        <p style={paragraphStyle}>
          我会把两者理解成两条轨道：<strong>敬体轨道负责对人礼貌表达</strong>，
          <strong>普通形轨道负责语法连接和亲近表达</strong>。两条都重要，只是使用场景不同～
        </p>
      </SectionCard>

      <ChecklistCard title="第 07 讲先记住" items={POLITENESS_CHECKS} />
    </LessonArticle>
  );
}

function OnyomiKunyomiLesson({ topic }) {
  return (
    <LessonArticle>
      <LessonHero topic={topic} lessonNumber="08">
        这一讲我来解释为什么日语汉字会有多个读音，以及教材里的假名标注怎么帮你读出生词。
      </LessonHero>

      <SectionCard title="先建立一个重要认知" eyebrow="KANJI">
        <p style={paragraphStyle}>
          日语汉字不像中文那样通常只按一个稳定读音来读。一个汉字有“意思”，但在不同词里可能读不同音。
          所以看到汉字时，不要只凭中文经验猜读音，我会教你更稳的方法～
        </p>
        <p style={paragraphStyle}>
          刚开始最稳的方法是：<strong>把汉字放在词里记</strong>。例如 学生 读
          <strong> がくせい / gakusei</strong>，不是把每个字随便拆开猜。
        </p>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={0} />

      <SectionCard title="三个关键词" eyebrow="TERMS">
        <div style={{ display: 'grid', gap: 10 }}>
          {KANJI_READING_TERMS.map(term => (
            <SentenceTermCard key={term.jp} term={term} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="同一个汉字，读法可能不同" eyebrow="ON / KUN">
        <p style={paragraphStyle}>
          下面每张卡都展示同一个汉字的训读和音读例子。先理解“为什么会有两类读法”，不用一次背完哦♪
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {KANJI_READING_PAIRS.map(pair => (
            <KanjiReadingPairCard key={pair.kanji} pair={pair} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="假名标注怎么帮你？" eyebrow="FURIGANA">
        <p style={paragraphStyle}>
          假名标注，也叫 <strong>振り仮名（ふりがな / furigana）</strong>，会把读音写在汉字上方。
          它的作用不是翻译，而是告诉你“这个词应该怎么读”，像我递给你的小扶手～
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {FURIGANA_EXAMPLES.map(item => (
            <FuriganaWordCard key={item.text} item={item} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={1} />

      <SectionCard title="放进句子里看" eyebrow="EXAMPLES">
        <div style={{ display: 'grid', gap: 10 }}>
          {KANJI_READING_EXAMPLES.map(example => (
            <SentenceExample key={example.jp} example={example} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="初学者怎么记最有效？" eyebrow="GUIDE">
        <div style={{ display: 'grid', gap: 10 }}>
          {[
            { title: '按词记，不按单字硬猜', body: '先记 日本語=にほんご、学生=がくせい、山=やま。词读熟了，汉字读音会自然积累～' },
            { title: '看到假名标注就认真读', body: '假名标注是给你的阅读小扶手。多读几次，慢慢就能离开扶手啦。' },
            { title: '例外以后再处理', body: '日语汉字有不少特殊读法。现在先掌握音读、训读、假名标注这三个基本概念就好★' },
          ].map(item => (
            <InfoBlock key={item.title} item={item} />
          ))}
        </div>
      </SectionCard>

      <ChecklistCard title="第 08 讲先记住" items={KANJI_READING_CHECKS} />
    </LessonArticle>
  );
}

function SpecialYoonLoanwordsLesson({ topic }) {
  return (
    <LessonArticle>
      <LessonHero topic={topic} lessonNumber="09">
        这一讲是选修小课堂～我不会要求你在入门阶段背完所有特殊组合，只会帮你理解现代片假名外来语为什么会出现
        ファ、ティ、ウェ 这样的写法。
      </LessonHero>

      <SectionCard title="为什么这是选修？" eyebrow="OPTIONAL">
        <div style={{ display: 'grid', gap: 10 }}>
          {SPECIAL_YOON_CONTEXTS.map(item => (
            <InfoBlock key={item.title} item={item} />
          ))}
        </div>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={0} />

      <SectionCard title="为什么现代日语需要这些组合？" eyebrow="BACKGROUND">
        <p style={paragraphStyle}>
          日语传统五十音很稳定，但它不是为英语、法语、德语等外语设计的。比如英语里有
          <strong> fa / fi / fe / fo </strong>这样的声音，传统日语里最接近的是
          <InlineKana kana="ふ" romaji="fu" />，但只用 フ 很难细分这些外来语声音。
        </p>
        <p style={paragraphStyle}>
          所以现代片假名会使用“小假名”来补足：<strong>フ + ァ = ファ（fa）</strong>，
          <strong>テ + ィ = ティ（ti）</strong>。这不是新的五十音表，而是外来语书写里常见的扩展写法哦。
        </p>
      </SectionCard>

      <TopicMiniQuiz topicId={topic.id} quizIndex={1} />

      <SectionCard title="常见特殊拗音组合" eyebrow="PATTERNS">
        <p style={paragraphStyle}>
          点击每个组合可以播放内置 gojuon 音频。先熟悉它们的“形”和“音”，不需要一次全部记牢～
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {SPECIAL_YOON_PATTERNS.map(group => (
            <SpecialYoonPatternCard key={group.label} group={group} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="它解决了什么区分问题？" eyebrow="CONTRAST">
        <p style={paragraphStyle}>
          特殊拗音的价值，不只是“看起来更像外语”，更重要的是减少混淆。下面两组对比我先带你建立直觉♪
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {SPECIAL_YOON_CONTRASTS.map(item => (
            <LoanwordContrastCard key={item.title} item={item} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="放进现代外来语里看" eyebrow="EXAMPLES">
        <p style={paragraphStyle}>
          这些词通常写成片假名。播放时使用你配置的 TTS 模型；读音仍然是日语节奏，不会完全等同英语原音。
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {SPECIAL_YOON_EXAMPLES.map(example => (
            <WordExampleRow key={example.jp} example={example} color="#DB2777" />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="初学者怎么处理？" eyebrow="GUIDE">
        <div style={{ display: 'grid', gap: 10 }}>
          {SPECIAL_YOON_STUDY_GUIDE.map(item => (
            <InfoBlock key={item.title} item={item} />
          ))}
        </div>
      </SectionCard>

      <ChecklistCard title="第 09 讲（选修）先记住" items={SPECIAL_YOON_CHECKS} />
    </LessonArticle>
  );
}

function LessonArticle({ children }) {
  return (
    <article style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {children}
    </article>
  );
}

function LessonHero({ topic, lessonNumber, children }) {
  return (
    <section
      style={{
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8F7FF 100%)',
        border: '2px solid #E5E0FF',
        borderRadius: 20,
        padding: '18px 18px 20px',
        boxShadow: '0 4px 16px rgba(91,79,233,0.10)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: -28,
          top: -28,
          width: 96,
          height: 96,
          borderRadius: '50%',
          background: 'rgba(124,108,246,0.10)',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--tp)', marginBottom: 8 }}>
          第 {lessonNumber} 讲 · {topic.subtitle}
        </div>
        <h2 style={{ fontSize: 25, fontWeight: 900, color: '#1E1B4B', margin: '0 0 10px', lineHeight: 1.25 }}>
          {topic.title}
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#64748B', fontWeight: 700, margin: 0 }}>
          {children}
        </p>
      </div>
    </section>
  );
}

function SectionCard({ eyebrow, title, children }) {
  return (
    <section
      className="japanese-intro-topic-section"
      style={{
        background: 'white',
        border: '2px solid #E5E7EB',
        borderRadius: 18,
        boxShadow: '0 3px 0 #E5E7EB',
        padding: '16px 16px 18px',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--tp)', marginBottom: 5, letterSpacing: 0 }}>
        {eyebrow}
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1E1B4B', margin: '0 0 10px', lineHeight: 1.3 }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function TopicMiniQuiz({ topicId, quizIndex }) {
  const quizzes = getJapaneseIntroMiniQuizzes(topicId);
  const quiz = quizzes[quizIndex];
  if (!quiz) return null;

  return (
    <MiniQuizCard
      topicId={topicId}
      quiz={quiz}
      requiredQuizIds={quizzes.map(item => item.id)}
    />
  );
}

function MiniQuizCard({ topicId, quiz, requiredQuizIds }) {
  const bgImg = useIcon('sd/sd_lc_incorrect.png');
  const isStoredCorrect = useJapaneseIntroProgressStore(s => s.isMiniQuizCorrect(topicId, quiz.id));
  const markMiniQuizCorrect = useJapaneseIntroProgressStore(s => s.markMiniQuizCorrect);
  const [wrongOptionId, setWrongOptionId] = useState('');
  const wrongTimerRef = useRef(null);
  const layout = quiz.layout ?? 'stack';
  const isGridLayout = layout === 'grid-2' || layout === 'grid-2x2';

  useEffect(() => () => {
    if (wrongTimerRef.current) window.clearTimeout(wrongTimerRef.current);
  }, []);

  const handleOptionClick = (optionId) => {
    if (isStoredCorrect || wrongOptionId) return;

    if (optionId === quiz.answerId) {
      if (wrongTimerRef.current) window.clearTimeout(wrongTimerRef.current);
      setWrongOptionId('');
      playSoundEffect(SOUND_EFFECT_TYPES.ANSWER_CORRECT);
      markMiniQuizCorrect(topicId, quiz.id, optionId, requiredQuizIds);
      return;
    }

    playSoundEffect(SOUND_EFFECT_TYPES.ANSWER_WRONG);
    setWrongOptionId(optionId);
    wrongTimerRef.current = window.setTimeout(() => {
      setWrongOptionId('');
      wrongTimerRef.current = null;
    }, 420);
  };

  const answeredCorrect = isStoredCorrect;

  return (
    <section
      className="japanese-intro-mini-quiz-card"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 20,
        border: '2px solid #DDD6FE',
        background: 'linear-gradient(135deg, #FFF7ED 0%, #F6F3FF 50%, #ECFEFF 100%)',
        boxShadow: '0 4px 0 #DDD6FE, 0 12px 24px rgba(91,79,233,0.10)',
        padding: '16px 15px 17px',
      }}
    >
      <img
        src={bgImg}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: -20,
          bottom: -30,
          width: 158,
          height: 158,
          objectFit: 'contain',
          opacity: 1,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.78)',
              border: '1.5px solid rgba(196,181,253,0.72)',
              color: 'var(--tp-deep)',
              fontSize: 12,
              fontWeight: 900,
              padding: '4px 10px',
              width: 'fit-content',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: answeredCorrect ? '#22C55E' : '#F59E0B',
                boxShadow: answeredCorrect ? '0 0 0 3px #DCFCE7' : '0 0 0 3px #FEF3C7',
              }}
            />
            {quiz.label}
          </div>
          {answeredCorrect && (
            <div
              style={{
                borderRadius: 999,
                background: '#DCFCE7',
                color: '#15803D',
                border: '1.5px solid #86EFAC',
                fontSize: 11,
                fontWeight: 900,
                padding: '3px 9px',
                whiteSpace: 'nowrap',
              }}
            >
              已答对
            </div>
          )}
        </div>

        <h3 style={{ fontSize: 17, fontWeight: 900, color: '#1E1B4B', margin: 0, lineHeight: 1.35 }}>
          {quiz.prompt}
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isGridLayout ? 'repeat(2, minmax(0, 1fr))' : '1fr',
            gap: 8,
          }}
        >
          {quiz.options.map((option, index) => {
            const isCorrectOption = answeredCorrect && option.id === quiz.answerId;
            const isWrongOption = wrongOptionId === option.id;
            const disabled = answeredCorrect || Boolean(wrongOptionId);
            const color = isCorrectOption ? '#15803D' : isWrongOption ? '#B91C1C' : '#1E1B4B';

            return (
              <button
                key={option.id}
                type="button"
                className={`btn-press japanese-intro-mini-quiz-option${isWrongOption ? ' japanese-intro-mini-quiz-option--wrong' : ''}`}
                data-sfx="none"
                disabled={disabled}
                onClick={() => handleOptionClick(option.id)}
                style={{
                  width: '100%',
                  minHeight: isGridLayout ? 54 : 46,
                  borderRadius: 14,
                  border: `2px solid ${isCorrectOption ? '#22C55E' : isWrongOption ? '#EF4444' : '#DDD6FE'}`,
                  borderBottomWidth: 4,
                  borderBottomColor: isCorrectOption ? '#16A34A' : isWrongOption ? '#DC2626' : '#A78BFA',
                  background: isCorrectOption
                    ? 'rgba(220,252,231,0.72)'
                    : isWrongOption
                      ? 'rgba(254,226,226,0.76)'
                      : 'rgba(255,255,255,0.64)',
                  color,
                  cursor: disabled ? 'default' : 'pointer',
                  opacity: answeredCorrect && !isCorrectOption ? 0.58 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isGridLayout ? 'center' : 'flex-start',
                  gap: isGridLayout ? 7 : 10,
                  padding: isGridLayout ? '9px 8px' : '9px 11px',
                  textAlign: isGridLayout ? 'center' : 'left',
                  fontSize: isGridLayout ? 13 : 14,
                  fontWeight: 900,
                  lineHeight: 1.35,
                  boxShadow: '0 2px 10px rgba(91,79,233,0.06)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    flex: '0 0 auto',
                    display: 'grid',
                    placeItems: 'center',
                    background: isCorrectOption ? '#22C55E' : isWrongOption ? '#EF4444' : '#F3F2FF',
                    color: isCorrectOption || isWrongOption ? 'white' : 'var(--tp)',
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{option.text}</span>
              </button>
            );
          })}
        </div>

        {answeredCorrect && (
          <div
            style={{
              borderRadius: 14,
              background: 'rgba(240,253,244,0.68)',
              border: '1.5px solid #BBF7D0',
              color: '#166534',
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1.6,
              padding: '9px 11px',
            }}
          >
            {quiz.successText}
          </div>
        )}
      </div>
    </section>
  );
}

function TermCard({ term }) {
  return (
    <div style={subPanelStyle}>
      <JapaneseSpeechButton text={term.jp} spokenText={term.kana} label={`播放「${term.jp}」`} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <JapaneseTitle jp={term.jp} reading={term.kana} romaji={term.romaji} />
        <div style={{ fontSize: 13, fontWeight: 900, color: '#475569', marginBottom: 5 }}>{term.cn}</div>
        <div style={smallBodyStyle}>{term.body}</div>
      </div>
    </div>
  );
}

function SentenceTermCard({ term }) {
  return (
    <div style={subPanelStyle}>
      <JapaneseSpeechButton text={term.jp} spokenText={term.reading} label={`播放「${term.jp}」`} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--tp)', marginBottom: 4 }}>{term.title}</div>
        <JapaneseTitle jp={term.jp} reading={term.reading} romaji={term.romaji} />
        <div style={smallBodyStyle}>{term.body}</div>
      </div>
    </div>
  );
}

function WritingSystemIntroCard({ item }) {
  return (
    <div
      style={{
        background: `${item.color}08`,
        border: `1.5px solid ${item.color}33`,
        borderRadius: 16,
        padding: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <JapaneseSpeechButton text={item.example} spokenText={item.exampleReading} label={`播放「${item.example}」`} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '5px 8px', marginBottom: 4 }}>
            <span className="jp" style={{ fontSize: 23, fontWeight: 900, color: item.color, lineHeight: 1.2 }}>
              {item.title}
            </span>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#94A3B8' }}>{item.reading}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '5px 8px', marginBottom: 7 }}>
            <span className="jp" style={{ fontSize: 20, fontWeight: 900, color: '#1E1B4B' }}>
              {item.example}
            </span>
            <span className="jp" style={{ fontSize: 12, fontWeight: 800, color: 'var(--tp)' }}>
              {item.exampleReading}
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>{item.romaji}</span>
          </div>
          <div style={smallBodyStyle}>{item.body}</div>
        </div>
      </div>
    </div>
  );
}

function KanaUsageBlock({ item }) {
  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1.5px solid #E5E7EB',
        borderRadius: 16,
        padding: '12px',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900, color: '#1E1B4B', marginBottom: 5 }}>{item.title}</div>
      <div style={{ ...smallBodyStyle, marginBottom: 10 }}>{item.body}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {item.examples.map(example => (
          <WordExampleRow key={example.jp} example={example} color="#2563EB" />
        ))}
      </div>
    </div>
  );
}

function StudyStepCard({ step, index }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        background: '#FFF7ED',
        border: '1.5px solid #FED7AA',
        borderRadius: 14,
        padding: '12px',
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          background: '#FB923C',
          color: 'white',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 900,
          flex: '0 0 auto',
          boxShadow: '0 2px 0 #EA580C',
        }}
      >
        {index + 1}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#7C2D12', marginBottom: 4 }}>{step.title}</div>
        <div style={{ ...smallBodyStyle, color: '#9A3412' }}>{step.body}</div>
      </div>
    </div>
  );
}

function JapaneseTitle({ jp, reading, romaji }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '5px 8px', marginBottom: 3 }}>
      <span className="jp" style={{ fontSize: 22, fontWeight: 900, color: '#1E1B4B', lineHeight: 1.2 }}>
        {jp}
      </span>
      <span className="jp" style={{ fontSize: 13, fontWeight: 800, color: 'var(--tp)' }}>
        {reading}
      </span>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8' }}>
        {romaji}
      </span>
    </div>
  );
}

function KanaTile({ kana, romaji, audioKana }) {
  return (
    <div
      style={{
        minHeight: 94,
        background: 'white',
        border: '1.5px solid #E5E7EB',
        borderRadius: 14,
        padding: '8px 4px 9px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
      }}
    >
      <div className="jp" style={{ fontSize: 26, fontWeight: 900, color: '#1E1B4B', lineHeight: 1 }}>
        {kana}
      </div>
      <div style={{ fontSize: 11, fontWeight: 900, color: '#94A3B8' }}>{romaji}</div>
      <KanaAudioButton kana={audioKana ?? kana} />
    </div>
  );
}

function PairedKanaRow({ pair }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr auto',
        alignItems: 'center',
        gap: 8,
        background: '#F8FAFC',
        border: '1.5px solid #E5E7EB',
        borderRadius: 14,
        padding: '10px',
      }}
    >
      <KanaPairBox label="平假名" kana={pair.hira} />
      <div style={{ fontSize: 18, fontWeight: 900, color: '#CBD5E1' }}>=</div>
      <KanaPairBox label="片假名" kana={pair.kata} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: '#94A3B8' }}>{pair.romaji}</span>
        <KanaAudioButton kana={pair.hira} />
      </div>
    </div>
  );
}

function KanaPairBox({ label, kana }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, fontWeight: 900, color: '#94A3B8', marginBottom: 2 }}>{label}</div>
      <div className="jp" style={{ fontSize: 28, fontWeight: 900, color: '#1E1B4B', lineHeight: 1.1 }}>{kana}</div>
    </div>
  );
}

function ScriptRoleBlock({ role }) {
  return (
    <div style={{ ...subPanelStyle, display: 'block', borderColor: `${role.color}33`, background: `${role.color}08` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div>
          <div className="jp" style={{ fontSize: 22, fontWeight: 900, color: role.color, lineHeight: 1.2 }}>{role.title}</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', marginTop: 2 }}>{role.reading}</div>
        </div>
        <div
          style={{
            alignSelf: 'flex-start',
            borderRadius: 999,
            background: 'white',
            border: `1.5px solid ${role.color}44`,
            color: role.color,
            fontSize: 11,
            fontWeight: 900,
            padding: '3px 9px',
            whiteSpace: 'nowrap',
          }}
        >
          {role.label}
        </div>
      </div>
      <div style={smallBodyStyle}>{role.body}</div>
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {role.examples.map(example => (
          <WordExampleRow key={example.jp} example={example} color={role.color} />
        ))}
      </div>
    </div>
  );
}

function WordExampleRow({ example, color }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        background: 'white',
        border: '1px solid #EEF2F7',
        borderRadius: 10,
        padding: '8px 9px',
      }}
    >
      <JapaneseSpeechButton text={example.jp} spokenText={example.reading} label={`播放「${example.jp}」`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px 8px' }}>
          <span className="jp" style={{ color, fontSize: 17, fontWeight: 900 }}>{example.jp}</span>
          <span className="jp" style={{ color: '#64748B', fontSize: 12, fontWeight: 800 }}>{example.reading}</span>
          <span style={{ color: '#94A3B8', fontSize: 11, fontWeight: 800 }}>{example.romaji}</span>
        </div>
        <div style={{ color: '#475569', fontSize: 12, fontWeight: 750, marginTop: 2 }}>{example.cn}</div>
      </div>
    </div>
  );
}

function PredicateCard({ item }) {
  return (
    <div style={{ ...subPanelStyle, alignItems: 'center' }}>
      <JapaneseSpeechButton text={item.example} spokenText={item.reading} label={`播放「${item.example}」`} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--tp)', marginBottom: 4 }}>{item.title}</div>
        <div className="jp" style={{ fontSize: 20, fontWeight: 900, color: '#1E1B4B' }}>{item.example}</div>
        <div className="jp" style={{ fontSize: 12, fontWeight: 800, color: '#64748B' }}>{item.reading}</div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>{item.romaji}</div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', flexShrink: 0 }}>{item.cn}</div>
    </div>
  );
}

function PolitenessPairCard({ pair }) {
  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1.5px solid #E5E7EB',
        borderRadius: 16,
        padding: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#1E1B4B' }}>{pair.label}</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#64748B', marginTop: 2 }}>{pair.cn}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <SpeechLine title="敬体" item={pair.polite} tone="#16A34A" />
        <SpeechLine title="普通形" item={pair.plain} tone="#F59E0B" />
      </div>
      <div style={{ ...smallBodyStyle, marginTop: 9 }}>{pair.note}</div>
    </div>
  );
}

function SpeechLine({ title, item, tone }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        background: 'white',
        border: '1px solid #EEF2F7',
        borderRadius: 12,
        padding: '8px 9px',
      }}
    >
      <JapaneseSpeechButton text={item.jp} spokenText={item.reading} label={`播放「${item.jp}」`} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: tone, marginBottom: 2 }}>{title}</div>
        <div className="jp" style={{ fontSize: 18, fontWeight: 900, color: '#1E1B4B', lineHeight: 1.35 }}>
          {item.jp}
        </div>
        <div className="jp" style={{ fontSize: 12, fontWeight: 800, color: 'var(--tp)', marginTop: 1 }}>
          {item.reading}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>{item.romaji}</div>
      </div>
    </div>
  );
}

function InfoBlock({ item }) {
  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1.5px solid #E5E7EB',
        borderRadius: 14,
        padding: '12px',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900, color: '#1E1B4B', marginBottom: 5 }}>{item.title}</div>
      <div style={smallBodyStyle}>{item.body}</div>
    </div>
  );
}

function SpecialYoonPatternCard({ group }) {
  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1.5px solid #E5E7EB',
        borderRadius: 16,
        padding: '12px',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900, color: '#1E1B4B', marginBottom: 5 }}>{group.label}</div>
      <div style={{ ...smallBodyStyle, marginBottom: 10 }}>{group.body}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {group.items.map(item => (
          <SpecialYoonKanaPill key={item.kana} item={item} />
        ))}
      </div>
    </div>
  );
}

function SpecialYoonKanaPill({ item }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'white',
        border: '1px solid #EEF2F7',
        borderRadius: 12,
        padding: '8px 9px',
      }}
    >
      <KanaAudioButton kana={item.audioKana} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="jp" style={{ fontSize: 19, fontWeight: 900, color: '#1E1B4B', lineHeight: 1.2 }}>
          {item.kana}
        </div>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#94A3B8', marginTop: 2 }}>{item.romaji}</div>
      </div>
    </div>
  );
}

function LoanwordContrastCard({ item }) {
  return (
    <div
      style={{
        background: '#FFF7ED',
        border: '1.5px solid #FED7AA',
        borderRadius: 16,
        padding: '12px',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900, color: '#7C2D12', marginBottom: 5 }}>{item.title}</div>
      <div style={{ ...smallBodyStyle, color: '#9A3412', marginBottom: 10 }}>{item.body}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <LoanwordMiniCard item={item.left} />
        <LoanwordMiniCard item={item.right} />
      </div>
    </div>
  );
}

function LoanwordMiniCard({ item }) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #FED7AA',
        borderRadius: 12,
        padding: '9px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <JapaneseSpeechButton text={item.jp} spokenText={item.reading} label={`播放「${item.jp}」`} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="jp" style={{ fontSize: 17, fontWeight: 900, color: '#1E1B4B', lineHeight: 1.3 }}>
          {item.jp}
        </div>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#F97316', marginTop: 1 }}>{item.romaji}</div>
        <div style={{ fontSize: 11, fontWeight: 750, color: '#64748B', marginTop: 3, lineHeight: 1.35 }}>{item.cn}</div>
      </div>
    </div>
  );
}

function KanjiReadingPairCard({ pair }) {
  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1.5px solid #E5E7EB',
        borderRadius: 16,
        padding: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <CharacterBox text={pair.kanji} active />
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#1E1B4B' }}>意思：{pair.meaning}</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', marginTop: 2 }}>
            同一个汉字，放进不同词里可能读不同音
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <ReadingExample label="训读" item={pair.kunyomi} tone="#16A34A" />
        <ReadingExample label="音读" item={pair.onyomi} tone="#2563EB" />
      </div>
    </div>
  );
}

function ReadingExample({ label, item, tone }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        background: 'white',
        border: '1px solid #EEF2F7',
        borderRadius: 12,
        padding: '8px 9px',
      }}
    >
      <JapaneseSpeechButton text={item.word} spokenText={item.reading} label={`播放「${item.word}」`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: tone, marginBottom: 2 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px 8px', flexWrap: 'wrap' }}>
          <span className="jp" style={{ fontSize: 18, fontWeight: 900, color: '#1E1B4B' }}>{item.word}</span>
          <span className="jp" style={{ fontSize: 12, fontWeight: 800, color: 'var(--tp)' }}>{item.reading}</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>{item.romaji}</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 750, color: '#475569', marginTop: 3 }}>{item.cn}</div>
      </div>
    </div>
  );
}

function FuriganaWordCard({ item }) {
  return (
    <div style={subPanelStyle}>
      <JapaneseSpeechButton text={item.text} spokenText={item.reading} label={`播放「${item.text}」`} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="jp" style={{ fontSize: 24, fontWeight: 900, color: '#1E1B4B', lineHeight: 2.1 }}>
          <RubyWord parts={item.ruby} />
        </div>
        <div className="jp" style={{ fontSize: 13, fontWeight: 800, color: 'var(--tp)', marginTop: -2 }}>
          {item.reading}
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', marginTop: 1 }}>{item.romaji}</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#475569', marginTop: 5 }}>{item.cn}</div>
      </div>
    </div>
  );
}

function RubyWord({ parts }) {
  return (
    <>
      {parts.map((part, index) => (
        part.ruby ? (
          <ruby key={`${part.base}-${part.ruby}-${index}`}>
            {part.base}
            <rt>{part.ruby}</rt>
          </ruby>
        ) : (
          <span key={`${part.base}-${index}`}>{part.base}</span>
        )
      ))}
    </>
  );
}

function ParticleCard({ item }) {
  return (
    <div style={subPanelStyle}>
      <KanaAudioButton kana={item.audioKana ?? item.particle} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span className="jp" style={{ fontSize: 26, fontWeight: 900, color: 'var(--tp)', lineHeight: 1 }}>
            {item.particle}
          </span>
          <span style={{ fontSize: 12, fontWeight: 900, color: '#94A3B8' }}>{item.romaji}</span>
          <span
            style={{
              borderRadius: 999,
              background: '#F3F2FF',
              color: 'var(--tp)',
              fontSize: 11,
              fontWeight: 900,
              padding: '2px 8px',
            }}
          >
            {item.title}
          </span>
        </div>
        <div style={{ ...smallBodyStyle, marginBottom: 9 }}>{item.body}</div>
        <div
          style={{
            background: 'white',
            border: '1px solid #EEF2F7',
            borderRadius: 10,
            padding: '8px 9px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <JapaneseSpeechButton text={item.example} spokenText={item.reading} label={`播放「${item.example}」`} />
          <div style={{ minWidth: 0 }}>
            <div className="jp" style={{ fontSize: 17, fontWeight: 900, color: '#1E1B4B' }}>{item.example}</div>
            <div className="jp" style={{ fontSize: 12, fontWeight: 800, color: 'var(--tp)' }}>{item.reading}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>{item.exampleRomaji}</div>
            <div style={{ fontSize: 12, fontWeight: 750, color: '#475569', marginTop: 3 }}>{item.cn}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoraGroup({ group }) {
  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1.5px solid #E5E7EB',
        borderRadius: 14,
        padding: '12px',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900, color: '#1E1B4B', marginBottom: 10 }}>{group.title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {group.items.map(item => (
          <MoraTile key={item.text} item={item} />
        ))}
      </div>
    </div>
  );
}

function MoraTile({ item }) {
  return (
    <div
      style={{
        minHeight: 104,
        background: 'white',
        border: '1.5px solid #E5E7EB',
        borderRadius: 14,
        padding: '9px 5px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
        textAlign: 'center',
      }}
    >
      <div className="jp" style={{ fontSize: 25, fontWeight: 900, color: '#1E1B4B', lineHeight: 1 }}>
        {item.text}
      </div>
      <div style={{ fontSize: 10, fontWeight: 900, color: '#94A3B8' }}>{item.romaji}</div>
      <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--tp)' }}>{item.mora}</div>
      {item.disabled ? (
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: '1.5px solid #E5E7EB',
            color: '#CBD5E1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          -
        </span>
      ) : (
        <KanaAudioButton kana={item.audioKana ?? item.text} />
      )}
    </div>
  );
}

function MoraWordCard({ word }) {
  return (
    <div style={{ ...subPanelStyle, display: 'block' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <JapaneseSpeechButton text={word.jp} spokenText={word.reading} label={`播放「${word.jp}」`} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <JapaneseTitle jp={word.jp} reading={word.reading} romaji={word.romaji} />
          <div style={{ fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 8 }}>{word.cn}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {word.beats.map((beat, index) => (
          <span
            key={`${word.jp}-${beat}-${index}`}
            className="jp"
            style={{
              minWidth: 34,
              height: 30,
              borderRadius: 10,
              background: beat === 'っ' ? '#FFF7ED' : '#F3F2FF',
              border: beat === 'っ' ? '1.5px solid #FDBA74' : '1.5px solid #DDD9FF',
              color: beat === 'っ' ? '#EA580C' : 'var(--tp)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              fontWeight: 900,
            }}
          >
            {beat}
          </span>
        ))}
      </div>
    </div>
  );
}

function LongVowelBlock({ group }) {
  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1.5px solid #E5E7EB',
        borderRadius: 16,
        padding: '12px',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900, color: '#1E1B4B', marginBottom: 5 }}>{group.title}</div>
      <div style={{ ...smallBodyStyle, marginBottom: 10 }}>{group.body}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {group.examples.map(example => (
          <WordExampleRow key={example.jp} example={example} color="#DB2777" />
        ))}
      </div>
    </div>
  );
}

function GojuonStructureCard({ group }) {
  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1.5px solid #E5E7EB',
        borderRadius: 16,
        padding: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#1E1B4B' }}>{group.title}</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>{group.reading}</div>
        </div>
      </div>
      <div style={{ ...smallBodyStyle, marginBottom: 10 }}>{group.body}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
        {group.items.map(item => (
          <KanaTile key={item.kana} kana={item.kana} romaji={item.romaji} />
        ))}
      </div>
    </div>
  );
}

function GojuonColumnCard({ column }) {
  return (
    <div
      style={{
        background: '#FAFAFF',
        border: '1.5px solid #E9E6FF',
        borderRadius: 16,
        padding: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#1E1B4B' }}>{column.title}</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>{column.reading}</div>
        </div>
      </div>
      <div style={{ ...smallBodyStyle, marginBottom: 10 }}>{column.body}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
        {column.items.map(kana => (
          <KanaTile key={`${column.title}-${kana}`} kana={kana} romaji={BASIC_KANA_ROMAJI[kana] ?? ''} />
        ))}
      </div>
    </div>
  );
}

function SoundGroupCard({ group }) {
  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1.5px solid #E5E7EB',
        borderRadius: 16,
        padding: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#1E1B4B' }}>{group.title}</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>{group.reading}</div>
        </div>
      </div>
      <div style={{ ...smallBodyStyle, marginBottom: 10 }}>{group.body}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {group.rows.map(row => (
          <SoundRow key={`${group.title}-${row.base}-${row.changed ?? row.base}`} row={row} />
        ))}
      </div>
    </div>
  );
}

function SoundRow({ row }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: row.changed ? '1fr auto 1fr auto' : '1fr auto',
        alignItems: 'center',
        gap: 8,
        background: 'white',
        border: '1px solid #EEF2F7',
        borderRadius: 12,
        padding: '8px',
      }}
    >
      <KanaPairBox label="原音" kana={row.base} />
      {row.changed ? (
        <>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#CBD5E1' }}>→</div>
          <KanaPairBox label="变化后" kana={row.changed} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#94A3B8' }}>{row.romaji}</span>
            <KanaAudioButton kana={row.changed} />
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: '#94A3B8' }}>{row.romaji}</span>
          <KanaAudioButton kana={row.base} />
        </div>
      )}
    </div>
  );
}

function OriginCard({ item }) {
  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1.5px solid #E5E7EB',
        borderRadius: 14,
        padding: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <CharacterBox text={item.kanji} />
        <div style={{ fontSize: 22, fontWeight: 900, color: '#CBD5E1' }}>→</div>
        <CharacterBox text={item.kana} active />
        <KanaAudioButton kana={item.audioKana ?? item.kana} />
        <div style={{ marginLeft: 'auto', minWidth: 0, textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--tp)' }}>{item.type}</div>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#94A3B8' }}>{item.romaji}</div>
        </div>
      </div>
      <div style={smallBodyStyle}>{item.note}</div>
    </div>
  );
}

function CharacterBox({ text, active = false }) {
  return (
    <div
      className="jp"
      style={{
        width: 48,
        height: 48,
        borderRadius: 14,
        background: active ? 'var(--tp-lite)' : 'white',
        border: active ? '1.5px solid var(--tp-bdr)' : '1.5px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 25,
        fontWeight: 900,
        color: active ? 'var(--tp)' : '#334155',
        flexShrink: 0,
      }}
    >
      {text}
    </div>
  );
}

function SentenceExample({ example }) {
  return (
    <div
      style={{
        background: '#FAFAFA',
        border: '1.5px solid #E5E7EB',
        borderRadius: 16,
        padding: '12px 12px 13px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <JapaneseSpeechButton text={example.jp} spokenText={example.reading} label={`播放「${example.jp}」`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="jp" style={{ fontSize: 20, fontWeight: 900, color: '#1E1B4B', lineHeight: 1.45 }}>
            {example.jp}
          </div>
          <div className="jp" style={{ fontSize: 12, fontWeight: 800, color: 'var(--tp)', marginTop: 2 }}>
            {example.reading}
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', marginTop: 1 }}>
            {example.romaji}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginTop: 5 }}>{example.cn}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 11 }}>
        {example.parts.map(part => (
          <div
            key={`${example.jp}-${part.label}-${part.role}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'white',
              border: '1px solid #EEF2F7',
              borderRadius: 10,
              padding: '7px 9px',
            }}
          >
            <span
              className="jp"
              style={{
                minWidth: 58,
                color: part.color,
                fontSize: 16,
                fontWeight: 900,
              }}
            >
              {part.label}
            </span>
            <span style={{ color: '#64748B', fontSize: 12, fontWeight: 800 }}>{part.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Timeline({ items }) {
  return (
    <div style={{ display: 'grid', gap: 9, marginTop: 12 }}>
      {items.map(item => (
        <div
          key={item.title}
          style={{
            background: '#F8FAFC',
            border: '1.5px solid #E5E7EB',
            borderRadius: 14,
            padding: '11px 12px',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 900, color: '#1E1B4B', marginBottom: 4 }}>{item.title}</div>
          <div style={smallBodyStyle}>{item.body}</div>
        </div>
      ))}
    </div>
  );
}

function ChecklistCard({ title, items }) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, var(--tp-from), var(--tp))',
        borderRadius: 18,
        padding: '18px 18px 20px',
        color: 'white',
        boxShadow: '0 4px 14px rgba(91,79,233,0.18)',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'grid', gap: 7, fontSize: 13, lineHeight: 1.65, fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>
        {items.map((item, index) => (
          <div key={item}>{index + 1}. {item}</div>
        ))}
      </div>
    </div>
  );
}

function InlineKana({ kana, romaji }) {
  return (
    <span
      className="jp"
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 3,
        background: '#F3F2FF',
        borderRadius: 8,
        padding: '1px 6px',
        color: 'var(--tp-deep)',
        fontWeight: 900,
        margin: '0 2px',
      }}
    >
      {kana}
      <span style={{ fontSize: 11, color: 'var(--tp)', fontFamily: 'var(--font-sans)' }}>{romaji}</span>
    </span>
  );
}

function KanaAudioButton({ kana }) {
  const audioKey = toGojuonAudioKey(kana);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const audioRef = useRef(null);
  const urlRef = useRef('');
  const disabled = !audioKey || !getGojuonAudioEntry(audioKey);

  const cleanup = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = '';
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const handlePlay = async () => {
    if (disabled) return;
    if (status === 'loading' || status === 'playing') {
      cleanup();
      setStatus('idle');
      return;
    }

    cleanup();
    setError('');
    setStatus('loading');

    try {
      const url = await createGojuonAudioUrl(audioKey);
      const audio = new Audio(url);
      audioRef.current = audio;
      urlRef.current = url;

      const finish = () => {
        cleanup();
        setStatus('idle');
      };

      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', () => {
        cleanup();
        setError('音频播放失败');
        setStatus('error');
      }, { once: true });

      await audio.play();
      setStatus('playing');
    } catch (err) {
      cleanup();
      setError(err?.message || '音频播放失败');
      setStatus('error');
    }
  };

  return (
    <button
      type="button"
      className="btn-press"
      onClick={handlePlay}
      disabled={disabled}
      aria-label={disabled ? `暂无「${kana}」音频` : `播放「${kana}」`}
      title={disabled ? `暂无「${kana}」音频` : error || `播放「${kana}」`}
      style={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        border: `1.5px solid ${status === 'error' ? '#FCA5A5' : '#DDD9FF'}`,
        background: status === 'playing' ? 'var(--tp)' : '#F8F7FF',
        color: status === 'playing' ? 'white' : 'var(--tp)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        padding: 0,
      }}
    >
      {status === 'loading' ? (
        <span style={{ fontSize: 11, fontWeight: 900 }}>...</span>
      ) : status === 'playing' ? (
        <span style={{ fontSize: 11, fontWeight: 900 }}>■</span>
      ) : (
        <SpeakerIcon />
      )}
    </button>
  );
}

function SpeakerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9.5v5h4l5 4v-13l-5 4H4Z" fill="currentColor" />
      <path d="M16 9a4.2 4.2 0 0 1 0 6M18.5 6.5a7.6 7.6 0 0 1 0 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function toGojuonAudioKey(kana) {
  const text = String(kana ?? '').trim();
  if (!text) return '';
  return text.replace(/[ァ-ン]/g, item => (
    String.fromCharCode(item.charCodeAt(0) - 0x60)
  ));
}

function PlaceholderTopic({ topic }) {
  return (
    <article
      style={{
        background: 'white',
        border: '2px solid #E5E7EB',
        borderRadius: 18,
        boxShadow: '0 3px 0 #E5E7EB',
        padding: '20px 18px 24px',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--tp)', marginBottom: 8 }}>
        {topic.subtitle}
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1E1B4B', margin: '0 0 12px', lineHeight: 1.25 }}>
        {topic.title}
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: '#6B7280', fontWeight: 600, margin: 0 }}>
        {topic.summary}
      </p>
      <div
        style={{
          marginTop: 18,
          borderRadius: 16,
          background: '#F8FAFC',
          border: '1.5px dashed #CBD5E1',
          padding: '18px 14px',
          color: '#94A3B8',
          fontSize: 13,
          fontWeight: 800,
          textAlign: 'center',
        }}
      >
        教程内容准备中
      </div>
    </article>
  );
}

function MissingTopic() {
  return (
    <div
      style={{
        background: 'white',
        border: '1.5px dashed #DDD6FE',
        borderRadius: 18,
        padding: '44px 20px',
        textAlign: 'center',
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: 800,
      }}
    >
      没有找到这篇教程
    </div>
  );
}

const paragraphStyle = {
  fontSize: 14,
  lineHeight: 1.85,
  color: '#374151',
  fontWeight: 600,
  margin: '0 0 10px',
};

const smallBodyStyle = {
  fontSize: 12,
  fontWeight: 650,
  color: '#64748B',
  lineHeight: 1.65,
};

const subPanelStyle = {
  background: '#FAFAFF',
  border: '1.5px solid #E9E6FF',
  borderRadius: 14,
  padding: '12px 12px 13px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
};

const kanaGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: 8,
  marginTop: 12,
};
