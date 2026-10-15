import type { CategoryChoice, Topic, TopicCategory, TopicTier } from "./types";
import { categoryChoiceSchema } from "./validation";

export const CATEGORIES: readonly { id: CategoryChoice; label: string }[] = [
  { id: "random", label: "Random" },
  { id: "animals-nature", label: "Animals & Nature" },
  { id: "food", label: "Food" },
  { id: "technology", label: "Technology" },
  { id: "money-work", label: "Money & Work" },
  { id: "travel-places", label: "Travel & Places" },
  { id: "health-habits", label: "Health & Habits" },
  { id: "sports-games", label: "Sports & Games" },
  { id: "culture-society", label: "Culture & Society" },
  { id: "science", label: "Science" },
  { id: "politics-issues", label: "Politics & Current Issues" },
  { id: "everyday-life", label: "Everyday Life" },
];

export const DEFAULT_CATEGORY: CategoryChoice = "random";

const LABELS = new Map<string, string>(CATEGORIES.map((c) => [c.id, c.label]));

export function categoryLabel(id: string | null | undefined): string | undefined {
  return id ? LABELS.get(id) : undefined;
}

/** Returns the category if it's on the fixed list, otherwise null. */
export function parseCategory(value: unknown): CategoryChoice | null {
  return categoryChoiceSchema.safeParse(value).data ?? null;
}

const A: TopicCategory = "animals-nature";
const F: TopicCategory = "food";
const T: TopicCategory = "technology";
const M: TopicCategory = "money-work";
const V: TopicCategory = "travel-places";
const H: TopicCategory = "health-habits";
const S: TopicCategory = "sports-games";
const C: TopicCategory = "culture-society";
const SC: TopicCategory = "science";
const P: TopicCategory = "politics-issues";
const E: TopicCategory = "everyday-life";

type Entry = readonly [text: string, category: TopicCategory];

// Topic ids come from each entry's position in its tier, so only ever append.
// Politics topics stay neutral, open questions: no parties, no named politicians.

const CONCRETE: Entry[] = [
  ["Shoes", E], ["Rain", A], ["Bread", F], ["Coffee", F], ["Your phone", T], ["Chairs", E],
  ["The moon", SC], ["Keys", E], ["Bicycles", V], ["Umbrellas", E], ["Socks", E], ["Trees", A],
  ["Clocks", SC], ["Mirrors", SC], ["Backpacks", V], ["Pencils", E], ["Oranges", F],
  ["The ocean", A], ["Windows", E], ["Bridges", V], ["Books", C], ["Cats", A], ["Dogs", A],
  ["Rice", F], ["Mountains", A], ["Buses", V], ["Candles", E], ["Gardens", A], ["Kitchens", F],
  ["Hats", E], ["Snow", A], ["Sunglasses", H], ["Eggs", F], ["Maps", V], ["Doors", E],
  ["Cameras", T], ["Rivers", A], ["Soap", H], ["Pillows", H], ["Tea", F], ["Trains", V],
  ["Bees", A], ["Lamps", E], ["Wallets", M], ["Clouds", SC], ["Chocolate", F], ["Bottles", E],
  ["Stairs", E], ["Birds", A], ["Headphones", T],
  // Added with topic categories.
  ["Laptops", T], ["Robots", T], ["Video calls", T], ["Passwords", T],
  ["Coins", M], ["Offices", M],
  ["Airports", V], ["Hotels", V], ["Beaches", V], ["Passports", V], ["Your hometown", V],
  ["Sleep", H], ["Water", H], ["Walking", H], ["Vegetables", H], ["Toothbrushes", H],
  ["Football", S], ["Chess", S], ["Board games", S], ["Swimming pools", S], ["Tennis", S],
  ["Puzzles", S], ["Playing cards", S],
  ["Magnets", SC], ["Volcanoes", SC], ["Stars", SC], ["Rainbows", SC], ["Microscopes", SC],
  ["Batteries", SC],
  ["Newspapers", P], ["Elections", P], ["Electric cars", P],
];

