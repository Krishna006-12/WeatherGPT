/**
 * Crop Intelligence catalog — grounded advisory rules (NOT fake yields / stages).
 * Extend CROP_CATALOG to add crops; aliases feed entity detection + geocode blocklist.
 */

export const CROP_CATALOG = {
  wheat: {
    id: 'wheat',
    names: ['wheat', 'gehun', 'gehu', 'गेहूँ', 'गेहूं', 'गेंहू'],
    name_en: 'Wheat',
    name_hi: 'गेहूँ',
    season_en: 'Rabi · sow ~Oct–Dec, harvest ~Mar–Apr (N. India)',
    season_hi: 'रबी · बुआई ~अक्टू–दिस, कटाई ~मार्च–अप्रैल',
    water_en: 'Critical irrigations at crown root, tillering, jointing, flowering, milk stage.',
    water_hi: 'क्राउन रूट, टिलरिंग, गांठ, फूल, दूधिया अवस्था पर सिंचाई महत्वपूर्ण।',
    rain_en: 'Heavy rain near harvest → lodging & spoilage. Prefer dry spell for threshing.',
    rain_hi: 'कटाई के पास तेज़ बारिश → गिरना/सड़न। मड़ाई सूखे मौसम में।',
    spray_en: 'Spray in calm wind, low rain chance; morning preferred.',
    spray_hi: 'कम हवा, कम बारिश संभावना; सुबह छिड़काव बेहतर।',
    heat_en: 'Terminal heat (>32–35°C at grain fill) may cut yield if soil is dry.',
    heat_hi: 'दाना भरते >32–35°C गर्मी पैदावार घटा सकती है।',
    cool_en: 'Mild cool weather generally suits vegetative wheat in season.',
    cool_hi: 'सीजन में हल्की ठंड वनस्पति गेहूँ के अनुकूल।',
  },
  rice: {
    id: 'rice',
    names: ['rice', 'paddy', 'dhan', 'chawal', 'धान', 'चावल', 'padi'],
    name_en: 'Rice',
    name_hi: 'धान',
    season_en: 'Kharif dominant; drainage before harvest.',
    season_hi: 'खरीफ मुख्य; कटाई से पहले निकासी।',
    water_en: 'Maintain field water by stage; storms may breach bunds.',
    water_hi: 'अवस्था अनुसार पानी; तूफान में मेड़ जाँचें।',
    rain_en: 'Useful vegetatively; excess at flowering/harvest can cut quality.',
    rain_hi: 'वनस्पति में उपयोगी; फूल/कटाई पर अधिक वर्षा गुणवत्ता घटाए।',
    spray_en: 'Plant protection in rain-free calm morning slots.',
    spray_hi: 'बारिश-मुक्त शांत सुबह में सुरक्षा स्प्रे।',
    heat_en: 'Extreme heat at flowering can cause sterility where water is short.',
    heat_hi: 'फूल पर भीषण गर्मी + कम पानी → बंध्यता जोखिम।',
    cool_en: 'Cool snaps less critical than heat/waterlogging for paddy.',
    cool_hi: 'धान के लिए ठंड से अधिक जलभराव/गर्मी महत्त्वपूर्ण।',
  },
  maize: {
    id: 'maize',
    names: ['maize', 'corn', 'makka', 'मक्का', 'bhutta', 'भुट्टा'],
    name_en: 'Maize',
    name_hi: 'मक्का',
    season_en: 'Kharif/rabi by zone; moisture critical at tassel & grain fill.',
    season_hi: 'क्षेत्र अनुसार; फूल व दाना भरने पर नमी ज़रूरी।',
    water_en: 'Irrigate at knee-high, tasseling, silking, grain fill if dry.',
    water_hi: 'घुटने, फूल, सिल्किंग, दाना भरने पर सूखा हो तो सिंचाई।',
    rain_en: 'Good if not waterlogged; storms can lodge tall plants.',
    rain_hi: 'जलभराव न हो तो अच्छी; तूफान से गिरने का खतरा।',
    spray_en: 'Stem borer / FAW sprays only in dry calm weather.',
    spray_hi: 'तना छेदक/FAW स्प्रे केवल सूखे शांत मौसम।',
    heat_en: 'Heat at silking reduces pollination — keep soil moisture.',
    heat_hi: 'सिल्किंग पर गर्मी परागण घटाए — मिट्टी नमी रखें।',
    cool_en: 'Cool nights usually fine; frost is a risk in exposed pockets.',
    cool_hi: 'ठंडी रातें अक्सर ठीक; खुले क्षेत्रों में पाला जोखिम।',
  },
  barley: {
    id: 'barley',
    names: ['barley', 'jau', 'जौ'],
    name_en: 'Barley',
    name_hi: 'जौ',
    season_en: 'Rabi cereal; similar moisture pattern to wheat, often hardier.',
    season_hi: 'रबी अनाज; गेहूँ-जैसी नमी, अक्सर अधिक सहिष्णु।',
    water_en: 'Limited irrigation; avoid excess water near maturity.',
    water_hi: 'सीमित सिंचाई; पकने पर अधिक पानी से बचें।',
    rain_en: 'Unseasonal rain at maturity hurts grain quality.',
    rain_hi: 'पकने पर बेमौसम बारिश गुणवत्ता खराब करे।',
    spray_en: 'Disease sprays in dry calm windows only.',
    spray_hi: 'रोग स्प्रे केवल सूखे शांत विंडो में।',
    heat_en: 'Terminal heat shortens grain fill.',
    heat_hi: 'अंत की गर्मी दाना भरना छोटा करे।',
    cool_en: 'Cool rabi weather is generally favourable.',
    cool_hi: 'रबी की ठंड आम तौर पर अनुकूल।',
  },
  millet: {
    id: 'millet',
    names: ['millet', 'bajra', 'bajri', 'बाजरा', 'ragi', 'रागी', 'foxtail millet', 'jowar millet'],
    name_en: 'Millet',
    name_hi: 'बाजरा / मिलट',
    season_en: 'Mostly kharif; drought-tolerant vs many cereals.',
    season_hi: 'अक्सर खरीफ; कई अनाजों से अधिक सूखा-सहिष्णु।',
    water_en: 'Light irrigation only on prolonged dry stress at flowering.',
    water_hi: 'फूल पर लंबे सूखे पर ही हल्की सिंचाई।',
    rain_en: 'Well-distributed rain helps; waterlogging harms.',
    rain_hi: 'बंटी बारिश मदद; जलभराव हानि।',
    spray_en: 'Pest sprays in dry weather only.',
    spray_hi: 'कीट स्प्रे केवल सूखे मौसम।',
    heat_en: 'Handles heat better than maize/wheat; still needs moisture at grain fill.',
    heat_hi: 'गर्मी सहन बेहतर; दाना भरते नमी चाहिए।',
    cool_en: 'Cool weather ok outside frost risk.',
    cool_hi: 'पाला न हो तो ठंड ठीक।',
  },
  sorghum: {
    id: 'sorghum',
    names: ['sorghum', 'jowar', 'ज्वार', 'jwari'],
    name_en: 'Sorghum',
    name_hi: 'ज्वार',
    season_en: 'Kharif/rabi forage & grain; drought hardy.',
    season_hi: 'खरीफ/रबी चारा व अनाज; सूखा-सहिष्णु।',
    water_en: 'Irrigate mainly if long dry spell at flowering.',
    water_hi: 'फूल पर लंबे सूखे पर मुख्य सिंचाई।',
    rain_en: 'Excess wetness can raise mould risk on grain heads.',
    rain_hi: 'अधिक नमी दाने पर फफूंद जोखिम।',
    spray_en: 'Shoot fly / stem borer sprays in calm dry slots.',
    spray_hi: 'तने/मक्खी स्प्रे शांत सूखे स्लॉट में।',
    heat_en: 'Generally heat tolerant with adequate soil moisture.',
    heat_hi: 'मिट्टी नमी हो तो गर्मी सहिष्णु।',
    cool_en: 'Cool dry weather often favourable for grain sorghum.',
    cool_hi: 'ठंडा सूखा मौसम अक्सर अनुकूल।',
  },
  sugarcane: {
    id: 'sugarcane',
    names: ['sugarcane', 'ganna', 'गन्ना', 'cane'],
    name_en: 'Sugarcane',
    name_hi: 'गन्ना',
    season_en: 'Long duration; irrigation critical in dry spells.',
    season_hi: 'लंबी फसल; सूखे में सिंचाई ज़रूरी।',
    water_en: 'Deep irrigation on schedule; skip if soil already wet from rain.',
    water_hi: 'निर्धारित गहरी सिंचाई; बारिश से गीली हो तो छोड़ें।',
    rain_en: 'Good if drainage OK; stagnant water invites disease.',
    rain_hi: 'निकासी हो तो अच्छी; ठहरा पानी रोग बढ़ाए।',
    spray_en: 'Pest sprays only in dry calm weather.',
    spray_hi: 'कीट स्प्रे केवल सूखे शांत मौसम।',
    heat_en: 'Heat + moisture stress → irrigate; trash mulch helps.',
    heat_hi: 'गर्मी + नमी तनाव → सिंचाई; ट्रैश मल्च मदद।',
    cool_en: 'Cool dry spells slow growth but rarely critical alone.',
    cool_hi: 'ठंड वृद्धि धीमी करे पर अकेले कम गंभीर।',
  },
  cotton: {
    id: 'cotton',
    names: ['cotton', 'kapas', 'कपास'],
    name_en: 'Cotton',
    name_hi: 'कपास',
    season_en: 'Kharif; avoid waterlogging; rain on open boll stains fibre.',
    season_hi: 'खरीफ; जलभराव से बचें; खुली डोडी पर बारिश रेशा खराब करे।',
    water_en: 'Irrigate on stress signs; skip if rain filled the profile.',
    water_hi: 'तनाव पर सिंचाई; बारिश से नमी भरी हो तो छोड़ें।',
    rain_en: 'Excess wetness → boll rot / humidity pests.',
    rain_hi: 'अधिक नमी → डोडी सड़न / रसचूसक कीट।',
    spray_en: 'IPM sprays in dry calm weather only; observe PHI.',
    spray_hi: 'आईपीएम स्प्रे सूखे शांत मौसम; PHI मानें।',
    heat_en: 'High heat + dry wind can increase square drop.',
    heat_hi: 'गर्मी + सूखी हवा से फूल झड़ना बढ़ सकता है।',
    cool_en: 'Cool cloudy spells may slow flowering.',
    cool_hi: 'ठंडा बादल मौसम फूल धीमा कर सकता है।',
  },
  potato: {
    id: 'potato',
    names: ['potato', 'aloo', 'alu', 'आलू', 'potatoes'],
    name_en: 'Potato',
    name_hi: 'आलू',
    season_en: 'Rabi in plains; avoid waterlogging.',
    season_hi: 'मैदानी रबी; जलभराव से बचें।',
    water_en: 'Even moisture; stop heavy water before harvest.',
    water_hi: 'नमी समान; कटाई से पहले भारी पानी बंद।',
    rain_en: 'Continuous rain → late blight risk; keep drainage.',
    rain_hi: 'लगातार बारिश → झुलसा; निकासी रखें।',
    spray_en: 'Blight sprays before wet spells; not in rain/high wind.',
    spray_hi: 'गीले मौसम से पहले झुलसा स्प्रे।',
    heat_en: 'Heat + dry soil stresses tubers.',
    heat_hi: 'गर्मी + सूखी मिट्टी कंद पर जोर।',
    cool_en: 'Cool weather generally suits tuber bulking.',
    cool_hi: 'ठंड कंद भरने के लिए आम तौर पर अनुकूल।',
  },
  tomato: {
    id: 'tomato',
    names: ['tomato', 'tamatar', 'टमाटर'],
    name_en: 'Tomato',
    name_hi: 'टमाटर',
    season_en: 'Multi-season; fruit crack if heavy rain after dry spell.',
    season_hi: 'कई सीजन; सूखे बाद तेज़ बारिश से फल फटना।',
    water_en: 'Regular moisture; drip preferred. Avoid flood at ripening.',
    water_hi: 'नियमित नमी; पकते समय बाढ़ सिंचाई न करें।',
    rain_en: 'Wet foliage → blight; stake & airflow help.',
    rain_hi: 'गीली पत्ती → झुलसा; सहारा व हवा का बहाव मदद।',
    spray_en: 'Protective sprays before wet spells.',
    spray_hi: 'गीले मौसम से पहले सुरक्षा स्प्रे।',
    heat_en: 'High heat causes flower drop.',
    heat_hi: 'तेज़ गर्मी से फूल झड़ना।',
    cool_en: 'Mild cool often good for fruit set if frost-free.',
    cool_hi: 'हल्की ठंड फल सेट के लिए अक्सर अच्छी (पाला-मुक्त)।',
  },
  onion: {
    id: 'onion',
    names: ['onion', 'pyaz', 'piyaz', 'प्याज'],
    name_en: 'Onion',
    name_hi: 'प्याज',
    season_en: 'Region-dependent; bulbs need dry weather near harvest.',
    season_hi: 'क्षेत्र अनुसार; कटाई के पास सूखा मौसम बेहतर।',
    water_en: 'Light frequent water; stop ~10–15 days before harvest if possible.',
    water_hi: 'हल्की बार-बार सिंचाई; कटाई 10–15 दिन पहले बंद करें।',
    rain_en: 'Rain at maturity delays curing & storage life.',
    rain_hi: 'पकने पर बारिश सुखाई/भंडारण खराब करे।',
    spray_en: 'Thrips/blight sprays in dry weather.',
    spray_hi: 'थ्रिप्स/झुलसा स्प्रे सूखे मौसम।',
    heat_en: 'Heat accelerates bulbing; excess stress needs light water.',
    heat_hi: 'गर्मी बल्बिंग तेज़ करे; तनाव पर हल्की सिंचाई।',
    cool_en: 'Cool dry spells help curing after harvest.',
    cool_hi: 'कटाई बाद ठंडा सूखा मौसम सुखाई मदद।',
  },
  mustard: {
    id: 'mustard',
    names: ['mustard', 'sarson', 'सरसों', 'राई', 'mustard oil'],
    name_en: 'Mustard',
    name_hi: 'सरसों',
    season_en: 'Rabi oilseed; dislikes waterlogging & rain at maturity.',
    season_hi: 'रबी तिलहन; जलभराव व पकने पर बारिश हानिकारक।',
    water_en: 'Often 1–2 light irrigations if rain fails.',
    water_hi: 'बारिश कम हो तो 1–2 हल्की सिंचाई।',
    rain_en: 'Rain at flowering/pod fill raises disease & shatter risk.',
    rain_hi: 'फूल/फली पर बारिश रोग व झड़ने का खतरा।',
    spray_en: 'Aphid control in dry weather; not before rain.',
    spray_hi: 'माहू नियंत्रण सूखे मौसम; बारिश से पहले नहीं।',
    heat_en: 'Sudden heat shortens grain fill.',
    heat_hi: 'अचानक गर्मी दाना भरना छोटा करे।',
    cool_en: 'Cool rabi weather generally favourable.',
    cool_hi: 'रबी की ठंड आम तौर पर अनुकूल।',
  },
  soybean: {
    id: 'soybean',
    names: ['soybean', 'soya', 'soy', 'सोयाबीन', 'सोया'],
    name_en: 'Soybean',
    name_hi: 'सोयाबीन',
    season_en: 'Kharif; early waterlogging very harmful.',
    season_hi: 'खरीफ; शुरुआती जलभराव बहुत हानिकारक।',
    water_en: 'Mostly rainfed; irrigate only on long dry stress at flowering/pod.',
    water_hi: 'अक्सर वर्षा आधारित; फूल/फली पर लंबे सूखे पर सिंचाई।',
    rain_en: 'Distributed rain good; continuous heavy rain → root issues.',
    rain_hi: 'बंटी बारिश अच्छी; लगातार तेज़ बारिश जड़ समस्या।',
    spray_en: 'Caterpillar sprays in dry windows.',
    spray_hi: 'इल्ली स्प्रे सूखे मौसम की खिड़की में।',
    heat_en: 'Heat + drought at pod fill cuts yield.',
    heat_hi: 'फली भरते गर्मी+सूखा पैदावार काटे।',
    cool_en: 'Mild cool less critical than wet feet / heat stress.',
    cool_hi: 'गीली जड़/गर्मी से अधिक महत्त्वपूर्ण नहीं।',
  },
  groundnut: {
    id: 'groundnut',
    names: ['groundnut', 'peanut', 'moongphali', 'mungfali', 'मूंगफली', 'ground nut'],
    name_en: 'Groundnut',
    name_hi: 'मूंगफली',
    season_en: 'Kharif/rabi by region; needs well-drained soil.',
    season_hi: 'क्षेत्र अनुसार; अच्छी निकासी वाली मिट्टी।',
    water_en: 'Critical moisture at flowering & pegging; avoid excess at harvest.',
    water_hi: 'फूल व पेगिंग पर नमी; कटाई पर अधिक पानी से बचें।',
    rain_en: 'Heavy rain at harvest makes digging hard & spoils pods.',
    rain_hi: 'कटाई पर तेज़ बारिश खोदाई कठिन व फली खराब।',
    spray_en: 'Leaf miner / leaf spot sprays in dry weather.',
    spray_hi: 'पत्ती धब्बा स्प्रे सूखे मौसम।',
    heat_en: 'Heat with dry soil at pegging reduces pods.',
    heat_hi: 'पेगिंग पर गर्मी+सूखी मिट्टी फलियाँ घटाए।',
    cool_en: 'Cool dry harvest weather is favourable.',
    cool_hi: 'कटाई पर ठंडा सूखा मौसम अनुकूल।',
  },
  chickpea: {
    id: 'chickpea',
    names: ['chickpea', 'chana', 'gram', 'चना', 'chole', 'chhole'],
    name_en: 'Chickpea',
    name_hi: 'चना',
    season_en: 'Rabi pulse; dislikes excess moisture.',
    season_hi: 'रबी दलहन; अधिक नमी से बचें।',
    water_en: 'Often one irrigation at branching/pre-flower if dry.',
    water_hi: 'सूखा हो तो शाखा/फूल से पहले 1 सिंचाई।',
    rain_en: 'Unseasonal rain at maturity → sprouting risk.',
    rain_hi: 'पकने पर बेमौसम बारिश → खेत में उगने का खतरा।',
    spray_en: 'Pod borer sprays in calm dry slots.',
    spray_hi: 'फली छेदक स्प्रे शांत सूखी सुबह/शाम।',
    heat_en: 'Terminal heat shortens pod fill.',
    heat_hi: 'अंत की गर्मी फली भरना छोटा करे।',
    cool_en: 'Cool dry rabi weather generally suits chana.',
    cool_hi: 'ठंडा सूखा रबी मौसम चना के अनुकूल।',
  },
  lentil: {
    id: 'lentil',
    names: ['lentil', 'masoor', 'मसूर', 'masur'],
    name_en: 'Lentil',
    name_hi: 'मसूर',
    season_en: 'Rabi pulse; sensitive to waterlogging.',
    season_hi: 'रबी दलहन; जलभराव के प्रति संवेदनशील।',
    water_en: 'Light irrigation if prolonged dry spell before flowering.',
    water_hi: 'फूल से पहले लंबे सूखे पर हल्की सिंचाई।',
    rain_en: 'Excess rain raises disease & lodging risk.',
    rain_hi: 'अधिक बारिश रोग व गिरने का खतरा।',
    spray_en: 'Disease/pest sprays in dry calm weather.',
    spray_hi: 'रोग/कीट स्प्रे सूखे शांत मौसम।',
    heat_en: 'Heat at pod fill reduces seed size.',
    heat_hi: 'फली भरते गर्मी दाना छोटा करे।',
    cool_en: 'Cool weather generally favourable in season.',
    cool_hi: 'सीजन में ठंड आम तौर पर अनुकूल।',
  },
  peas: {
    id: 'peas',
    names: ['peas', 'pea', 'matar', 'मटर', 'garden pea'],
    name_en: 'Peas',
    name_hi: 'मटर',
    season_en: 'Cool-season; frost & heat both matter by stage.',
    season_hi: 'ठंड-सीजन; अवस्था अनुसार पाला/गर्मी।',
    water_en: 'Regular light moisture; avoid waterlogging.',
    water_hi: 'नियमित हल्की नमी; जलभराव से बचें।',
    rain_en: 'Wet foliage raises mildew risk.',
    rain_hi: 'गीली पत्ती से मिल्ड्यू जोखिम।',
    spray_en: 'Mildew sprays before wet spells.',
    spray_hi: 'गीले मौसम से पहले मिल्ड्यू स्प्रे।',
    heat_en: 'Heat shortens flowering & pod fill.',
    heat_hi: 'गर्मी फूल/फली छोटा करे।',
    cool_en: 'Mild cool is preferred; hard frost can damage.',
    cool_hi: 'हल्की ठंड बेहतर; कड़ा पाला नुकसान।',
  },
  pigeonpea: {
    id: 'pigeonpea',
    names: ['pigeon pea', 'pigeonpea', 'tur', 'arhar', 'तूर', 'अरहर', 'toor'],
    name_en: 'Pigeon pea',
    name_hi: 'अरहर / तूर',
    season_en: 'Kharif/long duration pulse; deep rooted.',
    season_hi: 'खरीफ/लंबी दलहन; गहरी जड़।',
    water_en: 'Mostly rainfed; irrigate only on severe dry stress at flowering.',
    water_hi: 'अक्सर वर्षा आधारित; फूल पर भीषण सूखे पर सिंचाई।',
    rain_en: 'Waterlogging harmful; excess humidity raises pod pests/disease.',
    rain_hi: 'जलभराव हानिकारक; अधिक नमी फली कीट/रोग।',
    spray_en: 'Pod borer sprays in dry calm weather.',
    spray_hi: 'फली छेदक स्प्रे सूखे शांत मौसम।',
    heat_en: 'Heat with drought at flowering cuts pod set.',
    heat_hi: 'फूल पर गर्मी+सूखा फलियाँ घटाए।',
    cool_en: 'Cool dry finish often helps grain quality.',
    cool_hi: 'ठंडा सूखा अंत अक्सर गुणवत्ता मदद।',
  },
  apple: {
    id: 'apple',
    names: ['apple', 'seb', 'सेब'],
    name_en: 'Apple',
    name_hi: 'सेब',
    season_en: 'Temperate orchard; chill & hail/frost risk matter.',
    season_hi: 'शीतोष्ण बाग; ठंड/ओला/पाला जोखिम।',
    water_en: 'Steady moisture in fruit development; avoid water stress.',
    water_hi: 'फल विकास में समान नमी; तनाव से बचें।',
    rain_en: 'Rain near harvest can hurt finish; wetness raises scab pressure.',
    rain_hi: 'कटाई पास बारिश फिनिश खराब; पपड़ी दबाव।',
    spray_en: 'Scab/pest sprays per orchard schedule in dry windows.',
    spray_hi: 'सूखी खिड़की में बागानुसार स्प्रे।',
    heat_en: 'Heat waves can cause sunburn on exposed fruit.',
    heat_hi: 'लू से खुले फलों पर सनबर्न।',
    cool_en: 'Adequate chill is useful; hard frost at bloom is damaging.',
    cool_hi: 'पर्याप्त ठंड उपयोगी; फूल पर कड़ा पाला नुकसान।',
  },
  mango: {
    id: 'mango',
    names: ['mango', 'aam', 'आम'],
    name_en: 'Mango',
    name_hi: 'आम',
    season_en: 'Tropical orchard; flowering & fruit drop weather-sensitive.',
    season_hi: 'उष्ण बाग; फूल व फल झड़ना मौसम-संवेदनशील।',
    water_en: 'Irrigate on stress in fruit growth; ease water near harvest as practiced.',
    water_hi: 'फल वृद्धि में तनाव पर सिंचाई; कटाई पास प्रचलित अनुसार कम।',
    rain_en: 'Rain at flowering can hurt fruit set; wetness raises anthracnose risk.',
    rain_hi: 'फूल पर बारिश सेट घटाए; एन्थ्रेक्नोज जोखिम।',
    spray_en: 'Orchard sprays in dry calm weather only.',
    spray_hi: 'केवल सूखे शांत मौसम में बाग स्प्रे।',
    heat_en: 'Extreme heat with dry wind can increase fruit drop.',
    heat_hi: 'तेज़ गर्मी + सूखी हवा फल झड़ना बढ़ाए।',
    cool_en: 'Mild cool nights often help colour; frost rare in plains.',
    cool_hi: 'हल्की ठंडी रात रंग मदद; मैदान में पाला दुर्लभ।',
  },
  banana: {
    id: 'banana',
    names: ['banana', 'kela', 'केला'],
    name_en: 'Banana',
    name_hi: 'केला',
    season_en: 'Year-round in suitable zones; wind & waterlogging critical.',
    season_hi: 'उपयुक्त क्षेत्र में साल भर; हवा व जलभराव महत्वपूर्ण।',
    water_en: 'High water need; maintain moisture, avoid stagnant water.',
    water_hi: 'अधिक पानी जरूरत; नमी रखें, ठहरा पानी न हो।',
    rain_en: 'Heavy rain + poor drainage harms roots; storms lodge plants.',
    rain_hi: 'तेज़ बारिश + खराब निकासी जड़ हानि; तूफान गिराए।',
    spray_en: 'Sigatoka etc. sprays in dry windows.',
    spray_hi: 'सिगाटोका आदि स्प्रे सूखी खिड़की में।',
    heat_en: 'Heat with moisture stress slows bunch development.',
    heat_hi: 'गर्मी + नमी तनाव गुच्छा धीमा करे।',
    cool_en: 'Cool snaps slow growth; frost is damaging where it occurs.',
    cool_hi: 'ठंड वृद्धि धीमी; जहाँ पाला हो नुकसान।',
  },
  grapes: {
    id: 'grapes',
    names: ['grapes', 'grape', 'angur', 'अंगूर'],
    name_en: 'Grapes',
    name_hi: 'अंगूर',
    season_en: 'Vineyard; rain near harvest critical for quality.',
    season_hi: 'अंगूर बाग; कटाई पास बारिश गुणवत्ता प्रभावित।',
    water_en: 'Regulated irrigation; avoid excess near ripening.',
    water_hi: 'नियंत्रित सिंचाई; पकने पर अधिक पानी से बचें।',
    rain_en: 'Rain near harvest raises berry crack & rot risk.',
    rain_hi: 'कटाई पास बारिश फटन/सड़न जोखिम।',
    spray_en: 'Downy/powdery sprays before wet spells.',
    spray_hi: 'गीले मौसम से पहले फफूंद स्प्रे।',
    heat_en: 'Heat can advance ripening; extreme stress hurts vines.',
    heat_hi: 'गर्मी पकना तेज़ करे; भीषण तनाव हानि।',
    cool_en: 'Cool dry finish often favourable for quality.',
    cool_hi: 'ठंडा सूखा अंत अक्सर गुणवत्ता अनुकूल।',
  },
  tea: {
    id: 'tea',
    names: ['tea', 'chai', 'चाय'],
    name_en: 'Tea',
    name_hi: 'चाय',
    season_en: 'Plantation; humidity, rain distribution & heat matter.',
    season_hi: 'बागान; नमी, बारिश वितरण व गर्मी।',
    water_en: 'Prefers steady moisture; drought stress reduces flush.',
    water_hi: 'समान नमी पसंद; सूखा फ्लश घटाए।',
    rain_en: 'Well-distributed rain helps; waterlogging on flat beds harms.',
    rain_hi: 'बंटी बारिश मदद; समतल पर जलभराव हानि।',
    spray_en: 'Pest/disease sprays per estate schedule in dry windows.',
    spray_hi: 'सूखी खिड़की में बागानानुसार स्प्रे।',
    heat_en: 'Heat waves with low humidity stress bushes.',
    heat_hi: 'लू + कम नमी झाड़ियों पर तनाव।',
    cool_en: 'Cool misty weather common in many tea zones.',
    cool_hi: 'कई चाय क्षेत्रों में ठंडा कोहरा आम।',
  },
  coffee: {
    id: 'coffee',
    names: ['coffee', 'कॉफी', 'koffee'],
    name_en: 'Coffee',
    name_hi: 'कॉफी',
    season_en: 'Plantation; blossom showers & dry harvest windows matter.',
    season_hi: 'बागान; फूल बौछार व सूखी कटाई खिड़की।',
    water_en: 'Moisture at blossom & berry expansion; avoid extremes.',
    water_hi: 'फूल व बेरी विस्तार पर नमी; अति से बचें।',
    rain_en: 'Blossom showers help set; continuous wetness raises disease.',
    rain_hi: 'फूल बौछार सेट मदद; लगातार नमी रोग।',
    spray_en: 'Leaf rust etc. sprays in dry calm weather.',
    spray_hi: 'पत्ती रतुआ स्प्रे सूखे शांत मौसम।',
    heat_en: 'Excess heat with drought stresses arabica especially.',
    heat_hi: 'गर्मी+सूखा अरेबिका पर विशेष तनाव।',
    cool_en: 'Mild cool nights often favourable in hill coffee.',
    cool_hi: 'पहाड़ी कॉफी में हल्की ठंडी रात अक्सर अनुकूल।',
  },
}

