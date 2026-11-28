/**
 * Christmas cards (launch key `holiday_cards`, founder decisions 2026-10-30). A person picks one of the season's
 * pictures, writes a short note on its back and chooses when it arrives; it goes to one person, found by name or, for
 * someone not on Pantopus, by email (the escrow letter path). One card a day per sender.
 *
 * A card is a letter in an envelope (type `letter`) whose card lives in `mail_extracted.card` (only the server writes
 * it) and whose note lives only in the letter's private stored copy (MailObject), never in Mail.content, so lists,
 * search, notices and older app versions never show it. A card sealed until Christmas morning keeps its note on the
 * server until then (isSealed): the routes that read a letter's stored copy give a sealed card a short note instead.
 *
 * The pictures come in collections. The website serves every picture (/holiday-cards/<design id>.jpg); the phone apps
 * carry the first 17 and load the rest from the website. Each app prints the caption, the year and the postmark.
 */
const crypto = require('crypto');
const { DateTime } = require('luxon');
const supabaseAdmin = require('../config/supabaseAdmin');
const { cardImprovementsOn } = require('../utils/featureFlags');

const CARD_TAG = 'holiday_card';
const MESSAGE_LIMIT = 300;
const SUBJECT = 'A Christmas card';
// A reply to a card ("Write back", memories contract section 2; launch key card_replies): its own category and tag, never
// the card's, so it never uses the day's card or a stamp and never counts as a card. Its subject is what builds that
// don't know replies show (a plain letter with its note).
const REPLY_TAG = 'holiday_card_reply';
const REPLY_SUBJECT = 'A reply to a Christmas card';
const SEALED_NOTE = 'This Christmas card is sealed until Christmas morning.';

// The season: Christmas 2026. Sending closes when December 31 ends where the sender lives.
const SEASON = { holiday: 'christmas', year: 2026, tag: 'christmas_2026', closes_on: '2026-12-31' };
const MORNING_HOUR = 7;

/** A picture's design id by its number ("christmas-2026-07"). */
const designIdOf = (number) => `christmas-2026-${String(number).padStart(2, '0')}`;

// The collections "Pick a card" shows, in this order, each with its pictures (by number) in grid order (founder,
// 2026-10-31; Christmas with Santa 2026-11-07; the nativity pictures 2026-11-08, renamed Christmas with Jesus Christ
// and moved to the front the same day; 22 more of the founder's pictures of Jesus's life after them, 2026-11-21). On
// 2026-11-21 the founder also approved 16 more pictures (90-105), a ninth collection, Christmas in the City, and this
// order: Christmas with Jesus Christ first, then from cards anyone can send to anyone, to family, to one particular
// person (card shelves SPEC A2). A picture can move to another collection; its number stays. The collection's id stays
// first-christmas: nothing but this list reads it.
// Each also has what the card shelves draw (docs/product/card-shelves-2026-11-21, SPEC A3; the layout itself is launch
// key card_shelves, but these are sent whatever it says and older apps ignore them): `short`, its name in the website's
// row; `slug`, its public name in a link (/cards/collection/<slug>); `pick`, the number of the card that stands for it in
// "One from each collection" (one of its own cards; since the founder's choices of November 22 it may be one of the
// first three, SPEC E1); and, for Christmas with Jesus Christ, its `parts` in story order, each a name and a range of
// numbers.
const COLLECTIONS = [
  { id: 'first-christmas', name: 'Christmas with Jesus Christ', short: 'Jesus Christ', slug: 'jesus-christ',
    line: 'For the faithful, and anyone who loves the Christmas story.',
    numbers: [59, 60, 61, 62, 63, 64, 65, 66, 67,
      68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89],
    pick: 61,
    parts: [['The first Christmas', 59, 68], ['His life and teaching', 69, 80], ['The cross and the empty tomb', 81, 89]] },
  { id: 'with-santa', name: 'Christmas with Santa', short: 'Santa', slug: 'santa',
    line: 'For anyone who still believes, and anyone who used to.',
    numbers: [50, 51, 52, 53, 54, 55, 56, 57, 58, 90, 91, 92, 93, 94, 95], pick: 95 },
  { id: 'in-the-city', name: 'Christmas in the City', short: 'The City', slug: 'the-city',
    line: 'For anyone who dreams of the city at Christmas.', numbers: [96, 97, 98, 99, 100], pick: 99 },
  { id: 'as-a-kid', name: 'Christmas as a Kid', short: 'As a Kid', slug: 'as-a-kid',
    line: 'For families with kids, and anyone who misses being one.',
    numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 105], pick: 1 },
  { id: 'grandmas-house', name: 'Christmas at Grandma’s House', short: 'Grandma’s House', slug: 'grandmas-house',
    line: 'For grandparents, and the grandkids who still come home.', numbers: [44, 45, 46, 47, 48, 49], pick: 47 },
  { id: 'memories', name: 'Christmas Memories', short: 'Memories', slug: 'memories',
    line: 'For anyone who misses the little things.', numbers: [38, 39, 40, 41, 42, 43, 101, 102, 103, 104], pick: 101 },
  { id: 'with-friends', name: 'Christmas with Friends', short: 'Friends', slug: 'friends',
    line: 'For the friends who feel like family.', numbers: [18, 19, 20, 21, 22, 26, 31], pick: 22 },
  { id: 'love-stories', name: 'Christmas Love Stories', short: 'Love Stories', slug: 'love-stories',
    line: 'For the one you love, near or far.', numbers: [23, 24, 25, 27, 28, 29, 30], pick: 27 },
  { id: 'in-your-twenties', name: 'Christmas in Your Twenties', short: 'Your Twenties', slug: 'your-twenties',
    line: 'For first apartments, old roommates and long trips home.', numbers: [32, 33, 34, 35, 36, 37], pick: 37 },
].map(({ id, name, short, slug, line, numbers, pick, parts }) => {
  if (!numbers.includes(pick)) throw new Error(`Collection ${id}: its pick ${pick} must be one of its own cards`);
  return {
    id, name, short, slug, line, designs: numbers.map(designIdOf), pick: designIdOf(pick),
    ...(parts ? { parts: parts.map(([partName, from, to]) => ({
      name: partName, designs: numbers.filter((n) => n >= from && n <= to).map(designIdOf),
    })) } : {}),
  };
});
// The order "One from each collection" draws the collections' picks in (founder, November 22, SPEC E2): only that row;
// the shelves and every names row keep the collections' order above. Sent as `opening` in both card lists, so it can
// change again without an app build.
const OPENING = ['first-christmas', 'memories', 'in-the-city', 'with-santa', 'as-a-kid', 'grandmas-house', 'with-friends',
  'love-stories', 'in-your-twenties'];
if (OPENING.length !== COLLECTIONS.length || !COLLECTIONS.every((c) => OPENING.includes(c.id))) {
  throw new Error('OPENING must name every collection once');
}
const COLLECTION_OF_DESIGN = new Map(COLLECTIONS.flatMap((c) => c.designs.map((design) => [design, c.id])));
const MOOD_OF_COLLECTION = { 'first-christmas': 'reverence', 'with-santa': 'santa' }; // every other: nostalgia

