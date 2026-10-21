/**
 * Where a photograph of each dish can be found.
 *
 * The cards used to carry drawn art only, because photography of food is
 * never ours to ship. Wikimedia Commons is the exception: everything there
 * is published under a free licence, and the API hands back the author and
 * the licence string along with the file, so a photo can be shown with its
 * credit attached rather than silently appropriated.
 *
 * Nothing here is a URL. Commons file names change, and a hard-coded one
 * turns into a hole in the card the day it does. What is stored instead is
 * the search a human would type, plus the words the file name must contain
 * for the result to be about this dish at all — the search alone will happily
 * return a photograph of a cabbage field for «Щи».
 */

export interface DishQuery {
  /** What to search Commons for: two to four English words naming the dish. */
  readonly q: string;
  /**
   * A shorter, broader search, tried once when the first returns nothing.
   * On Commons a five-word query often matches no file at all while a
   * two-word one matches hundreds, and that gap was most of the empty cards.
   */
  readonly alt?: string;
  /**
   * At least one of these must appear in the file's name, caption,
   * description or categories, lowercased. They are substrings, so they are
   * written as stems — `lentil`, not `lentils` — and they include the
   * non-English forms of the dish's name, because a large share of Commons
   * food photography is catalogued in German, French, Polish or Russian.
   */
  readonly must: readonly string[];
}

