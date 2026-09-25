import type { LanguageId, DifficultyMode } from '../types';

export const ENGLISH_NORMAL_WORDS: string[] = [
  'the', 'be', 'of', 'and', 'a', 'to', 'in', 'he', 'have', 'it', 'that', 'for', 'they', 'I', 'with', 'as',
  'not', 'on', 'she', 'at', 'by', 'this', 'we', 'you', 'do', 'but', 'from', 'or', 'which', 'one', 'would',
  'all', 'will', 'there', 'say', 'who', 'make', 'when', 'can', 'more', 'if', 'no', 'man', 'out', 'other',
  'so', 'what', 'time', 'up', 'go', 'about', 'than', 'into', 'could', 'state', 'only', 'new', 'year', 'some',
  'take', 'come', 'these', 'know', 'see', 'use', 'get', 'like', 'then', 'first', 'any', 'work', 'now', 'may',
  'such', 'give', 'over', 'think', 'most', 'even', 'find', 'day', 'also', 'after', 'way', 'many', 'must',
  'look', 'before', 'great', 'back', 'through', 'long', 'where', 'much', 'should', 'well', 'people', 'down',
  'own', 'just', 'because', 'good', 'each', 'those', 'feel', 'seem', 'how', 'high', 'too', 'place', 'little',
  'world', 'very', 'still', 'nation', 'hand', 'old', 'life', 'tell', 'write', 'become', 'here', 'show', 'house',
  'both', 'between', 'need', 'mean', 'call', 'develop', 'under', 'last', 'right', 'move', 'thing', 'general',
  'school', 'never', 'same', 'another', 'begin', 'while', 'number', 'part', 'turn', 'real', 'leave', 'might',
  'want', 'point', 'form', 'child', 'small', 'since', 'against', 'late', 'home', 'interest', 'large', 'person',
  'end', 'open', 'public', 'follow', 'during', 'present', 'without', 'again', 'hold', 'govern', 'around',
  'possible', 'head', 'consider', 'word', 'program', 'problem', 'however', 'lead', 'system', 'set', 'order',
  'eye', 'plan', 'run', 'keep', 'face', 'fact', 'group', 'play', 'stand', 'increase', 'early', 'course', 'change',
  'help', 'line'
];

// Hard tier: long, rare, and awkward-to-type words plus heavy punctuation.
export const ENGLISH_HARD_WORDS: string[] = [
  'acquaintance', 'bureaucracy', 'conscientious', 'dialectical', 'ephemeral', 'fluorescent', 'grotesque',
  'hierarchical', 'idiosyncrasy', 'juxtaposition', 'kaleidoscope', 'liquefaction', 'methodical', 'nonchalant',
  'obfuscation', 'phenomenon', 'quintessential', 'reconnaissance', 'simultaneous', 'threnody', 'ubiquitous',
  'vernacular', 'welterweight', 'xylophonist', 'zeitgeist', 'archipelago', 'bourgeoisie', 'chiaroscuro',
  'déjà', 'entrepôt', 'fauxpas', 'grandiloquent', 'heterogeneous', 'iconoclast', 'jurisprudence', 'kerfuffle',
  'laryngoscope', 'mnemonic', 'nomenclature', 'ophthalmologist', 'perspicacious', 'querulous', 'rambunctious',
  'surreptitious', 'tautological', 'unprecedented', 'vicissitude', 'warranty', 'xenophobia', 'yachtsman',
  'zephyr', 'rhythmical', 'larynx', 'sphinx', 'gazebo', 'quixotic', 'onomatopoeia', 'hippopotamus',
  'threshold', 'wretched', 'squelch', 'wrench', 'sphincter', 'strengths', 'glimpsed', 'jigsawed',
  'synchronize', 'backslash', 'bracket', 'semicolon', 'hyphenate', 'underscore', 'parenthesis', 'quotation',
  'exclamation', 'interrobang', 'punctuation', 'typographical', 'keystroke', 'keyboardist', 'stenographer',
  'shorthand', 'typist', 'stenography', 'chirography', 'paleography', 'calligrapher', 'typographer',
  'labyrinthine', 'inconsequential', 'uncharacteristically', 'internationalization', 'counterintuitive',
  'misunderestimate', 'antidisestablishmentarianism', 'honorificabilitudinitatibus'
];