/** lowercase alias → crop id */
const ALIAS_TO_ID = (() => {
  const m = new Map()
  for (const crop of Object.values(CROP_CATALOG)) {
    m.set(crop.id, crop.id)
    m.set(crop.name_en.toLowerCase(), crop.id)
    for (const n of crop.names) {
      m.set(String(n).toLowerCase(), crop.id)
      m.set(String(n).normalize('NFC').toLowerCase(), crop.id)
    }
  }
  return m
})()

/** Short aliases only as exact bare tokens (never inside other words). */
const EXACT_ONLY = new Map([
  ['rai', 'mustard'],
  ['राई', 'mustard'],
  ['jau', 'barley'],
  ['जौ', 'barley'],
  ['tur', 'pigeonpea'],
  ['तूर', 'pigeonpea'],
  ['seb', 'apple'],
  ['सेब', 'apple'],
  ['aam', 'mango'],
  ['आम', 'mango'],
  ['tea', 'tea'],
  ['chai', 'tea'],
  ['चाय', 'tea'],
])

export function isCropToken(token) {
  if (!token) return false
  const t = String(token).toLowerCase().trim().replace(/[?.!,;:]+$/g, '')
  if (!t) return false
  if (ALIAS_TO_ID.has(t)) return true
  if (EXACT_ONLY.has(t) || EXACT_ONLY.has(String(token).trim())) return true
  return false
}