const PROCESS: Entry[] = [
  ["How to make tea", F], ["How to plan a trip", V], ["How to make a sandwich", F],
  ["How to wash a car", E], ["How to learn a new word", C], ["How to tie shoelaces", E],
  ["How to cook rice", F], ["How to pack a suitcase", V], ["How to plant a seed", A],
  ["How to clean a room", E], ["How to write a letter", E],
  ["How to make friends in a new city", C], ["How to prepare for an interview", M],
  ["How to ride a bike", S], ["How to bake bread", F], ["How to save money", M],
  ["How to choose a gift", C], ["How to set up a new phone", T], ["How to cook pasta", F],
  ["How to wrap a present", E], ["How to make a budget", M], ["How to do laundry", E],
  ["How to find your way in a new city", V], ["How to start a morning routine", H],
  ["How to make coffee", F], ["How to order food at a restaurant", F],
  ["How to give directions", V], ["How to study for an exam", C],
  ["How to organise a party", C], ["How to make a salad", F],
  ["How to take a good photo", T], ["How to walk a dog", A], ["How to change a light bulb", E],
  ["How to make pancakes", F], ["How to clean a kitchen", E],
  ["How to prepare for a long flight", V], ["How to teach someone to swim", S],
  ["How to make a smoothie", F], ["How to plan a weekend", E], ["How to buy a used car", M],
  ["How to grow herbs at home", A], ["How to write a shopping list", E],
  ["How to move to a new home", V], ["How to make hot chocolate", F],
  ["How to calm down before a presentation", H], ["How to apologise well", C],
  ["How to learn to cook", F], ["How to choose a book", C], ["How to make a paper plane", SC],
  ["How to get ready for work", M],
  // Added with topic categories.
  ["How to look after a houseplant", A], ["How to go on a nature walk", A],
  ["How to make a strong password", T], ["How to back up your photos", T],
  ["How to explain the internet to a child", T], ["How to take a break from your phone", T],
  ["How to ask for a pay rise", M], ["How to start a small business", M],
  ["How to drink more water", H], ["How to build a new habit", H],
  ["How to get a good night's sleep", H], ["How to stretch after exercise", H],
  ["How to break a bad habit", H],
  ["How to play your favourite board game", S], ["How to train for a 5k run", S],
  ["How to explain the rules of a sport", S], ["How to warm up before sport", S],
  ["How to be a good team player", S],
  ["How to do a simple science experiment", SC], ["How to explain why the sky is blue", SC],
  ["How to measure rainfall", SC], ["How to explain gravity to a child", SC],
  ["How to make your voice heard in your community", P],
  ["How to check if a news story is true", P], ["How to prepare for a debate", P],
  ["How to explain how a new law is made", P],
];