// The pictures by number, with the caption printed under each, the colour of its paper, its height in px at 960 px wide
// (an app keeps a picture's shape while it loads it), its name on the public card pages (/cards/<slug>) and the colour of
// the cloth it lies on (launch key card_table). 1–17 are the founder's own (2026-10-30); 18–49 came in five groups on
// 2026-10-31; 50–58 are the founder's Santa pictures (2026-11-07), which have no border, so their paper is one cream.
// 59–67 are the founder's nativity pictures (2026-11-08), each with its whole King James verse printed under the
// painting, so the caption is the verse's reference (its book and numbers joined by a no-break space). 68–89 are 22 more
// of the founder's pictures, from Jesus's birth to the Great Commission (2026-11-21), made the same way; a passage of
// two or three verses has an en dash in its reference ("Matthew 4:10–11 (KJV)"). 90–105 are 16 more of the founder's
// paintings (2026-11-21), borderless like 50–58: six more of Santa, five of Christmas in the City (no shop, hotel, rink or
// city is named anywhere: not in a caption, a slug or a file name), four Memories and one As a Kid.
// A number is never reused: every app picks the card's stamp from it. Each picture's `mood` is the table it opens on
// (SPEC A4, 2026-11-21): candlelit for Christmas with Jesus Christ, Santa's for Christmas with Santa, snowy for every
// other; it comes from the collection, so a picture that moves takes its table with it. Apps that don't read it decide
// by number.
// The whole King James verse printed under each Christmas with Jesus Christ picture (59–89), by its public page, as the
// apps show it below the card in readable type ("Read the verse", design plan 6.2, 2026-11-09). The text is Project
// Gutenberg's KJV, ebook 10 (public domain in the US), word for word as printed on the picture, with two changes: a
// passage whose last verse runs on into the next ends with a full stop (Matthew 2:14, Matthew 5:44), and John 20:18
// reads "the Lord" as the founder gave it (Gutenberg prints "LORD" there). In a passage each verse starts with its own
// number, tied to its first word by a no-break space (the picture prints it small). Plain digits, not superscript ones:
// the iPhone's serif (New York) has only ¹ ² ³ of them, so the others would print in another font.
const VERSES = new Map([
  ['isaiah-9-6', 'For unto us a child is born, unto us a son is given: and the government shall be upon his shoulder: and his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace.'],
  ['luke-2-7', 'And she brought forth her firstborn son, and wrapped him in swaddling clothes, and laid him in a manger; because there was no room for them in the inn.'],
  ['john-3-16', 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'],
  ['luke-2-10', 'And the angel said unto them, Fear not: for, behold, I bring you good tidings of great joy, which shall be to all people.'],
  ['luke-2-14', 'Glory to God in the highest, and on earth peace, good will toward men.'],
  ['matthew-2-2', 'Saying, Where is he that is born King of the Jews? for we have seen his star in the east, and are come to worship him.'],
  ['matthew-2-11', 'And when they were come into the house, they saw the young child with Mary his mother, and fell down, and worshipped him: and when they had opened their treasures, they presented unto him gifts; gold, and frankincense and myrrh.'],
  ['matthew-2-14', 'When he arose, he took the young child and his mother by night, and departed into Egypt.'],
  ['john-8-12', 'Then spake Jesus again unto them, saying, I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life.'],
  ['luke-2-11', 'For unto you is born this day in the city of David a Saviour, which is Christ the Lord.'],
  ['matthew-3-17', 'And lo a voice from heaven, saying, This is my beloved Son, in whom I am well pleased.'],
  ['matthew-4-10-11', '10\u00a0Then saith Jesus unto him, Get thee hence, Satan: for it is written, Thou shalt worship the Lord thy God, and him only shalt thou serve. 11\u00a0Then the devil leaveth him, and, behold, angels came and ministered unto him.'],
  ['john-3-16-nicodemus', 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'],
  ['john-4-14', 'But whosoever drinketh of the water that I shall give him shall never thirst; but the water that I shall give him shall be in him a well of water springing up into everlasting life.'],
  ['matthew-5-44', 'But I say unto you, Love your enemies, bless them that curse you, do good to them that hate you, and pray for them which despitefully use you, and persecute you.'],
  ['mark-1-41', 'And Jesus, moved with compassion, put forth his hand, and touched him, and saith unto him, I will; be thou clean.'],
  ['mark-2-10-12', '10\u00a0But that ye may know that the Son of man hath power on earth to forgive sins, (he saith to the sick of the palsy,) 11\u00a0I say unto thee, Arise, and take up thy bed, and go thy way into thine house. 12\u00a0And immediately he arose, took up the bed, and went forth before them all; insomuch that they were all amazed, and glorified God, saying, We never saw it on this fashion.'],
  ['john-6-11', 'And Jesus took the loaves; and when he had given thanks, he distributed to the disciples, and the disciples to them that were set down; and likewise of the fishes as much as they would.'],
  ['matthew-14-30-31', '30\u00a0But when he saw the wind boisterous, he was afraid; and beginning to sink, he cried, saying, Lord, save me. 31\u00a0And immediately Jesus stretched forth his hand, and caught him, and said unto him, O thou of little faith, wherefore didst thou doubt?'],
  ['luke-15-20', 'And he arose, and came to his father. But when he was yet a great way off, his father saw him, and had compassion, and ran, and fell on his neck, and kissed him.'],
  ['mark-10-14-16', '14\u00a0But when Jesus saw it, he was much displeased, and said unto them, Suffer the little children to come unto me, and forbid them not: for of such is the kingdom of God. 15\u00a0Verily I say unto you, Whosoever shall not receive the kingdom of God as a little child, he shall not enter therein. 16\u00a0And he took them up in his arms, put his hands upon them, and blessed them.'],
  ['john-11-25-26', '25\u00a0Jesus said unto her, I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live: 26\u00a0And whosoever liveth and believeth in me shall never die. Believest thou this?'],
  ['john-13-14-15', '14\u00a0If I then, your Lord and Master, have washed your feet; ye also ought to wash one another’s feet. 15\u00a0For I have given you an example, that ye should do as I have done to you.'],
  ['luke-22-19-20', '19\u00a0And he took bread, and gave thanks, and brake it, and gave unto them, saying, This is my body which is given for you: this do in remembrance of me. 20\u00a0Likewise also the cup after supper, saying, This cup is the new testament in my blood, which is shed for you.'],
  ['luke-22-42', 'Saying, Father, if thou be willing, remove this cup from me: nevertheless not my will, but thine, be done.'],
  ['1-peter-2-24', 'Who his own self bare our sins in his own body on the tree, that we, being dead to sins, should live unto righteousness: by whose stripes ye were healed.'],
  ['john-19-30', 'When Jesus therefore had received the vinegar, he said, It is finished: and he bowed his head, and gave up the ghost.'],
  ['matthew-28-6', 'He is not here: for he is risen, as he said. Come, see the place where the Lord lay.'],
  ['john-20-18', 'Mary Magdalene came and told the disciples that she had seen the Lord, and that he had spoken these things unto her.'],
  ['john-21-17', 'He saith unto him the third time, Simon, son of Jonas, lovest thou me? Peter was grieved because he said unto him the third time, Lovest thou me? And he said unto him, Lord, thou knowest all things; thou knowest that I love thee. Jesus saith unto him, Feed my sheep.'],
  ['matthew-28-18-20', '18\u00a0And Jesus came and spake unto them, saying, All power is given unto me in heaven and in earth. 19\u00a0Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost: 20\u00a0Teaching them to observe all things whatsoever I have commanded you: and, lo, I am with you alway, even unto the end of the world. Amen.'],
]);
const DESIGNS = [
  ['Home for Christmas.', '#f7eee0', 1054, 'home-for-christmas', '#2c4071'],
  ['One more run?', '#f7efe1', 1054, 'one-more-run', '#3b4c6e'],
  ['Don’t open until Christmas.', '#f4eee0', 1034, 'dont-open-until-christmas', '#6e4b30'],
  ['Remember making your wish list?', '#fcf5e7', 1054, 'remember-making-your-wish-list', '#6e4b30'],
  ['We saved you a window seat.', '#fbf2e2', 1035, 'we-saved-you-a-window-seat', '#3b4c6e'],
  ['Shake it once for me.', '#f4ede2', 1032, 'shake-it-once-for-me', '#6e4b30'],
  ['Remember Christmas at the mall?', '#f8f0e3', 1058, 'remember-christmas-at-the-mall', '#6e4b30'],
  ['Come finish our snowman.', '#f9f1e3', 1045, 'come-finish-our-snowman', '#3b4c6e'],
  ['Look outside. It’s snowing.', '#f6ede0', 1062, 'look-outside-its-snowing', '#3b4c6e'],
  ['One more Christmas movie.', '#f8f0e0', 1040, 'one-more-christmas-movie', '#6e4b30'],
  ['We found our tree.', '#f9f3e7', 1027, 'we-found-our-tree', '#3b4c6e'],
  ['Your cocoa’s getting cold.', '#f5eee0', 1052, 'your-cocoas-getting-cold', '#2c4071'],
  ['A little Christmas from home.', '#f8f1e0', 1065, 'a-little-christmas-from-home', '#6e4b30'],
  ['Wish you were here.', '#f9f6ed', 1046, 'wish-you-were-here', '#6e4b30'],
  ['Snowy wishes, just for you.', '#f8f0e3', 1052, 'snowy-wishes-just-for-you', '#3b4c6e'],
  ['Saved you the good cookies.', '#f4efe4', 1042, 'saved-you-the-good-cookies', '#6e4b30'],
  ['See you after Christmas.', '#fbf3e4', 1054, 'see-you-after-christmas', '#3b4c6e'],
  ['Same friends. New memories.', '#f2eee2', 1024, 'same-friends-new-memories', '#6e4b30'],
  ['No fancy plans. Just us.', '#f3efe5', 982, 'no-fancy-plans-just-us', '#6e4b30'],
  ['Come over. There’s always room.', '#f1ede2', 1014, 'come-over-theres-always-room', '#6e4b30'],
  ['Let’s take the long way home.', '#f7f3ea', 1019, 'lets-take-the-long-way-home', '#3b4c6e'],
  ['We saved your usual seat.', '#f5f0e6', 990, 'we-saved-your-usual-seat', '#704b51'],
  ['Our little place. Our Christmas.', '#f9f1e3', 994, 'our-little-place-our-christmas', '#6e4b30'],
  ['Another Christmas. Still you.', '#f9f1df', 968, 'another-christmas-still-you', '#6e4b30'],
  ['Until I can hold you again.', '#f8f0df', 987, 'until-i-can-hold-you-again', '#6e4b30'],
  ['One more movie, like always.', '#f7f0e3', 975, 'one-more-movie-like-always', '#6e4b30'],
  ['Christmas starts when you get here.', '#f7f2e8', 1019, 'christmas-starts-when-you-get-here', '#2c4071'],
  ['One more song, my love.', '#f7f0e5', 1019, 'one-more-song-my-love', '#6e4b30'],
  ['My favorite place is beside you.', '#faf1e1', 1066, 'my-favorite-place-is-beside-you', '#3b4c6e'],
  ['All I wanted was you.', '#f6eee0', 1004, 'all-i-wanted-was-you', '#6e4b30'],
  ['Good friends. Questionable wrapping skills.', '#f5efe2', 971, 'good-friends-questionable-wrapping-skills', '#6e4b30'],
  ['Save me a place at home.', '#f2eadf', 1034, 'save-me-a-place-at-home', '#704b51'],
  ['Our kind of Christmas Eve.', '#f1e7d8', 999, 'our-kind-of-christmas-eve', '#6e4b30'],
  ['Books closed. Christmas starts now.', '#f5ede1', 999, 'books-closed-christmas-starts-now', '#3b4c6e'],
  ['Small gifts. Good company.', '#f2ece1', 999, 'small-gifts-good-company', '#6e4b30'],
  ['We’ll make it fit.', '#f0e8d6', 1057, 'well-make-it-fit', '#2c4071'],
  ['Different cities. Same old us.', '#f4ecdc', 999, 'different-cities-same-old-us', '#6e4b30'],
  ['Saved you something sweet.', '#f7f0e3', 1014, 'saved-you-something-sweet', '#6e4b30'],
  ['A little Christmas, sent your way.', '#f6eddd', 1040, 'a-little-christmas-sent-your-way', '#6e4b30'],
  ['Follow the lights home.', '#f7eede', 1041, 'follow-the-lights-home', '#2c4071'],
  ['Press play. Stay awhile.', '#f8eee1', 1031, 'press-play-stay-awhile', '#6e4b30'],
  ['Wake up. It’s Christmas.', '#faf0e1', 996, 'wake-up-its-christmas', '#6e4b30'],
  ['Come in. The movie’s starting.', '#f4e7d3', 1046, 'come-in-the-movies-starting', '#6e4b30'],
  ['Your turn to stir.', '#faf3e5', 993, 'your-turn-to-stir', '#6e4b30'],
  ['You can have one now.', '#f5f1e7', 997, 'you-can-have-one-now', '#704b51'],
  ['Take this for tomorrow.', '#f9f2e6', 997, 'take-this-for-tomorrow', '#6e4b30'],
  ['You made this one.', '#f6f2e9', 986, 'you-made-this-one', '#6e4b30'],
  ['One more piece before bed.', '#f4f0e6', 1034, 'one-more-piece-before-bed', '#6e4b30'],
  ['Your bed’s already made.', '#f6eddd', 994, 'your-beds-already-made', '#6e4b30'],
  ['You made the nice list.', '#f7f0e2', 1022, 'you-made-the-nice-list', '#6e4b30'],
  ['I put in a good word for you.', '#f7f0e2', 1022, 'i-put-in-a-good-word-for-you', '#6e4b30'],
  ['Just making sure it works.', '#f7f0e2', 1022, 'just-making-sure-it-works', '#6e4b30'],
  ['He got your letter.', '#f7f0e2', 1022, 'he-got-your-letter', '#6e4b30'],
  ['Some things never get old.', '#f7f0e2', 1022, 'some-things-never-get-old', '#2c4071'],
  ['On his way to you.', '#f7f0e2', 1022, 'on-his-way-to-you', '#3b4c6e'],
  ['Saved the best house for last.', '#f7f0e2', 1022, 'saved-the-best-house-for-last', '#2c4071'],
  ['Shh. He’s here.', '#f7f0e2', 1022, 'shh-hes-here', '#6e4b30'],
  ['Put your feet up. It’s Christmas.', '#f7f0e2', 1022, 'put-your-feet-up-its-christmas', '#704b51'],
  ['Isaiah\u00a09:6 (KJV)', '#f7f0e2', 1022, 'isaiah-9-6', '#6e4b30'],
  ['Luke\u00a02:7 (KJV)', '#f7f0e2', 1022, 'luke-2-7', '#6e4b30'],
  ['John\u00a03:16 (KJV)', '#f7f0e2', 1022, 'john-3-16', '#704b51'],
  ['Luke\u00a02:10 (KJV)', '#f7f0e2', 1022, 'luke-2-10', '#2c4071'],
  ['Luke\u00a02:14 (KJV)', '#f7f0e2', 1022, 'luke-2-14', '#6e4b30'],
  ['Matthew\u00a02:2 (KJV)', '#f7f0e2', 1022, 'matthew-2-2', '#2c4071'],
  ['Matthew\u00a02:11 (KJV)', '#f7f0e2', 1022, 'matthew-2-11', '#704b51'],
  ['Matthew\u00a02:14 (KJV)', '#f7f0e2', 1022, 'matthew-2-14', '#2c4071'],
  ['John\u00a08:12 (KJV)', '#f7f0e2', 1022, 'john-8-12', '#6e4b30'],
  ['Luke\u00a02:11 (KJV)', '#f7f0e2', 1022, 'luke-2-11', '#6e4b30'],
  ['Matthew\u00a03:17 (KJV)', '#f7f0e2', 1022, 'matthew-3-17', '#704b51'],
  ['Matthew\u00a04:10–11 (KJV)', '#f7f0e2', 1022, 'matthew-4-10-11', '#6e4b30'],
  ['John\u00a03:16 (KJV)', '#f7f0e2', 1022, 'john-3-16-nicodemus', '#2c4071'],
  ['John\u00a04:14 (KJV)', '#f7f0e2', 1022, 'john-4-14', '#6e4b30'],
  ['Matthew\u00a05:44 (KJV)', '#f7f0e2', 1022, 'matthew-5-44', '#704b51'],
  ['Mark\u00a01:41 (KJV)', '#f7f0e2', 1022, 'mark-1-41', '#6e4b30'],
  ['Mark\u00a02:10–12 (KJV)', '#f7f0e2', 1022, 'mark-2-10-12', '#6e4b30'],
  ['John\u00a06:11 (KJV)', '#f7f0e2', 1022, 'john-6-11', '#704b51'],
  ['Matthew\u00a014:30–31 (KJV)', '#f7f0e2', 1022, 'matthew-14-30-31', '#2c4071'],
  ['Luke\u00a015:20 (KJV)', '#f7f0e2', 1022, 'luke-15-20', '#6e4b30'],
  ['Mark\u00a010:14–16 (KJV)', '#f7f0e2', 1022, 'mark-10-14-16', '#6e4b30'],
  ['John\u00a011:25–26 (KJV)', '#f7f0e2', 1022, 'john-11-25-26', '#6e4b30'],
  ['John\u00a013:14–15 (KJV)', '#f7f0e2', 1022, 'john-13-14-15', '#6e4b30'],
  ['Luke\u00a022:19–20 (KJV)', '#f7f0e2', 1022, 'luke-22-19-20', '#6e4b30'],
  ['Luke\u00a022:42 (KJV)', '#f7f0e2', 1022, 'luke-22-42', '#2c4071'],
  ['1\u00a0Peter\u00a02:24 (KJV)', '#f7f0e2', 1022, '1-peter-2-24', '#2c4071'],
  ['John\u00a019:30 (KJV)', '#f7f0e2', 1022, 'john-19-30', '#2c4071'],
  ['Matthew\u00a028:6 (KJV)', '#f7f0e2', 1022, 'matthew-28-6', '#6e4b30'],
  ['John\u00a020:18 (KJV)', '#f7f0e2', 1022, 'john-20-18', '#704b51'],
  ['John\u00a021:17 (KJV)', '#f7f0e2', 1022, 'john-21-17', '#6e4b30'],
  ['Matthew\u00a028:18–20 (KJV)', '#f7f0e2', 1022, 'matthew-28-18-20', '#704b51'],
  ['Bundle up. It’s a long night.', '#f7f0e2', 1022, 'bundle-up-its-a-long-night', '#6e4b30'],
  ['Save some for the reindeer.', '#f7f0e2', 1022, 'save-some-for-the-reindeer', '#6e4b30'],
  ['One more lap, then it’s yours.', '#f7f0e2', 1022, 'one-more-lap-then-its-yours', '#6e4b30'],
  ['For everyone working tonight.', '#f7f0e2', 1022, 'for-everyone-working-tonight', '#704b51'],
  ['He won’t tell if you don’t.', '#f7f0e2', 1022, 'he-wont-tell-if-you-dont', '#6e4b30'],
  ['And away he goes.', '#f7f0e2', 1022, 'and-away-he-goes', '#2c4071'],
  ['Christmas Eve in the city.', '#f7f0e2', 1022, 'christmas-eve-in-the-city', '#704b51'],
  ['The whole city’s lit up.', '#f7f0e2', 1022, 'the-whole-citys-lit-up', '#2c4071'],
  ['Remember the windows downtown?', '#f7f0e2', 1022, 'remember-the-windows-downtown', '#6e4b30'],
  ['Meet me under the tree.', '#f7f0e2', 1022, 'meet-me-under-the-tree', '#2c4071'],
  ['Skate with me till the lights come on.', '#f7f0e2', 1022, 'skate-with-me-till-the-lights-come-on', '#3b4c6e'],
  ['The whole street’s lit up for you.', '#f7f0e2', 1022, 'the-whole-streets-lit-up-for-you', '#2c4071'],
  ['The porch light’s on.', '#f7f0e2', 1022, 'the-porch-lights-on', '#704b51'],
  ['Follow our footprints home.', '#f7f0e2', 1022, 'follow-our-footprints-home', '#3b4c6e'],
  ['I had help with the wrapping.', '#f7f0e2', 1022, 'i-had-help-with-the-wrapping', '#6e4b30'],
  ['Come to the window. It’s starting.', '#f7f0e2', 1022, 'come-to-the-window-its-starting', '#3b4c6e'],
].map(([caption, paper, height, slug, table], index) => {
  const id = designIdOf(index + 1);
  return {
    id, number: index + 1, caption, paper, collection: COLLECTION_OF_DESIGN.get(id) || null, height, slug, table,
    mood: MOOD_OF_COLLECTION[COLLECTION_OF_DESIGN.get(id)] || 'nostalgia',
    // Only the verse pictures carry it; apps read it when present (older apps ignore it).
    ...(VERSES.has(slug) ? { verse: VERSES.get(slug) } : {}),
  };
});
const DESIGN_BY_ID = new Map(DESIGNS.map((design) => [design.id, design]));

// The photo card (the card round of November 28, Wave 4; docs/product/card-improvements-2026-11-28): the sender's own
// photo is the card's front, in one of three frames, with a line of their own under it. It is a design of its own and
// is NOT in DESIGNS: it is never on Pick a card's shelves, a public page, a share picture or a video, and it never
// travels. The website serves one stock picture at its address, which lists, the mantel and apps from before it draw;
// its caption is what they print under it. The photo is the card's own photo (services/holidayCardMedia) and the
// frame and caption live in the card's private stored copy (frontOf), never in the Mail row.
// `height` is the stock picture's at 960 px wide, as every design's is (christmas-2026-photo.jpg is 960 × 1056).
const PHOTO_CARD = Object.freeze({
  id: 'christmas-2026-photo', number: null, caption: 'Merry Christmas', paper: '#f7f0e2', collection: null, height: 1056,
  slug: null, table: '#1c2233', mood: 'nostalgia',
});
const PHOTO_CARD_FRAMES = ['heirloom', 'midnight', 'arch'];
const PHOTO_CARD_CAPTION_LIMIT = 42;
// The shapes a photo card's photo is cropped to on the device (width to height); the server checks the stored
// photo is one of them, within PHOTO_CARD_SHAPE_SLACK.
const PHOTO_CARD_SHAPES = [{ id: 'portrait', w: 4, h: 5 }, { id: 'square', w: 1, h: 1 }, { id: 'landscape', w: 4, h: 3 }];
const PHOTO_CARD_SHAPE_SLACK = 0.02;
const isPhotoCardDesign = (id) => String(id || '') === PHOTO_CARD.id;
/** What GET /cards tells the apps of the photo card (`photo_card`). */
const photoCardControls = () => ({ design: PHOTO_CARD.id, frames: PHOTO_CARD_FRAMES, default_frame: PHOTO_CARD_FRAMES[0],
  caption_limit: PHOTO_CARD_CAPTION_LIMIT, shapes: PHOTO_CARD_SHAPES });
/** Whether a photo this wide and high is one of the photo card's shapes. */
function photoCardShape(width, height) {
  const ratio = Number(width) / Number(height);
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  return PHOTO_CARD_SHAPES.find((shape) => Math.abs(ratio / (shape.w / shape.h) - 1) <= PHOTO_CARD_SHAPE_SLACK) || null;
}
/**
 * A photo card's front as a send gives it ({ frame, caption }): the frame one of the three, the caption optional, on
 * one line, spaces folded and trimmed, at most PHOTO_CARD_CAPTION_LIMIT letters. { front: { frame, caption } }
 * (caption '' for none) or { refusal: 'CARD_FRONT_FRAME_UNKNOWN' | 'CARD_FRONT_CAPTION_TOO_LONG' }.
 */
function cleanFront(raw) {
  const frame = typeof raw?.frame === 'string' ? raw.frame : '';
  if (!PHOTO_CARD_FRAMES.includes(frame)) return { refusal: 'CARD_FRONT_FRAME_UNKNOWN' };
  // eslint-disable-next-line no-control-regex
  const caption = typeof raw.caption === 'string' ? raw.caption.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if ([...caption].length > PHOTO_CARD_CAPTION_LIMIT) return { refusal: 'CARD_FRONT_CAPTION_TOO_LONG' };
  return { front: { frame, caption } };
}

// "Pick a card" prints a verse card's whole verse under the card, and the Android app makes every card of a collection
// small enough to leave room for the longest verse in it. So the list "Pick a card" reads (GET /api/mailbox/cards)
// carries that text only for a verse no longer than Matthew 2:11, the longest of 59–67: no card shows smaller there than
// before 68–89 came (design review, 2026-11-21). A longer passage shows its reference under the card and is read on the
// picture. An opened card's "Read the verse" (cardView) and the public card pages still carry every verse whole.
const PICK_A_CARD_VERSE_MAX = VERSES.get('matthew-2-11').length;
function pickACardDesign(design) {
  if (!design.verse || design.verse.length <= PICK_A_CARD_VERSE_MAX) return design;
  const { verse, ...rest } = design;
  return rest;
}

// When a card comes: with the next morning's mail, the next morning sealed until Christmas, or on Christmas morning.
// A card to someone not on Pantopus comes when they open the email (`now`), sealed until Christmas or not.
const PERSON_ARRIVALS = ['next_morning', 'sealed_christmas', 'christmas_morning'];
const EMAIL_ARRIVALS = ['now', 'sealed_christmas'];
// A person's choices while the card round of November 28, 2026 is on (GET /cards arrivals.person_all): Right away
// too, second, after the morning mail. Apps from before it read PERSON_ARRIVALS and never see it.
const PERSON_ARRIVALS_ALL = ['next_morning', 'now', 'sealed_christmas', 'christmas_morning'];
// Every choice a card by email has for apps that word them all (founder, November 15): the three a person has, its email
// going at the sender's 7 a.m. (the person's time zone isn't known), and Right away. Older apps get EMAIL_ARRIVALS.
const EMAIL_ARRIVALS_ALL = ['next_morning', 'sealed_christmas', 'christmas_morning', 'now'];

function designById(id) {
  return DESIGN_BY_ID.get(String(id || '')) || null;
}
/**
 * The design a stored card is drawn from: one of the season's pictures, or the photo card. Reading a card uses this
 * one, whatever the round's switch says, so a photo card already sent stays readable; designById stays the catalog
 * alone, for everything a photo card never has (a public page, a share picture, a video, an email picture, a journey).
 */
function designOf(id) {
  return isPhotoCardDesign(id) ? PHOTO_CARD : designById(id);
}

function isCard(mail) {
  return Boolean(mail?.mail_extracted?.card?.design);
}

/** Whether this piece is a reply to a card (its server-written `card_reply` names the card). */
function isReply(mail) {
  return Boolean(mail?.mail_extracted?.card_reply?.card_id);
}

/** A UUID (version 5, variant 8, as the gig-completion File ids) from these parts, the same parts always the same. */
function uuidOf(parts) {
  const digest = crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

/**
 * The row id of the one reply a card can have (memories contract section 6): made from the card's id alone, so the
 * database refuses a second reply to the same card, whatever request it came from.
 */
function replyRowId(cardId) {
  return uuidOf(['holiday_card_reply_v1', String(cardId).toLowerCase()]);
}

/** What a reply asked for, as one digest: the card it answers, its note and its signature. */
function replyDigest({ cardId, message, signature = null }) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(['holiday_card_reply_v1', String(cardId).toLowerCase(), message, ...(signature ? [signature] : [])]))
    .digest('hex');
}

/**
 * The row id of the card one send stores (POST /api/mailbox/cards with a `request_id`): the same sender and request ID
 * always give the same id, so the database refuses a second card for one send, however it's repeated. Formatted as the
 * gig-completion File ids are (services/s3Service).
 */
function requestRowId(senderId, requestId) {
  return uuidOf(['holiday_card_v1', String(senderId), String(requestId).toLowerCase()]);
}

/**
 * A card sent by link (launch key card_table): the token its link carries, made from its id and the server's secret (the
 * same one as services/mailEnclosures, under its own label), so its sender can ask for the link again while the Mail row
 * keeps only the token's hash. Empty when the server has no secret.
 */
function cardLinkToken(mailId, label = 'card-link') {
  const secret = process.env.MAIL_ENCLOSURE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(`pantopus:${label}:v1:${mailId}`).digest('base64url');
}

/**
 * A card by email's token, made the same way under its own label, so a retry of its email (services/cardEmail) carries
 * the same link as the first try. Empty when the server has no secret.
 */
function cardEmailToken(mailId) {
  return cardLinkToken(mailId, 'card-email');
}

// ---- A card by email's email (services/cardEmail) ----
// The Mail row of a card by email keeps where its email is in mail_extracted.card.email: { state, tries, at, sent_at,
// send_at }. `state` is 'scheduled' until `send_at` (its 7 a.m. or Christmas morning), 'sending' while a try runs, 'sent'
// once the mail server took it, 'failed' after a try didn't go. Cards sent before this was kept have none and are read as
// emailed. A link goes to no address, so it has none.
const EMAIL_TRIES = 5;
const EMAIL_GIVE_UP_MS = 60 * 60 * 1000;

/** Where a card's email is: null (it went, or the card has no email record), 'retrying', or 'failed'. */
function emailTrouble(mail, now = new Date()) {
  const email = mail?.mail_extracted?.card?.email;
  if (!email || email.state === 'sent' || email.state === 'scheduled' || !mail.escrow_status) return null;
  // Its first try runs as it's sent (or as it's due); a card still sending a while later lost its try, which the job
  // picks up.
  if (email.state === 'sending' && !(Number(email.tries) > 0)
    && now.getTime() - Date.parse(email.at || mail.created_at) < 10 * 60 * 1000) return null;
  // Given up an hour after the email was due (as it was sealed, or its 7 a.m.), even if the job isn't running.
  const old = now.getTime() - Date.parse(email.send_at || mail.created_at) >= EMAIL_GIVE_UP_MS;
  return Number(email.tries) >= EMAIL_TRIES || old ? 'failed' : 'retrying';
}

/**
 * The picture at the top of a card's email and of its look (services/emailService cardWaitingEmailContent), as a path
 * on the website: the front the sender picked, lying on its open envelope (the picture's link preview, 1200x630 JPEG,
 * which every mail client draws), or the sealed envelope for a card sealed until Christmas (founder, November 16: the
 * stock picture may show before they join; never the note, signature, own photo or voice). A design this server doesn't
 * know gets the sealed envelope too. Answers { path, alt, caption }.
 */
function emailPicture({ design, sealed }) {
  const picked = sealed ? null : designById(design);
  if (!picked) return { path: '/holiday-cards/share/sealed-link.jpg', alt: 'A sealed red envelope with a gold wax seal', caption: null };
  return { path: `/holiday-cards/share/${picked.id}-link.jpg`, alt: `A Christmas card: ${picked.caption}`, caption: picked.caption };
}

/** Whether a card's email went out (or it never kept a record, before this was kept). */
function emailWent(mail) {
  const email = mail?.mail_extracted?.card?.email;
  return !email || email.state === 'sent';
}

/** Whether this card went out as a link: it waits like a card by email, for whoever opens it first. */
function isByLink(mail) {
  return Boolean(mail?.mail_extracted?.card?.by_link);
}

/** What a send asked for, as one digest: the same request ID with other content asks for another card. */
function requestDigest({ design, message, arrival, toUserId, toEmail, signature = null, media = null, travel = false, toName = null, front = null }) {
  // A signed card's strokes count too, and a card's own photo and voice (their ids and the photo's description),
  // whether it travels (card_travel), and the name on a link's envelope; a card without them has the digest it always had.
  const parts = [design, message, arrival, toUserId || null, toEmail || null, ...(signature ? [signature] : []),
    ...(media ? [{ media }] : []), ...(travel ? [{ travel: true }] : []), ...(toName ? [{ to_name: toName }] : []),
    // A photo card's frame and line; a card without them has the digest it always had.
    ...(front ? [{ front }] : [])];
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

/** Whether this card is still sealed: its note stays on the server until `sealed_until`. */
function isSealed(mail, now = new Date()) {
  const until = mail?.mail_extracted?.card?.sealed_until;
  return Boolean(until) && Date.parse(until) > now.getTime();
}

// The sender's own signature beside FROM (design plan 8.2, launch key card_table): their name signed with a finger,
// kept as a few pen strokes in a 400 × 100 box (x to the right, y down, whole numbers; each stroke [x, y, x, y, ...],
// a dot is one point). It is stored with the note in the card's private copy, never in the Mail row, so like the note
// it waits while the card is sealed. Never logged, and never put in a share picture's name or a public page. Apps
// that don't read it set the first name in the pen, as before.
const SIGNATURE_BOX = { w: 400, h: 100 };
const SIGNATURE_MAX_BYTES = 2048;
const SIGNATURE_MAX_STROKES = 40;

/**
 * A signature as a send gives it, checked: { signature } (null when there is none), or { refusal: code } when it
 * can't be kept: CARD_SIGNATURE_INVALID (not strokes in the box) or CARD_SIGNATURE_TOO_LONG (over 2 KB as stored).
 */
function cleanSignature(raw) {
  if (raw === undefined || raw === null) return { signature: null };
  const invalid = { refusal: 'CARD_SIGNATURE_INVALID' };
  if (typeof raw !== 'object' || raw.w !== SIGNATURE_BOX.w || raw.h !== SIGNATURE_BOX.h) return invalid;
  const { strokes } = raw;
  if (!Array.isArray(strokes) || !strokes.length || strokes.length > SIGNATURE_MAX_STROKES) return invalid;
  for (const stroke of strokes) {
    if (!Array.isArray(stroke) || stroke.length < 2 || stroke.length % 2) return invalid;
    for (let i = 0; i < stroke.length; i += 1) {
      const v = stroke[i];
      if (!Number.isInteger(v) || v < 0 || v > (i % 2 ? SIGNATURE_BOX.h : SIGNATURE_BOX.w)) return invalid;
    }
  }
  const signature = { w: SIGNATURE_BOX.w, h: SIGNATURE_BOX.h, strokes: strokes.map((stroke) => [...stroke]) };
  if (Buffer.byteLength(JSON.stringify(signature)) > SIGNATURE_MAX_BYTES) return { refusal: 'CARD_SIGNATURE_TOO_LONG' };
  return { signature };
}

/** The signature kept in a card's private stored copy (the payload mailObjects.readPayload answers), or null. */
function signatureOf(payload) {
  const signature = payload?.body?.payload?.signature;
  return signature && Array.isArray(signature.strokes) ? signature : null;
}

/**
 * The photo and voice a card's private stored copy keeps (holiday_card_memories, services/holidayCardMedia): beside the
 * note and the signature, never in the Mail row, so a sealed card shows nothing of them. { photo, voice } or null.
 */
function mediaOf(payload) {
  const media = payload?.body?.payload?.media;
  if (!media || !(media.photo || media.voice)) return null;
  // A photo card's frame and caption ride with its photo to mediaView, which every reader of a card's photo calls.
  const front = frontOf(payload);
  return front ? { ...media, front } : media;
}

// How long after joining an account counts as new for the cards that brought it (GET /cards/waiting, `welcome`).
const JOINED_FOR_MS = 14 * 24 * 60 * 60 * 1000;
/**
 * Whether this reader joined for this card (piece.card.joined_for; the card round, Wave 4.1): they are who it went to,
 * it reached them from an email or a link, and their account is under 14 days old. While such a card is on screen the
 * apps hold the notices that explain the rest of Pantopus. False when it can't be read: the notices then show as ever.
 */
async function joinedFor(mail, readerId, now = new Date()) {
  if (!cardImprovementsOn() || !isCard(mail) || mail.escrow_status !== 'claimed') return false;
  if (!readerId || String(mail.recipient_user_id) !== String(readerId)) return false;
  const { data, error } = await supabaseAdmin.from('User').select('created_at').eq('id', readerId).maybeSingle();
  if (error) return false;
  const joined = Date.parse(data?.created_at);
  return Number.isFinite(joined) && now.getTime() - joined < JOINED_FOR_MS;
}

/** A photo card's front as its private stored copy keeps it ({ frame, caption }), beside the note; else null. */
function frontOf(payload) {
  const front = payload?.body?.payload?.front;
  return front && PHOTO_CARD_FRAMES.includes(front.frame)
    ? { frame: front.frame, caption: typeof front.caption === 'string' ? front.caption : '' } : null;
}

/** A sealed card as the letter readers return it: the short note instead of its own, and no stored copy. */
function sealedView(mail) {
  const { object_payload: _payload, object: _object, card_signature: _signature, card_media: _media,
    card_photo_covered: _covered, ...rest } = mail;
  return { ...rest, content: SEALED_NOTE, content_format: 'plain_text', content_text: SEALED_NOTE, attachments: [] };
}

/** 7:00 a.m. on Christmas morning in this time zone. */
function christmasMorning(timeZone) {
  return DateTime.fromObject({ year: SEASON.year, month: 12, day: 25, hour: MORNING_HOUR }, { zone: timeZone }).toJSDate();
}

/** Whether cards can still be sent from this time zone: until December 31 ends there. */
function seasonOpen(timeZone, now = new Date()) {
  const end = DateTime.fromISO(SEASON.closes_on, { zone: timeZone }).plus({ days: 1 }).startOf('day');
  return DateTime.fromJSDate(now, { zone: timeZone }) < end;
}

/** The start of today in this time zone (the daily card resets at midnight where the sender lives). */
function dayStart(timeZone, now = new Date()) {
  return DateTime.fromJSDate(now, { zone: timeZone }).startOf('day').toJSDate();
}

/** Whole days from one day to a later one, as YYYY-MM-DD ("2026-12-11" to "2026-12-25" is 14). */
function daysBetween(fromDay, toDay) {
  return Math.round(DateTime.fromISO(toDay, { zone: 'utc' }).diff(DateTime.fromISO(fromDay, { zone: 'utc' }), 'days').days);
}

/**
 * The arrivals open now. A person's: the sealed and Christmas-morning choices only while the next morning round in
 * their time zone comes before Christmas morning. An email's: sealed only before Christmas morning where the sender is.
 */
function arrivalsFor({ byEmail, all = false, timeZone, now = new Date(), nextRound }) {
  const christmas = christmasMorning(timeZone).getTime();
  if (byEmail && all) return now.getTime() < christmas ? EMAIL_ARRIVALS_ALL : ['next_morning', 'now'];
  if (byEmail) return now.getTime() < christmas ? EMAIL_ARRIVALS : ['now'];
  const beforeChristmas = nextRound(timeZone, now).getTime() < christmas;
  // `all` for a person (the card round): Right away as well, for as long as cards are sent.
  if (all) return beforeChristmas ? PERSON_ARRIVALS_ALL : ['next_morning', 'now'];
  return beforeChristmas ? PERSON_ARRIVALS : ['next_morning'];
}

/**
 * When a card to a person comes and opens, and until when the sender can take it back (the carrier's next pickup,
 * the next 7 a.m. in their time zone). Answers ISO strings; `opens_at` is null unless it's sealed.
 */
function personDelivery({ arrival, timeZone, now = new Date(), nextRound }) {
  // Right away (the card round): it is in their mailbox now, so there is no pickup to take it back before.
  if (arrival === 'now') return { delivered_at: now.toISOString(), sealed_until: null, take_back_until: null };
  const pickup = nextRound(timeZone, now);
  const christmas = christmasMorning(timeZone);
  if (arrival === 'christmas_morning') {
    return { delivered_at: christmas.toISOString(), sealed_until: null, take_back_until: pickup.toISOString() };
  }
  return {
    delivered_at: pickup.toISOString(),
    sealed_until: arrival === 'sealed_christmas' ? christmas.toISOString() : null,
    take_back_until: pickup.toISOString(),
  };
}

/**
 * When a card by email's email goes, by the sender's clock (`timeZone`; the other person's isn't known until they join):
 * at their next 7 a.m. (next_morning), at 7 a.m. on Christmas morning (christmas_morning), or now (now, and
 * sealed_christmas, whose card stays sealed until Christmas morning). Answers ISO strings; `sealed_until` is null unless
 * it's sealed. The card can be opened once they join with that address and its seal, if any, lifts.
 */
function emailDelivery({ arrival, timeZone, now = new Date(), nextRound }) {
  if (arrival === 'next_morning') return { send_at: nextRound(timeZone, now).toISOString(), sealed_until: null };
  if (arrival === 'christmas_morning') return { send_at: christmasMorning(timeZone).toISOString(), sealed_until: null };
  return { send_at: now.toISOString(),
    sealed_until: arrival === 'sealed_christmas' ? christmasMorning(timeZone).toISOString() : null };
}

// The name a sender writes on a link's envelope ("Mom", "The Patel family"; the card round): spaces folded and
// trimmed, at most TO_NAME_LIMIT letters. { name } ('' for none) or { refusal: 'CARD_TO_NAME_TOO_LONG' }.
const TO_NAME_LIMIT = 40;
function cleanToName(raw) {
  // eslint-disable-next-line no-control-regex
  const name = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return [...name].length > TO_NAME_LIMIT ? { refusal: 'CARD_TO_NAME_TOO_LONG' } : { name };
}

/** When a card by email's email is set to go, while it waits for that time (services/cardEmail), else null. */
function emailSendAt(mail) {
  const email = mail?.mail_extracted?.card?.email;
  return mail?.escrow_status === 'pending' && email?.state === 'scheduled' && email.send_at ? email.send_at : null;
}

/** The card as the apps read it on a piece (mailPiece.present), or null when the piece isn't a card. */
function cardView(mail, now = new Date()) {
  if (!isCard(mail)) return null;
  const card = mail.mail_extracted.card;
  const design = designOf(card.design);
  const sealed = isSealed(mail, now);
  return {
    design: card.design,
    number: design?.number ?? null,
    caption: card.caption || design?.caption || null,
    paper: design?.paper || '#f7f0e2',
    // The picture's height at 960 px wide, so an app keeps its shape while it loads it.
    height: design?.height ?? null,
    // The card's public page (/cards/<slug>) and the colour of the cloth it lies on (launch key card_table).
    slug: design?.slug || null,
    table: design?.table || null,
    // The table it opens on: reverence, santa or nostalgia (apps without it decide by number).
    mood: design?.mood || null,
    holiday: card.holiday || SEASON.holiday,
    year: card.year || SEASON.year,
    arrival: card.arrival || null,
    sealed_until: card.sealed_until || null,
    sealed,
    // The whole verse printed on a nativity picture ("Read the verse"); like the picture, not before a seal lifts.
    verse: (!sealed && design?.verse) || null,
    // The sender's signature (8.2), when the reader read the card's stored copy: v2's object_payload, or the
    // card_signature GET /api/mailbox/:id sets. Like the note, not before a seal lifts; null: set the typed name.
    signature: (!sealed && (mail.card_signature || signatureOf(mail.object_payload))) || null,
    // A photo card (PHOTO_CARD): its frame and the sender's line, where the stored copy was read and its seal has
    // lifted (mediaView); null otherwise, and the apps draw the stock picture. A catalog card has no `front`.
    ...(isPhotoCardDesign(card.design) ? { front: null } : {}),
    ...mediaView(mail, sealed),
    // The reader joined for this card (joinedFor; the routes that read one piece set card_joined_for). Absent otherwise.
    ...(mail.card_joined_for ? { joined_for: true } : {}),
    // A card that travels (card_travel), as its reader may see it: the route reads it (services/cardTravel readerView).
    ...(mail.card_travel ? { travel: mail.card_travel } : {}),
  };
}

/**
 * A reply as the apps read it on a piece (`piece.card_reply`, memories contract section 5; `piece.card` stays null, so a
 * build that knows cards but not replies shows a plain letter with its note): the card it answers and that card's
 * picture, so it draws on the same paper, and the replier's signature when the reader read its stored copy. Note only
 * in this build: no photo or voice. Null when the piece isn't a reply.
 */
function replyView(mail) {
  if (!isReply(mail)) return null;
  const reply = mail.mail_extracted.card_reply;
  const design = designOf(reply.design);
  return {
    card_id: reply.card_id,
    design: reply.design || null,
    number: design?.number ?? null,
    caption: design?.caption || null,
    paper: design?.paper || '#f7f0e2',
    height: design?.height ?? null,
    slug: design?.slug || null,
    table: design?.table || null,
    mood: design?.mood || null,
    year: reply.year || SEASON.year,
    signature: mail.card_signature || signatureOf(mail.object_payload) || null,
    photo: null,
    voice: null,
  };
}

/**
 * A card's photo and voice on a piece (contract section 5), when the reader read its stored copy (v2's object_payload,
 * or the card_media GET /api/mailbox/:id sets): like the note, nothing of them before a seal lifts. A photo is covered
 * for the reader unless the route found them the sender's connection (card_photo_covered false; section 10).
 */
function mediaView(mail, sealed) {
  const media = sealed ? null : (mail.card_media || mediaOf(mail.object_payload));
  const photo = media?.photo?.file_id ? media.photo : null;
  const voice = media?.voice?.file_id ? media.voice : null;
  // A Live Photo's moving part rides its photo (kind `live`, founder November 16): covered whenever the photo is.
  const live = photo && media?.live?.file_id ? media.live : null;
  return {
    photo: photo ? { file_id: photo.file_id, width: photo.width ?? null, height: photo.height ?? null, alt: photo.alt || null,
      covered: mail.card_photo_covered !== false,
      live: live ? { file_id: live.file_id, mime_type: live.mime_type || null, duration_ms: live.duration_ms ?? null } : null } : null,
    voice: voice ? { file_id: voice.file_id, duration_ms: voice.duration_ms ?? null } : null,
    // A photo card's front: the photo above is drawn in this frame, with this line under it.
    ...(photo && media.front ? { front: { frame: media.front.frame, caption: media.front.caption || null } } : {}),
  };
}

/**
 * When the carrier picks up a card to a person: their next 7 a.m. after it was sent, which is also the last moment to
 * take it back. A morning or sealed card is delivered at its pickup; a Christmas-morning card waits for Dec 25.
 */
function pickupAt(mail) {
  return mail?.mail_extracted?.card?.take_back_until || mail?.delivered_at || null;
}

/**
 * What the sender sees of a card they sent (today's card and the answer to sending it). `toName` is the person's
 * name as they show it, or the masked email address.
 */
function sentSummary(mail, now = new Date()) {
  const card = mail?.mail_extracted?.card || {};
  const byEmail = Boolean(mail.escrow_status);
  let status;
  if (byEmail) status = mail.escrow_status === 'pending' ? 'waiting' : mail.escrow_status;
  else status = Date.parse(mail.delivered_at) > now.getTime() ? 'waiting' : 'delivered';
  const takeBackUntil = byEmail ? null : pickupAt(mail);
  const canTakeBack = byEmail
    ? mail.escrow_status === 'pending'
    : Boolean(takeBackUntil) && Date.parse(takeBackUntil) > now.getTime() && Date.parse(mail.delivered_at) > now.getTime();
  return {
    id: mail.id,
    design: card.design || null,
    to_name: card.to_name || null,
    by_email: byEmail,
    // By link it also counts as by email (older apps read it that way); newer apps say it in link words.
    ...(card.by_link ? { by_link: true } : {}),
    // By email, set to go at 7 a.m. or on Christmas morning: when (older apps read it as waiting for them).
    ...(emailSendAt(mail) ? { email_send_at: emailSendAt(mail) } : {}),
    arrival: card.arrival || null,
    arrives_at: byEmail ? null : mail.delivered_at,
    // The day it reaches them by their clock (cards sent before this was kept: null; the apps read arrives_at).
    arrives_on: byEmail ? null : card.arrives_on || null,
    opens_at: card.sealed_until || null,
    take_back_until: takeBackUntil,
    can_take_back: canTakeBack,
    status,
    sent_at: mail.created_at || null,
    // A card that travels (card_travel): its journey, for "See its journey".
    ...(card.travel?.journey ? { travel: { journey: card.travel.journey } } : {}),
  };
}

// ---- Sent: personal letters and cards (GET /api/mailbox/sent, /sent/:id, and the Mailbox flag in v2 drawers) ----

/**
 * The letters and cards this person sent as themselves (not as a business) that weren't taken back: a card that was taken
 * back is gone, one by email is withdrawn. With `notDelivered` (Sent's opt-in ?include=not_delivered), also the cards a
 * block withdrew since they keep their picture (notDeliveredOf). A query to add filters and order to.
 */
function sentCards(userId, select, options, { notDelivered = false } = {}) {
  return supabaseAdmin.from('Mail').select(select, options)
    .eq('sender_user_id', userId)
    .eq('type', 'letter')
    .is('sender_entity_id', null)
    .or(`escrow_status.is.null,escrow_status.neq.withdrawn${notDelivered ? ',mail_extracted->card->withdrawn->>design.not.is.null' : ''}`);
}

/**
 * A card a block withdrew before it was delivered, as its withdrawn record keeps it (migration 20261110210000; memories
 * contract section 8): { design, to_name }, or null for anything else (a take-back, a letter, a card withdrawn before
 * the record kept its picture). Its sender's Sent says "Couldn't be delivered" and never why.
 */
function notDeliveredOf(mail) {
  const withdrawn = mail?.mail_extracted?.card?.withdrawn;
  return mail?.escrow_status === 'withdrawn' && withdrawn?.reason === 'blocked' && withdrawn.design
    ? { design: String(withdrawn.design), to_name: withdrawn.to_name || null } : null;
}

/**
 * Where a card someone sent is now, as their Sent shows it. To a person: `waiting` for the carrier's 7 a.m. pickup,
 * `picked_up` (a Christmas-morning card on its way) or `delivered`. By email: `email_waiting` until they open it,
 * `claimed` once they joined and have it, `expired` after its 90 days. Never whether they opened, kept or shredded it.
 */
function sentStatus(mail, now = new Date()) {
  const t = now.getTime();
  if (mail.escrow_status) {
    if (mail.escrow_status === 'claimed') return 'claimed';
    if (mail.escrow_status === 'expired' || Date.parse(mail.escrow_expires_at) <= t) return 'expired';
    return 'email_waiting';
  }
  if (Date.parse(mail.delivered_at) <= t) return 'delivered';
  return Date.parse(pickupAt(mail)) <= t ? 'picked_up' : 'waiting';
}

/** This instant's day (YYYY-MM-DD) by this clock, or null. */
function dayIn(at, timeZone) {
  return at ? DateTime.fromJSDate(new Date(at), { zone: timeZone }).toISODate() : null;
}

/** An instant as one ISO form ("2026-12-25T15:00:00.000Z"), whichever way it was stored, or null. */
function instant(at) {
  return at ? new Date(at).toISOString() : null;
}

/**
 * A card in its sender's Sent. `toName`: the name stored when it was sent, or by email the masked address until it's
 * claimed, then the name neighbors see the person by. `senderName`: the name on the envelope (the sender's Local Profile,
 * as the recipient sees it). `zone`: the clock their days are told by (theirs; the sender's own for a card by email
 * nobody has claimed). `toHousehold`: a letter to a Home itself, whose `toName` ("their household") is said whole, never
 * as a first name. Never the recipient's ids, address or time zone, nor anything they did with it.
 */
function sentPiece(mail, { toName, toHousehold = false, senderName, zone, travel = null, now = new Date() }) {
  const notDelivered = notDeliveredOf(mail);
  if (notDelivered) {
    // Couldn't be delivered: its picture and the name it went to, nothing of when or why.
    const view = cardView({ mail_extracted: { card: { design: notDelivered.design } } }, now) || {};
    return {
      id: mail.id, kind: 'card', subject: SUBJECT, sent_at: instant(mail.created_at), to_name: notDelivered.to_name || toName || null,
      to_household: false, by_email: false, arrival: null, status: 'not_delivered', arrives_at: null, arrives_on: null,
      opens_on: null, sealed: false, can_take_back: false, take_back_until: null,
      envelope: { from: senderName, postmarked_on: null },
      card: { design: view.design || null, number: view.number ?? null, caption: view.caption || null, paper: view.paper || null,
        year: view.year || null, height: view.height ?? null, slug: view.slug || null, table: view.table || null,
        mood: view.mood || null, verse: null },
    };
  }
  const isHolidayCard = isCard(mail);
  const card = mail.mail_extracted?.card || {};
  const view = cardView(mail, now) || {};
  const byEmail = Boolean(mail.escrow_status);
  const status = sentStatus(mail, now);
  // A card whose email didn't go out while it waits: 'retrying' while the retry job keeps trying, then 'failed', with the
  // address they typed whole, so they can see a mistake in it (Email it again, or take it back and the stamp comes back).
  const trouble = isHolidayCard && status === 'email_waiting' ? emailTrouble(mail, now) : null;
  return {
    id: mail.id,
    kind: isHolidayCard ? 'card' : 'letter',
    subject: isHolidayCard ? SUBJECT : (mail.subject || mail.display_title || 'A letter'),
    sent_at: instant(mail.created_at),
    to_name: toName || null,
    to_household: Boolean(toHousehold),
    by_email: byEmail,
    ...(card.by_link ? { by_link: true } : {}),
    ...(trouble ? { email_status: trouble, email_to: mail.escrow_recipient_contact || null } : {}),
    // Set to go at 7 a.m. or on Christmas morning, by the sender's clock: when. Older apps read it as waiting for them.
    ...(isHolidayCard && status === 'email_waiting' && emailSendAt(mail) ? { email_send_at: emailSendAt(mail) } : {}),
    arrival: card.arrival || null,
    status,
    arrives_at: byEmail ? null : instant(mail.delivered_at),
    arrives_on: byEmail ? null : card.arrives_on || dayIn(mail.delivered_at, zone),
    opens_on: dayIn(card.sealed_until, zone),
    sealed: isSealed(mail, now),
    // The same rule as take-back: to a person until the pickup, by email until they open it.
    can_take_back: isHolidayCard && (status === 'waiting' || status === 'email_waiting'),
    take_back_until: byEmail || !isHolidayCard ? null : instant(pickupAt(mail)),
    // The envelope as it reaches them: postmarked once the carrier has it (by email, the day it was sent).
    envelope: { from: senderName, postmarked_on: status === 'waiting' ? null : dayIn(mail.created_at, zone) },
    card: { design: view.design || null, number: view.number ?? null, caption: view.caption || null, paper: view.paper || null,
      year: view.year || null, height: view.height ?? null, slug: view.slug || null, table: view.table || null,
      mood: view.mood || null,
      // The whole verse on a Christmas with Jesus Christ picture ("Read the verse"), not while it's sealed (cardView).
      verse: view.verse || null },
    // A reply they wrote (card_replies): the card it answers, and its own take-back, which goes through
    // POST /cards/:card_id/reply/take-back (the piece stays a letter, with can_take_back false, for builds that don't know
    // replies).
    ...(isReply(mail) ? { card_reply: { ...replyOnSent(mail), can_take_back: status === 'waiting',
      take_back_until: status === 'waiting' ? instant(pickupAt(mail)) : null } } : {}),
    // A card that travels (card_travel; services/cardTravel sentViews): its journey, and from this card on its towns,
    // miles and newest town ("5 towns · 2,692 miles. Now in Tampa, FL.").
    ...(travel ? { travel } : {}),
  };
}

/** A reply's card on its writer's Sent: replyView without the signature (Sent's detail reads it from the stored copy). */
function replyOnSent(mail) {
  const { signature: _signature, ...view } = replyView(mail);
  return view;
}

/**
 * A sent card's trail, in order: [{ step, at | on, done }], `at` an instant (shown by the sender's clock), `on` a day by
 * the recipient's (`zone`, as in sentPiece). A step not reached yet is not done. To a person: sealed → delivered, then
 * opens for a sealed card; a Christmas-morning card: sealed → picked_up → delivered. By email: sealed → emailed →
 * joined (at the claim) or returned (on the day its 90 days ended). By link, the same steps, each marked `by_link`.
 */
function sentTrail(mail, { zone, now = new Date() }) {
  if (notDeliveredOf(mail)) {
    return [{ step: 'sealed', at: instant(mail.created_at), done: true }, { step: 'not_delivered', done: true }];
  }
  const card = mail.mail_extracted?.card || {};
  const reached = (at) => Boolean(at) && Date.parse(at) <= now.getTime();
  const trail = [{ step: 'sealed', at: instant(mail.created_at), done: true }];
  if (mail.escrow_status) {
    // A link is "ready" as it's sealed. An email is done once the mail server took it (older cards: as they were sent).
    const email = card.by_link ? null : card.email;
    trail.push(email && email.state !== 'sent'
      ? { step: 'emailed', at: null, done: false }
      : { step: 'emailed', at: instant(email?.sent_at || mail.created_at), done: true });
    const status = sentStatus(mail, now);
    if (status === 'claimed') trail.push({ step: 'joined', at: instant(mail.delivered_at), done: true });
    else if (status === 'expired') trail.push({ step: 'returned', on: dayIn(mail.escrow_expires_at, zone), done: true });
    else trail.push({ step: 'joined', at: null, done: false });
    return card.by_link ? trail.map((step) => ({ ...step, by_link: true })) : trail;
  }
  if (card.arrival === 'christmas_morning') {
    trail.push({ step: 'picked_up', on: dayIn(pickupAt(mail), zone), done: reached(pickupAt(mail)) });
  }
  trail.push({ step: 'delivered', on: card.arrives_on || dayIn(mail.delivered_at, zone), done: reached(mail.delivered_at) });
  if (card.arrival === 'sealed_christmas' && card.sealed_until) {
    trail.push({ step: 'opens', on: dayIn(card.sealed_until, zone), done: reached(card.sealed_until) });
  }
  return trail;
}

/**
 * The Mailbox's Sent line (GET /api/mailbox/v2/drawers `sent`): whether the person has sent a letter or card (not taken back),
 * and how many letters or cards to a person still wait for the 7 a.m. pickup (the mailbox's flag is up while any do), of
 * them `waiting_letters` letters, so the flag says what waits.
 */
async function sentLine(userId, now = new Date()) {
  const [any, coming] = await Promise.all([
    sentCards(userId, 'id').limit(1),
    sentCards(userId, 'id, delivered_at, escrow_status, mail_extracted').is('escrow_status', null)
      .gt('delivered_at', now.toISOString()),
  ]);
  if (any.error || coming.error) throw new Error((any.error || coming.error).message);
  const waiting = (coming.data || []).filter((mail) => sentStatus(mail, now) === 'waiting');
  return {
    any: Boolean(any.data?.length),
    waiting: waiting.length,
    waiting_letters: waiting.filter((mail) => !isCard(mail)).length,
  };
}

module.exports = {
  REPLY_TAG, REPLY_SUBJECT, isReply, replyRowId, replyDigest, replyView, uuidOf,
  CARD_TAG, MESSAGE_LIMIT, SUBJECT, SEALED_NOTE, SEASON, COLLECTIONS, OPENING, DESIGNS, pickACardDesign, PERSON_ARRIVALS, EMAIL_ARRIVALS,
  EMAIL_ARRIVALS_ALL, PERSON_ARRIVALS_ALL, TO_NAME_LIMIT, cleanToName,
  PHOTO_CARD, isPhotoCardDesign, photoCardControls, photoCardShape, cleanFront, frontOf, designOf, joinedFor,
  SIGNATURE_BOX, SIGNATURE_MAX_BYTES, cleanSignature, signatureOf, mediaOf, mediaView,
  designById, isCard, isByLink, cardLinkToken, cardEmailToken, EMAIL_TRIES, emailTrouble, emailPicture, emailWent, emailSendAt, requestRowId, requestDigest, isSealed, sealedView, christmasMorning, seasonOpen, dayStart,
  daysBetween, arrivalsFor,
  personDelivery, emailDelivery, cardView, pickupAt, sentSummary, sentCards, notDeliveredOf, sentStatus, sentPiece, sentTrail, sentLine,
};