export const ENGLISH_ADVANCED_WORDS: string[] = [
  'accommodate', 'achievement', 'acquire', 'aggressive', 'amateur', 'apparent', 'argument', 'athlete', 'calendar',
  'category', 'cemetery', 'colleague', 'column', 'committed', 'conscience', 'conscious', 'consensus', 'convenient',
  'definitely', 'discipline', 'embarrass', 'equipment', 'exaggerate', 'existence', 'experience', 'fascinating',
  'foreign', 'guarantee', 'guidance', 'hierarchy', 'humorous', 'ignorance', 'imitate', 'immediately', 'independent',
  'intelligence', 'interrupt', 'judgment', 'knowledge', 'leisure', 'liaison', 'license', 'maintenance', 'maneuver',
  'medieval', 'mischievous', 'necessary', 'neighbor', 'noticeable', 'occasionally', 'occurrence', 'parallel',
  'parliament', 'perseverance', 'possession', 'preferable', 'privilege', 'pronunciation', 'questionnaire',
  'recommend', 'relevant', 'religious', 'restaurant', 'rhythm', 'schedule', 'separate', 'sergeant', 'successful',
  'supersede', 'surprise', 'temperament', 'tendency', 'threshold', 'tomorrow', 'twelfth', 'tyranny', 'unforeseen',
  'unnecessary', 'vacuum', 'vicious', 'weather', 'weird', 'withhold', 'yield', 'algorithm', 'complexity', 'infrastructure',
  'architecture', 'cybersecurity', 'cryptography', 'asynchronous', 'concurrency', 'optimization', 'distributed'
];

export const SPANISH_WORDS: string[] = [
  'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'se', 'del', 'las', 'un', 'por', 'con', 'no', 'una', 'su',
  'para', 'es', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'fue', 'este', 'ha', 'sí', 'porque',
  'esta', 'son', 'entre', 'está', 'cuando', 'muy', 'sin', 'sobre', 'ser', 'tiene', 'también', 'me', 'hasta',
  'hay', 'donde', 'han', 'quien', 'están', 'estado', 'desde', 'todo', 'nos', 'durante', 'estados', 'todos', 'uno',
  'les', 'ni', 'contra', 'otros', 'fueron', 'ese', 'eso', 'había', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes',
  'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes',
  'nada', 'muchos', 'cual', 'sea', 'poco', 'ella', 'estar', 'haber', 'estas', 'estaba', 'tenía', 'tiempo'
];

export const FRENCH_WORDS: string[] = [
  'de', 'la', 'le', 'et', 'les', 'des', 'en', 'un', 'du', 'une', 'que', 'est', 'pour', 'qui', 'dans', 'a',
  'par', 'sur', 'au', 'plus', 'ce', 'pas', 'avec', 'ne', 'se', 'sont', 'il', 'aux', 'ou', 'on', 'mais', 'nous',
  'comme', 'son', 'sa', 'ses', 'cette', 'tout', 'été', 'aussi', 'faire', 'ils', 'deux', 'ces', 'fait', 'même',
  'leur', 'bien', 'peut', 'encore', 'temps', 'tous', 'si', 'sans', 'sous', 'notre', 'autres', 'entre', 'premier',
  'très', 'après', 'leurs', 'mon', 'donc', 'dire', 'tous', 'avoir', 'ans', 'grande', 'voir', 'vers', 'lui'
];

export const GERMAN_WORDS: string[] = [
  'der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem',
  'nicht', 'ein', 'eine', 'als', 'auch', 'es', 'an', 'werden', 'aus', 'er', 'hat', 'dass', 'sie', 'nach', 'wird',
  'bei', 'einer', 'um', 'am', 'sind', 'noch', 'wie', 'einem', 'über', 'einen', 'so', 'sie', 'war', 'haben',
  'nur', 'oder', 'aber', 'vor', 'zur', 'bis', 'mehr', 'durch', 'man', 'sein', 'wurde', 'sei', 'prozent', 'hatte',
  'kann', 'gegen', 'vom', 'können', 'schon', 'wenn', 'habe', 'seine', 'ihre', 'dann', 'unter', 'wir', 'soll'
];

export const ITALIAN_WORDS: string[] = [
  'di', 'e', 'il', 'la', 'in', 'che', 'per', 'un', 'del', 'non', 'i', 'a', 'da', 'una', 'si', 'le', 'ha', 'con',
  'della', 'dei', 'delle', 'al', 'è', 'nel', 'più', 'sono', 'sul', 'anche', 'dall', 'come', 'alla', 'gli', 'questo',
  'dalla', 'tra', 'dopo', 'stato', 'prima', 'loro', 'ed', 'due', 'suo', 'sua', 'modo', 'ogni', 'tutti', 'fatto',
  'anni', 'grande', 'tempo', 'cosa', 'essere', 'bene', 'senza', 'molto', 'tanto', 'ancora', 'solo', 'mentre', 'casa'
];

export const PORTUGUESE_WORDS: string[] = [
  'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no', 'se', 'na',
  'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua', 'ou', 'quando',
  'muito', 'nos', 'já', 'está', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela', 'entre', 'era', 'depois',
  'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'me', 'esse', 'eles', 'estão', 'você', 'tinha', 'foram', 'essa'
];