const OPINION: Entry[] = [
  ["Should homework exist?", C], ["Is it better to live in a city or the countryside?", V],
  ["Should phones be allowed in schools?", T], ["Is working from home better than the office?", M],
  ["Should everyone learn to cook?", F], ["Are pets good for children?", A],
  ["Is it better to rent or buy a home?", M], ["Should public transport be free?", P],
  ["Is social media good for friendships?", T], ["Should people travel more?", V],
  ["Is breakfast the most important meal?", H], ["Should schools teach money skills?", M],
  ["Is it better to read the book or watch the film?", C],
  ["Should children have screen time limits?", H],
  ["Is it important to learn a second language?", C],
  ["Should cars be banned from city centres?", P], ["Is it better to be early or on time?", E],
  ["Should tipping be expected?", M], ["Are video games a waste of time?", S],
  ["Is it better to save or to spend?", M], ["Should the weekend be three days?", M],
  ["Is fame worth it?", C], ["Should people retire earlier?", M], ["Is cash still useful?", M],
  ["Are cities becoming too crowded?", V], ["Should uniforms be required at school?", C],
  ["Is honesty always the best policy?", C], ["Should we eat less meat?", F],
  ["Is online shopping better than going to shops?", E],
  ["Should exams be replaced by projects?", C], ["Is it rude to use your phone at dinner?", T],
  ["Are smartphones making us less patient?", T], ["Should sports stars earn so much?", S],
  ["Is it better to have many friends or a few close ones?", C],
  ["Should everyone volunteer?", C], ["Is it worth going to university?", C],
  ["Should zoos exist?", A], ["Is it good to have a strict routine?", H],
  ["Should a four-day work week be normal?", M], ["Is art important in schools?", C],
  ["Should children learn to code?", T], ["Is it better to travel alone or with friends?", V],
  ["Are rules made to be broken?", C], ["Do we still need libraries?", C],
  ["Is it okay to tell small lies?", C], ["Should we explore space or fix Earth first?", SC],
  ["Is competition good for kids?", S], ["Should news be free?", P],
  ["Are first impressions accurate?", C], ["Is it better to plan or be spontaneous?", E],
  // Added with topic categories.
  ["Should people be allowed to keep wild animals as pets?", A],
  ["Is it better to have a cat or a dog?", A], ["Should cities have more parks?", A],
  ["Is fast food always bad?", F], ["Is it better to eat at home or eat out?", F],
  ["Is artificial intelligence more helpful or harmful?", T],
  ["Should children have their own smartphone?", T], ["Are self-driving cars a good idea?", T],
  ["Is it better to work for yourself or for a company?", M],
  ["Is a high salary more important than enjoying your job?", M],
  ["Is it better to visit one place slowly or many places quickly?", V],
  ["Is it better to exercise in the morning or the evening?", H],
  ["Should schools teach mental health?", H], ["Is a daily walk enough exercise?", H],
  ["Should esports be in the Olympics?", S], ["Is it more fun to play sport or watch it?", S],
  ["Should every school have sport every day?", S],
  ["Should everyone learn basic science?", SC],
  ["Should we try to bring back extinct animals?", SC], ["Would you want to live on Mars?", SC],
  ["Is it better to learn science from experiments or from books?", SC],
  ["Should voting be compulsory?", P], ["Should the voting age be lowered to 16?", P],
  ["Should there be a limit on how long leaders can stay in power?", P],
  ["Should university education be free?", P], ["Should single-use plastics be banned?", P],
  ["Should cities build more bike lanes?", P],
  ["Should every young person do a year of community service?", P],
  ["Should big decisions be made by a public vote?", P],
  ["Should people be able to vote online?", P], ["Should there be a tax on sugary drinks?", P],
];

function build(tier: TopicTier, prefix: string, entries: readonly Entry[]): Topic[] {
  return entries.map(([text, category], i) => ({
    id: `${prefix}${String(i + 1).padStart(3, "0")}`,
    text,
    tier,
    category,
  }));
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

/** Every topic for a category; "random" means all of them. */
export function topicsInCategory(category: CategoryChoice): Topic[] {
  return category === "random" ? [...TOPICS] : TOPICS.filter((t) => t.category === category);
}

export const RECENT_TOPICS_TO_AVOID = 10;

/**
 * Picks `count` distinct random topics from a category, avoiding the given recent
 * topic texts. Throws on a category that isn't on the list.
 * `random` returns an integer in [0, max).
 */
export function pickTopics(
  category: CategoryChoice,
  recentTexts: readonly string[],
  count: number,
  random: (max: number) => number,
): Topic[] {
  if (parseCategory(category) === null) throw new Error("Unknown topic category");
  const all = topicsInCategory(category);
  const recent = new Set(recentTexts);
  const pool = all.filter((t) => !recent.has(t.text));
  const source = pool.length >= count ? pool : all;
  const picked: Topic[] = [];
  while (picked.length < count && source.length > 0) {
    picked.push(source.splice(random(source.length), 1)[0]);
  }
  return picked;
}