/**
 * Detect crop mention with word boundaries.
 * Never uses bare substring includes (avoids rai⊂rain).
 */
export function detectCrop(text) {
  if (!text) return null
  const raw = String(text)
  const lower = raw.toLowerCase()

  const aliases = [...ALIAS_TO_ID.keys()].sort((a, b) => b.length - a.length)
  for (const alias of aliases) {
    // Latin aliases shorter than 4 chars only via bare exact match
    if (!/[\u0900-\u097F]/.test(alias) && alias.length < 4) continue
    const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    const re = new RegExp(
      `(?:^|[^a-zA-Z\\u0900-\\u097f])${esc}(?:[^a-zA-Z\\u0900-\\u097f]|$)`,
      'i'
    )
    if (re.test(lower) || re.test(raw)) {
      const id = ALIAS_TO_ID.get(alias.toLowerCase()) || ALIAS_TO_ID.get(alias)
      if (id && CROP_CATALOG[id]) return CROP_CATALOG[id]
    }
  }

  const bare = lower.trim().replace(/[?.!,;:]+$/g, '')
  if (ALIAS_TO_ID.has(bare)) return CROP_CATALOG[ALIAS_TO_ID.get(bare)] || null
  if (EXACT_ONLY.has(bare)) return CROP_CATALOG[EXACT_ONLY.get(bare)] || null
  return null
}