export const DISH_QUERIES: Readonly<Record<string, DishQuery>> = {
  'cottage-bowl': {
    q: 'cottage cheese with berries',
    alt: 'cottage cheese',
    must: ['cottage cheese', 'quark', 'curd', 'tvorog', 'tvaro', 'творог', 'творож', 'twaro', 'twaróg', 'fromage blanc'],
  },
  'egg-veg-scramble': {
    q: 'scrambled eggs with vegetables',
    alt: 'scrambled eggs',
    must: ['scrambl', 'rührei', 'ruhrei', 'brouill', 'revuelt', 'jajeczn', 'яичниц', 'yaichnits'],
  },
  'oat-protein': {
    q: 'oatmeal porridge bowl',
    alt: 'porridge',
    must: ['oatmeal', 'porridge', 'haferbrei', 'bouillie d\'avoine', 'gachas de avena', 'avena cocida', 'owsian', 'овсян', 'ovsyank'],
  },
  'shakshuka': {
    q: 'shakshuka with eggs',
    alt: 'shakshuka',
    must: ['shaksh', 'chakch', 'schaksch', 'szaksz', 'шакшук', 'sakshuk'],
  },
  'cottage-omelette': {
    q: 'omelette with fresh herbs',
    alt: 'omelette',
    must: ['omelet', 'omlet', 'омлет', 'tortilla francesa', 'frittata'],
  },
  'kefir-bran': {
    q: 'glass of kefir',
    alt: 'kefir',
    must: ['kefir', 'kéfir', 'kephir', 'kefyr', 'кефир'],
  },
  'tuna-bean': {
    q: 'tuna bean salad',
    alt: 'tuna beans',
    must: ['tuna and bean', 'bean and tuna', 'tuna salad', 'thunfischsalat', 'thunfisch', 'salade de thon', 'insalata di tonno', 'tonno e fagioli', 'atún', 'tuńczyk'],
  },
  'chicken-cabbage': {
    q: 'cabbage salad with chicken',
    alt: 'coleslaw',
    must: ['coleslaw', 'cabbage salad', 'krautsalat', 'weißkrautsalat', 'salade de chou', 'ensalada de col', 'surówka z kapust', 'капустный салат', 'салат из капуст'],
  },
  'greek-feta': {
    q: 'greek salad with feta',
    alt: 'greek salad',
    must: ['greek salad', 'horiatiki', 'choriatiki', 'griechischer salat', 'salat mit feta', 'salade grecque', 'ensalada griega', 'sałatka grecka', 'греческий салат'],
  },
  'beet-walnut': {
    q: 'beetroot salad with walnuts',
    alt: 'beetroot salad',
    must: ['beetroot', 'beet salad', 'rote bete', 'betterave', 'remolacha', 'burak', 'buracz', 'свёкл', 'свекл', 'свеколь'],
  },
  'tuna-egg': {
    q: 'tuna salad with egg',
    alt: 'tuna salad',
    must: ['tuna and egg', 'egg and tuna', 'tuna salad with egg', 'thunfischsalat mit ei', 'salade de thon aux oeufs', 'tuna salad', 'thunfischsalat', 'sałatka z tuńczyk', 'тунец с яйц'],
  },
  'lentil-soup': {
    q: 'lentil soup bowl',
    alt: 'lentil soup',
    must: ['lentil', 'linsen', 'lentille', 'lenteja', 'soczewic', 'чечевич', 'mercimek'],
  },
  'chicken-broth-veg': {
    q: 'chicken broth vegetables',
    alt: 'chicken broth',
    must: ['chicken broth', 'chicken soup', 'hühnerbrühe', 'hühnersuppe', 'bouillon de poule', 'caldo de pollo', 'rosół', 'куриный бульон', 'бульон из кур', 'tavuk suyu'],
  },
  'broccoli-cream': {
    q: 'broccoli cream soup',
    alt: 'broccoli soup',
    must: ['broccoli', 'brokkoli', 'brocoli', 'brócoli', 'brokuł', 'брокколи', 'cremesuppe'],
  },
  'baked-fish': {
    q: 'baked mackerel vegetables',
    alt: 'baked mackerel',
    must: ['mackerel', 'makrele', 'makrela', 'maquereau', 'caballa', 'скумбри', 'skumbri'],
  },
  'chicken-buckwheat': {
    q: 'buckwheat with chicken',
    alt: 'buckwheat kasha',
    must: ['buckwheat with chicken', 'гречка с курицей', 'buckwheat', 'buchweizen', 'sarrasin', 'kasza gryczan', 'гречнев', 'гречка', 'grechka'],
  },
  'turkey-patties': {
    q: 'turkey patties plate',
    alt: 'turkey cutlet',
    must: ['cutlet', 'kotlet', 'котлет', 'frikadelle', 'boulette', 'albóndig', 'albondig', 'patty', 'pattie', 'meatball'],
  },
  'beef-stew': {
    q: 'beef stew with beans',
    alt: 'beef stew',
    must: ['stew', 'eintopf', 'gulasch', 'gulasz', 'goulash', 'ragout', 'estofado', 'bourguignon', 'тушён', 'тушен'],
  },
  'tofu-stirfry': {
    q: 'tofu stir fry',
    alt: 'fried tofu',
    must: ['tofu', 'тофу', 'doufu', 'bean curd', 'beancurd', '豆腐'],
  },
  'chicken-broccoli': {
    q: 'baked chicken breast broccoli',
    alt: 'chicken broccoli',
    must: ['chicken and broccoli', 'chicken with broccoli', 'chicken breast', 'hähnchen mit brokkoli', 'hähnchenbrust', 'pechuga de pollo', 'poulet brocoli', 'курица с брокколи', 'курин'],
  },
  'yogurt-nuts': {
    q: 'greek yogurt with nuts',
    alt: 'greek yogurt',
    must: ['greek yogurt', 'yogur', 'yoghurt', 'joghurt', 'jogurt', 'yaourt', 'йогурт'],
  },
  'hummus-veg': {
    q: 'hummus bowl with vegetables',
    alt: 'hummus',
    must: ['hummus', 'houmous', 'hoummous', 'hommus', 'hummos', 'хумус'],
  },
  'egg-avocado': {
    q: 'boiled eggs with avocado',
    alt: 'avocado egg',
    must: ['avocado', 'avocat', 'aguacate', 'palta', 'авокадо', 'awokado', 'avokado'],
  },
  'cottage-cucumber': {
    q: 'cottage cheese with cucumber',
    alt: 'curd cheese',
    must: ['cottage cheese with cucumber', 'cottage cheese and cucumber', 'quark mit gurke', 'творог с огурц', 'cottage cheese', 'quark', 'curd cheese', 'творог', 'творож', 'tvorog'],
  },
  'uz-shurpa': {
    q: 'shurpa meat soup',
    alt: 'shurpa',
    must: ['shurpa', 'shorpa', 'shurva', 'shorva', 'šurpa', 'шурпа', 'шўрва'],
  },
  'uz-chalop': {
    q: 'cold cucumber yogurt soup',
    alt: 'tarator',
    must: ['chalop', 'chalap', 'чалоп', 'tarator', 'таратор', 'ovdukh', 'ovduh', 'овдух', 'cold yogurt soup'],
  },
  'uz-achichuk': {
    q: 'tomato onion salad',
    alt: 'tomato salad',
    must: ['achichuk', 'achik chuchuk', 'achik-chuchuk', 'shakarob', 'ачичук', 'ачик-чучук', 'tomato onion salad', 'tomato and onion', 'tomaten und zwiebel'],
  },
  'uz-dimlama': {
    q: 'dimlama uzbek stew',
    alt: 'damlama',
    must: ['dimlama', 'damlama', 'dimlyama', 'damlyama', 'domlama', 'домлама', 'димлама', 'дымлама'],
  },
  'uz-nohat': {
    q: 'boiled chickpeas onion',
    alt: 'chickpeas',
    must: ['chickpea', 'garbanzo', 'kichererbse', 'pois chiche', 'ciecierzyc', 'nohut', 'nohat', 'нохат'],
  },
  'ru-shchi': {
    q: 'shchi cabbage soup',
    alt: 'shchi',
    must: ['shchi', 'schtschi', 'chtchi', 'щи из', 'cabbage soup', 'kohlsuppe', 'kapuśniak', 'soupe aux choux', 'sopa de col'],
  },
  'ru-okroshka': {
    q: 'okroshka cold soup',
    alt: 'okroshka',
    must: ['okroshka', 'okroschka', 'okrochka', 'okroška', 'okroszka', 'окрошка'],
  },
  'ru-grechka': {
    q: 'buckwheat porridge mushrooms',
    alt: 'buckwheat porridge',
    must: ['buckwheat with mushroom', 'гречка с гриб', 'гречнев каша', 'buckwheat', 'buchweizen', 'sarrasin', 'grano saraceno', 'kasza gryczan', 'гречка', 'grechka'],
  },
  'ru-beet-walnut': {
    q: 'beetroot salad with garlic',
    alt: 'beet salad',
    must: ['beetroot', 'beet salad', 'rote bete', 'betterave', 'remolacha', 'burak', 'свекл', 'свёкл'],
  },
  'kz-sorpa': {
    q: 'sorpa lamb broth',
    alt: 'shorpa',
    must: ['sorpa', 'сорпа', 'şorpa', 'qazaq', 'kazakh soup', 'mutton broth', 'lamb soup', 'бульон из баранины'],
  },
  'kz-kuyrdak': {
    q: 'kuyrdak kazakh meat',
    alt: 'kuurdak',
    must: ['kuyrdak', 'kuirdak', 'kuurdak', 'quyrdaq', 'qwyrdaq', 'qýyrdaq', 'куырдак', 'куурдак'],
  },
  'kz-shalgam': {
    q: 'daikon carrot salad',
    alt: 'radish salad',
    must: ['daikon', 'radish salad', 'rettichsalat', 'salade de radis', 'ensalada de rábano', 'rzodkiew', 'редьк', 'морковча', 'carrot salad'],
  },
  'cau-lobio': {
    q: 'lobio georgian beans',
    alt: 'lobio',
    must: ['lobio', 'ლობიო', 'лобио', 'red bean', 'bean stew', 'фасол', 'haricots rouges', 'rote bohnen'],
  },
  'cau-chakhokhbili': {
    q: 'chakhokhbili chicken stew',
    alt: 'chakhokhbili',
    must: ['chakhokhbili', 'chakhokbili', 'chahohbili', 'tschachochbili', 'tchakhokhbili', 'ჩახოხბილი', 'чахохбили', 'chicken stew'],
  },
  'cau-walnut-salad': {
    q: 'georgian tomato cucumber salad',
    alt: 'georgian salad',
    must: ['georgian salad', 'tomato cucumber', 'cucumber tomato', 'walnut salad', 'грузинск', 'ქართული', 'salade géorgienne', 'tomaten gurken'],
  },
  'tat-tokmach': {
    q: 'chicken noodle soup',
    alt: 'noodle soup',
    must: ['tokmach', 'токмач', 'chicken noodle', 'noodle soup', 'hühnernudelsuppe', 'nudelsuppe', 'rosół z makaron', 'sopa de fideos', 'суп с лапшой'],
  },
  'tat-azu': {
    q: 'azu tatar beef',
    alt: 'azu po-tatarski',
    must: ['azu po', 'azu tatar', 'tatar azu', 'азу по', 'азу из', 'azu (dish)', 'beef with pickle'],
  },
  'tat-katyk': {
    q: 'yogurt with cucumber dill',
    alt: 'katyk',
    must: ['katyk', 'katik', 'qatiq', 'qatyq', 'катык', 'suzma', 'yogurt with cucumber', 'joghurt mit gurke', 'cacık', 'cacik'],
  },
};

/**
 * File names that look like a dish but are not one.
 *
 * Split in two because matching matters. A phrase can be found anywhere in
 * the name; a single word has to be a word, or `plant` rejects the aubergine
 * stew, `field` rejects anything photographed in Sheffield and `sign`
 * rejects every file whose author mentioned a design. Words that merely say
 * where the food was — market, street, farm — are gone entirely: street food
 * is still food, and a sign in the background is not what the filter is for.
 */
export const REJECT_WORDS: readonly string[] = [
  'logo', 'map', 'diagram', 'chart', 'icon', 'sign', 'signs', 'poster', 'label',
  'menu', 'flag', 'stamp', 'banknote', 'portrait', 'monument', 'facade',
  'packaging', 'package', 'raw', 'uncooked', 'seeds', 'seedling', 'leaflet',
  'advertisement', 'billboard', 'infographic', 'screenshot', 'cover',
];

export const REJECT_PHRASES: readonly string[] = [
  'coat of arms', 'box of', 'can of', 'bottle of', 'jar of', 'bag of',
  'nutrition facts', 'recipe card',
];
