import type { Topic, TopicTier } from "./types";

const CONCRETE = [
  "Shoes", "Rain", "Bread", "Coffee", "Your phone", "Chairs", "The moon", "Keys",
  "Bicycles", "Umbrellas", "Socks", "Trees", "Clocks", "Mirrors", "Backpacks",
  "Pencils", "Oranges", "The ocean", "Windows", "Bridges", "Books", "Cats", "Dogs",
  "Rice", "Mountains", "Buses", "Candles", "Gardens", "Kitchens", "Hats", "Snow",
  "Sunglasses", "Eggs", "Maps", "Doors", "Cameras", "Rivers", "Soap", "Pillows",
  "Tea", "Trains", "Bees", "Lamps", "Wallets", "Clouds", "Chocolate", "Bottles",
  "Stairs", "Birds", "Headphones",
];

const PROCESS = [
  "How to make tea", "How to plan a trip", "How to make a sandwich",
  "How to wash a car", "How to learn a new word", "How to tie shoelaces",
  "How to cook rice", "How to pack a suitcase", "How to plant a seed",
  "How to clean a room", "How to write a letter", "How to make friends in a new city",
  "How to prepare for an interview", "How to ride a bike", "How to bake bread",
  "How to save money", "How to choose a gift", "How to set up a new phone",
  "How to cook pasta", "How to wrap a present", "How to make a budget",
  "How to do laundry", "How to find your way in a new city",
  "How to start a morning routine", "How to make coffee",
  "How to order food at a restaurant", "How to give directions",
  "How to study for an exam", "How to organise a party", "How to make a salad",
  "How to take a good photo", "How to walk a dog", "How to change a light bulb",
  "How to make pancakes", "How to clean a kitchen", "How to prepare for a long flight",
  "How to teach someone to swim", "How to make a smoothie", "How to plan a weekend",
  "How to buy a used car", "How to grow herbs at home", "How to write a shopping list",
  "How to move to a new home", "How to make hot chocolate",
  "How to calm down before a presentation", "How to apologise well",
  "How to learn to cook", "How to choose a book", "How to make a paper plane",
  "How to get ready for work",
];

const OPINION = [
  "Should homework exist?", "Is it better to live in a city or the countryside?",
  "Should phones be allowed in schools?", "Is working from home better than the office?",
  "Should everyone learn to cook?", "Are pets good for children?",
  "Is it better to rent or buy a home?", "Should public transport be free?",
  "Is social media good for friendships?", "Should people travel more?",
  "Is breakfast the most important meal?", "Should schools teach money skills?",
  "Is it better to read the book or watch the film?",
  "Should children have screen time limits?",
  "Is it important to learn a second language?",
  "Should cars be banned from city centres?", "Is it better to be early or on time?",
  "Should tipping be expected?", "Are video games a waste of time?",
  "Is it better to save or to spend?", "Should the weekend be three days?",
  "Is fame worth it?", "Should people retire earlier?", "Is cash still useful?",
  "Are cities becoming too crowded?", "Should uniforms be required at school?",
  "Is honesty always the best policy?", "Should we eat less meat?",
  "Is online shopping better than going to shops?",
  "Should exams be replaced by projects?", "Is it rude to use your phone at dinner?",
  "Are smartphones making us less patient?", "Should sports stars earn so much?",
  "Is it better to have many friends or a few close ones?",
  "Should everyone volunteer?", "Is it worth going to university?",
  "Should zoos exist?", "Is it good to have a strict routine?",
  "Should a four-day work week be normal?", "Is art important in schools?",
  "Should children learn to code?", "Is it better to travel alone or with friends?",
  "Are rules made to be broken?", "Do we still need libraries?",
  "Is it okay to tell small lies?", "Should we explore space or fix Earth first?",
  "Is competition good for kids?", "Should news be free?",
  "Are first impressions accurate?", "Is it better to plan or be spontaneous?",
];

function build(tier: TopicTier, prefix: string, texts: string[]): Topic[] {
  return texts.map((text, i) => ({ id: `${prefix}${String(i + 1).padStart(3, "0")}`, text, tier }));
}

export const TOPICS: readonly Topic[] = [
  ...build("concrete", "c", CONCRETE),
  ...build("process", "p", PROCESS),
  ...build("opinion", "o", OPINION),
];

const BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

export function getTopic(id: unknown): Topic | undefined {
  return typeof id === "string" ? BY_ID.get(id) : undefined;
}

export const RECENT_TOPICS_TO_AVOID = 10;

/**
 * Picks `count` distinct random topics, avoiding the given recent topic texts.
 * `random` returns an integer in [0, max).
 */
export function pickTopics(
  recentTexts: readonly string[],
  count: number,
  random: (max: number) => number,
): Topic[] {
  const recent = new Set(recentTexts);
  const pool = TOPICS.filter((t) => !recent.has(t.text));
  const source = pool.length >= count ? [...pool] : [...TOPICS];
  const picked: Topic[] = [];
  while (picked.length < count && source.length > 0) {
    picked.push(source.splice(random(source.length), 1)[0]);
  }
  return picked;
}