/**
 * True when message is primarily crop/agri about a crop —
 * not a pure place weather ask ("weather in Kanpur").
 */
export function isCropQuestion(text) {
  const crop = detectCrop(text)
  if (!crop) return false
  const lower = String(text || '').toLowerCase()

  // Explicit "weather in <place>" where place is NOT the crop → weather mode
  const placeWeather =
    /\b(weather|forecast|temperature|temp|mausam|baarish|rain)\s+(in|at|of|for)\s+/i.test(lower) ||
    /\b(in|at)\s+[a-z\u0900-\u097f][a-z\u0900-\u097f\s.'-]{2,40}\s+(weather|forecast|mausam)\b/i.test(
      lower
    )
  if (placeWeather) {
    // "rain for wheat" / "weather for wheat" still crop
    const after = lower.split(/\b(?:in|at|of|for)\s+/i).pop() || ''
    if (detectCrop(after) || isCropToken(after.trim().split(/\s+/)[0])) return true
    // "wheat weather in Kanpur" — still crop intelligence for Kanpur
    if (detectCrop(lower.slice(0, 40))) return true
    return false
  }
  return true
}

/** Follow-up without crop name: "will rain affect it?", "how about irrigation?" */
export function isCropFollowUp(text) {
  const t = String(text || '').toLowerCase().trim()
  if (!t || detectCrop(t)) return false
  // Pronoun / "it" references to prior crop
  if (/(it|this|that)/.test(t) && /(rain|weather|affect|impact|irrigat|spray|heat|cold|wind|harm|help|ok|good|bad)/.test(t)) {
    return true
  }
  if (
    /^(will\s+)?(rain|weather|heat|cold|wind)\s+(affect|impact|hurt|help)/i.test(t) ||
    /(affect|impact)\s+(it|the\s+crop|my\s+crop)/i.test(t) ||
    /(will|does|can)\s+rain\s+affect/i.test(t) ||
    /^(how\s+about\s+)?(irrigation|irrigate|spray|sowing|harvest)\??$/i.test(t) ||
    /(should\s+i\s+irrigate|irrigate\s+(it|tomorrow|today))/i.test(t) ||
    /(is\s+(the\s+)?weather\s+good\s+for\s+it)/i.test(t) ||
    /^(और\s+)?(सिंचाई|छिड़काव|बारिश\s+का\s+असर)/i.test(t) ||
    /(same\s+crop|that\s+crop|the\s+crop)/i.test(t)
  ) {
    return true
  }
  return false
}

export function allCropStopwords() {
  const set = new Set([...ALIAS_TO_ID.keys(), ...EXACT_ONLY.keys()])
  // multi-word first tokens already in map
  return [...set]
}

export function getCropById(id) {
  return CROP_CATALOG[id] || null
}