export const RUSSIAN_WORDS: string[] = [
  'и', 'в', 'не', 'на', 'я', 'быть', 'он', 'с', 'что', 'а', 'по', 'это', 'она', 'этот', 'к', 'но', 'они', 'мы',
  'как', 'из', 'у', 'который', 'то', 'за', 'свой', 'что', 'весь', 'год', 'от', 'так', 'о', 'для', 'ты', 'же',
  'все', 'тот', 'мочь', 'вы', 'человек', 'такой', 'его', 'сказать', 'только', 'или', 'еще', 'бы', 'себя', 'один',
  'как', 'уже', 'до', 'время', 'если', 'сам', 'когда', 'другой', 'вот', 'говорить', 'наш', 'мой', 'знать', 'стать'
];

export const CODE_WORDS: string[] = [
  'const', 'let', 'function', 'return', 'import', 'export', 'default', 'async', 'await', 'class', 'interface',
  'type', 'extends', 'implements', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'typeof', 'instanceof',
  'switch', 'case', 'break', 'continue', 'if', 'else', 'for', 'while', 'null', 'undefined', 'true', 'false',
  'console.log()', 'Promise.resolve()', 'Array.prototype.map()', 'document.getElementById()', 'setTimeout()',
  'JSON.parse()', 'JSON.stringify()', 'Object.keys()', 'addEventListener()', 'filter()', 'reduce()', 'useState()',
  'useEffect()', 'useCallback()', 'useMemo()', 'useRef()', 'props', 'state', 'render()', 'componentDidMount()'
];

export const TEXT_PRACTICE_PARAGRAPHS = [
  {
    title: 'The Art of Typing Fast',
    author: 'GorillaType',
    text: 'Typing is not just about moving your fingers rapidly across the keyboard. It is a harmonious dance between your eyes, mind, and hands. When you achieve flow state, words materialize directly from thought onto the screen without conscious effort.',
  },
  {
    title: 'The Great Gatsby Opening',
    author: 'F. Scott Fitzgerald',
    text: 'In my younger and more vulnerable years my father gave me some advice that I have been turning over in my mind ever since. Whenever you feel like criticizing anyone, just remember that all the people in this world have not had the advantages that you have had.',
  },
  {
    title: 'Coding & Architecture',
    author: 'Clean Code',
    text: 'Programming is the art of telling another human being what one wants the computer to do. Clean code always looks like it was written by someone who cares. There is nothing obvious you can do to make it better.',
  },
  {
    title: 'Speed & Accuracy',
    author: 'Typing Pro',
    text: 'Do not hurry, focus on precision. Speed is a natural byproduct of accuracy and muscle memory. The moment you stop looking at your fingers and let tactile intuition guide you, your words per minute will soar.',
  }
];

export function getRandomWords(language: LanguageId, difficulty: DifficultyMode, count: number = 250): string[] {
  let pool: string[] = ENGLISH_NORMAL_WORDS;

  if (language === 'english') {
    // Easy reuses the classic common-word bank; Medium upgrades to the old
    // advanced vocabulary; Hard mixes a brand-new very-hard word bank with
    // punctuation decoration below.
    pool = difficulty === 'easy' ? ENGLISH_NORMAL_WORDS : difficulty === 'hard' ? ENGLISH_HARD_WORDS : ENGLISH_ADVANCED_WORDS;
  } else if (language === 'english-advanced') {
    pool = ENGLISH_ADVANCED_WORDS;
  } else if (language === 'spanish') {
    pool = SPANISH_WORDS;
  } else if (language === 'french') {
    pool = FRENCH_WORDS;
  } else if (language === 'german') {
    pool = GERMAN_WORDS;
  } else if (language === 'italian') {
    pool = ITALIAN_WORDS;
  } else if (language === 'portuguese') {
    pool = PORTUGUESE_WORDS;
  } else if (language === 'russian') {
    pool = RUSSIAN_WORDS;
  } else if (language === 'code') {
    pool = CODE_WORDS;
  }

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    let word = pool[randomIndex];

    if (difficulty === 'hard' && language !== 'code') {
      // Hard tier: capitalisation, commas, periods, quotes, semicolons, hyphens
      // and clusters of tricky technical words.
      const rand = Math.random();
      if (rand < 0.2) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      } else if (rand < 0.28) {
        word = word + ',';
      } else if (rand < 0.35) {
        word = word + '.';
      } else if (rand < 0.4) {
        word = `"${word}"`;
      } else if (rand < 0.45) {
        word = word + ';';
      } else if (rand < 0.5) {
        word = word.charAt(0).toUpperCase() + word.slice(1) + '-Typist';
      } else if (rand < 0.55) {
        word = `(${word})`;
      }
    } else if (difficulty === 'medium' && language !== 'code') {
      // Medium tier: the original "advanced" decoration levels.
      const rand = Math.random();
      if (rand < 0.15) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      } else if (rand < 0.22) {
        word = word + ',';
      } else if (rand < 0.28) {
        word = word + '.';
      } else if (rand < 0.32) {
        word = `"${word}"`;
      }
    }

    result.push(word);
  }
  return result;
}
